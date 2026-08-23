"""Cloudflare Vectorize-backed dense store, queried over its REST API — no
local index files, no in-process vector search. One Vectorize index per
chunking strategy (index names are `{prefix}-{strategy_name}`, hyphenated
since Vectorize index names reject underscores).

Query results carry a raw cosine similarity (1.0 = identical, unlike FAISS's
L2 distance the code used to convert from), so callers reading `score`
directly should expect that scale.
"""

import json

import httpx
from langchain_core.documents import Document

from .retry import retry

# HTTP API allows up to 5,000 vectors/call; smaller batches keep individual
# request bodies and retries cheap.
UPSERT_BATCH_SIZE = 500


def _index_name(prefix: str, strategy_name: str) -> str:
    return f"{prefix}-{strategy_name.replace('_', '-')}"


class VectorizeStore:
    def __init__(self, account_id: str, api_token: str, index_name: str):
        self._base = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/vectorize/v2/indexes/{index_name}"
        self._client = httpx.Client(headers={"Authorization": f"Bearer {api_token}"}, timeout=30.0)

    @retry(attempts=3, exceptions=(httpx.HTTPError,), backoff_s=2.0)
    def similarity_search_with_score_by_vector(self, query_vector: list[float], k: int = 4) -> list[tuple[Document, float]]:
        response = self._client.post(
            f"{self._base}/query",
            json={"vector": query_vector, "topK": k, "returnMetadata": "all"},
        )
        response.raise_for_status()
        payload = response.json()
        if not payload.get("success"):
            raise RuntimeError(f"Vectorize query failed: {payload.get('errors')}")
        results = []
        for match in payload["result"]["matches"]:
            metadata = dict(match.get("metadata") or {})
            page_content = metadata.pop("page_content", "")
            results.append((Document(page_content=page_content, metadata=metadata), float(match["score"])))
        return results

    @retry(attempts=3, exceptions=(httpx.HTTPError,), backoff_s=2.0)
    def _upsert_batch(self, vectors: list[dict]) -> None:
        body = "\n".join(json.dumps(v) for v in vectors)
        response = self._client.post(
            f"{self._base}/upsert",
            content=body,
            headers={"Content-Type": "application/x-ndjson"},
        )
        if response.status_code >= 400:
            raise RuntimeError(f"Vectorize upsert failed ({response.status_code}): {response.text[:2000]}")
        payload = response.json()
        if not payload.get("success"):
            raise RuntimeError(f"Vectorize upsert failed: {payload.get('errors')}")

    def upsert_documents(self, chunks: list[Document], vectors: list[list[float]], id_prefix: str) -> None:
        records = [
            {
                "id": f"{id_prefix}-{i}",
                "values": vector,
                # Vectorize caps metadata at 10 KiB/vector. Values are
                # truncated defensively — the source corpus has at least one
                # degenerate `query` field that's a ~40KB repeated-token
                # artifact, not real content, so trusting field lengths as
                # given isn't safe.
                "metadata": {
                    k: (v[:500] if isinstance(v, str) else v)
                    for k, v in {"page_content": chunk.page_content, **chunk.metadata}.items()
                },
            }
            for i, (chunk, vector) in enumerate(zip(chunks, vectors))
        ]
        for i in range(0, len(records), UPSERT_BATCH_SIZE):
            self._upsert_batch(records[i : i + UPSERT_BATCH_SIZE])


def build_index(chunks: list[Document], embeddings, strategy_name: str, settings) -> VectorizeStore:
    vectors = embeddings.embed_documents([c.page_content for c in chunks])
    store = VectorizeStore(
        settings.cloudflare_account_id, settings.cloudflare_api_token, _index_name(settings.vectorize_index_prefix, strategy_name)
    )
    store.upsert_documents(chunks, vectors, id_prefix=strategy_name)
    return store


def load_index(embeddings, strategy_name: str, settings) -> VectorizeStore:
    return VectorizeStore(
        settings.cloudflare_account_id, settings.cloudflare_api_token, _index_name(settings.vectorize_index_prefix, strategy_name)
    )
