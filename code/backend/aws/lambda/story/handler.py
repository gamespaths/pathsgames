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

def _safe_int(val, default=0):
    """Safely convert a value to int, returning default on None/error."""
    if val is None:
        return default
    try:
        return int(val)
    except (ValueError, TypeError):
        return default


# ─── response builders ────────────────────────────────────────────────────────

def _story_summary(item, lang):
    """Build StorySummaryResponse from a DynamoDB story item."""
    texts = item.get('texts', {})

    # Card resolution
    raw_card = item.get('card')
    card = None
    if raw_card:
        card = {
            'uuid':             raw_card.get('uuid'),
            'imageUrl':         raw_card.get('imageUrl'),
            'alternativeImage': raw_card.get('alternativeImage'),
            'awesomeIcon':      raw_card.get('awesomeIcon'),
            'styleMain':        raw_card.get('styleMain'),
            'styleDetail':      raw_card.get('styleDetail'),
            'title':            _resolve_text(raw_card.get('texts', {}), lang, 'title'),
            'description':      _resolve_text(raw_card.get('texts', {}), lang, 'description'),
            'copyrightText':    _resolve_text(raw_card.get('texts', {}), lang, 'copyrightText'),
            'linkCopyright':    raw_card.get('linkCopyright'),
        }

    return {
        'uuid':            item.get('uuid'),
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
    }

