"""
story/handler.py — Paths Games AWS Lambda
Handles every route registered for StoryFunction in template.yaml.

Routes (API contracts match Java OpenAPI specs):
  GET    /api/stories                     → list_stories           (public)
  GET    /api/stories/{uuid}              → get_story              (public)
  GET    /api/stories/categories          → list_categories        (public)  [Step 15]
  GET    /api/stories/category/{category} → list_stories_by_cat    (public)  [Step 15]
  GET    /api/stories/groups              → list_groups            (public)  [Step 15]
  GET    /api/stories/group/{group}       → list_stories_by_group  (public)  [Step 15]
  POST   /api/admin/stories/import        → import_story           (ADMIN)
  GET    /api/admin/stories               → list_all_stories       (ADMIN)
  GET    /api/admin/stories/{uuid}        → get_admin_story        (ADMIN)
  DELETE /api/admin/stories/{uuid}        → delete_story           (ADMIN)

Response shapes follow:
  StorySummaryResponse  (v0.15.0-story-content-api.yaml)
  StoryDetailResponse   (v0.15.0-story-content-api.yaml)
  StoryImportResponse   (v0.14.0-story-api.yaml)
  DeleteStoryResponse   (v0.14.0-story-api.yaml)
  ErrorResponse         (shared)

DynamoDB layout for stories
  PK = STORY#{uuid}, SK = METADATA
    All story fields + texts dict + difficulties list + GSI keys.
    Step 15: + characterTemplates, classes, traits, card (inline).
  GSI: GSI1_PK = STORY_LIST, GSI1_SK = STORY#{uuid}
"""

import json
import os
import uuid as uuid_lib

from common import db_utils
from common import jwt_utils
from common.response import dumps as _dumps, ok as _ok, err as _err, HEADERS
from common.http_utils import (normalize_path as _normalize_path,
                               get_source_ip as _get_source_ip,
                               bearer_token as _bearer_token,
                               check_admin_ip as _check_admin_ip_common)
from common.data_utils import (safe_int as _safe_int,
                               resolve_raw_text as _resolve_raw_text,
                               resolve_card_from_raw as _find_card_from_raw)

try:
    from story import story_validator
except ImportError:  # when handler is imported as a top-level module in tests
    import story_validator

# ─── shared helpers ───────────────────────────────────────────────────────────

def _check_admin_ip(event):
    """Return error response if caller IP not in ADMIN_IP_WHITELIST, else None."""
    whitelist_raw = os.environ.get('ADMIN_IP_WHITELIST', '').strip()
    if not whitelist_raw:
        return None
    allowed = [ip.strip() for ip in whitelist_raw.split(',') if ip.strip()]
    if not allowed:
        return None
    source_ip = _get_source_ip(event)
    if source_ip not in allowed:
        return _err(403, 'FORBIDDEN', f'IP {source_ip} not authorized for admin access')
    return None

def _validation_400(errors):
    """400 body for a failed story validation, carrying the errors[] array."""
    return {"statusCode": 400, "headers": HEADERS,
            "body": _dumps({"error": "INVALID_STORY",
                            "message": story_validator.summary(errors),
                            "errors": errors})}

def _require_admin(event):
    """Return (user_dict, None) or (None, error_response).

    Accepts real HS256 JWT tokens and MOCK_ACCESS_ tokens.
    IP is checked first against ADMIN_IP_WHITELIST env var (before JWT validation).
    """
    ip_err = _check_admin_ip(event)
    if ip_err:
        return None, ip_err
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



# ─── response builders ────────────────────────────────────────────────────────

def _story_summary(item, lang):
    """Build StorySummaryResponse from a DynamoDB story item."""
    texts = item.get('texts', {})

    # Card resolution — cards are stored inline in raw_cards on the story item
    raw_cards = item.get('raw_cards', [])
    raw_texts_list = item.get('raw_texts', [])
    idCard = item.get('idCard')
    card = _find_card_from_raw(raw_cards, raw_texts_list, idCard, lang)

    return {
        'uuid':            item.get('uuid'),
        'id':              _safe_int(item.get('id')),
        'title':           _resolve_text(texts, lang, 'title'),
        'description':     _resolve_text(texts, lang, 'description'),
        'author':          item.get('author'),
        'category':        item.get('category'),
        'group':           item.get('group'),
        'visibility':      item.get('visibility'),
        'priority':        _safe_int(item.get('priority')),
        'peghi':           _safe_int(item.get('peghi')),
        'difficultyCount': _safe_int(item.get('difficulty_count')),
        'card':            card,
        'idTextClockSingular': _safe_int(item.get('idTextClockSingular')),
        'idTextClockPlural':   _safe_int(item.get('idTextClockPlural')),
    }

