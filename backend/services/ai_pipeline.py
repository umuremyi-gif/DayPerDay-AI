"""
AI Processing Pipeline
Implements the full multilingual AI flow:

  1. Receive the original user message
  2. Detect the original language
  3. Preserve the exact original message
  4. Translate to English for internal processing (if needed)
  5. Send English text + context to the AI service
  6. Generate a response
  7. Translate the response back to the user's language
  8. Return the translated response

The pipeline also handles fixed-language mode: if the user has a
preferred language set (not "automatic"), the response is always
translated into that language regardless of input language.
"""
import logging
from typing import Optional
from dataclasses import dataclass, field

from services.ollama_service import generate_response
from services.language_service import detect_language, language_name
from services.translation_service import translate_text, TranslationError

logger = logging.getLogger(__name__)


@dataclass
class PipelineResult:
    """Result of the AI processing pipeline."""
    original_message: str
    detected_language: str
    detection_confidence: float
    english_message: str
    ai_response_english: str
    final_response: str
    response_language: str
    translation_used: bool
    translation_error: Optional[str] = None
    source: str = "ollama"


async def run_ai_pipeline(
    message: str,
    system_prompt: str = "",
    user_preferred_language: str = "automatic",
    fallback_language: str = "en",
    max_response_tokens: int = 500,
) -> PipelineResult:
    """
    Run the full multilingual AI pipeline.

    Args:
        message: The user's original message.
        system_prompt: System prompt for the AI model.
        user_preferred_language: "automatic" to respond in the detected
            language, or a language code like "rw", "en", "fr", "sw"
            to always respond in that language.
        fallback_language: Language to use if detection fails.
        max_response_tokens: Max tokens for AI response.

    Returns:
        PipelineResult with all intermediate and final values.
    """
    # Step 1-2: Detect language
    detected_lang, confidence = await detect_language(message, fallback=fallback_language)

    # Determine response language
    if user_preferred_language and user_preferred_language != "automatic":
        response_lang = user_preferred_language
    else:
        response_lang = detected_lang

    # Step 3-4: Translate to English for processing (if not already English)
    english_message = message
    if detected_lang != "en":
        try:
            english_message = await translate_text(message, detected_lang, "en")
        except TranslationError as e:
            logger.warning(f"Failed to translate input to English: {e}")
            # Continue with original message — the AI may still understand it
            english_message = message

    # Step 5-6: Generate AI response in English
    ai_response = await generate_response(
        english_message,
        system_prompt=system_prompt,
    )

    if ai_response is None:
        return PipelineResult(
            original_message=message,
            detected_language=detected_lang,
            detection_confidence=confidence,
            english_message=english_message,
            ai_response_english="",
            final_response="",
            response_language=response_lang,
            translation_used=False,
            source="fallback",
        )

    ai_response = ai_response.strip()

    # Step 7: Translate response to the user's language
    final_response = ai_response
    translation_used = False
    translation_error: Optional[str] = None

    if response_lang != "en":
        try:
            final_response = await translate_text(
                ai_response, "en", response_lang, preserve_formatting=True
            )
            translation_used = True
        except TranslationError as e:
            translation_error = str(e)
            logger.warning(f"Failed to translate response to {response_lang}: {e}")
            # Keep the English response but note the failure
            # Do NOT silently pretend it's translated — caller can check translation_error

    # Step 8: Return result
    return PipelineResult(
        original_message=message,
        detected_language=detected_lang,
        detection_confidence=confidence,
        english_message=english_message,
        ai_response_english=ai_response,
        final_response=final_response,
        response_language=response_lang,
        translation_used=translation_used,
        translation_error=translation_error,
        source="ollama" if ai_response else "fallback",
    )


def build_translation_notice(result: PipelineResult) -> Optional[str]:
    """
    If translation failed, return a user-facing notice in the response language.
    Returns None if no notice is needed.
    """
    if result.translation_error and result.response_language != "en":
        lang_name = language_name(result.response_language)
        return (
            f"[Translation to {lang_name} was unavailable. Showing response in English.]\n\n"
            + result.final_response
        )
    return None
