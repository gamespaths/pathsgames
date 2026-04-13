"""
story/handler.py — Paths Games AWS Lambda
Handles every route registered for StoryFunction in template.yaml.

Routes (API contracts match Java OpenAPI specs):
  GET    /api/stories                     → list_stories      (public)
  GET    /api/stories/{uuid}              → get_story         (public)
  POST   /api/admin/stories/import        → import_story      (ADMIN)
  GET    /api/admin/stories               → list_all_stories  (ADMIN)
  DELETE /api/admin/stories/{uuid}        → delete_story      (ADMIN)

Response shapes follow:
  StorySummaryResponse  (v0.14.0-story-api.yaml)
  StoryDetailResponse   (v0.14.0-story-api.yaml)
  StoryImportResponse   (v0.14.0-story-api.yaml)
  DeleteStoryResponse   (v0.14.0-story-api.yaml)
  ErrorResponse         (shared)

DynamoDB layout for stories
  PK = STORY#{uuid}, SK = METADATA
    All story fields + texts dict + difficulties list + GSI keys.
  GSI: GSI1_PK = STORY_LIST, GSI1_SK = PRIORITY#{priority:010}#{uuid}
"""

import json
import uuid as uuid_lib
import decimal

from common import db_utils
from common import jwt_utils

# ─── shared helpers ───────────────────────────────────────────────────────────

HEADERS = {"Content-Type": "application/json"}