def _story_detail(item, lang):
    """Build StoryDetailResponse from a DynamoDB story item.

    Includes Step 15 enrichments: characterTemplates, classes, traits,
    card, classCount, characterTemplateCount, traitCount.
    """
    texts = item.get('texts', {})

    # Cards/texts are stored inline on the story item
    raw_cards = item.get('raw_cards', [])
    raw_texts_list = item.get('raw_texts', [])

    def _build_card(id_card, fallback_lang):
        return _find_card_from_raw(raw_cards, raw_texts_list, id_card, fallback_lang)

    # Difficulties
    raw_diffs = item.get('difficulties', [])
    difficulties = []
    for d in raw_diffs:
        d_id_card = d.get('idCard')
        difficulties.append({
            'uuid':                  d.get('uuid'),
            'id':                    _safe_int(d.get('id')),
            'description':           _resolve_text(d.get('texts', {}), lang, 'title'),
            'expCost':               _safe_int(d.get('expCost')),
            'maxWeight':             _safe_int(d.get('maxWeight')),
            'minCharacter':          _safe_int(d.get('minCharacter')),
            'maxCharacter':          _safe_int(d.get('maxCharacter')),
            'costHelpComa':          _safe_int(d.get('costHelpComa')),
            'costMaxCharacteristics':_safe_int(d.get('costMaxCharacteristics')),
            'numberMaxFreeAction':   _safe_int(d.get('numberMaxFreeAction')),
            'life':                  _safe_int(d.get('life', 0)),
            'energy':                _safe_int(d.get('energy', 0)),
            'sad':                   _safe_int(d.get('sad', 0)),
            'dexterity':             _safe_int(d.get('dexterity', 0)),
            'intelligence':          _safe_int(d.get('intelligence', 0)),
            'constitution':          _safe_int(d.get('constitution', 0)),
            'weight':                _safe_int(d.get('weight', 0)),
            # Step 23 — trait cost budgets; None = no limit
            'traitCostPositiveBudget': _safe_int(d.get('traitCostPositiveBudget'))
                                       if d.get('traitCostPositiveBudget') is not None else None,
            'traitCostNegativeBudget': _safe_int(d.get('traitCostNegativeBudget'))
                                       if d.get('traitCostNegativeBudget') is not None else None,
            'idCard':                _safe_int(d_id_card) if d_id_card is not None else None,
            'card':                  _build_card(d_id_card, lang),
        })

    # Step 15: Character Templates
    raw_templates = item.get('characterTemplates', [])
    character_templates = []
    for ct in raw_templates:
        ct_id_card = ct.get('idCard')
        character_templates.append({
            'uuid':              ct.get('uuid'),
            'id_tipo':           _safe_int(ct.get('id_tipo')),
            'name':              _resolve_text(ct.get('texts', {}), lang, 'name'),
            'description':       _resolve_text(ct.get('texts', {}), lang, 'description'),
            'lifeMax':           _safe_int(ct.get('lifeMax')),
            'energyMax':         _safe_int(ct.get('energyMax')),
            'sadMax':            _safe_int(ct.get('sadMax')),
            'dexterityStart':    _safe_int(ct.get('dexterityStart')),
            'intelligenceStart': _safe_int(ct.get('intelligenceStart')),
            'constitutionStart': _safe_int(ct.get('constitutionStart')),
            'idCard':            _safe_int(ct_id_card) if ct_id_card is not None else None,
            'card':              _build_card(ct_id_card, lang),
            'idClassPermitted':  ct.get('idClassPermitted'),
            'idClassProhibited': ct.get('idClassProhibited'),
        })

    # Step 15: Classes (+ bonuses from list_classes_bonus)
    raw_classes = item.get('classes', [])
    raw_class_bonuses = item.get('classBonuses', []) or []
    classes = []
    for cl in raw_classes:
        cl_id_card = cl.get('idCard')
        cl_id = _safe_int(cl.get('id'))
        cl_bonuses = []
        for b in raw_class_bonuses:
            b_class_id = _safe_int(b.get('idClass'))
            if cl_id is not None and b_class_id == cl_id:
                cl_bonuses.append({
                    'uuid':      b.get('uuid'),
                    'statistic': b.get('statistic') or b.get('bonusType'),
                    'value':     _safe_int(b.get('value') if b.get('value') is not None else b.get('bonusValue')),
                })
        classes.append({
            'uuid':             cl.get('uuid'),
            'id':               cl_id,
            'name':             _resolve_text(cl.get('texts', {}), lang, 'name'),
            'description':      _resolve_text(cl.get('texts', {}), lang, 'description'),
            'weightMax':        _safe_int(cl.get('weightMax')),
            'dexterityBase':    _safe_int(cl.get('dexterityBase')),
            'intelligenceBase': _safe_int(cl.get('intelligenceBase')),
            'constitutionBase': _safe_int(cl.get('constitutionBase')),
            'idCard':           _safe_int(cl_id_card) if cl_id_card is not None else None,
            'card':             _build_card(cl_id_card, lang),
            'bonuses':          cl_bonuses,
        })

    # Step 15: Traits
    raw_traits = item.get('traits', [])
    traits = [_trait_detail(item, tr, lang) for tr in raw_traits]

    # Step 15: story-level card
    idCard = item.get('idCard')
    card = _build_card(idCard, lang)

    return {
        'uuid':                       item.get('uuid'),
        'id':                         _safe_int(item.get('id')),
        'title':                      _resolve_text(texts, lang, 'title'),
        'description':                _resolve_text(texts, lang, 'description'),
        'author':                     item.get('author'),
        'category':                   item.get('category'),
        'group':                      item.get('group'),
        'visibility':                 item.get('visibility'),
        'priority':                   _safe_int(item.get('priority')),
        'peghi':                      _safe_int(item.get('peghi')),
        'versionMin':                 item.get('versionMin'),
        'versionMax':                 item.get('versionMax'),
        'idTextTitle':                _safe_int(item.get('idTextTitle')),
        'idTextDescription':          _safe_int(item.get('idTextDescription')),
        'idLocationStart':            _safe_int(item.get('idLocationStart')),
        'idImage':                    _safe_int(item.get('idImage')),
        'idCard':                     _safe_int(item.get('idCard')),
        'idLocationAllPlayerComa':    _safe_int(item.get('idLocationAllPlayerComa')),
        'idEventAllPlayerComa':       _safe_int(item.get('idEventAllPlayerComa')),
        'idEventEndGame':             _safe_int(item.get('idEventEndGame')),
        'idTextCopyright':            _safe_int(item.get('idTextCopyright')),
        'idCreator':                  _safe_int(item.get('idCreator')),
        'idTextClockSingular':        _safe_int(item.get('idTextClockSingular')),
        'idTextClockPlural':          _safe_int(item.get('idTextClockPlural')),
        'clockSingularDescription':   _resolve_text(texts, lang, 'clockSingular'),
        'clockPluralDescription':     _resolve_text(texts, lang, 'clockPlural'),
        'copyrightText':              None,  # stored in texts if needed
        'linkCopyright':              item.get('linkCopyright'),
        'locationCount':              _safe_int(item.get('location_count')),
        'eventCount':                 _safe_int(item.get('event_count')),
        'itemCount':                  _safe_int(item.get('item_count')),
        'classCount':                 _safe_int(item.get('class_count')),
        'characterTemplateCount':     _safe_int(item.get('template_count')),
        'traitCount':                 _safe_int(item.get('trait_count')),
        'difficulties':               difficulties,
        'characterTemplates':         character_templates,
        'classes':                    classes,
        'traits':                     traits,
        'card':                       card,
    }


# ─── router ───────────────────────────────────────────────────────────────────

