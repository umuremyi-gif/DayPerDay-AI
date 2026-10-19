"""
AI Router
Endpoints for AI-powered features: evening summaries, goal breakdowns,
financial analysis, and the general AI coach chat.

All endpoints use the multilingual AI pipeline which:
  - Detects the user's language
  - Translates to English for processing
  - Generates the AI response
  - Translates the response back to the user's language
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List
from services.ollama_service import check_ollama_status, generate_response, OLLAMA_MODEL, OLLAMA_ENDPOINT
from services.ai_pipeline import run_ai_pipeline, build_translation_notice
from services.language_service import detect_language, language_name
from services.translation_service import translate_text, TranslationError
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


class EveningSummaryRequest(BaseModel):
    user_id: str
    review_data: dict
    tasks: List[dict]
    preferred_language: str = "automatic"


class GoalBreakdownRequest(BaseModel):
    goal: dict
    user_id: str
    preferred_language: str = "automatic"


class FinancialAnalysisRequest(BaseModel):
    user_id: str
    period: dict
    summary: dict
    preferred_language: str = "automatic"


class CoachRequest(BaseModel):
    user_id: str
    message: str
    context: Optional[dict] = {}
    preferred_language: str = "automatic"
    conversation_history: Optional[List[dict]] = []


@router.get("/status")
async def ai_status():
    """Check if Ollama is available and the configured model is loaded."""
    return await check_ollama_status()


@router.post("/evening-summary")
async def evening_summary(req: EveningSummaryRequest):
    """
    Generate an evening summary from the user's actual review and task data.

    For this endpoint, ask Ollama to write directly in the requested language.
    This avoids a second translation pass that was producing garbled Kinyarwanda.
    """
    completed = [task for task in req.tasks if task.get("completed") is True]
    incomplete = [task for task in req.tasks if not task.get("completed", False)]

    review = req.review_data or {}
    challenges = review.get("challenges") or review.get("difficulties") or "Not provided"

    completed_titles = [
        str(task.get("title") or "Untitled task")
        for task in completed[:10]
    ]
    incomplete_titles = [
        str(task.get("title") or "Untitled task")
        for task in incomplete[:10]
    ]

    user_text = " ".join(
        str(review.get(key, "") or "").strip()
        for key in (
            "accomplishments",
            "challenges",
            "difficulties",
            "lessons_learned",
            "improvements",
        )
        if str(review.get(key, "") or "").strip()
    ).strip()

    detected_lang, confidence = await detect_language(
        user_text or "Daily review",
        fallback="en",
    )
    response_lang = (
        req.preferred_language
        if req.preferred_language and req.preferred_language != "automatic"
        else detected_lang
    )
    response_lang_name = language_name(response_lang)

    data_summary = (
        f"Completed tasks ({len(completed)}): "
        f"{', '.join(completed_titles) if completed_titles else 'None'}\n"
        f"Incomplete tasks ({len(incomplete)}): "
        f"{', '.join(incomplete_titles) if incomplete_titles else 'None'}\n"
        f"Accomplishments: {review.get('accomplishments') or 'Not provided'}\n"
        f"Challenges/difficulties: {challenges}\n"
        f"Lessons learned: {review.get('lessons_learned') or 'Not provided'}\n"
        f"Planned improvements: {review.get('improvements') or 'Not provided'}\n"
        f"Mood (if provided): {review.get('mood') or 'Not provided'}"
    )

    prompt = (
        "Create a concise daily review summary in 3-4 sentences. "
        "Use only the facts supplied below. Mention completed work, "
        "acknowledge challenges constructively, and suggest one practical "
        "improvement for tomorrow. Do not invent tasks, achievements, "
        "feelings, or numbers.\n\n"
        f"Daily review data:\n{data_summary}\n\n"
        f"IMPORTANT: Write the final summary directly in {response_lang_name} "
        f"(language code: {response_lang}). Do not translate from another "
        "language, do not include an introduction, and do not output analysis. "
        "Use natural, clear wording."
    )

    response = await generate_response(
        prompt,
        system_prompt=(
            "You are DayPerDay AI, a careful productivity coach. "
            "Follow the requested output language exactly. Be factual, concise, "
            "and helpful. Never invent information. If some field is missing, "
            "do not pretend it was provided."
        ),
    )

    if not response:
        rate = round(len(completed) / max(len(req.tasks), 1) * 100)
        # Safe deterministic fallback. It contains no invented user claims.
        fallback_en = (
            f"You completed {len(completed)} of {len(req.tasks)} tasks "
            f"({rate}%). Review the unfinished tasks and choose one practical "
            "priority for tomorrow."
        )
        fallback_text = fallback_en
        if response_lang != "en":
            try:
                fallback_text = await translate_text(
                    fallback_en, "en", response_lang
                )
            except TranslationError:
                fallback_text = fallback_en

        return {
            "summary": fallback_text,
            "source": "fallback",
            "detected_language": detected_lang,
            "detection_confidence": confidence,
            "response_language": response_lang,
            "translation_used": response_lang != "en" and fallback_text != fallback_en,
            "translation_error": (
                "Ollama did not return a summary."
                if response_lang == "en" or fallback_text == fallback_en
                else None
            ),
        }

    return {
        "summary": response.strip(),
        "source": "ollama",
        "detected_language": detected_lang,
        "detection_confidence": confidence,
        "response_language": response_lang,
        "translation_used": False,
        "translation_error": None,
    }


@router.post("/goal-breakdown")
async def goal_breakdown(req: GoalBreakdownRequest):
    """Break down a 90-day goal into 3 monthly milestones with weekly objectives."""
    goal = req.goal
    data = (
        f"Goal: {goal.get('title', '')}\n"
        f"Why it matters: {goal.get('why_it_matters', '')}\n"
        f"Current situation: {goal.get('current_situation', '')}\n"
        f"Available resources: {goal.get('available_resources', '')}\n"
        f"Skills: {goal.get('skills_strengths', '')}\n"
        f"Obstacles: {goal.get('obstacles_risks', '')}\n"
        f"Available time: {goal.get('available_time', '')}\n"
        f"Budget: {goal.get('available_budget', '')}\n"
        f"Success metrics: {goal.get('success_metrics', '')}\n"
    )

    # Detect language from the goal text
    goal_text = " ".join(filter(None, [
        goal.get("title", ""),
        goal.get("why_it_matters", ""),
        goal.get("current_situation", ""),
    ]))
    detected_lang, _ = await detect_language(goal_text)

    prompt = f"""Based on this goal and the user's real situation, create 3 monthly milestones for a 90-day plan.
