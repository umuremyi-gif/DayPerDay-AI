"""
Tests for the multilingual AI pipeline.

Run with: cd backend && python -m pytest test_translation.py -v

These tests mock the Ollama service so they run without a live Ollama instance.
They cover:
  - Language detection (Kinyarwanda, English, French, Kiswahili, mixed)
  - Translation pipeline (input → English → AI → response language)
  - Fixed-language mode
  - Translation failure handling
  - Preservation of numbers, dates, currencies
  - Conversation history context
"""
import asyncio
from unittest.mock import AsyncMock, patch
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from services.language_service import detect_language, _heuristic_detect, language_name
from services.translation_service import translate_text, TranslationError
from services.ai_pipeline import run_ai_pipeline, build_translation_notice


MOCK_LOCATIONS = [
    "services.ollama_service.generate_response",
    "services.translation_service.generate_response",
    "services.language_service.generate_response",
    "services.ai_pipeline.generate_response",
]


def patch_all_gen(**kwargs):
    """Patch generate_response in every module that imports it, sharing one mock."""
    from unittest.mock import patch
    mock = AsyncMock(**kwargs)
    return [patch(loc, mock) for loc in MOCK_LOCATIONS], mock


# ==================== LANGUAGE DETECTION TESTS ====================

def test_heuristic_kinyarwanda():
    """Kinyarwanda keywords are detected correctly."""
    result = _heuristic_detect("Murakoze cyane, nagize umunsi mwiza")
    assert result is not None
    assert result[0] == "rw"
    assert result[1] >= 0.6


def test_heuristic_french():
    """French keywords are detected correctly."""
    result = _heuristic_detect("Bonjour, merci beaucoup pour votre aide")
    assert result is not None
    assert result[0] == "fr"


def test_heuristic_kiswahili():
    """Kiswahili keywords are detected correctly."""
    result = _heuristic_detect("Habari yako, asante sana kwa kazi nzuri")
    assert result is not None
    assert result[0] == "sw"


def test_heuristic_english():
    """English keywords are detected correctly."""
    result = _heuristic_detect("Hello, thanks for the help with my savings goal")
    assert result is not None
    assert result[0] == "en"


def test_heuristic_empty():
    """Empty text returns None."""
    assert _heuristic_detect("") is None
    assert _heuristic_detect("a") is None


def test_heuristic_short_text():
    """Very short text returns None (too ambiguous)."""
    result = _heuristic_detect("ok")
    assert result is None


def test_language_name_mapping():
    """Language code to name mapping works."""
    assert language_name("rw") == "Kinyarwanda"
    assert language_name("en") == "English"
    assert language_name("fr") == "French"
    assert language_name("sw") == "Kiswahili"
    assert language_name("xx") == "Unknown"


def test_run_detect_language_kinyarwanda():
    """async detect_language returns (code, confidence) for Kinyarwanda."""
    result = asyncio.run(detect_language("Muraho, nshaka kumenya uko nshobora kugera ku ntego yanjye"))
    assert result[0] == "rw"
    assert 0 <= result[1] <= 1


def test_run_detect_language_french():
    """async detect_language returns (code, confidence) for French."""
    result = asyncio.run(detect_language("Bonjour, je veux améliorer mes économies"))
    assert result[0] == "fr"


def test_run_detect_language_empty_fallback():
    """Empty text falls back to the specified fallback language."""
    result = asyncio.run(detect_language("", fallback="en"))
    assert result[0] == "en"
    assert result[1] == 0.0


def test_run_detect_language_kiswahili():
    """async detect_language returns (code, confidence) for Kiswahili."""
    result = asyncio.run(detect_language("Habari, nataka kujua jinsi ya kuboresha akiba yangu"))
    assert result[0] == "sw"


# ==================== TRANSLATION TESTS ====================

def test_translate_same_language_noop():
    """Translating en→en returns the original text unchanged."""
    result = asyncio.run(translate_text("Hello world", "en", "en"))
    assert result == "Hello world"


def test_translate_empty_text():
    """Empty text is returned as-is."""
    result = asyncio.run(translate_text("", "rw", "en"))
    assert result == ""


def test_translate_with_mocked_ollama():
    """Translation calls Ollama and returns the translated text."""
    with patch("services.translation_service.generate_response", new_callable=AsyncMock) as mock:
        mock.return_value = "Hello, how are you?"
        result = asyncio.run(translate_text("Muraho, amakuru?", "rw", "en"))
        assert result == "Hello, how are you?"
        mock.assert_awaited_once()


def test_translate_failure_raises():
    """When Ollama returns empty, TranslationError is raised after retries."""
    with patch("services.translation_service.generate_response", new_callable=AsyncMock) as mock:
        mock.return_value = ""
        with patch("services.translation_service.MAX_RETRIES", 0):
            try:
                asyncio.run(translate_text("Muraho", "rw", "en"))
                assert False, "Should have raised TranslationError"
            except TranslationError:
                pass