def lambda_handler(event, context):
    path   = _normalize_path(event.get('rawPath', event.get('path', '')))
    method = (event.get('requestContext', {})
                   .get('http', {})
                   .get('method', event.get('httpMethod', '')))
    params = event.get('pathParameters') or {}

    # Step 15: category/group endpoints — MUST be checked before /api/stories/{uuid}
    if path == '/api/stories/categories' and method == 'GET':
        return list_categories(event)
    if path.startswith('/api/stories/category/') and method == 'GET':
        cat = params.get('category') or path.split('/')[-1]
        return list_stories_by_category(event, cat)
    if path == '/api/stories/groups' and method == 'GET':
        return list_groups(event)
    if path.startswith('/api/stories/group/') and method == 'GET':
        grp = params.get('group') or path.split('/')[-1]
        return list_stories_by_group(event, grp)

    # public
    if path == '/api/stories' and method == 'GET':
        return list_stories(event)
    # Step 23: /api/stories/{uuidStory}/classes/{uuidClass}/traits
    parts = path.split('/')
    if (method == 'GET' and path.startswith('/api/stories/') and len(parts) == 7
            and parts[4] == 'classes' and parts[6] == 'traits'):
        return list_traits_for_class(event,
                                     params.get('uuidStory') or parts[3],
                                     params.get('uuidClass') or parts[5])
    if path.startswith('/api/stories/') and method == 'GET' and len(path.split('/')) == 4:
        uid = params.get('uuid') or path.split('/')[-1]
        return get_story(event, uid)

    # admin — static routes before parameterised
    if path == '/api/admin/stories/import' and method == 'POST':
        return import_story(event)
    if method == 'GET' and path.endswith('/validate') and path.startswith('/api/admin/stories/'):
        v_uuid = params.get('uuid') or path.split('/')[-2]
        return validate_story(event, v_uuid)
    if path == '/api/admin/stories' and method == 'GET':
        return list_all_stories(event)
    if path == '/api/admin/stories' and method == 'POST':
        return create_story(event)
    if method == 'GET' and 'uuid' in params and 'uuidStory' not in params and 'entityType' not in params:
        return get_admin_story(event, params['uuid'])

    # admin — parameterised routes
    if method == 'PUT' and 'uuidStory' in params and 'entityType' not in params:
        return update_story(event, params['uuidStory'])

    if 'uuidStory' in params and 'entityType' in params:
        st_uuid  = params['uuidStory']
        ent_type = params['entityType']
        ent_uuid = params.get('entityUuid')

        if method == 'GET':
            if ent_uuid:
                return get_entity(event, st_uuid, ent_type, ent_uuid)
            return list_entities(event, st_uuid, ent_type)
        if method == 'POST':
            return create_entity(event, st_uuid, ent_type)
        if method == 'PUT' and ent_uuid:
            return update_entity(event, st_uuid, ent_type, ent_uuid)
        if method == 'DELETE' and ent_uuid:
            return delete_entity(event, st_uuid, ent_type, ent_uuid)

    # old delete story (keeping for compatibility if needed, but uuidStory is preferred)
    if path.startswith('/api/admin/stories/') and method == 'DELETE' and 'uuid' in params:
        return delete_story(event, params['uuid'])

    return _err(404, 'NOT_FOUND', f'Resource {path} not found')

# ─── endpoint handlers ────────────────────────────────────────────────────────

def list_stories(event):
    lang  = _get_lang(event)
    items = db_utils.query_gsi('GSI1', 'STORY_LIST')
    # only PUBLIC stories
    public = [i for i in items if i.get('visibility') == 'PUBLIC']
    # sort by priority descending
    public.sort(key=lambda x: _safe_int(x.get('priority')), reverse=True)
    return _ok([_story_summary(i, lang) for i in public])


def get_story(event, story_uuid):
    lang = _get_lang(event)
    item = db_utils.get_item(f'STORY#{story_uuid}')
    if not item:
        return _err(404, 'STORY_NOT_FOUND',
                    f'No story found with UUID: {story_uuid}')
    return _ok(_story_detail(item, lang))


# ─── Step 23: trait listing filtered by class ─────────────────────────────────

def _trait_detail(item, tr, lang):
    tr_id_card = tr.get('idCard')
    card = _find_card_from_raw(item.get('raw_cards', []), item.get('raw_texts', []),
                               tr_id_card, lang)
    return {
        'uuid':              tr.get('uuid'),
        'id':                _safe_int(tr.get('id')),
        'name':              _resolve_text(tr.get('texts', {}), lang, 'name'),
        'description':       _resolve_text(tr.get('texts', {}), lang, 'description'),
        'costPositive':      _safe_int(tr.get('costPositive')),
        'costNegative':      _safe_int(tr.get('costNegative')),
        'idClassPermitted':  tr.get('idClassPermitted'),
        'idClassProhibited': tr.get('idClassProhibited'),
        'idCard':            _safe_int(tr_id_card) if tr_id_card is not None else None,
        'card':              card,
        'life':              _safe_int(tr.get('life')),
        'energy':            _safe_int(tr.get('energy')),
        'sad':               _safe_int(tr.get('sad')),
        'dexterity':         _safe_int(tr.get('dexterity')),
        'intelligence':      _safe_int(tr.get('intelligence')),
        'constitution':      _safe_int(tr.get('constitution')),
        'weight':            _safe_int(tr.get('weight')),
    }


def list_traits_for_class(event, story_uuid, class_uuid):
    """GET /api/stories/{uuidStory}/classes/{uuidClass}/traits — Step 23.

    A trait is selectable when idClassPermitted is null or equals the class
    and idClassProhibited is null or differs from the class.
    """
    lang = _get_lang(event)
    item = db_utils.get_item(f'STORY#{story_uuid}')
    if not item:
        return _err(404, 'STORY_NOT_FOUND', f'No story found with UUID: {story_uuid}')
    clazz = next((c for c in (item.get('classes') or []) if c.get('uuid') == class_uuid), None)
    if clazz is None:
        return _err(404, 'CLASS_NOT_FOUND', f'No class found with UUID: {class_uuid}')
    class_id = _safe_int(clazz.get('id'))

    def selectable(tr):
        permitted = tr.get('idClassPermitted')
        prohibited = tr.get('idClassProhibited')
        permitted_ok = permitted is None or (class_id is not None and int(permitted) == class_id)
        prohibited_ok = prohibited is None or class_id is None or int(prohibited) != class_id
        return permitted_ok and prohibited_ok

    traits = [_trait_detail(item, tr, lang) for tr in (item.get('traits') or []) if selectable(tr)]
    return _ok(traits)


# ─── Step 15: Category and Group endpoints ────────────────────────────────────

def list_categories(event):
    """GET /api/stories/categories — distinct categories from PUBLIC stories."""
    items = db_utils.query_gsi('GSI1', 'STORY_LIST')
    public = [i for i in items if i.get('visibility') == 'PUBLIC']
    categories = set()
    for i in public:
        cat = i.get('category')
        if cat:
            categories.add(cat)
    return _ok(sorted(categories))


