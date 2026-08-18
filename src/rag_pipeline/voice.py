"""STT via ElevenLabs (satisfies task requirement 1). TTS uses Sarvam AI
(bulbul) as the primary voice for every language it supports — verified
against Sarvam's docs: bn/gu/hi/kn/ml/mr/od/pa/ta/te-IN (10 of the corpus's
14 languages; Marathi rides on the Hindi Devanagari voice since Sarvam has
no way to pick a voice from script alone, same limitation every provider
here has). edge-tts (Microsoft, no API key) is the fallback: it's the
ONLY provider for Urdu (Sarvam doesn't support it at all), and a safety
net if a Sarvam call fails at runtime.

Assamese and Sanskrit have no dedicated voice in either provider (or in
mainstream free TTS generally) — they fall through to the closest-script
voice (Bengali and Hindi respectively) rather than producing no audio.

(ElevenLabs TTS was tried first but every voice ID on this account —
including a custom one added specifically to fix this — returned
402 'paid_plan_required', confirmed via logs, so it's STT-only here.)
"""

import asyncio
import base64
import concurrent.futures
import io

import edge_tts
import httpx
from elevenlabs.client import ElevenLabs

from .config import Settings
from .retry import retry

# (unicode range start, end, language key, candidate edge-tts locale
# prefixes in priority order). Some scripts are shared by multiple
# languages (Devanagari: Hindi/Marathi/Nepali/Sanskrit; Bengali script:
# Bengali/Assamese) — script alone can't disambiguate those, so the first
# available candidate is used.
SCRIPT_TABLE = [
    (0x0980, 0x09FF, "Bengali", ["bn-IN", "bn-BD"]),  # also covers Assamese (no dedicated voice)
    (0x0A00, 0x0A7F, "Punjabi", ["pa-IN"]),  # Gurmukhi
    (0x0A80, 0x0AFF, "Gujarati", ["gu-IN"]),
    (0x0B00, 0x0B7F, "Odia", ["or-IN"]),  # Oriya
    (0x0B80, 0x0BFF, "Tamil", ["ta-IN", "ta-LK"]),
    (0x0C00, 0x0C7F, "Telugu", ["te-IN"]),
    (0x0C80, 0x0CFF, "Kannada", ["kn-IN"]),
    (0x0D00, 0x0D7F, "Malayalam", ["ml-IN"]),
    (0x0900, 0x097F, "Hindi", ["hi-IN", "mr-IN", "ne-NP", "sa-IN"]),  # Devanagari, also covers Marathi/Nepali/Sanskrit
    (0x0600, 0x06FF, "Urdu", ["ur-IN", "ur-PK"]),  # Arabic script
]
FALLBACK_LOCALE = "en-US"

SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech"
SARVAM_LANGUAGE_CODES = {
    # Every script-group Sarvam actually supports. Urdu is deliberately
    # absent — Sarvam has no Urdu voice at all, so that group stays on
    # edge-tts unconditionally (see synthesize()).
    "Bengali": "bn-IN",  # also carries Assamese (no dedicated voice anywhere)
    "Punjabi": "pa-IN",
    "Gujarati": "gu-IN",
    "Odia": "od-IN",
    "Tamil": "ta-IN",
    "Telugu": "te-IN",
    "Kannada": "kn-IN",
    "Malayalam": "ml-IN",
    "Hindi": "hi-IN",  # also carries Marathi/Nepali/Sanskrit (script can't disambiguate)
}

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


def _detect_language(text: str) -> tuple[str | None, list[str]]:
    """Returns (language_key, edge_tts_locale_candidates) based on the
    dominant Unicode script in the text. language_key is None if the text
    doesn't match any known script (falls back to English)."""
    counts: dict[str, int] = {}
    candidates_by_key: dict[str, list[str]] = {}
    for ch in text:
        cp = ord(ch)
        for lo, hi, key, candidates in SCRIPT_TABLE:
            if lo <= cp <= hi:
                counts[key] = counts.get(key, 0) + 1
                candidates_by_key[key] = candidates
                break
    if not counts:
        return None, [FALLBACK_LOCALE]
    best_key = max(counts, key=counts.get)
    return best_key, candidates_by_key[best_key]


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


async def _speak_edge(text: str, voice_name: str) -> bytes:
    communicate = edge_tts.Communicate(text, voice_name)
    chunks = []
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            chunks.append(chunk["data"])
    return b"".join(chunks)


def _speak_sarvam(text: str, language_code: str, api_key: str) -> bytes:
    response = httpx.post(
        SARVAM_TTS_URL,
        headers={"api-subscription-key": api_key},
        json={
            "text": text,
            "language_code": language_code,
            "model": "bulbul:v2",
            "speaker": "anushka",
            "output_audio_codec": "mp3",
        },
        timeout=30.0,
    )
    response.raise_for_status()
    audio_b64 = response.json()["audios"][0]
    return base64.b64decode(audio_b64)


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

    def synthesize(self, text: str) -> bytes:
        """Text -> speech (bytes), routed to whichever provider actually
        has a native voice for the text's language."""
        language_key, edge_candidates = _detect_language(text)

        if language_key in SARVAM_LANGUAGE_CODES and self.settings.sarvam_api_key:
            try:
                return self._sarvam_with_retry(text, SARVAM_LANGUAGE_CODES[language_key])
            except Exception:  # noqa: BLE001 - fall through to edge-tts rather than fail the whole answer
                pass

        return self._edge_with_retry(text, edge_candidates)

    @retry(attempts=2, exceptions=(Exception,))
    def _sarvam_with_retry(self, text: str, language_code: str) -> bytes:
        return _speak_sarvam(text, language_code, self.settings.sarvam_api_key)

    @retry(attempts=2, exceptions=(Exception,))
    def _edge_with_retry(self, text: str, locale_candidates: list[str]) -> bytes:
        voice_name = _run_async(_resolve_voice(locale_candidates))
        return _run_async(_speak_edge(text, voice_name))