def test_translate_preserves_numbers():
    """Translation preserves numbers in the text (mocked)."""
    with patch("services.translation_service.generate_response", new_callable=AsyncMock) as mock:
        # The mock simulates Ollama preserving numbers
        mock.return_value = "Umushahara wanjye ni 50,000 RWF"
        result = asyncio.run(translate_text("My salary is 50,000 RWF", "en", "rw"))
        assert "50,000" in result
        assert "RWF" in result


# ==================== AI PIPELINE TESTS ====================

def test_pipeline_english_input():
    """English input → English response, no translation needed."""
    patches, mock = patch_all_gen(return_value="Focus on your top 3 priorities each morning.")
    for p in patches:
        p.start()
    try:
        result = asyncio.run(run_ai_pipeline(
            message="How can I be more productive?",
            system_prompt="You are a productivity coach.",
            user_preferred_language="automatic",
        ))
    finally:
        for p in patches:
            p.stop()
    assert result.detected_language == "en"
    assert result.response_language == "en"
    assert result.translation_used is False
    assert "priorities" in result.final_response.lower()
    assert result.translation_error is None


def test_pipeline_kinyarwanda_to_kinyarwanda():
    """Kinyarwanda input → English processing → Kinyarwanda response."""
    patches, mock_gen = patch_all_gen(side_effect=[
        "How can I improve my savings?",  # rw → en translation
        "Track your expenses daily and save 10% of income.",  # AI response
        "Kurikirana amafaranga yose umunsi, kuguramo 10% by'income.",  # en → rw
    ])
    for p in patches:
        p.start()
    try:
        result = asyncio.run(run_ai_pipeline(
            message="Nigute nshobora kugira amafaranga menshi mu banka?",
            user_preferred_language="automatic",
        ))
    finally:
        for p in patches:
            p.stop()
    assert result.detected_language == "rw"
    assert result.response_language == "rw"
    assert result.translation_used is True
    assert result.english_message == "How can I improve my savings?"


def test_pipeline_french_input():
    """French input → detected, translated to English, response in French."""
    patches, mock_gen = patch_all_gen(side_effect=[
        "French",  # language detection (model call, no heuristic match)
        "How can I improve my savings?",  # fr → en
        "Save 20% of your income each month.",  # AI response
        "Économisez 20% de vos revenus chaque mois.",  # en → fr
    ])
    for p in patches:
        p.start()
    try:
        result = asyncio.run(run_ai_pipeline(
            message="Comment puis-je améliorer mes économies?",
            user_preferred_language="automatic",
        ))
    finally:
        for p in patches:
            p.stop()
    assert result.detected_language == "fr"
    assert result.response_language == "fr"
    assert result.translation_used is True


def test_pipeline_kiswahili_input():
    """Kiswahili input → detected, translated, response in Kiswahili."""
    patches, mock_gen = patch_all_gen(side_effect=[
        "How can I save more money?",  # sw → en
        "Reduce unnecessary expenses and save daily.",  # AI response
        "Punguza matumizi yasiyo ya lazima na uweke akiba kila siku.",  # en → sw
    ])
    for p in patches:
        p.start()
    try:
        result = asyncio.run(run_ai_pipeline(
            message="Ninawezaje kuokoa pesa zaidi?",
            user_preferred_language="automatic",
        ))
    finally:
        for p in patches:
            p.stop()
    assert result.detected_language == "sw"
    assert result.response_language == "sw"
    assert result.translation_used is True


def test_pipeline_fixed_language_mode():
    """Fixed language mode always responds in the selected language."""
    patches, mock_gen = patch_all_gen(side_effect=[
        "English",  # language detection (model call)
        "Plan your day the night before.",  # AI response (no input translation, already en)
        "Sudia siku yako usiku uliopita.",  # en → sw
    ])
    for p in patches:
        p.start()
    try:
        result = asyncio.run(run_ai_pipeline(
            message="How can I be more productive?",
            user_preferred_language="sw",  # Fixed to Kiswahili
        ))
    finally:
        for p in patches:
            p.stop()
    # English input but response should be in Kiswahili
    assert result.response_language == "sw"
    assert result.translation_used is True


def test_pipeline_translation_failure_preserves_english():
    """When response translation fails, English response is preserved with notice."""
    patches, mock_gen = patch_all_gen(side_effect=[
        "How can I save money?",  # rw → en
        "Save 10% of your income.",  # AI response
        "",  # en → rw translation fails (empty response)
    ])
    for p in patches:
        p.start()
    try:
        with patch("services.translation_service.MAX_RETRIES", 0):
            result = asyncio.run(run_ai_pipeline(
                message="Nigute nshobora kugira amafaranga?",
                user_preferred_language="automatic",
            ))
    finally:
        for p in patches:
            p.stop()
    assert result.detected_language == "rw"
    assert result.response_language == "rw"
    assert result.translation_error is not None
    # English response is kept
    assert "Save 10%" in result.final_response