def list_stories_by_category(event, category):
    """GET /api/stories/category/{category} — PUBLIC stories matching category."""
    lang = _get_lang(event)
    items = db_utils.query_gsi('GSI1', 'STORY_LIST')
    matches = [i for i in items
               if i.get('visibility') == 'PUBLIC' and i.get('category') == category]
    matches.sort(key=lambda x: _safe_int(x.get('priority')), reverse=True)
    return _ok([_story_summary(i, lang) for i in matches])


def list_groups(event):
    """GET /api/stories/groups — distinct groups from PUBLIC stories."""
    items = db_utils.query_gsi('GSI1', 'STORY_LIST')
    public = [i for i in items if i.get('visibility') == 'PUBLIC']
    groups = set()
    for i in public:
        grp = i.get('group')
        if grp:
            groups.add(grp)
    return _ok(sorted(groups))


def list_stories_by_group(event, group):
    """GET /api/stories/group/{group} — PUBLIC stories matching group."""
    lang = _get_lang(event)
    items = db_utils.query_gsi('GSI1', 'STORY_LIST')
    matches = [i for i in items
               if i.get('visibility') == 'PUBLIC' and i.get('group') == group]
    matches.sort(key=lambda x: _safe_int(x.get('priority')), reverse=True)
    return _ok([_story_summary(i, lang) for i in matches])


