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
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ src/
COPY server/ server/
COPY scripts/ scripts/
COPY --from=frontend-builder /app/frontend/dist/ frontend/dist/

# Dense vectors live in Cloudflare Vectorize now (see vectorstore.py), not
# local files — only the BM25 sparse index (built LOCALLY via
# `python scripts/build_index.py`, since it's cheap and has no network
# dependency) still needs to ship with the image. It's stored in the same
# public Cloudflare R2 bucket as before, just far smaller now that it's not
# carrying FAISS vectors alongside it.
RUN curl -fsSL "https://pub-80ad0c77d4bb4f58887079c4166236f8.r2.dev/bm25-index.tar" -o bm25-index.tar && \
    tar -xf bm25-index.tar && \
    rm bm25-index.tar

ENV PYTHONPATH=/app/src \
    INDEX_DIR=/app/data/index

EXPOSE 7860

# Shell form so ${PORT} is resolved at container start, not build time —
# Render (and most PaaS hosts) inject PORT and expect the app to bind to
# it, while HF Spaces / local runs have no PORT set and fall back to 7860.
CMD uvicorn server.main:app --host 0.0.0.0 --port ${PORT:-7860}
