---
title: Voice RAG
emoji: 🎙️
colorFrom: yellow
colorTo: red
sdk: docker
app_port: 7860
pinned: false
---

# Voice-Enabled RAG Pipeline

Voice in → ElevenLabs STT → guardrail → chunked/embedded hybrid retrieval (FAISS dense + BM25 sparse, fused via RRF) → an instant extractive answer (no LLM) → ElevenLabs TTS → voice out. A Groq LLM-polished answer is generated separately, off the response-latency critical path, mirroring the on-demand TTS pattern. Orchestrated as a LangGraph state machine.

Built for the HH Goa 2026 Task 2 spec, on the [ai4bharat/MSMARCO-XI](https://huggingface.co/datasets/ai4bharat/MSMARCO-XI) dataset — **all 14 languages** (Assamese, Bengali, Gujarati, Hindi, Kannada, Malayalam, Marathi, Nepali, Odia, Punjabi, Sanskrit, Tamil, Telugu, Urdu) indexed into one multilingual corpus per chunking strategy.

### A dataset quirk worth knowing about

MSMARCO-XI isn't exposed as separate HF "configs" per language — it's sharded as individual parquet files (`validation/hinval.parquet`, `validation/tamval.parquet`, etc). Streaming these through the `datasets` library also hits a pyarrow bug on this schema's nested `passages` column (`ArrowNotImplementedError: Nested data conversions not implemented for chunked array outputs`), so `data_loader.py` bypasses `datasets` entirely: it downloads each language's shard via `huggingface_hub` and reads it with `pyarrow.parquet.read_table` in one shot, which takes a different (working) code path than the chunked streaming reader.

We use the `validation` split rather than `train`: train shards are ~3.7GB each (~50GB for all 13 languages that have one — Telugu has *no* train shard at all, only validation), vs. ~460MB per language in validation, which is practical to fully download and still has 90k+ rows per language.

## Stack

| Layer | Choice |
|---|---|
| STT / TTS | ElevenLabs (Scribe / Flash) |
| Chunking | LangChain splitters — 3 strategies (see below) |
| Embeddings | Local `intfloat/multilingual-e5-small` (sentence-transformers) — no network call in the retrieval hot path |
| Vector DB | FAISS (dense) + BM25 via `bm25s` (sparse), fused with Reciprocal Rank Fusion — local/in-memory, no network round-trip |
| Fast answer | Extractive — best-matching sentence(s) pulled straight from the top chunk, no LLM call |
| Generation | Groq (`llama-3.3-70b-versatile`), fetched separately via `/api/query/polish` |
| Harness | LangGraph — structured state, conditional routing, retries, error recovery |

## Chunking strategies

Implemented in `src/rag_pipeline/chunking.py`, each on the same source corpus so they're comparable:

1. **`fixed_overlap`** — fixed-size character windows (500 chars, 50 overlap), sentence-boundary-aware separators covering the corpus's scripts (Devanagari `। `, Arabic/Urdu `۔ `, Latin `. `). The baseline.
2. **`semantic`** — `SemanticChunker` splits at points where consecutive sentence embeddings diverge most, instead of an arbitrary character count.
3. **`metadata_aware`** — same windowing as the baseline, but every chunk carries `query_id`, `language`, and MSMARCO's own `is_selected` relevance label as metadata, usable to filter/boost at retrieval time.

`scripts/build_index.py` builds one FAISS index per strategy, each spanning **all 14 languages combined** — the multilingual embedding model shares a representation space across languages, so a query in any of the 14 retrieves correctly from the same index without per-language routing. You can restrict to a subset with `--languages Hindi Tamil Bengali` if you want a smaller/faster index for testing.

## Harness

`src/rag_pipeline/harness.py` — a LangGraph graph, not a raw prompt-in/text-out call:

```
input_guardrail --(unsafe/empty)--> END
       |
   retrieve  (embed_query, vector_search — timed separately)
       |
retrieval_guardrail --(low similarity)--> END
       |
    generate  (Groq call, retried on failure)
       |
grounding_guardrail --(ungrounded)--> END
       |
      END
```

Each node reads/writes a typed `PipelineState`. The Groq call is wrapped in `retry.py` (2 attempts, backoff). STT/TTS calls in `voice.py` are retried the same way.

## Guardrails (`src/rag_pipeline/guardrails.py`)

1. **Input guardrail** — rejects empty input and a pattern list of unsafe queries, before spending any retrieval budget.
2. **Retrieval guardrail** — if the top retrieval similarity is below `MIN_RETRIEVAL_SCORE` (default 0.55), the query is treated as off-topic and refused rather than answered from a weak match.
3. **Grounding guardrail** — after generation, a lexical-overlap check between the answer and the retrieved chunks catches answers that drifted from the context (a cheap proxy for hallucination — no extra LLM call, to stay inside the latency budget).

A refused query returns the refusal reason as the answer text instead of a fabricated response.

## Latency

`src/rag_pipeline/latency.py` times every stage per query. `retrieval_ms` (`embed_query` + `vector_search`) is reported separately from `total_ms`, since **the 200ms target applies to chunking + vector DB retrieval, not the LLM generation or voice I/O round-trips** — those are inherently slower network calls and are measured but not held to the 200ms bar.

Run the benchmark:

```bash
python scripts/benchmark_latency.py --strategy fixed_overlap --n 30
```

Outputs P50/P70/P100 for both total and retrieval-only latency to `benchmark_results/latency.json`.

## Setup

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in ELEVENLABS_API_KEY and GROQ_API_KEY
```

## Build the index (offline, once)

```bash
# all 14 languages, 150 passages each (~2100 total) — default
python scripts/build_index.py --limit-per-language 150

# a smaller/faster subset for local testing
python scripts/build_index.py --languages Hindi Tamil Bengali --limit-per-language 100
```

First run downloads each language's ~460MB parquet shard (cached afterward by `huggingface_hub`) plus the ~1GB embedding model.

## Run a query

```bash
# text in, text out
python scripts/run_query.py --text "भारत की राजधानी क्या है?" --strategy fixed_overlap
python scripts/run_query.py --text "தமிழ்நாட்டின் தலைநகரம் என்ன?" --strategy fixed_overlap

# audio in, audio out
python scripts/run_query.py --audio question.mp3 --strategy semantic --speak answer.mp3
```

## Run the full platform (backend + React frontend)

```bash
# terminal 1
uvicorn server.main:app --reload --port 8000

# terminal 2
cd frontend && npm run dev
```

Open the printed frontend URL, pick a chunking strategy, and either tap the mic to record a question in any of the 14 languages or type one — the UI shows the transcript, answer, and a live per-stage latency breakdown.

## Project layout

```
src/rag_pipeline/
  config.py       env-driven settings
  voice.py        ElevenLabs STT/TTS, retried
  retry.py         small retry decorator used by voice.py + harness.py
  data_loader.py   MSMARCO-XI -> flat passage Documents (all 14 languages)
  chunking.py      3 chunking strategies
  embeddings.py    local multilingual embedding model
  vectorstore.py   FAISS build/load
  retrieval.py     timed query-time retrieval
  guardrails.py    input / retrieval / grounding checks (multi-script tokenizer)
  harness.py       LangGraph orchestration
  latency.py       per-stage timing + percentile reporting
  pipeline.py      voice in -> harness -> voice out
server/
  main.py          FastAPI app exposing /api/query/text, /api/query/audio, /api/strategies
frontend/
  src/App.jsx, components/, useRecorder.js, api.js — React + Vite UI (mic recorder, latency bars)
scripts/
  build_index.py       offline indexing, all 3 strategies x 14 languages
  run_query.py          single query, text or audio
  benchmark_latency.py  P50/P70/P100 over a multilingual query batch
```

## Deploy to Hugging Face Spaces (free)

The `Dockerfile` at the repo root builds a single self-contained image: it compiles the React frontend, installs the backend, and bakes a 14-language index (`--limit-per-language 200`, ~15-20 min build) directly into the image so there's no slow first-request cold start and no need to commit the ~1.4GB index to git. HF Spaces' free CPU tier (16GB RAM) is used here specifically because this stack (torch + sentence-transformers + FAISS) needs more than the 512MB most free PaaS tiers give you.

1. Create a new Space at [huggingface.co/new-space](https://huggingface.co/new-space) — **SDK: Docker**, any hardware tier (`cpu-basic` is free).
2. Add this repo as a second git remote and push:
   ```bash
   git remote add space https://huggingface.co/spaces/<your-username>/<space-name>
   git push space main
   ```
3. In the Space's **Settings → Repository secrets**, add:
   - `GROQ_API_KEY` (required)
   - `ELEVENLABS_API_KEY` (required — STT)
   - `SARVAM_API_KEY` (optional — enables Odia/Punjabi TTS; without it those two fall back to edge-tts's closest-script voice)
4. The Space rebuilds automatically on push and gives you a public URL once the build finishes — that's your live link.

To index more than 200 queries/language for a richer demo corpus, edit the `RUN python scripts/build_index.py ...` line in the `Dockerfile` and push again — expect build time to scale roughly linearly with `--limit-per-language`.

## Known constraints worth calling out

- The 200ms target is realistic for retrieval only. End-to-end (with an LLM call and voice I/O) will be well above that — report both numbers, don't hide it.
- `metadata_aware` chunks currently reuse the fixed-window split with richer metadata; if the demo needs metadata-driven *filtering* (not just tagging), extend `retrieval.py` to pass a FAISS metadata filter (e.g. `is_selected=True`) at query time.
