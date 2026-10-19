"""
Scheduler
Background scheduler for daily reminders, evening reviews, and periodic reports.
Uses APScheduler for reliable scheduling. In production, use a persistent job store.
"""
import asyncio
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

_scheduler = None

async def start_scheduler():
    """Start the background scheduler."""
    global _scheduler
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.cron import CronTrigger

        _scheduler = AsyncIOScheduler()

        # Daily planning reminder at 06:00
        _scheduler.add_job(
            daily_planning_reminder,
            CronTrigger(hour=6, minute=0),
            id="daily_planning",
            replace_existing=True,
        )

        # Evening review reminder at 20:00
        _scheduler.add_job(
            evening_review_reminder,
            CronTrigger(hour=20, minute=0),
            id="evening_review",
            replace_existing=True,
        )

        # Every 3 days: productivity progress review
        _scheduler.add_job(
            three_day_review,
            CronTrigger(day="*/3", hour=18, minute=0),
            id="three_day_review",
            replace_existing=True,
        )

        # Weekly report (Sundays at 09:00)
        _scheduler.add_job(
            weekly_report,
            CronTrigger(day_of_week="sun", hour=9, minute=0),
            id="weekly_report",
            replace_existing=True,
        )

        # Monthly report (1st of month at 09:00)
        _scheduler.add_job(
            monthly_report,
            CronTrigger(day=1, hour=9, minute=0),
            id="monthly_report",
            replace_existing=True,
        )

        _scheduler.start()
        logger.info("Background scheduler started successfully")
    except ImportError:
        logger.warning("APScheduler not installed. Scheduled jobs will not run. Install with: pip install apscheduler")
    except Exception as e:
        logger.error(f"Failed to start scheduler: {e}")


async def stop_scheduler():
    """Stop the scheduler on shutdown."""
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")


async def daily_planning_reminder():
    """Send planning reminder to all users at 06:00."""
    logger.info(f"[{datetime.now(timezone.utc)}] Daily planning reminder triggered")
    # In production: query Supabase for all users, create notifications
    # The frontend also checks and shows reminders


async def evening_review_reminder():
    """Send evening review reminder at 20:00."""
    logger.info(f"[{datetime.now(timezone.utc)}] Evening review reminder triggered")


async def three_day_review():
    """Every 3 days: review productivity and financial trends."""
    logger.info(f"[{datetime.now(timezone.utc)}] 3-day review triggered")


async def weekly_report():
    """Weekly comprehensive report."""
    logger.info(f"[{datetime.now(timezone.utc)}] Weekly report triggered")


async def monthly_report():
    """Monthly performance and financial report."""
    logger.info(f"[{datetime.now(timezone.utc)}] Monthly report triggered")
