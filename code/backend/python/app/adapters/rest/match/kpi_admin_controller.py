"""v0.41.2 Step 41 F — GET /api/admin/reports/kpi: the daily UTC KPI counters per story grouped by day,
month or total (admin app/port only). Mirrors ``KpiAdminController.java``."""
from typing import Any, Dict, Optional

from app.adapters.rest.match.match_controller import _error
from app.core.ports.match.kpi_ports import KpiError, KpiPort, KpiReport
from fastapi import APIRouter, Query


def report_to_camel(r: KpiReport) -> Dict[str, Any]:
    return {
        "storyUuid": r.story_uuid,
        "from": r.from_day,
        "to": r.to_day,
        "groupBy": r.group_by,
        "rows": [{"period": x.period, "matchesStarted": x.matches_started,
                  "matchesCompleted": x.matches_completed, "completionRate": x.completion_rate,
                  "avgDurationMinutes": x.avg_duration_minutes, "avgDurationClocks": x.avg_duration_clocks,
                  "comaCount": x.coma_count} for x in r.rows],
        "choices": [{"uuid": c.uuid, "count": c.count} for c in r.choices],
        "locations": [{"uuid": c.uuid, "count": c.count} for c in r.locations],
        "missions": [{"uuid": m.uuid, "activated": m.activated, "completed": m.completed,
                      "failed": m.failed} for m in r.missions],
    }


class KpiAdminController:
    def __init__(self, kpi_port: KpiPort):
        self.kpi_port = kpi_port
        self.router = APIRouter()
        self.router.add_api_route("/api/admin/reports/kpi", self.get_kpi, methods=["GET"])

    def get_kpi(self, story_uuid: Optional[str] = Query(None, alias="storyUuid"),
                from_day: Optional[str] = Query(None, alias="from"),
                to_day: Optional[str] = Query(None, alias="to"),
                group_by: Optional[str] = Query(None, alias="groupBy")):
        try:
            return report_to_camel(self.kpi_port.report(story_uuid, from_day, to_day, group_by))
        except KpiError as exc:
            return _error(exc.code, exc.message, 400)