# ─── Import ───────────────────────────────────────────────────────────────────

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

    # Step 22: validate referential integrity before persisting anything (hard-fail).
    validation_errors = story_validator.validate_story_dict(data)
    if validation_errors:
        return _validation_400(validation_errors)

    story_uuid = data.get('uuid')
    if not story_uuid:
        story_uuid = str(uuid_lib.uuid4())

    # If story already exists by UUID → delete it first (replace-on-conflict)
    # Must happen before id collision check to avoid self-collision on re-import
    existing = db_utils.get_item(f'STORY#{story_uuid}')
    if existing:
        db_utils.delete_all_by_pk(f'STORY#{story_uuid}')

    # ID validation and generation for stories
    all_stories = db_utils.query_gsi('GSI1', 'STORY_LIST')
    # Filter out the just-deleted story in case GSI is eventually consistent
    all_stories = [s for s in all_stories if s.get('uuid') != story_uuid]
    input_id = data.get('id')
    if input_id is not None:
        input_id = _safe_int(input_id)
        # Check global collision
        for s in all_stories:
            if _safe_int(s.get('id')) == input_id:
                return _err(400, 'INVALID_IMPORT_DATA', f'story/list_stories id={input_id} already present')
    else:
        max_story_id = max([_safe_int(s.get('id')) for s in all_stories], default=0)
        input_id = max_story_id + 1

    # Build multi-lang texts dict from the texts array
    raw_texts = data.get('texts', [])
    id_title = data.get('idTextTitle')
    id_desc  = data.get('idTextDescription')
    id_clock_s = data.get('idTextClockSingular')
    id_clock_p = data.get('idTextClockPlural')

    texts_dict = {}
    for t in raw_texts:
        if not t.get('uuid'):
            t['uuid'] = str(uuid_lib.uuid4())
        lang = t.get('lang', 'en')
        id_t = t.get('idText')
        if lang not in texts_dict:
            texts_dict[lang] = {}
        if id_t == id_title:
            texts_dict[lang]['title'] = t.get('shortText') or t.get('longText')
        if id_t == id_desc:
            texts_dict[lang]['description'] = t.get('shortText') or t.get('longText')
        if id_t == id_clock_s:
            texts_dict[lang]['clockSingular'] = t.get('shortText') or t.get('longText')
        if id_t == id_clock_p:
            texts_dict[lang]['clockPlural'] = t.get('shortText') or t.get('longText')

    # Build difficulties list (store inline with story metadata)
    raw_diffs = _assign_ids(data.get('difficulties', []), 'id')
    difficulties = []
    for d in raw_diffs:
        diff_uuid = d.get('uuid') or str(uuid_lib.uuid4())
        # Map idTextDescription to a stub text dict for description
        id_diff_name = d.get('idTextName')
        id_diff_desc = d.get('idTextDescription')
        diff_texts = {}
        for t in raw_texts:
            if t.get('idText') == id_diff_desc:
                lang_t = t.get('lang', 'en')
                diff_texts[lang_t] = {'title': t.get('shortText') or t.get('longText')}
        difficulties.append({
            'uuid':                   diff_uuid,
            'id':                     _safe_int(d.get('id')),
            'texts':                  diff_texts,
            'idTextName':             _safe_int(id_diff_name) if id_diff_name is not None else None,
            'idTextDescription':      _safe_int(id_diff_desc) if id_diff_desc is not None else None,
            'expCost':                d.get('expCost', 0),
            'maxWeight':              d.get('maxWeight', 0),
            'minCharacter':           d.get('minCharacter', 0),
            'maxCharacter':           d.get('maxCharacter', 0),
            'costHelpComa':           d.get('costHelpComa', 0),
            'costMaxCharacteristics': d.get('costMaxCharacteristics', 0),
            'numberMaxFreeAction':    d.get('numberMaxFreeAction', 0),
            'life':                   d.get('life', 100),
            'energy':                 d.get('energy', 100),
            'sad':                    d.get('sad', 0),
            'dexterity':              d.get('dexterity', 10),
            'intelligence':           d.get('intelligence', 10),
            'constitution':           d.get('constitution', 10),
            'weight':                 d.get('weight', 10),
            'idCard':                 d.get('idCard'),
        })

    # Step 15: Build character templates list
    raw_char_templates = _assign_ids(data.get('characterTemplates', []), 'id_tipo')
    character_templates = []
    for ct in raw_char_templates:
        ct_uuid = ct.get('uuid') or str(uuid_lib.uuid4())
        id_ct_name = ct.get('idTextName')
        id_ct_desc = ct.get('idTextDescription')
        ct_texts = _build_sub_entity_texts(raw_texts, id_ct_name, id_ct_desc)
        character_templates.append({
            'uuid':              ct_uuid,
            'id_tipo':           _safe_int(ct.get('id_tipo')),
            'texts':             ct_texts,
            'idTextName':        _safe_int(id_ct_name) if id_ct_name is not None else None,
            'idTextDescription': _safe_int(id_ct_desc) if id_ct_desc is not None else None,
            'lifeMax':           ct.get('lifeMax', 0),
            'energyMax':         ct.get('energyMax', 0),
            'sadMax':            ct.get('sadMax', 0),
            'dexterityStart':    ct.get('dexterityStart', 0),
            'intelligenceStart': ct.get('intelligenceStart', 0),
            'constitutionStart': ct.get('constitutionStart', 0),
            'idCard':            ct.get('idCard'),
            'idClassPermitted':  ct.get('idClassPermitted'),
            'idClassProhibited': ct.get('idClassProhibited'),
        })

    # Step 15: Build classes list
    raw_classes = _assign_ids(data.get('classes', []), 'id')
    classes = []
    for cl in raw_classes:
        cl_uuid = cl.get('uuid') or str(uuid_lib.uuid4())
        id_cl_name = cl.get('idTextName')
        id_cl_desc = cl.get('idTextDescription')
        cl_texts = _build_sub_entity_texts(raw_texts, id_cl_name, id_cl_desc)
        classes.append({
            'uuid':              cl_uuid,
            'id':                _safe_int(cl.get('id')),
            'texts':             cl_texts,
            'idTextName':        _safe_int(id_cl_name) if id_cl_name is not None else None,
            'idTextDescription': _safe_int(id_cl_desc) if id_cl_desc is not None else None,
            'weightMax':         cl.get('weightMax', 0),
            'dexterityBase':     cl.get('dexterityBase', 0),
            'intelligenceBase':  cl.get('intelligenceBase', 0),
            'constitutionBase':  cl.get('constitutionBase', 0),
            'idCard':            cl.get('idCard'),
        })

    # Step 15: Build traits list
    raw_traits = _assign_ids(data.get('traits', []), 'id')
    traits = []
    for tr in raw_traits:
        tr_uuid = tr.get('uuid') or str(uuid_lib.uuid4())
        id_tr_name = tr.get('idTextName')
        id_tr_desc = tr.get('idTextDescription')
        tr_texts = _build_sub_entity_texts(raw_texts, id_tr_name, id_tr_desc)
        traits.append({
            'uuid':              tr_uuid,
            'id':                _safe_int(tr.get('id')),
            'texts':             tr_texts,
            'idTextName':        _safe_int(id_tr_name) if id_tr_name is not None else None,
            'idTextDescription': _safe_int(id_tr_desc) if id_tr_desc is not None else None,
            'costPositive':      tr.get('costPositive', 0),
            'costNegative':      tr.get('costNegative', 0),
            'idClassPermitted':  tr.get('idClassPermitted'),
            'idClassProhibited': tr.get('idClassProhibited'),
            'idCard':            tr.get('idCard'),
            'life':              tr.get('life', 0),
            'energy':            tr.get('energy', 0),
            'sad':               tr.get('sad', 0),
            'dexterity':         tr.get('dexterity', 0),
            'intelligence':      tr.get('intelligence', 0),
            'constitution':      tr.get('constitution', 0),
            'weight':            tr.get('weight', 0),
        })

    # Step 15: Build card info
    raw_cards = data.get('cards', [])
    id_card = data.get('idCard')
    card = None
    if id_card is not None and raw_cards:
        for c in raw_cards:
            if c.get('id') == id_card:
                card_uuid = c.get('uuid') or str(uuid_lib.uuid4())
                id_card_name = c.get('idTextName') or c.get('idTextTitle')
                id_card_desc = c.get('idTextDescription')
                id_card_copyright = c.get('idTextCopyright')
                card_texts = {}
                for t in raw_texts:
                    id_t = t.get('idText')
                    lang_t = t.get('lang', 'en')
                    val = t.get('shortText') or t.get('longText')
                    if id_t == id_card_name:
                        if lang_t not in card_texts:
                            card_texts[lang_t] = {}
                        card_texts[lang_t]['title'] = val
                    if id_t == id_card_desc:
                        if lang_t not in card_texts:
                            card_texts[lang_t] = {}
                        card_texts[lang_t]['description'] = val
                    if id_t == id_card_copyright:
                        if lang_t not in card_texts:
                            card_texts[lang_t] = {}
                        card_texts[lang_t]['copyrightText'] = val
                card = {
                    'uuid':             card_uuid,
                    'cardType':         c.get('cardType'),
                    'texts':            card_texts,
                    'urlImage':         c.get('urlImage'),# or c.get('imageUrl'),
                    'alternativeImage': c.get('alternativeImage'),
                    'awesomeIcon':      c.get('awesomeIcon'),
                    'styleMain':        c.get('styleMain'),
                    'styleDetail':      c.get('styleDetail'),
                    'styleImageLittle': c.get('styleImageLittle'),
                    'styleImageMedium': c.get('styleImageMedium'),
                    'styleImageLarge':  c.get('styleImageLarge'),
                    'linkCopyright':    c.get('linkCopyright'),
                }
                break

    # Step 16: Build raw_creators with assigned UUIDs (for content detail queries)
    raw_creators_input = _assign_ids(data.get('creators', []), 'id')
    stored_creators = []
    for cr in raw_creators_input:
        cr_uuid = cr.get('uuid') or str(uuid_lib.uuid4())
        stored_creators.append({
            'id':           _safe_int(cr.get('id')),
            'uuid':         cr_uuid,
            'idText':       cr.get('idText'),
            'link':         cr.get('link'),
            'url':          cr.get('url'),
            'urlImage':     cr.get('urlImage'),
            'urlEmote':     cr.get('urlEmote'),
            'urlInstagram': cr.get('urlInstagram'),
        })

    # Step 16: Build raw_cards with assigned UUIDs (for content detail queries)
    raw_cards_input = _assign_ids(data.get('cards', []), 'id')
    stored_cards = []
    for c in raw_cards_input:
        c_uuid = c.get('uuid') or str(uuid_lib.uuid4())
        stored_cards.append({
            'id':                _safe_int(c.get('id')),
            'uuid':              c_uuid,
            'cardType':          c.get('cardType'),
            'idTextTitle':       c.get('idTextName') or c.get('idTextTitle'),
            'idTextDescription': c.get('idTextDescription'),
            'idTextCopyright':   c.get('idTextCopyright'),
            'linkCopyright':     c.get('linkCopyright'),
            'idCreator':         c.get('idCreator'),
            'urlImage':          c.get('urlImage'),# or c.get('imageUrl'),
            'alternativeImage':  c.get('alternativeImage'),
            'awesomeIcon':       c.get('awesomeIcon'),
            'styleMain':         c.get('styleMain'),
            'styleDetail':       c.get('styleDetail'),
            'styleImageLittle':  c.get('styleImageLittle'),
            'styleImageMedium':  c.get('styleImageMedium'),
            'styleImageLarge':   c.get('styleImageLarge'),
        })

    priority = int(data.get('priority') or 0)

    # Step 27.x — pre-resolve the cards embedded in locations / neighbors / events
    # so the match handler (_build_locations_active) can read `loc.card`,
    # `neighbor.card` and `event.card` directly, exactly like the seed item does.
    # Without this, an imported story has only `idCard` on these sub-entities and
    # the game frontend cannot render the active location card.
    def _resolve_inline_card(id_card):
        return _find_card_from_raw(stored_cards, raw_texts, id_card, 'en')

    locations_enriched = []
    for loc in _assign_uuids(_assign_ids(data.get('locations', []), 'id')):
        loc = dict(loc)
        loc['card'] = _resolve_inline_card(loc.get('idCard'))
        locations_enriched.append(loc)

    # The match handler reads `story.get("neighbors")`; the import payload uses the
    # `locationNeighbors` key. Store under both so content queries and gameplay work.
    neighbors_enriched = []
    for n in _assign_ids(data.get('locationNeighbors', []), 'id'):
        n = dict(n)
        n['card'] = _resolve_inline_card(n.get('idCard'))
        neighbors_enriched.append(n)

    # Events expose their owning location as `idSpecificLocation` in the import
    # payload; the match handler filters on `idLocation`. Alias it and resolve cards.
    events_enriched = []
    for e in _assign_uuids(_assign_ids(data.get('events', []), 'id')):
        e = dict(e)
        e['card'] = _resolve_inline_card(e.get('idCard'))
        if e.get('idLocation') is None:
            e['idLocation'] = e.get('idSpecificLocation')
        events_enriched.append(e)

    story_item = {
        'PK':                     f'STORY#{story_uuid}',
        'SK':                     'METADATA',
        'uuid':                   story_uuid,
        'id':                     _safe_int(input_id),
        'author':                 data.get('author'),
        'category':               data.get('category'),
        'group':                  data.get('group'),
        'visibility':             data.get('visibility', 'PUBLIC'),
        'priority':               priority,
        'peghi':                  int(data.get('peghi') or 0),
        'versionMin':             data.get('versionMin'),
        'versionMax':             data.get('versionMax'),
        'idCard':                 _safe_int(data.get('idCard')),
        'idTextTitle':            _safe_int(data.get('idTextTitle')),
        'idTextDescription':      _safe_int(data.get('idTextDescription')),
        'idLocationStart':        _safe_int(data.get('idLocationStart')),
        'idImage':                _safe_int(data.get('idImage')),
        'idLocationAllPlayerComa': _safe_int(data.get('idLocationAllPlayerComa')),
        'idEventAllPlayerComa':    _safe_int(data.get('idEventAllPlayerComa')),
        'idEventEndGame':          _safe_int(data.get('idEventEndGame')),
        'idTextCopyright':         _safe_int(data.get('idTextCopyright')),
        'idCreator':               _safe_int(data.get('idCreator')),
        'idTextClockSingular':    _safe_int(data.get('idTextClockSingular')),
        'idTextClockPlural':      _safe_int(data.get('idTextClockPlural')),
        # Pre-resolved clock labels (en) so GET /clock can read them directly,
        # mirroring the seed item; runtime resolution from `texts` is the fallback.
        'clockSingularDescription': _resolve_text(texts_dict, 'en', 'clockSingular'),
        'clockPluralDescription':   _resolve_text(texts_dict, 'en', 'clockPlural'),
        'linkCopyright':          data.get('linkCopyright'),
        'texts':                  texts_dict,
        'difficulties':           difficulties,
        'difficulty_count':       len(difficulties),
        'location_count':         len(data.get('locations', [])),
        'event_count':            len(data.get('events', [])),
        'item_count':             len(data.get('items', [])),
        # Step 15
        'characterTemplates':     character_templates,
        'classes':                classes,
        'traits':                 traits,
        'card':                   card,
        'class_count':            len(classes),
        'template_count':         len(character_templates),
        'trait_count':            len(traits),
        # Step 17: actually store sub-entities (with pre-resolved inline cards)
        'locations':              locations_enriched,
        # Step 27.x — gameplay reads `neighbors`; keep `locationNeighbors` for content queries.
        'neighbors':              neighbors_enriched,
        'events':                 events_enriched,
        'items':                  _assign_uuids(_assign_ids(data.get('items', []), 'id')),
        # Step 16: raw data for content detail queries
        'raw_texts':              _assign_ids(data.get('texts', []), 'id'),
        'raw_cards':              stored_cards,
        'raw_creators':           stored_creators,
        'keys':                   _assign_ids(data.get('keys', []), 'id'),
        'choices':                _assign_ids(data.get('choices', []), 'id'),
        'weatherRules':           _assign_ids(data.get('weatherRules', []), 'id'),
        'globalRandomEvents':    _assign_ids(data.get('globalRandomEvents', []), 'id'),
        'missions':               _assign_ids(data.get('missions', []), 'id'),
        'locationNeighbors':      _assign_ids(data.get('locationNeighbors', []), 'id'),
        'eventEffects':           _assign_ids(data.get('eventEffects', []), 'id'),
        'itemEffects':            _assign_ids(data.get('itemEffects', []), 'id'),
        'choiceConditions':       _assign_ids(data.get('choiceConditions', []), 'id'),
        'choiceEffects':          _assign_ids(data.get('choiceEffects', []), 'id'),
        'classBonuses':           _assign_ids(data.get('classBonuses', []), 'id'),
        'missionSteps':           _assign_ids(data.get('missionSteps', []), 'id'),
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
        'classesImported':     len(classes),
        'choicesImported':     len(data.get('choices', [])),
    }, status=201)


