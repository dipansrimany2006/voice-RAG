import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


def _require(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


@dataclass(frozen=True)
class Settings:
    elevenlabs_api_key: str
    groq_api_key: str
    groq_model: str
    elevenlabs_stt_model: str
    embedding_model: str
    index_dir: str
    min_retrieval_score: float


def load_settings() -> Settings:
    return Settings(
        elevenlabs_api_key=_require("ELEVENLABS_API_KEY"),
        groq_api_key=_require("GROQ_API_KEY"),
        groq_model=os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b"),
        elevenlabs_stt_model=os.environ.get("ELEVENLABS_STT_MODEL", "scribe_v1"),
        embedding_model=os.environ.get("EMBEDDING_MODEL", "intfloat/multilingual-e5-base"),
        index_dir=os.environ.get("INDEX_DIR", "data/index"),
        min_retrieval_score=float(os.environ.get("MIN_RETRIEVAL_SCORE", "0.55")),
    )