Each milestone should have: title, description, target_date (month 1/2/3 from start), weekly_objectives, success_indicators, potential_obstacles, and solutions.
Be realistic and practical. Consider the user's actual resources, time, and obstacles.

User's goal data:
{data}

Respond in JSON format with a "milestones" array. Each milestone has: title, description, month_number (1, 2, or 3), target_date (YYYY-MM-DD), weekly_objectives, daily_tasks_hint, success_indicators, potential_obstacles, solutions."""

    response = await generate_response(prompt)
    if response is None:
        # Fallback: return template milestones
        from datetime import datetime, timedelta
        start = datetime.strptime(goal.get("start_date", datetime.now().strftime("%Y-%m-%d")), "%Y-%m-%d")
        milestones = []
        for month in range(1, 4):
            target = start + timedelta(days=30 * month)
            milestones.append({
                "title": f"Month {month} Milestone",
                "description": f"Define month {month} objectives for: {goal.get('title', '')}",
                "month_number": month,
                "target_date": target.strftime("%Y-%m-%d"),
                "weekly_objectives": "",
                "daily_tasks_hint": "",
                "success_indicators": "",
                "potential_obstacles": "",
                "solutions": "",
            })
        return {
            "milestones": milestones,
            "source": "fallback",
            "detected_language": detected_lang,
        }

    milestones = parse_milestones(response, goal)

    # Translate milestone descriptions if the goal was not in English
    response_lang = req.preferred_language if req.preferred_language != "automatic" else detected_lang
    if response_lang != "en" and milestones:
        for ms in milestones:
            for field in ("title", "description", "weekly_objectives", "success_indicators", "potential_obstacles", "solutions"):
                if ms.get(field):
                    try:
                        ms[field] = await translate_text(ms[field], "en", response_lang)
                    except TranslationError:
                        pass  # Keep English if translation fails

    return {
        "milestones": milestones,
        "source": "ollama",
        "detected_language": detected_lang,
        "response_language": response_lang,
    }


def parse_milestones(response: str, goal: dict) -> list:
    """Try to parse AI response as JSON; fall back to template if parsing fails."""
    import json
    from datetime import datetime, timedelta
    try:
        data = json.loads(response)
        if "milestones" in data:
            return data["milestones"]
    except json.JSONDecodeError:
        pass

    start = datetime.strptime(goal.get("start_date", datetime.now().strftime("%Y-%m-%d")), "%Y-%m-%d")
    milestones = []
    for month in range(1, 4):
        target = start + timedelta(days=30 * month)
        milestones.append({
            "title": f"Month {month} Milestone",
            "description": response[:200] if response else "",
            "month_number": month,
            "target_date": target.strftime("%Y-%m-%d"),
            "weekly_objectives": "",
            "daily_tasks_hint": "",
            "success_indicators": "",
            "potential_obstacles": "",
            "solutions": "",
        })
    return milestones


@router.post("/financial-analysis")
async def financial_analysis(req: FinancialAnalysisRequest):
    """Generate AI analysis of financial trends for a period."""
    s = req.summary
    data = (
        f"Period: {req.period.get('start', '')} to {req.period.get('end', '')}\n"
        f"Total income: {s.get('income', 0)}\n"
        f"Total expenses: {s.get('expenses', 0)}\n"
        f"Net cash flow: {s.get('netCashFlow', 0)}\n"
        f"Savings balance: {s.get('savingsBalance', 0)}\n"
        f"Tasks completed: {s.get('tasksCompleted', 0)} of {s.get('totalTasks', 0)}\n"
    )

    prompt = f"""Analyze this financial data and provide a brief insight (2-3 sentences).
