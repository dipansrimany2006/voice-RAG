"""STT via ElevenLabs (satisfies task requirement 1), TTS via Microsoft Edge
TTS (edge-tts) — chosen after ElevenLabs TTS turned out to require a paid
plan for any voice on this account (confirmed via logs: a 402
'paid_plan_required' error on both the default library voice and a custom
voice added to the account). edge-tts needs no API key/account and covers
most of the corpus's 14 languages.
"""

import asyncio
import concurrent.futures
import io

import edge_tts
from elevenlabs.client import ElevenLabs

from .config import Settings
from .retry import retry

# (unicode range start, end, candidate edge-tts locale prefixes in priority
# order). Some scripts are shared by multiple languages (Devanagari:
# Hindi/Marathi/Nepali/Sanskrit; Bengali script: Bengali/Assamese) — script
# alone can't disambiguate those, so the first available candidate is used.
# Languages without any Edge neural voice (Assamese, Odia, Sanskrit, Punjabi
# as of writing) fall through to the closest-script or English voice rather
# than producing no audio at all.
SCRIPT_LOCALE_CANDIDATES = [
    (0x0980, 0x09FF, ["bn-IN", "bn-BD"]),  # Bengali script (Bengali, Assamese)
    (0x0A00, 0x0A7F, ["pa-IN"]),  # Gurmukhi (Punjabi)
    (0x0A80, 0x0AFF, ["gu-IN"]),  # Gujarati
    (0x0B00, 0x0B7F, ["or-IN"]),  # Oriya (Odia)
    (0x0B80, 0x0BFF, ["ta-IN", "ta-LK"]),  # Tamil
    (0x0C00, 0x0C7F, ["te-IN"]),  # Telugu
    (0x0C80, 0x0CFF, ["kn-IN"]),  # Kannada
    (0x0D00, 0x0D7F, ["ml-IN"]),  # Malayalam
    (0x0900, 0x097F, ["hi-IN", "mr-IN", "ne-NP", "sa-IN"]),  # Devanagari
    (0x0600, 0x06FF, ["ur-IN", "ur-PK"]),  # Arabic script (Urdu)
]
FALLBACK_LOCALE = "en-US"

_voice_list_cache: list[dict] | None = None


def _run_async(coro):
    """Run an async call from sync code, safely whether or not the calling
    thread already has a running event loop (it does when called from
    inside a FastAPI async request handler)."""
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(asyncio.run, coro).result()


def _detect_locale_candidates(text: str) -> list[str]:
    counts: dict[tuple, int] = {}
    for ch in text:
        cp = ord(ch)
        for lo, hi, candidates in SCRIPT_LOCALE_CANDIDATES:
            if lo <= cp <= hi:
                key = tuple(candidates)
                counts[key] = counts.get(key, 0) + 1
                break
    if not counts:
        return [FALLBACK_LOCALE]
    best = max(counts, key=counts.get)
    return list(best)


async def _get_voice_list() -> list[dict]:
    global _voice_list_cache
    if _voice_list_cache is None:
        _voice_list_cache = await edge_tts.list_voices()
    return _voice_list_cache


async def _resolve_voice(locale_candidates: list[str]) -> str:
    voices = await _get_voice_list()
    for prefix in [*locale_candidates, FALLBACK_LOCALE]:
        match = next((v for v in voices if v["Locale"].startswith(prefix)), None)
        if match:
            return match["ShortName"]
    return voices[0]["ShortName"]  # last resort: any voice at all


async def _speak(text: str, voice_name: str) -> bytes:
    communicate = edge_tts.Communicate(text, voice_name)
    chunks = []
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            chunks.append(chunk["data"])
    return b"".join(chunks)


class VoiceIO:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.client = ElevenLabs(api_key=settings.elevenlabs_api_key)

    @retry(attempts=2, exceptions=(Exception,))
    def transcribe(self, audio_bytes: bytes) -> str:
        """Speech -> text (ElevenLabs Scribe). Raises after retries exhausted; caller decides fallback."""
        result = self.client.speech_to_text.convert(
            file=io.BytesIO(audio_bytes),
            model_id=self.settings.elevenlabs_stt_model,
        )
        text = getattr(result, "text", None)
        if not text or not text.strip():
            raise ValueError("STT returned empty transcript")
        return text.strip()

    @retry(attempts=2, exceptions=(Exception,))
    def synthesize(self, text: str) -> bytes:
        """Text -> speech (mp3 bytes), voice picked from the text's script."""
        candidates = _detect_locale_candidates(text)
        voice_name = _run_async(_resolve_voice(candidates))
        return _run_async(_speak(text, voice_name))
