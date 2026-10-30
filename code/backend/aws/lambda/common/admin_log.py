"""v1.7.0 step 10 — the admin intervention log writer (mirror of AdminInterventionAdapter.java): items
ADMINLOG#YYYY-MM / <ts_ms:013d>#<seq> with admin uuid, action, target uuid and reason, expired by a 24-month ttl."""
import time
import uuid as uuid_lib
from datetime import datetime, timezone

from common import db_utils

SYSTEM = 'SYSTEM'
RETENTION_DAYS = 731  # 24 months


def record(admin_uuid, action, target_uuid, reason, now_ms=None):
    now = int(now_ms if now_ms is not None else time.time() * 1000)
    month = datetime.fromtimestamp(now / 1000, tz=timezone.utc).strftime('%Y-%m')
    item = {'PK': f'ADMINLOG#{month}', 'SK': f'{now:013d}#{uuid_lib.uuid4().hex[:8]}',
            'admin_uuid': admin_uuid if admin_uuid and str(admin_uuid).strip() else 'UNKNOWN',
            'action': action, 'target_uuid': target_uuid, 'reason': reason,
            'ts_insert': now, 'ttl': now // 1000 + RETENTION_DAYS * 86400}
    return db_utils.put_item(item)