def test_pipeline_ai_unavailable():
    """When AI is unavailable, pipeline returns fallback source."""
    patches, mock = patch_all_gen(return_value=None)
    for p in patches:
        p.start()
    try:
        result = asyncio.run(run_ai_pipeline(
            message="Hello",
            user_preferred_language="automatic",
        ))
    finally:
        for p in patches:
            p.stop()
    assert result.source == "fallback"
    assert result.final_response == ""


def test_build_translation_notice_when_error():
    """Translation notice is added when translation fails."""
    from services.ai_pipeline import PipelineResult
    result = PipelineResult(
        original_message="Test",
        detected_language="rw",
        detection_confidence=0.8,
        english_message="Test",
        ai_response_english="Save money daily.",
        final_response="Save money daily.",
        response_language="rw",
        translation_used=False,
        translation_error="Translation failed",
    )
    notice = build_translation_notice(result)
    assert notice is not None
    assert "Kinyarwanda" in notice
    assert "Save money daily." in notice


def test_build_translation_notice_no_error():
    """No notice when translation succeeded."""
    from services.ai_pipeline import PipelineResult
    result = PipelineResult(
        original_message="Test",
        detected_language="rw",
        detection_confidence=0.8,
        english_message="Test",
        ai_response_english="Save money daily.",
        final_response="Rungika amafaranga buri munsi.",
        response_language="rw",
        translation_used=True,
        translation_error=None,
    )
    notice = build_translation_notice(result)
    assert notice is None


# ==================== NUMBER/CURRENCY PRESERVATION TESTS ====================

def test_numbers_preserved_in_translation():
    """Numbers and currency codes are preserved during translation."""
    text = "I earned 150,000 RWF this month and saved 15,000 RWF."
    with patch("services.translation_service.generate_response", new_callable=AsyncMock) as mock:
        mock.return_value = "Nahuye 150,000 RFW iyi kwezi kandi nabungiye 15,000 RWF."
        result = asyncio.run(translate_text(text, "en", "rw"))
        # Numbers should be preserved
        assert "150,000" in result
        assert "15,000" in result


def test_dates_preserved_in_translation():
    """Dates are preserved during translation."""
    text = "My goal deadline is 2026-12-31."
    with patch("services.translation_service.generate_response", new_callable=AsyncMock) as mock:
        mock.return_value = "Igihe cyo kurangiza intego yanjye ni 2026-12-31."
        result = asyncio.run(translate_text(text, "en", "rw"))
        assert "2026-12-31" in result


def test_percentages_preserved_in_translation():
    """Percentages are preserved during translation."""
    text = "Your savings rate is 20%."
    with patch("services.translation_service.generate_response", new_callable=AsyncMock) as mock:
        mock.return_value = "Igipimo cyo kuguramo ni 20%."
        result = asyncio.run(translate_text(text, "en", "rw"))
        assert "20%" in result


# ==================== MIXED LANGUAGE TESTS ====================

def test_mixed_language_detection():
    """Mixed language messages detect the dominant language."""
    # Mostly Kinyarwanda with some English
    result = _heuristic_detect("Muraho, nshaka kuguma focused ku ntego yanjye")
    # Should detect rw due to "muraho", "nshaka", "intego"
    assert result is not None
    assert result[0] == "rw"


# ==================== CONVERSATION HISTORY TESTS ====================

def test_pipeline_preserves_original_message():
    """The original message is preserved exactly in the result."""
    original = "Muraho, nshaka kumenya uko nshobora kugera ku ntego yanjye!"
    patches, mock_gen = patch_all_gen(side_effect=[
        "Hello, I want to know how to reach my goals!",
        "Break your goals into weekly milestones.",
        "Gabanya inzego zawe mu byiciro by'icyumweru.",
    ])
    for p in patches:
        p.start()
    try:
        result = asyncio.run(run_ai_pipeline(
            message=original,
            user_preferred_language="automatic",
        ))
    finally:
        for p in patches:
            p.stop()
    assert result.original_message == original


def test_pipeline_stores_english_translation():
    """The English translation is stored separately for debugging."""
    patches, mock_gen = patch_all_gen(side_effect=[
        "How can I improve my savings?",  # rw → en
        "Track expenses and save 10%.",
        "Kurikirana amafaranga kugiramo 10%.",
    ])
    for p in patches:
        p.start()
    try:
        result = asyncio.run(run_ai_pipeline(
            message="Nigute nshobora kugira amafaranga?",
            user_preferred_language="automatic",
        ))
    finally:
        for p in patches:
            p.stop()
    assert result.english_message == "How can I improve my savings?"
    assert result.ai_response_english == "Track expenses and save 10%."
    assert result.final_response == "Kurikirana amafaranga kugiramo 10%."


if __name__ == "__main__":
    # Simple test runner for environments without pytest
    import traceback
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    passed = 0
    failed = 0
    for test in tests:
        try:
            test()
            print(f"  PASS  {test.__name__}")
            passed += 1
        except Exception as e:
            print(f"  FAIL  {test.__name__}: {e}")
            traceback.print_exc()
            failed += 1
    print(f"\n{'=' * 50}")
    print(f"Results: {passed} passed, {failed} failed, {len(tests)} total")
    exit(0 if failed == 0 else 1)
