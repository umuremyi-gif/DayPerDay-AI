"""
Translation Service
Provides a provider-based translation interface so translation backends
can be swapped without rewriting the application.

Default provider: Ollama (local, no API key required).
Optional provider: DeepL / Google Translate via env vars (requires paid API key).

All provider credentials are read from backend environment variables and
are NEVER exposed to the frontend.
"""
import os
import logging
from typing import Optional
from services.ollama_service import generate_response

logger = logging.getLogger(__name__)

TRANSLATION_PROVIDER = os.getenv("TRANSLATION_PROVIDER", "ollama")
TRANSLATION_TIMEOUT = int(os.getenv("TRANSLATION_TIMEOUT", "30"))
MAX_RETRIES = int(os.getenv("TRANSLATION_RETRIES", "2"))

# Optional external provider keys (kept server-side only)
DEEPL_API_KEY = os.getenv("DEEPL_API_KEY", "")
DEEPL_ENDPOINT = os.getenv("DEEPL_ENDPOINT", "https://api-free.deepl.com/v2/translate")
GOOGLE_API_KEY = os.getenv("GOOGLE_TRANSLATE_API_KEY", "")


class TranslationError(Exception):
    """Raised when translation fails after retries."""
    pass


async def translate_text(
    text: str,
    source_lang: str,
    target_lang: str,
    preserve_formatting: bool = True,
) -> str:
    """
    Translate `text` from source_lang to target_lang.

    If source_lang == target_lang, returns the original text unchanged.

    Args:
        text: The text to translate.
        source_lang: ISO 639-1 code (e.g. 'rw', 'en', 'fr', 'sw').
        target_lang: ISO 639-1 code.
        preserve_formatting: If True, instructs the provider to preserve
            numbers, dates, currency, names, and structure.

    Returns:
        The translated text, or the original text if source == target.

    Raises:
        TranslationError: if all retries fail.
    """
    if not text or not text.strip():
        return text

    if source_lang == target_lang:
        return text

    last_error: Optional[Exception] = None
    for attempt in range(MAX_RETRIES + 1):
        try:
            if TRANSLATION_PROVIDER == "deepl" and DEEPL_API_KEY:
                return await _translate_deepl(text, source_lang, target_lang)
            elif TRANSLATION_PROVIDER == "google" and GOOGLE_API_KEY:
                return await _translate_google(text, source_lang, target_lang)
            else:
                return await _translate_ollama(text, source_lang, target_lang, preserve_formatting)
        except TranslationError:
            raise
        except Exception as e:
            last_error = e
            logger.warning(f"Translation attempt {attempt + 1} failed ({source_lang}->{target_lang}): {e}")
            if attempt < MAX_RETRIES:
                continue

    # All retries exhausted — raise, do NOT silently return untranslated text
    raise TranslationError(
        f"Translation failed after {MAX_RETRIES + 1} attempts ({source_lang}->{target_lang}): {last_error}"
    )


async def _translate_ollama(
    text: str, source_lang: str, target_lang: str, preserve_formatting: bool
) -> str:
    """Use the local Ollama model for translation."""
    from services.language_service import language_name

    src_name = language_name(source_lang)
    tgt_name = language_name(target_lang)

    preserve_note = ""
    if preserve_formatting:
        preserve_note = (
            "IMPORTANT: Do NOT translate or alter numbers, dates, currency amounts, "
            "percentages, names of people or places, or structural formatting. "
            "Translate only the natural language text around them. "
        )

    system = (
        f"You are a professional translator. Translate the user's text from {src_name} "
        f"to {tgt_name}. {preserve_note}"
        "Provide ONLY the translated text, no explanations or introductions. "
        "Use natural, fluent language — not word-for-word translation. "
        "Maintain the original tone and intent."
    )

    response = await generate_response(text, system_prompt=system)
    if response and response.strip():
        return response.strip()

    raise TranslationError(f"Ollama returned empty response for {source_lang}->{target_lang}")


async def _translate_deepl(text: str, source_lang: str, target_lang: str) -> str:
    """DeepL API translation (requires DEEPL_API_KEY env var)."""
    import httpx

    # DeepL uses uppercase codes; map our codes to DeepL's
    deepl_target = target_lang.upper()
    deepl_source = source_lang.upper() if source_lang != "rw" else None  # DeepL may not support rw

    async with httpx.AsyncClient(timeout=TRANSLATION_TIMEOUT) as client:
        params: dict = {
            "auth_key": DEEPL_API_KEY,
            "text": text,
            "target_lang": deepl_target,
        }
        if deepl_source:
            params["source_lang"] = deepl_source

        response = await client.post(DEEPL_ENDPOINT, data=params)
        if response.status_code == 200:
            translations = response.json().get("translations", [])
            if translations:
                return translations[0].get("text", text)
            raise TranslationError("DeepL returned no translations")
        else:
            raise TranslationError(f"DeepL API error: {response.status_code} - {response.text}")


async def _translate_google(text: str, source_lang: str, target_lang: str) -> str:
    """Google Cloud Translation API (requires GOOGLE_TRANSLATE_API_KEY env var)."""
    import httpx

    endpoint = "https://translation.googleapis.com/language/translate/v2"
    async with httpx.AsyncClient(timeout=TRANSLATION_TIMEOUT) as client:
        response = await client.post(
            f"{endpoint}?key={GOOGLE_API_KEY}",
            json={
                "q": text,
                "source": source_lang,
                "target": target_lang,
                "format": "text",
            },
        )
        if response.status_code == 200:
            data = response.json()
            translations = data.get("data", {}).get("translations", [])
            if translations:
                return translations[0].get("translatedText", text)
            raise TranslationError("Google returned no translations")
        else:
            raise TranslationError(f"Google API error: {response.status_code} - {response.text}")
