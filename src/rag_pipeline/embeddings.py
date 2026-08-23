"""Local embeddings via ONNX Runtime — multilingual-e5-small, quantized to
int8 (~113MB on disk). Cloudflare Workers AI was tried first to dodge torch's
memory footprint, but a network round-trip per query (~200-600ms observed)
made the 200ms retrieval budget unreachable. ONNX Runtime avoids torch's
overhead too (no CUDA-adjacent bloat even on the CPU wheel) while running
in-process — verified in isolation at ~2ms/query on this machine, and the
whole point of switching back to local: no network hop at all.

e5 models require a "query: " / "passage: " prefix on every input (baked
into the training objective, not optional) and mean-pool + L2-normalize the
raw token embeddings rather than using a pooler head — see
https://huggingface.co/intfloat/multilingual-e5-small for the reference
implementation this mirrors.
"""

import os

import numpy as np
import onnxruntime as ort
from langchain_core.embeddings import Embeddings
from tokenizers import Tokenizer

from .config import Settings

_MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "models", "multilingual-e5-small")

# Every item in a batch gets padded (and, per-token, matrix-multiplied) up to
# the batch's own max sequence length, so one giant batch over the whole
# corpus at index-build time isn't just slow — it's a single ~(n_items x
# max_seq_len x hidden_dim) tensor, which for tens of thousands of chunks
# means tens of gigabytes. Batching bounds that regardless of corpus size.
BATCH_SIZE = 32


def _mean_pool_normalize(last_hidden_state: np.ndarray, attention_mask: np.ndarray) -> np.ndarray:
    mask = attention_mask[..., None].astype(np.float32)
    pooled = (last_hidden_state * mask).sum(axis=1) / mask.sum(axis=1)
    return pooled / np.linalg.norm(pooled, axis=1, keepdims=True)


class LocalEmbeddings(Embeddings):
    def __init__(self, settings: Settings):
        model_path = os.path.join(_MODEL_DIR, "model_quantized.onnx")
        tokenizer_path = os.path.join(_MODEL_DIR, "tokenizer.json")

        # Single-threaded for the same reason as the old FAISS/torch thread
        # caps: this app embeds one query at a time, so a multi-threaded
        # intraop pool only adds thread-wake-up overhead, not real
        # parallelism, on the hot path.
        session_options = ort.SessionOptions()
        session_options.intra_op_num_threads = 1
        session_options.inter_op_num_threads = 1
        self._session = ort.InferenceSession(model_path, sess_options=session_options)

        # Dynamic INT8 quantization keeps the weights small on disk, but
        # activations are still computed in float32, so the arena grows to
        # roughly fp32-model-sized buffers on the first real Run() call
        # (observed: ~350MB after load, ~600MB after one inference) and
        # normally keeps that reserved forever. This app does one query at a
        # time with idle gaps between them (unlike a throughput workload),
        # so shrinking the arena back down after every run trades a little
        # CPU for a lot of steady-state memory headroom.
        self._run_options = ort.RunOptions()
        self._run_options.add_run_config_entry("memory.enable_memory_arena_shrinkage", "cpu:0")

        self._tokenizer = Tokenizer.from_file(tokenizer_path)
        self._tokenizer.enable_truncation(max_length=512)

    def _embed(self, texts: list[str]) -> list[list[float]]:
        self._tokenizer.enable_padding()
        encodings = self._tokenizer.encode_batch(texts)
        input_ids = np.array([e.ids for e in encodings], dtype=np.int64)
        attention_mask = np.array([e.attention_mask for e in encodings], dtype=np.int64)
        token_type_ids = np.zeros_like(input_ids)

        (last_hidden_state,) = self._session.run(
            None,
            {"input_ids": input_ids, "attention_mask": attention_mask, "token_type_ids": token_type_ids},
            self._run_options,
        )
        return _mean_pool_normalize(last_hidden_state, attention_mask).tolist()

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        prefixed = [f"passage: {t}" for t in texts]
        vectors: list[list[float]] = []
        for i in range(0, len(prefixed), BATCH_SIZE):
            vectors.extend(self._embed(prefixed[i : i + BATCH_SIZE]))
        return vectors

    def embed_query(self, text: str) -> list[float]:
        return self._embed([f"query: {text}"])[0]


def build_embeddings(settings: Settings) -> LocalEmbeddings:
    embeddings = LocalEmbeddings(settings)
    embeddings.embed_query("warm up")  # pay any one-time init cost now, not on the first real request
    return embeddings
