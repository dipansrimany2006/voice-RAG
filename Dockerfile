# syntax=docker/dockerfile:1

# ---- Stage 1: build the React frontend ----
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: backend + baked-in index ----
FROM python:3.12-slim AS backend

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ src/
COPY server/ server/
COPY scripts/ scripts/
COPY --from=frontend-builder /app/frontend/dist/ frontend/dist/

# FAISS + BM25 index (built LOCALLY via `python scripts/build_index.py`) and
# the ONNX embedding model both ship baked into the image — no network
# dependency at build OR query time, which is the whole point after
# Cloudflare Workers AI/Vectorize proved too slow for the retrieval budget
# (see embeddings.py, vectorstore.py). Both are small enough (~180MB
# combined, largest single file 113MB) to commit directly via Git LFS
# instead of fetching from external storage — see .gitattributes. Render's
# own git checkout (which happens before this Dockerfile even runs) resolves
# the LFS pointers, so these are plain COPYs.
COPY data/index/ data/index/
COPY models/ models/

ENV PYTHONPATH=/app/src \
    INDEX_DIR=/app/data/index

EXPOSE 7860

# Shell form so ${PORT} is resolved at container start, not build time —
# Render (and most PaaS hosts) inject PORT and expect the app to bind to
# it, while HF Spaces / local runs have no PORT set and fall back to 7860.
CMD uvicorn server.main:app --host 0.0.0.0 --port ${PORT:-7860}
