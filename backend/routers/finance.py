"""
Finance Router
Server-side financial calculations using Python.
All calculations are performed here, not by AI, to ensure accuracy.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from datetime import date
import calendar

router = APIRouter()


class TransactionInput(BaseModel):
    transaction_type: str  # income, expense, transfer, savings_contribution, savings_withdrawal
    amount: float
    category: str = ""
    transaction_date: str = ""


class FinanceSummaryRequest(BaseModel):
    transactions: List[TransactionInput]
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class PeriodSummary(BaseModel):
    total_income: float = 0
    total_expenses: float = 0
    net_cash_flow: float = 0
    savings_contributions: float = 0
    savings_withdrawals: float = 0
    savings_balance: float = 0
    transfers: float = 0
    transaction_count: int = 0


@router.post("/summary", response_model=PeriodSummary)
async def calculate_summary(req: FinanceSummaryRequest):
    """
    Calculate financial summary for a period.
    IMPORTANT: Transfers are NOT counted as income or expenses.
    Savings contributions/withdrawals are tracked separately.
    """
    start = req.start_date or "1900-01-01"
    end = req.end_date or "2100-12-31"

    summary = PeriodSummary()

    for tx in req.transactions:
        # Filter by date range
        if tx.transaction_date and not (start <= tx.transaction_date <= end):
            continue

        summary.transaction_count += 1

        if tx.transaction_type == "income":
            summary.total_income += tx.amount
        elif tx.transaction_type == "expense":
            summary.total_expenses += tx.amount
        elif tx.transaction_type == "transfer":
            # Transfers are NOT income or expenses - just movement between accounts
            summary.transfers += tx.amount
        elif tx.transaction_type == "savings_contribution":
            summary.savings_contributions += tx.amount
        elif tx.transaction_type == "savings_withdrawal":
            summary.savings_withdrawals += tx.amount

    # Net cash flow = income - expenses (transfers excluded)
    summary.net_cash_flow = summary.total_income - summary.total_expenses

    # Savings balance = contributions - withdrawals
    summary.savings_balance = summary.savings_contributions - summary.savings_withdrawals

    return summary


@router.post("/accounting-profit")
async def accounting_profit(req: FinanceSummaryRequest):
    """
    Calculate accounting profit: revenue minus recognized expenses.
    Only meaningful when sufficient data exists.
    """
    summary = await calculate_summary(req)

    if summary.transaction_count == 0:
        return {"profit": 0, "has_data": False, "note": "No transaction data for this period."}

    # Accounting profit = income (revenue) - expenses
    profit = summary.total_income - summary.total_expenses
    return {
        "profit": profit,
        "revenue": summary.total_income,
        "expenses": summary.total_expenses,
        "has_data": True,
    }


@router.post("/category-breakdown")
async def category_breakdown(req: FinanceSummaryRequest):
    """Break down expenses by category."""
    start = req.start_date or "1900-01-01"
    end = req.end_date or "2100-12-31"

    categories: dict = {}
    for tx in req.transactions:
        if tx.transaction_date and not (start <= tx.transaction_date <= end):
            continue
        if tx.transaction_type == "expense":
            cat = tx.category or "Other"
            categories[cat] = categories.get(cat, 0) + tx.amount

    return {
        "categories": [{"name": k, "amount": v} for k, v in sorted(categories.items(), key=lambda x: -x[1])],
        "total": sum(categories.values()),
    }
