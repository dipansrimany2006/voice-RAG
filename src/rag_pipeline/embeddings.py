"""Embeddings via Cloudflare Workers AI (bge-m3, multilingual) instead of a
local sentence-transformers/torch model — torch alone pushed the deploy
target's 512MB memory budget over the edge before the index was even
touched. This trades a network round-trip per query for that memory
headroom; retrieval.py used to specifically avoid this trade, so it's a
deliberate regression against the 200ms retrieval budget, not an oversight.
"""

import httpx
from langchain_core.embeddings import Embeddings

from .config import Settings
from .retry import retry

# A flat per-batch character budget isn't safe either: the model pads every
# item in a batch to the longest item's token length, so a batch's real cost
# is item_count * longest_item_tokens, not the sum of each item's own length
# — confirmed empirically (297 items, 89,816 chars total, but one ~19K-char
# outlier chunk in the mix inflated the request to 511,731 "tokens" against
# the model's 60,000 cap, i.e. ~297 * ~1,723). Batching texts in length-sorted
# order (see embed_documents) keeps same-length items together so padding
# waste stays low; CHAR_PRODUCT_BUDGET bounds item_count * batch_max_char_len
# (chars, not tokens — no local tokenizer available, so this uses the
# ~1.8-2 chars/token ratio observed across this corpus's scripts, with a
# safety margin below the real 60,000-token cap).
CHAR_PRODUCT_BUDGET = 45_000
MAX_ITEMS_PER_BATCH = 500


class WorkersAIEmbeddings(Embeddings):
    def __init__(self, settings: Settings):
        self._url = (
            f"https://api.cloudflare.com/client/v4/accounts/{settings.cloudflare_account_id}"
            f"/ai/run/{settings.embedding_model}"
        )
        self._client = httpx.Client(
            headers={"Authorization": f"Bearer {settings.cloudflare_api_token}"},
            timeout=60.0,
        )

    @retry(attempts=3, exceptions=(httpx.HTTPError,), backoff_s=2.0)
    def _embed_batch(self, texts: list[str]) -> list[list[float]]:
        response = self._client.post(self._url, json={"text": texts})
        if response.status_code >= 400:
            raise RuntimeError(f"Workers AI embedding request failed ({response.status_code}): {response.text[:2000]}")
        payload = response.json()
        if not payload.get("success"):
            raise RuntimeError(f"Workers AI embedding request failed: {payload.get('errors')}")
        return payload["result"]["data"]

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        # Sorted by length so each batch's max-length item (the one every
        # other item in that batch gets padded to) stays close to every
        # other item's real length — batching in original order risks
        # pairing a handful of short chunks with one long outlier and
        # padding all of them up to it. Results are scattered back to the
        # caller's original order at the end.
        order = sorted(range(len(texts)), key=lambda i: len(texts[i]))
        vectors_by_index: dict[int, list[float]] = {}

        batch_indices: list[int] = []
        batch_max_len = 0
        for i in order:
            text_len = len(texts[i])
            projected_max = max(batch_max_len, text_len)
            if batch_indices and (len(batch_indices) + 1) * projected_max > CHAR_PRODUCT_BUDGET:
                self._embed_and_store(texts, batch_indices, vectors_by_index)
                batch_indices, batch_max_len = [], 0
            batch_indices.append(i)
            batch_max_len = max(batch_max_len, text_len)
            if len(batch_indices) >= MAX_ITEMS_PER_BATCH:
                self._embed_and_store(texts, batch_indices, vectors_by_index)
                batch_indices, batch_max_len = [], 0
        if batch_indices:
            self._embed_and_store(texts, batch_indices, vectors_by_index)

        return [vectors_by_index[i] for i in range(len(texts))]

    def _embed_and_store(self, texts: list[str], indices: list[int], out: dict[int, list[float]]) -> None:
        vectors = self._embed_batch([texts[i] for i in indices])
        for i, vector in zip(indices, vectors):
            out[i] = vector

    def embed_query(self, text: str) -> list[float]:
        return self._embed_batch([text])[0]


def build_embeddings(settings: Settings) -> WorkersAIEmbeddings:
    embeddings = WorkersAIEmbeddings(settings)
    embeddings.embed_query("warm up")  # surface auth/network failures at startup, not on the first real request
    return embeddings
