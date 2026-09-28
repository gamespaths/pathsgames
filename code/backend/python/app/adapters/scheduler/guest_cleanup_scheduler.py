"""v0.41.0 — the daily guest cleanup (00:42 UTC by default): one AsyncIOScheduler, started once
by the launcher's _serve, running the same service call as DELETE /stale?withoutMatches=true."""
import logging

logger = logging.getLogger(__name__)

JOB_ID = "guest-cleanup"


def run_guest_cleanup(guest_admin_service, age_days: int) -> int:
    """Deletes the guests idle for ``age_days`` that no match references, capped per run."""
    summary = guest_admin_service.delete_stale_guests(age_days, True)
    logger.info("[GUEST CLEANUP] %s idle guests without matches removed", summary["guests"])
    return summary["guests"]


def start_guest_cleanup(guest_admin_service, config, scheduler_factory=None):
    """Schedules and starts the job inside the running loop (_serve); None when switched off."""
    if not config.guest_cleanup_enabled or config.guest_cleanup_age_days < 0:
        logger.info("[GUEST CLEANUP] disabled, no job scheduled")
        return None
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.triggers.cron import CronTrigger

    scheduler = (scheduler_factory or AsyncIOScheduler)(timezone="UTC")
    scheduler.add_job(run_guest_cleanup,
                      CronTrigger(hour=config.guest_cleanup_hour,
                                  minute=config.guest_cleanup_minute, timezone="UTC"),
                      args=[guest_admin_service, config.guest_cleanup_age_days],
                      id=JOB_ID, replace_existing=True, max_instances=1, coalesce=True)
    scheduler.start()
    return scheduler