Note trends, identify if spending is sustainable, and suggest one specific action.
Never invent numbers - use only the data provided.

Data:
{data}

Analysis:"""

    result = await run_ai_pipeline(
        message=prompt,
        system_prompt="You are a financial analyst. Provide a brief insight based on the data. Never invent numbers.",
        user_preferred_language=req.preferred_language,
    )

    if result.source == "fallback":
        net = s.get("netCashFlow", 0)
        if net >= 0:
            analysis = f"You maintained a positive cash flow of {net}. Continue monitoring expenses to sustain this trend."
        else:
            analysis = f"Your expenses exceeded income by {abs(net)}. Consider reviewing your top expense categories."

        response_lang = req.preferred_language if req.preferred_language != "automatic" else result.detected_language
        if response_lang != "en":
            try:
                analysis = await translate_text(analysis, "en", response_lang)
            except TranslationError:
                pass

        return {
            "analysis": analysis,
            "source": "fallback",
            "detected_language": result.detected_language,
            "response_language": response_lang,
        }

    notice = build_translation_notice(result)
    analysis = notice if notice else result.final_response
    return {
        "analysis": analysis,
        "source": "ollama",
        "detected_language": result.detected_language,
        "detection_confidence": result.detection_confidence,
        "response_language": result.response_language,
        "translation_used": result.translation_used,
        "translation_error": result.translation_error,
    }


@router.post("/coach")
async def ai_coach(req: CoachRequest):
    """General AI coach chat endpoint with multilingual support."""
    ctx = req.context or {}
    account_type = ctx.get("account_type", "personal")

    profile = ctx.get("profile", {})
    employment = ctx.get("employment", {})
    social = ctx.get("social", {})

    context_lines = []
    if profile:
        if profile.get("full_name"):
            context_lines.append(f"User's name: {profile.get('full_name')}")
        if profile.get("country"):
            context_lines.append(f"Location: {profile.get('country')}, {profile.get('district', '')}")
        if profile.get("education_level"):
            context_lines.append(f"Education: {profile.get('education_level')}")
        if profile.get("skills_talents"):
            context_lines.append(f"Skills: {profile.get('skills_talents')}")
        if profile.get("areas_to_improve"):
            context_lines.append(f"Areas to improve: {profile.get('areas_to_improve')}")
    if employment:
        if employment.get("employment_status"):
            context_lines.append(f"Employment status: {', '.join(employment.get('employment_status', []))}")
        if employment.get("work_description"):
            context_lines.append(f"Work: {employment.get('work_description')}")
        if employment.get("income_type"):
            context_lines.append(f"Income type: {employment.get('income_type')}")
        if employment.get("work_challenges"):
            context_lines.append(f"Work challenges: {employment.get('work_challenges')}")
    if social:
        if social.get("living_situation"):
            context_lines.append(f"Living situation: {social.get('living_situation')}")
        if social.get("daily_available_hours") is not None:
            context_lines.append(f"Daily available hours: {social.get('daily_available_hours')}")
        if social.get("has_internet") is not None:
            context_lines.append(f"Internet access: {'yes' if social.get('has_internet') else 'no'}")
        if social.get("has_smartphone") is not None:
            context_lines.append(f"Smartphone: {'yes' if social.get('has_smartphone') else 'no'}")
        if social.get("family_responsibilities"):
            context_lines.append(f"Family responsibilities: {social.get('family_responsibilities')}")
        if social.get("external_challenges"):
            context_lines.append(f"External challenges: {social.get('external_challenges')}")

    context_str = "\n".join(context_lines) if context_lines else "No specific context available."

    # Include conversation history if provided
    history_text = ""
    if req.conversation_history:
        history_lines = []
        for msg in req.conversation_history[-10:]:  # Last 10 messages
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if content:
                history_lines.append(f"{role}: {content}")
        history_text = "\n".join(history_lines)

    history_section = f"\n\nConversation history:\n{history_text}\n" if history_text else ""

    system = (
        "You are DayPerDay AI, a productivity and finance coach. "
        f"The user has a {account_type} account.\n\n"
        f"User context:\n{context_str}\n"
        f"{history_section}\n"
        "Personalize your advice based on this context. "
        "Give concise, practical, and encouraging advice tailored to the user's real situation. "
        "Never invent data, transactions, or achievements. "
        "If you don't have specific data, give general but actionable advice."
    )

    result = await run_ai_pipeline(
        message=req.message,
        system_prompt=system,
        user_preferred_language=req.preferred_language,
    )

    if result.source == "fallback":
        return {
            "response": "I'm currently unavailable. Please make sure Ollama is running (ollama serve) and the model is pulled (ollama pull qwen2.5:3b). The Python backend must also be running.",
            "source": "fallback",
            "detected_language": result.detected_language,
            "detection_confidence": result.detection_confidence,
            "response_language": result.response_language,
        }

    notice = build_translation_notice(result)
    response_text = notice if notice else result.final_response
    return {
        "response": response_text,
        "source": "ollama",
        "detected_language": result.detected_language,
        "detection_confidence": result.detection_confidence,
        "response_language": result.response_language,
        "translation_used": result.translation_used,
        "translation_error": result.translation_error,
        "original_message": result.original_message,
        "english_message": result.english_message,
    }