def _story_detail(item, lang):
    """Build StoryDetailResponse from a DynamoDB story item.

    Includes Step 15 enrichments: characterTemplates, classes, traits,
    card, classCount, characterTemplateCount, traitCount.
    """
    texts = item.get('texts', {})

    # Difficulties
    raw_diffs = item.get('difficulties', [])
    difficulties = []
    for d in raw_diffs:
        difficulties.append({
            'uuid':                  d.get('uuid'),
            'description':           _resolve_text(d.get('texts', {}), lang, 'title'),
            'expCost':               _safe_int(d.get('expCost')),
            'maxWeight':             _safe_int(d.get('maxWeight')),
            'minCharacter':          _safe_int(d.get('minCharacter')),
            'maxCharacter':          _safe_int(d.get('maxCharacter')),
            'costHelpComa':          _safe_int(d.get('costHelpComa')),
            'costMaxCharacteristics':_safe_int(d.get('costMaxCharacteristics')),
            'numberMaxFreeAction':   _safe_int(d.get('numberMaxFreeAction')),
        })

    # Step 15: Character Templates
    raw_templates = item.get('characterTemplates', [])
    character_templates = []
    for ct in raw_templates:
        character_templates.append({
            'uuid':              ct.get('uuid'),
            'name':              _resolve_text(ct.get('texts', {}), lang, 'name'),
            'description':       _resolve_text(ct.get('texts', {}), lang, 'description'),
            'lifeMax':           _safe_int(ct.get('lifeMax')),
            'energyMax':         _safe_int(ct.get('energyMax')),
            'sadMax':            _safe_int(ct.get('sadMax')),
            'dexterityStart':    _safe_int(ct.get('dexterityStart')),
            'intelligenceStart': _safe_int(ct.get('intelligenceStart')),
            'constitutionStart': _safe_int(ct.get('constitutionStart')),
        })

    # Step 15: Classes
    raw_classes = item.get('classes', [])
    classes = []
    for cl in raw_classes:
        classes.append({
            'uuid':             cl.get('uuid'),
            'name':             _resolve_text(cl.get('texts', {}), lang, 'name'),
            'description':      _resolve_text(cl.get('texts', {}), lang, 'description'),
            'weightMax':        _safe_int(cl.get('weightMax')),
            'dexterityBase':    _safe_int(cl.get('dexterityBase')),
            'intelligenceBase': _safe_int(cl.get('intelligenceBase')),
            'constitutionBase': _safe_int(cl.get('constitutionBase')),
        })

    # Step 15: Traits
    raw_traits = item.get('traits', [])
    traits = []
    for tr in raw_traits:
        traits.append({
            'uuid':              tr.get('uuid'),
            'name':              _resolve_text(tr.get('texts', {}), lang, 'name'),
            'description':       _resolve_text(tr.get('texts', {}), lang, 'description'),
            'costPositive':      _safe_int(tr.get('costPositive')),
            'costNegative':      _safe_int(tr.get('costNegative')),
            'idClassPermitted':  tr.get('idClassPermitted'),
            'idClassProhibited': tr.get('idClassProhibited'),
        })

    # Step 15: Card
    raw_card = item.get('card')
    card = None
    if raw_card:
        card = {
            'uuid':             raw_card.get('uuid'),
            'imageUrl':         raw_card.get('imageUrl'),
            'alternativeImage': raw_card.get('alternativeImage'),
            'awesomeIcon':      raw_card.get('awesomeIcon'),
            'styleMain':        raw_card.get('styleMain'),
            'styleDetail':      raw_card.get('styleDetail'),
            'title':            _resolve_text(raw_card.get('texts', {}), lang, 'title'),
            'description':      _resolve_text(raw_card.get('texts', {}), lang, 'description'),
            'copyrightText':    _resolve_text(raw_card.get('texts', {}), lang, 'copyrightText'),
            'linkCopyright':    raw_card.get('linkCopyright'),
        }

    return {
        'uuid':                       item.get('uuid'),
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
        'clockSingularDescription':   item.get('clockSingularDescription'),
        'clockPluralDescription':     item.get('clockPluralDescription'),
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
    if path.startswith('/api/stories/') and method == 'GET':
        uid = params.get('uuid') or path.split('/')[-1]
        return get_story(event, uid)

    # admin — static routes before parameterised
    if path == '/api/admin/stories/import' and method == 'POST':
        return import_story(event)
    if path == '/api/admin/stories' and method == 'GET':
        return list_all_stories(event)
    if path == '/api/admin/stories' and method == 'POST':
        return create_story(event)

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

    # Step 15: Build character templates list
    raw_char_templates = data.get('characterTemplates', [])
    character_templates = []
    for ct in raw_char_templates:
        ct_uuid = str(uuid_lib.uuid4())
        id_ct_name = ct.get('idTextName')
        id_ct_desc = ct.get('idTextDescription')
        ct_texts = _build_sub_entity_texts(raw_texts, id_ct_name, id_ct_desc)
        character_templates.append({
            'uuid':              ct_uuid,
            'texts':             ct_texts,
            'lifeMax':           ct.get('lifeMax', 0),
            'energyMax':         ct.get('energyMax', 0),
            'sadMax':            ct.get('sadMax', 0),
            'dexterityStart':    ct.get('dexterityStart', 0),
            'intelligenceStart': ct.get('intelligenceStart', 0),
            'constitutionStart': ct.get('constitutionStart', 0),
        })

    # Step 15: Build classes list
    raw_classes = data.get('classes', [])
    classes = []
    for cl in raw_classes:
        cl_uuid = str(uuid_lib.uuid4())
        id_cl_name = cl.get('idTextName')
        id_cl_desc = cl.get('idTextDescription')
        cl_texts = _build_sub_entity_texts(raw_texts, id_cl_name, id_cl_desc)
        classes.append({
            'uuid':             cl_uuid,
            'texts':            cl_texts,
            'weightMax':        cl.get('weightMax', 0),
            'dexterityBase':    cl.get('dexterityBase', 0),
            'intelligenceBase': cl.get('intelligenceBase', 0),
            'constitutionBase': cl.get('constitutionBase', 0),
        })

    # Step 15: Build traits list
    raw_traits = data.get('traits', [])
    traits = []
    for tr in raw_traits:
        tr_uuid = str(uuid_lib.uuid4())
        id_tr_name = tr.get('idTextName')
        id_tr_desc = tr.get('idTextDescription')
        tr_texts = _build_sub_entity_texts(raw_texts, id_tr_name, id_tr_desc)
        traits.append({
            'uuid':              tr_uuid,
            'texts':             tr_texts,
            'costPositive':      tr.get('costPositive', 0),
            'costNegative':      tr.get('costNegative', 0),
            'idClassPermitted':  tr.get('idClassPermitted'),
            'idClassProhibited': tr.get('idClassProhibited'),
        })

    # Step 15: Build card info
    raw_cards = data.get('cards', [])
    id_card = data.get('idCard')
    card = None
    if id_card is not None and raw_cards:
        for c in raw_cards:
            if c.get('id') == id_card:
                card_uuid = str(uuid_lib.uuid4())
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
                    'texts':            card_texts,
                    'imageUrl':         c.get('urlImmage') or c.get('imageUrl'),
                    'alternativeImage': c.get('alternativeImage'),
                    'awesomeIcon':      c.get('awesomeIcon'),
                    'styleMain':        c.get('styleMain'),
                    'styleDetail':      c.get('styleDetail'),
                    'linkCopyright':    c.get('linkCopyright'),
                }
                break

    # Step 16: Build raw_creators with assigned UUIDs (for content detail queries)
    raw_creators_input = data.get('creators', [])
    stored_creators = []
    for cr in raw_creators_input:
        cr_uuid = str(uuid_lib.uuid4())
        stored_creators.append({
            'id':           cr.get('id'),
            'uuid':         cr_uuid,
            'idText':       cr.get('idText'),
            'link':         cr.get('link'),
            'url':          cr.get('url'),
            'urlImage':     cr.get('urlImage'),
            'urlEmote':     cr.get('urlEmote'),
            'urlInstagram': cr.get('urlInstagram'),
        })

    # Step 16: Build raw_cards with assigned UUIDs (for content detail queries)
    stored_cards = []
    for c in raw_cards:
        c_uuid = str(uuid_lib.uuid4())
        stored_cards.append({
            'id':                c.get('id'),
            'uuid':              c_uuid,
            'idTextTitle':       c.get('idTextName') or c.get('idTextTitle'),
            'idTextDescription': c.get('idTextDescription'),
            'idTextCopyright':   c.get('idTextCopyright'),
            'linkCopyright':     c.get('linkCopyright'),
            'idCreator':         c.get('idCreator'),
            'imageUrl':          c.get('urlImmage') or c.get('imageUrl'),
            'alternativeImage':  c.get('alternativeImage'),
            'awesomeIcon':       c.get('awesomeIcon'),
            'styleMain':         c.get('styleMain'),
            'styleDetail':       c.get('styleDetail'),
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
        # Step 15
        'characterTemplates':     character_templates,
        'classes':                classes,
        'traits':                 traits,
        'card':                   card,
        'class_count':            len(classes),
        'template_count':         len(character_templates),
        'trait_count':            len(traits),
        # Step 17: actually store sub-entities
        'locations':              _assign_uuids(data.get('locations', [])),
        'events':                 _assign_uuids(data.get('events', [])),
        'items':                  _assign_uuids(data.get('items', [])),
        # Step 16: raw data for content detail queries
        'raw_texts':              raw_texts,
        'raw_cards':              stored_cards,
        'raw_creators':           stored_creators,
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
    for e in entities:
        if not e.get('uuid'):
            e['uuid'] = str(uuid_lib.uuid4())
    return entities


def list_all_stories(event):
    _, err = _require_admin(event)
    if err:
        return err
    lang  = _get_lang(event)
    items = db_utils.query_gsi('GSI1', 'STORY_LIST')
    items.sort(key=lambda x: _safe_int(x.get('priority')), reverse=True)
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


# ─── Step 17: Admin CRUD ──────────────────────────────────────────────────────

TYPE_MAP = {
    'difficulties': 'difficulties',
    'locations': 'locations',
    'events': 'events',
    'items': 'items',
    'character-templates': 'characterTemplates',
    'classes': 'classes',
    'traits': 'traits',
    'creators': 'raw_creators',
    'cards': 'raw_cards',
    'texts': 'raw_texts'
}

def create_story(event):
    _, err = _require_admin(event)
    if err: return err

    try:
        data = json.loads(event.get('body', '{}'))
    except Exception:
        return _err(400, 'INVALID_JSON', 'Invalid JSON body')

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
    fields = ['author', 'category', 'group', 'visibility', 'priority', 'peghi', 'versionMin', 'versionMax']
    for f in fields:
        if f in data:
            item[f] = data[f]

    db_utils.put_item(item)
    return _ok({'uuid': story_uuid, 'status': 'UPDATED'})

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
    # Add idStory to response for compatibility
    for e in entities:
        e['idStory'] = item.get('id') # or 0

    return _ok(entities)

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

    ent_uuid = str(uuid_lib.uuid4())
    data['uuid'] = ent_uuid
    data['idStory'] = item.get('id')

    if field not in item:
        item[field] = []
    item[field].append(data)

    db_utils.put_item(item)
    return _ok({'uuid': ent_uuid}, status=201)

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

    return _ok(entity)

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

    # Update fields in place
    for k, v in data.items():
        if k != 'uuid': # don't change uuid
            entities[found_idx][k] = v

    db_utils.put_item(item)
    return _ok({'uuid': entity_uuid, 'status': 'UPDATED'})

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