class _DecimalEncoder(json.JSONEncoder):
    """Serialise DynamoDB Decimal values as int or float."""
    def default(self, obj):
        if isinstance(obj, decimal.Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super().default(obj)

def _dumps(obj):
    return json.dumps(obj, cls=_DecimalEncoder)

def _ok(body, status=200):
    return {"statusCode": status, "headers": HEADERS, "body": _dumps(body)}

def _err(status, code, message):
    return {"statusCode": status, "headers": HEADERS,
            "body": _dumps({"error": code, "message": message})}

def _normalize_path(raw_path):
    if raw_path.startswith('/api/'):
        return raw_path
    idx = raw_path.find('/api/')
    return raw_path[idx:] if idx >= 0 else raw_path

def _bearer_token(event):
    auth = (event.get('headers') or {}).get('authorization',
           (event.get('headers') or {}).get('Authorization', ''))
    if auth.startswith('Bearer '):
        return auth[7:]
    return None

def _require_admin(event):
    """Return (user_dict, None) or (None, error_response).

    Accepts real HS256 JWT tokens and MOCK_ACCESS_ tokens.
    """
    token = _bearer_token(event)
    claims = jwt_utils.verify_access_token(token)
    if not claims or not claims.get('uuid'):
        return None, _err(401, 'UNAUTHORIZED', 'Valid access token required')

    user_uuid = claims['uuid']

    if claims['source'] == 'jwt':
        # Trust JWT claims
        if claims.get('role') != 'ADMIN':
            return None, _err(403, 'FORBIDDEN', 'ADMIN role required')
        user = db_utils.get_item(f'USER#{user_uuid}')
        if user:
            return user, None
        # User exists only in the Java backend
        return {
            'uuid':     user_uuid,
            'username': claims.get('username'),
            'role':     'ADMIN',
        }, None

    # mock token — DB lookup
    user = db_utils.get_item(f'USER#{user_uuid}')
    if not user:
        return None, _err(401, 'UNAUTHORIZED', 'User not found')
    if user.get('role') != 'ADMIN':
        return None, _err(403, 'FORBIDDEN', 'ADMIN role required')
    return user, None

def _get_lang(event):
    """Extract ?lang= query parameter (default 'en')."""
    qs = event.get('queryStringParameters') or {}
    return qs.get('lang', 'en') or 'en'

def _resolve_text(texts_dict, lang, field):
    """Resolve a text field with English fallback."""
    t = texts_dict.get(lang) or texts_dict.get('en') or {}
    return t.get(field)

def _story_summary(item, lang):
    """Build StorySummaryResponse from a DynamoDB story item."""
    texts = item.get('texts', {})
    return {
        'uuid':            item.get('uuid'),
        'title':           _resolve_text(texts, lang, 'title'),
        'description':     _resolve_text(texts, lang, 'description'),
        'author':          item.get('author'),
        'category':        item.get('category'),
        'group':           item.get('group'),
        'visibility':      item.get('visibility'),
        'priority':        int(item.get('priority') or 0),
        'peghi':           int(item.get('peghi') or 0),
        'difficultyCount': int(item.get('difficulty_count') or 0),
    }

def _story_detail(item, lang):
    """Build StoryDetailResponse from a DynamoDB story item."""
    texts = item.get('texts', {})
    raw_diffs = item.get('difficulties', [])
    difficulties = []
    for d in raw_diffs:
        difficulties.append({
            'uuid':                  d.get('uuid'),
            'description':           _resolve_text(d.get('texts', {}), lang, 'title'),
            'expCost':               int(d.get('expCost') or 0),
            'maxWeight':             int(d.get('maxWeight') or 0),
            'minCharacter':          int(d.get('minCharacter') or 0),
            'maxCharacter':          int(d.get('maxCharacter') or 0),
            'costHelpComa':          int(d.get('costHelpComa') or 0),
            'costMaxCharacteristics':int(d.get('costMaxCharacteristics') or 0),
            'numberMaxFreeAction':   int(d.get('numberMaxFreeAction') or 0),
        })
    return {
        'uuid':                   item.get('uuid'),
        'title':                  _resolve_text(texts, lang, 'title'),
        'description':            _resolve_text(texts, lang, 'description'),
        'author':                 item.get('author'),
        'category':               item.get('category'),
        'group':                  item.get('group'),
        'visibility':             item.get('visibility'),
        'priority':               int(item.get('priority') or 0),
        'peghi':                  int(item.get('peghi') or 0),
        'versionMin':             item.get('versionMin'),
        'versionMax':             item.get('versionMax'),
        'clockSingularDescription': item.get('clockSingularDescription'),
        'clockPluralDescription':   item.get('clockPluralDescription'),
        'copyrightText':          None,  # stored in texts if needed
        'linkCopyright':          item.get('linkCopyright'),
        'locationCount':          int(item.get('location_count') or 0),
        'eventCount':             int(item.get('event_count') or 0),
        'itemCount':              int(item.get('item_count') or 0),
        'difficulties':           difficulties,
    }

# ─── router ───────────────────────────────────────────────────────────────────

def lambda_handler(event, context):
    path   = _normalize_path(event.get('rawPath', event.get('path', '')))
    method = (event.get('requestContext', {})
                   .get('http', {})
                   .get('method', event.get('httpMethod', '')))
    params = event.get('pathParameters') or {}

    # public
    if path == '/api/stories' and method == 'GET':
        return list_stories(event)
    if path.startswith('/api/stories/') and method == 'GET':
        uid = params.get('uuid') or path.split('/')[-1]
        return get_story(event, uid)

    # admin — static route before parameterised
    if path == '/api/admin/stories/import' and method == 'POST':
        return import_story(event)
    if path == '/api/admin/stories' and method == 'GET':
        return list_all_stories(event)
    if path.startswith('/api/admin/stories/') and method == 'DELETE':
        uid = params.get('uuid') or path.split('/')[-1]
        return delete_story(event, uid)

    return _err(404, 'NOT_FOUND', f'Resource {path} not found')

# ─── endpoint handlers ────────────────────────────────────────────────────────

def list_stories(event):
    lang  = _get_lang(event)
    items = db_utils.query_gsi('GSI1', 'STORY_LIST')
    # only PUBLIC stories
    public = [i for i in items if i.get('visibility') == 'PUBLIC']
    # sort by priority descending
    public.sort(key=lambda x: int(x.get('priority') or 0), reverse=True)
    return _ok([_story_summary(i, lang) for i in public])


def get_story(event, story_uuid):
    lang = _get_lang(event)
    item = db_utils.get_item(f'STORY#{story_uuid}')
    if not item:
        return _err(404, 'STORY_NOT_FOUND',
                    f'No story found with UUID: {story_uuid}')
    return _ok(_story_detail(item, lang))


def import_story(event):
    _, err = _require_admin(event)
    if err:
        return err

    if not event.get('body'):
        return _err(400, 'EMPTY_IMPORT_DATA', 'Request body must contain story data')

    try:
        data = json.loads(event['body'])
    except Exception:
        return _err(400, 'INVALID_IMPORT_DATA', 'Request body is not valid JSON')

    if not data:
        return _err(400, 'EMPTY_IMPORT_DATA', 'storyData must not be null or empty')

    story_uuid = data.get('uuid')
    if not story_uuid:
        story_uuid = str(uuid_lib.uuid4())

    # If story already exists → delete it first (replace-on-conflict)
    existing = db_utils.get_item(f'STORY#{story_uuid}')
    if existing:
        db_utils.delete_all_by_pk(f'STORY#{story_uuid}')

    # Build multi-lang texts dict from the texts array
    raw_texts = data.get('texts', [])
    id_title = data.get('idTextTitle')
    id_desc  = data.get('idTextDescription')

    texts_dict = {}
    for t in raw_texts:
        lang = t.get('lang', 'en')
        id_t = t.get('idText')
        if lang not in texts_dict:
            texts_dict[lang] = {}
        if id_t == id_title:
            texts_dict[lang]['title'] = t.get('shortText') or t.get('longText')
        if id_t == id_desc:
            texts_dict[lang]['description'] = t.get('shortText') or t.get('longText')

    # Build difficulties list (store inline with story metadata)
    raw_diffs = data.get('difficulties', [])
    difficulties = []
    for i, d in enumerate(raw_diffs):
        diff_uuid = str(uuid_lib.uuid4())
        # Map idTextDescription to a stub text dict for description
        id_diff_desc = d.get('idTextDescription')
        diff_texts = {}
        for t in raw_texts:
            if t.get('idText') == id_diff_desc:
                lang_t = t.get('lang', 'en')
                diff_texts[lang_t] = {'title': t.get('shortText') or t.get('longText')}
        difficulties.append({
            'uuid':                   diff_uuid,
            'texts':                  diff_texts,
            'expCost':                d.get('expCost', 0),
            'maxWeight':              d.get('maxWeight', 0),
            'minCharacter':           d.get('minCharacter', 0),
            'maxCharacter':           d.get('maxCharacter', 0),
            'costHelpComa':           d.get('costHelpComa', 0),
            'costMaxCharacteristics': d.get('costMaxCharacteristics', 0),
            'numberMaxFreeAction':    d.get('numberMaxFreeAction', 0),
        })

    priority = int(data.get('priority') or 0)

    story_item = {
        'PK':                     f'STORY#{story_uuid}',
        'SK':                     'METADATA',
        'uuid':                   story_uuid,
        'author':                 data.get('author'),
        'category':               data.get('category'),
        'group':                  data.get('group'),
        'visibility':             data.get('visibility', 'PUBLIC'),
        'priority':               priority,
        'peghi':                  int(data.get('peghi') or 0),
        'versionMin':             data.get('versionMin'),
        'versionMax':             data.get('versionMax'),
        'clockSingularDescription': data.get('clockSingularDescription'),
        'clockPluralDescription': data.get('clockPluralDescription'),
        'linkCopyright':          data.get('linkCopyright'),
        'texts':                  texts_dict,
        'difficulties':           difficulties,
        'difficulty_count':       len(difficulties),
        'location_count':         len(data.get('locations', [])),
        'event_count':            len(data.get('events', [])),
        'item_count':             len(data.get('items', [])),
        # GSI for story listing
        'GSI1_PK':                'STORY_LIST',
        'GSI1_SK':                f'STORY#{story_uuid}',
    }
    db_utils.put_item(story_item)

    return _ok({
        'storyUuid':           story_uuid,
        'status':              'IMPORTED',
        'textsImported':       len(raw_texts),
        'locationsImported':   len(data.get('locations', [])),
        'eventsImported':      len(data.get('events', [])),
        'itemsImported':       len(data.get('items', [])),
        'difficultiesImported':len(difficulties),
        'classesImported':     len(data.get('classes', [])),
        'choicesImported':     len(data.get('choices', [])),
    }, status=201)


def list_all_stories(event):
    _, err = _require_admin(event)
    if err:
        return err
    lang  = _get_lang(event)
    items = db_utils.query_gsi('GSI1', 'STORY_LIST')
    items.sort(key=lambda x: int(x.get('priority') or 0), reverse=True)
    return _ok([_story_summary(i, lang) for i in items])


def delete_story(event, story_uuid):
    _, err = _require_admin(event)
    if err:
        return err
    item = db_utils.get_item(f'STORY#{story_uuid}')
    if not item:
        return _err(404, 'STORY_NOT_FOUND',
                    f'No story found with UUID: {story_uuid}')
    db_utils.delete_all_by_pk(f'STORY#{story_uuid}')
    return _ok({'status': 'DELETED', 'uuid': story_uuid})
