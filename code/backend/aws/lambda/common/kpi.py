"""v0.41.2 Step 41 F — KPI counters of one request, flushed by ONE ``UpdateItem ADD`` per story and
UTC day on ``KPI#<storyUuid>`` / ``DAY#YYYY-MM-DD`` after ``repo.flush()``; a failure is only logged."""
import json
import re
import time
from datetime import date, datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal

from boto3.dynamodb.conditions import Key

from common import db_utils
from common import story_index

PK_PREFIX = 'KPI#'
SK_PREFIX = 'DAY#'
MATCHES_STARTED = 'matchesStarted'
MATCHES_COMPLETED = 'matchesCompleted'
DURATION_MS_SUM = 'durationMsSum'
DURATION_CLOCKS_SUM = 'durationClocksSum'
COMA = 'coma'
STATUS_ACTIVE, STATUS_COMPLETED, STATUS_FAILED = 'ACTIVE', 'COMPLETED', 'FAILED'
MISSION_STATUSES = (STATUS_ACTIVE, STATUS_COMPLETED, STATUS_FAILED)

_PENDING = {}  # (storyUuid, day) -> {attribute: delta}


def today():
    return datetime.now(timezone.utc).date().isoformat()


def begin():
    """Top of the request: forget whatever a previous (failed) request left behind."""
    _PENDING.clear()


def pending():
    return {key: dict(values) for key, values in _PENDING.items()}


def add(story_uuid, attribute, delta=1):
    """Queue ``delta`` on today's counter of the story; blank story or zero delta ignored."""
    if not story_uuid or not attribute or not delta:
        return
    counters = _PENDING.setdefault((str(story_uuid), today()), {})
    counters[attribute] = counters.get(attribute, 0) + int(delta)


def choice(story_uuid, choice_uuid):
    if choice_uuid:
        add(story_uuid, f'c#{choice_uuid}')


def location_visit(story_uuid, location_uuid):
    if location_uuid:
        add(story_uuid, f'l#{location_uuid}')


def mission(story_uuid, mission_uuid, previous, status):
    """One counter per status change into ACTIVE, COMPLETED or FAILED (decision 13)."""
    if mission_uuid and status in MISSION_STATUSES and status != previous:
        add(story_uuid, f'm#{mission_uuid}#{status}')


def completed(story_uuid, match, now_ms=None):
    """MATCH_COMPLETED plus the durations, from the start stamp (else the creation)."""
    add(story_uuid, MATCHES_COMPLETED)
    start = match.get('timestampStartMs') or match.get('tsInsert')
    if start:
        now = int(now_ms if now_ms is not None else time.time() * 1000)
        add(story_uuid, DURATION_MS_SUM, max(0, now - int(start)))
    add(story_uuid, DURATION_CLOCKS_SUM, int(match.get('currentClock') or 0))


def flush():
    """One ``UpdateItem ADD`` per (story, day) with every delta of the request."""
    items = list(_PENDING.items())
    _PENDING.clear()
    written = 0
    for (story_uuid, day), counters in items:
        names, values, parts = {}, {}, []
        for i, (attribute, delta) in enumerate(sorted(counters.items())):
            names[f'#a{i}'] = attribute
            values[f':v{i}'] = int(delta)
            parts.append(f'#a{i} :v{i}')
        try:
            db_utils._get_table().update_item(
                Key={'PK': f'{PK_PREFIX}{story_uuid}', 'SK': f'{SK_PREFIX}{day}'},
                UpdateExpression='ADD ' + ', '.join(parts),
                ExpressionAttributeNames=names, ExpressionAttributeValues=values)
            written += 1
        except Exception as exc:  # noqa: BLE001 - a KPI never fails the request
            print(json.dumps({'level': 'WARN', 'event': 'KPI_FLUSH_FAILED', 'story': story_uuid,
                              'day': day, 'error': str(exc)}))
    return written


# ── the report (GET /api/admin/reports/kpi) ─────────────────────────────────

GROUP_DAY, GROUP_MONTH, GROUP_TOTAL = 'day', 'month', 'total'
DEFAULT_DAYS, MAX_DAYS = 30, 366
TOTAL_PERIOD = 'total'
_DAY = re.compile(r'^\d{4}-\d{2}-\d{2}$')
_PERIOD_SLOT = {MATCHES_STARTED: 0, MATCHES_COMPLETED: 1, DURATION_MS_SUM: 2, DURATION_CLOCKS_SUM: 3, COMA: 4}
_MISSION_SLOT = {STATUS_ACTIVE: 0, STATUS_COMPLETED: 1, STATUS_FAILED: 2}


class KpiError(Exception):
    """Bad query parameters: 400 INVALID_INPUT."""


def ratio(numerator, denominator, scale):
    """HALF_UP rounding of an exact division, like Java's BigDecimal.divide."""
    quantum = Decimal(1).scaleb(-scale)
    return float((Decimal(int(numerator)) / Decimal(int(denominator))).quantize(quantum, rounding=ROUND_HALF_UP))


