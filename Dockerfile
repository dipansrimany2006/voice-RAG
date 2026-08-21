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

# CPU-only torch first — plain `pip install torch` on Linux pulls the full
# CUDA build (several GB of NVIDIA libraries) even though this deploys to a
# CPU-only free tier with no GPU to use them. Installing the CPU wheel here
# satisfies sentence-transformers' torch dependency before requirements.txt
# is processed, so pip sees it already satisfied and never fetches CUDA.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ src/
COPY server/ server/
COPY scripts/ scripts/
COPY --from=frontend-builder /app/frontend/dist/ frontend/dist/

# The index is built LOCALLY (outside Docker) and copied in as static
# files, not built during the image build. Building it inside Docker (14
# sequential HF Hub downloads, then chunking/embedding/indexing) was
# repeatedly hanging indefinitely under Docker Desktop's virtualized
# networking — every local, non-Docker run of the same script completed
# reliably. Copying a pre-built index sidesteps that networking layer
# entirely: this step is just a fast local file copy, no network calls,
# not the fragile part. Run `python scripts/build_index.py` locally
# whenever you want to refresh data/index/ before rebuilding the image.
COPY data/index/ data/index/

ENV PYTHONPATH=/app/src \
    HF_HOME=/app/.cache/huggingface \
    INDEX_DIR=/app/data/index \
    HF_HUB_DOWNLOAD_TIMEOUT=30 \
    HF_HUB_DISABLE_XET=1

# Pre-fetch the embedding model so the server's first request doesn't pay
# a slow/flaky download at runtime — it's needed to embed live queries
# even though the index itself is no longer built here.
RUN python3 -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('intfloat/multilingual-e5-small')"

EXPOSE 7860

# Shell form so ${PORT} is resolved at container start, not build time —
# Render (and most PaaS hosts) inject PORT and expect the app to bind to
# it, while HF Spaces / local runs have no PORT set and fall back to 7860.
CMD uvicorn server.main:app --host 0.0.0.0 --port ${PORT:-7860}
CMD ["uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "7860"]