def _build_sub_entity_texts(raw_texts, id_name, id_desc):
    """Build a multi-lang texts dict for a sub-entity (class, template, trait).

    Returns: { 'en': {'name': '...', 'description': '...'}, 'it': {...} }
    """
    texts = {}
    for t in raw_texts:
        id_t = t.get('idText')
        lang_t = t.get('lang', 'en')
        val = t.get('shortText') or t.get('longText')
        if id_t == id_name:
            if lang_t not in texts:
                texts[lang_t] = {}
            texts[lang_t]['name'] = val
        if id_t == id_desc:
            if lang_t not in texts:
                texts[lang_t] = {}
            texts[lang_t]['description'] = val
    return texts


def _assign_uuids(entities):
    """Assign a random UUID to each entity in a list if not already present."""
    if not entities: return []
    for e in entities:
        if not e.get('uuid'):
            e['uuid'] = str(uuid_lib.uuid4())
    return entities

def _assign_ids(entities, id_field):
    """Assign/validate numeric IDs for sub-entities within a story.
    Enforces uniqueness within the list and generates missing ones.
    Checks for common ID fields if id_field is not present.
    """
    if not entities: return []
    
    seen = set()
    to_assign = []
    
    for e in entities:
        # Try primary field, then fallbacks
        eid = e.get(id_field)
        if eid is None:
            eid = e.get('id') or e.get('idText') or e.get('id_text') or e.get('id_tipo') or e.get('idTipo')
            
        if eid is not None:
            eid = _safe_int(eid)
            if eid in seen:
                # Collision within the same story import payload
                pass 
            seen.add(eid)
            e[id_field] = eid
        else:
            to_assign.append(e)
            
    if not to_assign:
        return entities
        
    next_id = max(seen, default=0) + 1
    for e in to_assign:
        e[id_field] = next_id
        next_id += 1
        
    return entities


