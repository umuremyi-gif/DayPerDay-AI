
"""
Language Detection Service
Detects Kinyarwanda, English, French, Kiswahili, and other languages.
"""
import logging
import re
from typing import Optional

from services.ollama_service import generate_response

logger = logging.getLogger(__name__)

SUPPORTED_LANGUAGES = {
    "en": "English",
    "rw": "Kinyarwanda",
    "fr": "French",
    "sw": "Kiswahili",
    "es": "Spanish",
    "de": "German",
    "ar": "Arabic",
    "zh": "Chinese",
    "pt": "Portuguese",
    "hi": "Hindi",
}

# Use distinctive words and phrases, not very common fragments.
SCRIPT_HINTS = {
    "rw": [
        "muraho", "murakoze", "amakuru", "umunsi", "umuntu",
        "umuryango", "amafaranga", "ibyifuzo", "gusoma",
        "kwiga", "nize", "nakoze", "ndashaka", "nkeneye",
        "ndifuza", "turashaka", "urakoze", "ni gute",
        "bimeze bite", "sinzi", "ntabwo", "ariko", "cyane",
        "ejo", "uyu munsi", "igihe", "umushinga",
        "intego", "akazi", "yego", "oya", "neza",
    ],
    "sw": [
        "habari", "asante", "karibu", "tafadhali",
        "ninataka", "ninaomba", "maisha", "familia",
        "pesa", "kujifunza", "habari yako",
    ],
    "fr": [
        "bonjour", "merci", "s'il vous plaît", "aujourd'hui",
        "je voudrais", "j'ai besoin", "famille", "argent",
        "travailler", "apprendre", "comment allez-vous",
    ],
    "en": [
        "hello", "thank you", "please", "today",
        "i need", "i want", "how are you", "my family",
        "my money", "i learned", "i worked",
    ],
}


def _heuristic_detect(text: str) -> Optional[tuple[str, float]]:
    """Detect languages using distinctive words and phrases."""
    if not text or len(text.strip()) < 2:
        return None

    lower = text.lower()
    scores: dict[str, int] = {}

    for lang, phrases in SCRIPT_HINTS.items():
        score = 0

        for phrase in phrases:
            # Match whole words/phrases to reduce accidental matches.
            pattern = r"(?<!\w)" + re.escape(phrase) + r"(?!\w)"
            if re.search(pattern, lower):
                score += 1

        if score:
            scores[lang] = score

    if not scores:
        return None

    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    best_lang, best_score = ranked[0]
    second_score = ranked[1][1] if len(ranked) > 1 else 0

    # Avoid a confident guess when two languages score equally.
    if best_score == second_score:
        return None

    confidence = min(
        0.98,
        0.65 + 0.10 * (best_score - second_score)
        + 0.03 * min(best_score - 1, 5),
    )

    return best_lang, confidence


def _match_language_name(name: str) -> Optional[str]:
    """Match a model response to a supported language code."""
    cleaned = name.strip().lower().strip(" .,:;\"'`")

    # Accept a language code when the model returns one.
    if cleaned in SUPPORTED_LANGUAGES:
        return cleaned

    for code, lang_name in SUPPORTED_LANGUAGES.items():
        if cleaned == lang_name.lower():
            return code

    # Handle responses such as 'The language is Kinyarwanda'.
    for code, lang_name in SUPPORTED_LANGUAGES.items():
        if re.search(
            r"(?<!\w)" + re.escape(lang_name.lower()) + r"(?!\w)",
            cleaned,
        ):
            return code

    return None


async def detect_language(
    text: str, fallback: str = "en"
) -> tuple[str, float]:
    """
    Return (language_code, confidence).
    Prefer distinctive language clues; use Ollama when ambiguous.
    """
    if not text or not text.strip():
        return fallback, 0.0

    heuristic = _heuristic_detect(text)

    # Strong keyword evidence is more reliable than a vague model guess.
    if heuristic and heuristic[1] >= 0.65:
        return heuristic

    prompt = (
        "Identify the primary language of the user's text. "
        "Return ONLY one code from this list: "
        "en, rw, fr, sw, es, de, ar, zh, pt, hi.\n"
        "rw means Kinyarwanda, the language of Rwanda. "
        "Do not classify Kinyarwanda as English. "
        "Judge the language of the text itself, not the language "
        "used in these instructions.\n"
        f"Text: {text[:500]}\n"
        "Language code:"
    )

    try:
        response = await generate_response(
            prompt,
            system_prompt=(
                "You are a precise language classifier. "
                "Return exactly one supported two-letter language code. "
                "For Kinyarwanda, return rw. Do not translate the text."
            ),
        )

        if response:
            detected = _match_language_name(response)
            if detected:
                return detected, 0.85 if detected != "en" else 0.75

    except Exception:
        logger.exception("Language detection via Ollama failed")

    if heuristic:
        return heuristic

    return fallback, 0.3


def language_name(code: str) -> str:
    """Return the human-readable name for a language code."""
    return SUPPORTED_LANGUAGES.get(code, "Unknown")
