"""
Reports Router
Server-side report generation using real user data.
Calculates all metrics in Python, not by AI.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from datetime import date, timedelta

router = APIRouter()


class TaskInput(BaseModel):
    title: str
    completed: bool
    created_at: str
    priority: str = "medium"
    category: str = ""


class TransactionInput(BaseModel):
    transaction_type: str
    amount: float
    category: str = ""
    transaction_date: str = ""


class ReportRequest(BaseModel):
    report_type: str = "weekly"  # daily, weekly, monthly, quarterly
    tasks: List[TaskInput] = []
    transactions: List[TransactionInput] = []
    goals: List[dict] = []
    start_date: Optional[str] = None
    end_date: Optional[str] = None


@router.post("/generate")
async def generate_report(req: ReportRequest):
    """Generate a comprehensive report from real user data."""
    today = date.today()

    if req.report_type == "daily":
        start = today
        end = today
    elif req.report_type == "weekly":
        start = today - timedelta(days=7)
        end = today
    elif req.report_type == "monthly":
        start = today.replace(day=1)
        end = today
    elif req.report_type == "quarterly":
        start = today - timedelta(days=90)
        end = today
    else:
        start = date.fromisoformat(req.start_date) if req.start_date else today - timedelta(days=7)
        end = date.fromisoformat(req.end_date) if req.end_date else today

    start_str = start.isoformat()
    end_str = end.isoformat()

    # Filter tasks by date range
    period_tasks = [
        t for t in req.tasks
        if t.created_at and start_str <= t.created_at[:10] <= end_str
    ]
    tasks_completed = sum(1 for t in period_tasks if t.completed)
    tasks_planned = len(period_tasks)
    completion_rate = round(tasks_completed / max(tasks_planned, 1) * 100)

    # Filter and calculate transactions
    period_tx = [
        t for t in req.transactions
        if t.transaction_date and start_str <= t.transaction_date <= end_str
    ]

    total_income = sum(t.amount for t in period_tx if t.transaction_type == "income")
    total_expenses = sum(t.amount for t in period_tx if t.transaction_type == "expense")
    net_cash_flow = total_income - total_expenses

    savings_contrib = sum(t.amount for t in period_tx if t.transaction_type == "savings_contribution")
    savings_withdraw = sum(t.amount for t in period_tx if t.transaction_type == "savings_withdrawal")
    savings_balance = savings_contrib - savings_withdraw

    # Category breakdown
    categories: dict = {}
    for t in period_tx:
        if t.transaction_type == "expense":
            cat = t.category or "Other"
            categories[cat] = categories.get(cat, 0) + t.amount

    # Active goals
    active_goals = [g for g in req.goals if g.get("status") == "active"]

    report = {
        "report_type": req.report_type,
        "period": {"start": start_str, "end": end_str},
        "tasks": {
            "planned": tasks_planned,
            "completed": tasks_completed,
            "completion_rate": completion_rate,
        },
        "finance": {
            "total_income": total_income,
            "total_expenses": total_expenses,
            "net_cash_flow": net_cash_flow,
            "savings_balance": savings_balance,
            "expense_categories": [{"name": k, "amount": v} for k, v in sorted(categories.items(), key=lambda x: -x[1])],
        },
        "goals": {
            "active_count": len(active_goals),
            "titles": [g.get("title", "") for g in active_goals],
        },
        "consistency": {
            "planning_days": len(set(t.created_at[:10] for t in period_tasks if t.created_at)),
            "review_days": 0,  # Would be calculated from review records
        },
    }

    # Generate text summary
    lines = [
        f"Report: {req.report_type.capitalize()} ({start_str} to {end_str})",
        f"",
        f"Tasks: {tasks_completed}/{tasks_planned} completed ({completion_rate}%)",
        f"Income: {total_income}",
        f"Expenses: {total_expenses}",
        f"Net Cash Flow: {net_cash_flow}",
        f"Savings: {savings_balance}",
        f"Active Goals: {len(active_goals)}",
    ]
    if categories:
        lines.append(f"Top Expense Categories:")
        for cat, amt in sorted(categories.items(), key=lambda x: -x[1])[:3]:
            lines.append(f"  - {cat}: {amt}")

    report["text_summary"] = "\n".join(lines)

    return report
