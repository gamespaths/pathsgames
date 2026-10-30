"""v1.2.0 the account jobs: every 10 minutes one chunk of the deletions requested by DELETE /api/auth/me
(state 7), once a day the 24-month inactivity retirement (v1.7.0 + admin log and revoked tokens purge)."""
import logging

logger = logging.getLogger(__name__)

DELETION_JOB_ID = "account-deletion"
RETENTION_JOB_ID = "account-retention"


def run_deletion(account_service) -> int:
    return account_service.run_deletion_job()


def run_retention(account_service, user_admin_service=None, session_service=None) -> int:
    retired = account_service.retire_inactive_users()
    logger.info("[ACCOUNT RETENTION] %d inactive users set to deleting", retired)
    if user_admin_service is not None:
        logger.info("[ADMIN LOG RETENTION] %d rows removed", user_admin_service.purge_intervention_log())
    if session_service is not None:
        # v1.7.0 step 12 — ROTATED and LOGOUT refresh tokens are kept 7 days
        logger.info("[SESSION CLEANUP] %d rotated or logged-out tokens removed", session_service.purge_revoked_tokens())
    return retired


def start_account_jobs(account_service, config, scheduler_factory=None, user_admin_service=None,
                       session_service=None):
    """Schedules and starts both jobs inside the running loop (_serve); None when switched off."""
    if not config.account_jobs_enabled:
        logger.info("[ACCOUNT JOBS] disabled, no job scheduled")
        return None
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.triggers.cron import CronTrigger

    scheduler = (scheduler_factory or AsyncIOScheduler)(timezone="UTC")
    scheduler.add_job(run_deletion, CronTrigger(minute="*/10", timezone="UTC"), args=[account_service],
                      id=DELETION_JOB_ID, replace_existing=True, max_instances=1, coalesce=True)
    scheduler.add_job(run_retention, CronTrigger(hour=0, minute=52, timezone="UTC"),
                      args=[account_service, user_admin_service, session_service],
                      id=RETENTION_JOB_ID, replace_existing=True, max_instances=1, coalesce=True)
    scheduler.start()
    return scheduler