def _parse_day(name, value):
    v = str(value).strip()
    if not _DAY.match(v):
        raise KpiError(f'{name} must be a UTC date YYYY-MM-DD')
    try:
        return date.fromisoformat(v)
    except ValueError:
        raise KpiError(f'{name} must be a UTC date YYYY-MM-DD') from None


def _blank(value):
    return value is None or not str(value).strip()


def query_days(story_uuid, from_day, to_day):
    """The DAY# items of one story between two days: ONE Query on the KPI# partition."""
    return db_utils._paginate(
        db_utils._get_table().query,
        KeyConditionExpression=Key('PK').eq(f'{PK_PREFIX}{story_uuid}')
        & Key('SK').between(f'{SK_PREFIX}{from_day}', f'{SK_PREFIX}{to_day}'))


def story_uuids():
    """Every story of the STORY_LIST index (GSI2), one Query per story afterwards."""
    out = []
    for row in db_utils.query_gsi('GSI2', story_index.STORY_LIST_PK) or []:
        key = str(row.get('GSI2_SK') or row.get('PK') or '')
        uuid = row.get('uuid') or (key.split('#', 1)[1] if '#' in key else None)
        if uuid and uuid not in out:
            out.append(uuid)
    return out


def _empty_periods(start, end, group):
    if group == GROUP_TOTAL:
        return {TOTAL_PERIOD: [0] * 5}
    periods = {}
    day = start
    while day <= end:
        key = day.isoformat()[:7] if group == GROUP_MONTH else day.isoformat()
        periods.setdefault(key, [0] * 5)
        day += timedelta(days=1)
    return periods


def _accumulate(item, slot, choices, locations, missions):
    for attribute, raw in item.items():
        try:
            value = int(raw)
        except (TypeError, ValueError):
            continue
        if attribute in _PERIOD_SLOT:
            slot[_PERIOD_SLOT[attribute]] += value
        elif attribute.startswith('c#'):
            choices[attribute[2:]] = choices.get(attribute[2:], 0) + value
        elif attribute.startswith('l#'):
            locations[attribute[2:]] = locations.get(attribute[2:], 0) + value
        elif attribute.startswith('m#') and attribute.count('#') >= 2:
            uuid, status = attribute[2:].rsplit('#', 1)
            if status in _MISSION_SLOT:
                missions.setdefault(uuid, [0, 0, 0])[_MISSION_SLOT[status]] += value


def _row(period, p):
    return {
        'period': period,
        'matchesStarted': p[0],
        'matchesCompleted': p[1],
        'completionRate': None if p[0] == 0 else ratio(p[1], p[0], 4),
        'avgDurationMinutes': None if p[1] == 0 else ratio(p[2], p[1] * 60_000, 2),
        'avgDurationClocks': None if p[1] == 0 else ratio(p[3], p[1], 2),
        'comaCount': p[4],
    }


def _counts(by_uuid):
    return [{'uuid': u, 'count': c} for u, c in sorted(by_uuid.items(), key=lambda kv: (-kv[1], kv[0]))]


def report(story_uuid, from_day, to_day, group_by, today_fn=None):
    """The KpiReport of Java/Python; raises ``KpiError`` on bad input."""
    group = (group_by or '').strip().lower() or GROUP_DAY
    if group not in (GROUP_DAY, GROUP_MONTH, GROUP_TOTAL):
        raise KpiError('groupBy must be day, month or total')
    now = date.fromisoformat((today_fn or today)())
    end = now if _blank(to_day) else _parse_day('to', to_day)
    start = end - timedelta(days=DEFAULT_DAYS - 1) if _blank(from_day) else _parse_day('from', from_day)
    if start > end:
        raise KpiError('from must not be after to')
    if (end - start).days + 1 > MAX_DAYS:
        raise KpiError(f'The range may span at most {MAX_DAYS} days')
    story = None if _blank(story_uuid) else str(story_uuid).strip()

    periods = _empty_periods(start, end, group)
    choices, locations, missions = {}, {}, {}
    for uuid in ([story] if story else story_uuids()):
        for item in query_days(uuid, start.isoformat(), end.isoformat()):
            day = str(item.get('SK', ''))[len(SK_PREFIX):]
            key = TOTAL_PERIOD if group == GROUP_TOTAL else (day[:7] if group == GROUP_MONTH else day)
            slot = periods.get(key)
            if slot is not None:
                _accumulate(item, slot, choices, locations, missions)
    return {
        'storyUuid': story,
        'from': start.isoformat(),
        'to': end.isoformat(),
        'groupBy': group,
        'rows': [_row(period, p) for period, p in periods.items()],
        'choices': _counts(choices),
        'locations': _counts(locations),
        'missions': [{'uuid': u, 'activated': v[0], 'completed': v[1], 'failed': v[2]}
                     for u, v in sorted(missions.items())],
    }