def list_all_stories(event):
    _, err = _require_admin(event)
    if err:
        return err
    lang  = _get_lang(event)
    items = db_utils.query_gsi('GSI1', 'STORY_LIST')
    items.sort(key=lambda x: _safe_int(x.get('priority')), reverse=True)
    return _ok([_story_summary(i, lang) for i in items])


def get_admin_story(event, story_uuid):
    _, err = _require_admin(event)
    if err:
        return err
    lang = _get_lang(event)
    item = db_utils.get_item(f'STORY#{story_uuid}')
    if not item:
        return _err(404, 'STORY_NOT_FOUND',
                    f'No story found with UUID: {story_uuid}')
    return _ok(_story_detail(item, lang))


def validate_story(event, story_uuid):
    # Step 22: read-only integrity report for a persisted story.
    _, err = _require_admin(event)
    if err:
        return err
    item = db_utils.get_item(f'STORY#{story_uuid}')
    if not item:
        return _err(404, 'STORY_NOT_FOUND',
                    f'No story found with UUID: {story_uuid}')
    errors = story_validator.validate_story_dict(item)
    return _ok({"valid": len(errors) == 0, "count": len(errors), "errors": errors})


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


# ─── Step 17: Admin CRUD ──────────────────────────────────────────────────────

TYPE_MAP = {
    'difficulties': 'difficulties',
    'locations': 'locations',
    'location-neighbors': 'locationNeighbors',
    'events': 'events',
    'event-effects': 'eventEffects',
    'items': 'items',
    'item-effects': 'itemEffects',
    'character-templates': 'characterTemplates',
    'classes': 'classes',
    'class-bonuses': 'classBonuses',
    'traits': 'traits',
    'creators': 'raw_creators',
    'cards': 'raw_cards',
    'texts': 'raw_texts',
    'keys': 'keys',
    'choices': 'choices',
    'choice-conditions': 'choiceConditions',
    'choice-effects': 'choiceEffects',
    'weather-rules': 'weatherRules',
    'global-random-events': 'globalRandomEvents',
    'missions': 'missions',
    'mission-steps': 'missionSteps',
}


def _normalize_entity_input(entity_type, data):
    """Normalise an incoming entity body before storing in DynamoDB.

    Card storage key is `urlImage` (matches the SQL column `url_immage` and
    the import JSON convention). Legacy data may have arrived with `imageUrl`
    (the public-API output shape) — promote it to the canonical `urlImage`
    and drop the alias so storage stays clean.
    """
    if not isinstance(data, dict):
        return data
    if entity_type == 'cards':
        if data.get('urlImage') is None and data.get('imageUrl') is not None:
            data['urlImage'] = data.pop('imageUrl')
        data.pop('imageUrl', None)
    return data


def _normalize_entity_output(entity_type, entity):
    if not isinstance(entity, dict):
        return entity

    normalized = dict(entity)
    if entity_type == 'creators':
        if normalized.get('idCard') is None and normalized.get('id_card') is not None:
            normalized['idCard'] = normalized.get('id_card')
        if normalized.get('id_card') is None and normalized.get('idCard') is not None:
            normalized['id_card'] = normalized.get('idCard')

    # Cards: storage key is `urlImage`. Legacy records may still have
    # `urlImage` from before the keys were unified — surface it under
    # `urlImage` so the admin form always sees the value.
    if entity_type == 'cards':
        if normalized.get('urlImage') is None and normalized.get('imageUrl') is not None:
            normalized['urlImage'] = normalized.get('imageUrl')

    return normalized

def create_story(event):
    _, err = _require_admin(event)
    if err: return err

    try:
        data = json.loads(event.get('body', '{}'))
    except Exception:
        return _err(400, 'INVALID_JSON', 'Invalid JSON body')

    if not data:
        return _err(400, 'EMPTY_IMPORT_DATA', 'Request body must contain story data')

    story_uuid = str(uuid_lib.uuid4())
    story_item = {
        'PK':         f'STORY#{story_uuid}',
        'SK':         'METADATA',
        'uuid':       story_uuid,
        'author':     data.get('author'),
        'category':   data.get('category'),
        'group':      data.get('group'),
        'visibility': data.get('visibility', 'DRAFT'),
        'priority':   _safe_int(data.get('priority')),
        'peghi':      _safe_int(data.get('peghi')),
        'versionMin': data.get('versionMin'),
        'versionMax': data.get('versionMax'),
        'idTextTitle':               _safe_int(data.get('idTextTitle')),
        'idTextDescription':         _safe_int(data.get('idTextDescription')),
        'idLocationStart':           _safe_int(data.get('idLocationStart')),
        'idImage':                   _safe_int(data.get('idImage')),
        'idLocationAllPlayerComa':   _safe_int(data.get('idLocationAllPlayerComa')),
        'idEventAllPlayerComa':      _safe_int(data.get('idEventAllPlayerComa')),
        'idTextClockSingular':       _safe_int(data.get('idTextClockSingular')),
        'idTextClockPlural':         _safe_int(data.get('idTextClockPlural')),
        'idEventEndGame':            _safe_int(data.get('idEventEndGame')),
        'idTextCopyright':           _safe_int(data.get('idTextCopyright')),
        'linkCopyright':             data.get('linkCopyright'),
        'idCreator':                 _safe_int(data.get('idCreator')),
        'idCard':                    _safe_int(data.get('idCard')),
        'texts':      {},
        'GSI1_PK':    'STORY_LIST',
        'GSI1_SK':    f'STORY#{story_uuid}',
    }
    db_utils.put_item(story_item)
    return _ok({'uuid': story_uuid}, status=201)

