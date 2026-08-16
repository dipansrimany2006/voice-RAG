"""On macOS, faiss-cpu and torch (used by sentence-transformers for
embeddings) each bundle their own OpenMP runtime. Loading both in the same
process segfaults (SIGSEGV) the moment a FAISS search runs right after a
torch forward pass — which is exactly the embed-then-search sequence every
retrieval does. These must be set before either library is imported
anywhere, so they're set here, at package-import time, before any submodule
(which might import faiss/torch) gets a chance to load.
"""

import os

os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
os.environ.setdefault("OMP_NUM_THREADS", "1")