def update_story(event, story_uuid):
    _, err = _require_admin(event)
    if err: return err

    item = db_utils.get_item(f'STORY#{story_uuid}')
    if not item:
        return _err(404, 'STORY_NOT_FOUND', f'Story {story_uuid} not found')

    try:
        data = json.loads(event.get('body', '{}'))
    except Exception:
        return _err(400, 'INVALID_JSON', 'Invalid JSON body')

    # Update allowed fields
    fields = ['author', 'category', 'group', 'visibility', 'priority', 'peghi',
              'versionMin', 'versionMax', 'idTextTitle', 'idTextDescription',
              'idLocationStart', 'idImage', 'idLocationAllPlayerComa', 'idEventAllPlayerComa',
              'idTextClockSingular', 'idTextClockPlural', 'idEventEndGame',
              'idTextCopyright', 'linkCopyright', 'idCreator', 'idCard']
    for f in fields:
        if f in data:
            item[f] = data[f]

    db_utils.put_item(item)
    return _ok({'uuid': story_uuid, 'status': 'UPDATED', 'item': item})

def list_entities(event, story_uuid, entity_type):
    _, err = _require_admin(event)
    if err: return err

    item = db_utils.get_item(f'STORY#{story_uuid}')
    if not item:
        return _err(404, 'STORY_NOT_FOUND', f'Story {story_uuid} not found')

    field = TYPE_MAP.get(entity_type)
    if not field:
        return _ok([]) # unknown type -> empty list

    entities = item.get(field, [])
    # Ensure each entity has a sequential numeric id and correct idStory
    for i, e in enumerate(entities):
        if 'id' not in e or e['id'] is None:
            e['id'] = i + 1
        e['idStory'] = item.get('id', story_uuid)

    return _ok([_normalize_entity_output(entity_type, e) for e in entities])

def create_entity(event, story_uuid, entity_type):
    _, err = _require_admin(event)
    if err: return err

    item = db_utils.get_item(f'STORY#{story_uuid}')
    if not item:
        return _err(404, 'STORY_NOT_FOUND', f'Story {story_uuid} not found')

    field = TYPE_MAP.get(entity_type)
    if not field:
        return _err(400, 'INVALID_TYPE', f'Invalid entity type: {entity_type}')

    try:
        data = json.loads(event.get('body', '{}'))
    except Exception:
        return _err(400, 'INVALID_JSON', 'Invalid JSON body')

    # Step 22: entity-local (lenient) validation before persisting.
    local_errors = story_validator.validate_entity(entity_type, data)
    if local_errors:
        return _validation_400(local_errors)

    ent_uuid = str(uuid_lib.uuid4())
    data['uuid'] = ent_uuid
    data['idStory'] = item.get('id', story_uuid)

    if field not in item:
        item[field] = []
    data['id'] = len(item[field]) + 1
    if entity_type=='cards':
        data['idCard']=data['id']
    _normalize_entity_input(entity_type, data)
    item[field].append(data)

    db_utils.put_item(item)
    return _ok(_normalize_entity_output(entity_type, data), status=201)

def get_entity(event, story_uuid, entity_type, entity_uuid):
    _, err = _require_admin(event)
    if err: return err

    item = db_utils.get_item(f'STORY#{story_uuid}')
    if not item:
        return _err(404, 'STORY_NOT_FOUND', f'Story {story_uuid} not found')

    field = TYPE_MAP.get(entity_type)
    if not field:
        return _err(404, 'ENTITY_NOT_FOUND', 'Type not found')

    entities = item.get(field, [])
    entity = next((e for e in entities if e.get('uuid') == entity_uuid), None)
    if not entity:
        return _err(404, 'ENTITY_NOT_FOUND', f'Entity {entity_uuid} not found')

    return _ok(_normalize_entity_output(entity_type, entity))

def update_entity(event, story_uuid, entity_type, entity_uuid):
    _, err = _require_admin(event)
    if err: return err

    item = db_utils.get_item(f'STORY#{story_uuid}')
    if not item:
        return _err(404, 'STORY_NOT_FOUND', f'Story {story_uuid} not found')

    field = TYPE_MAP.get(entity_type)
    if not field:
        return _err(404, 'ENTITY_NOT_FOUND', 'Type not found')

    entities = item.get(field, [])
    found_idx = -1
    for i, e in enumerate(entities):
        if e.get('uuid') == entity_uuid:
            found_idx = i
            break

    if found_idx == -1:
        return _err(404, 'ENTITY_NOT_FOUND', f'Entity {entity_uuid} not found')

    try:
        data = json.loads(event.get('body', '{}'))
    except Exception:
        return _err(400, 'INVALID_JSON', 'Invalid JSON body')

    # Step 22: entity-local (lenient) validation before persisting.
    local_errors = story_validator.validate_entity(entity_type, data)
    if local_errors:
        return _validation_400(local_errors)

    # Update fields in place
    for k, v in data.items():
        if k != 'uuid': # don't change uuid
            entities[found_idx][k] = v
    _normalize_entity_input(entity_type, entities[found_idx])
    
    if entity_type=='cards':
        entities[found_idx]['idCard']=entities[found_idx]['id']

    db_utils.put_item(item)
    updated_entity = _normalize_entity_output(entity_type, entities[found_idx])
    updated_entity['status'] = 'UPDATED'
    return _ok(updated_entity)

def delete_entity(event, story_uuid, entity_type, entity_uuid):
    _, err = _require_admin(event)
    if err: return err

    item = db_utils.get_item(f'STORY#{story_uuid}')
    if not item:
        return _err(404, 'STORY_NOT_FOUND', f'Story {story_uuid} not found')

    field = TYPE_MAP.get(entity_type)
    if not field:
        return _err(404, 'ENTITY_NOT_FOUND', 'Type not found')

    entities = item.get(field, [])
    new_entities = [e for e in entities if e.get('uuid') != entity_uuid]

    if len(new_entities) == len(entities):
        return _err(404, 'ENTITY_NOT_FOUND', f'Entity {entity_uuid} not found')

    item[field] = new_entities
    db_utils.put_item(item)
    return _ok({'status': 'DELETED', 'uuid': entity_uuid, 'entityType': entity_type})
