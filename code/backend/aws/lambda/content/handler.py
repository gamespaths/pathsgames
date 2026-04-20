"""
content/handler.py — Paths Games AWS Lambda
Handles routes registered for ContentFunction in template/content.yaml.

Routes (API contracts match Java OpenAPI specs v0.16.0):
  GET /api/content/{uuidStory}/cards/{uuidCard}              → get_card    (public)
  GET /api/content/{uuidStory}/texts/{idText}/lang/{lang}    → get_text    (public)
  GET /api/content/{uuidStory}/creators/{uuidCreator}        → get_creator (public)

All endpoints are public (no authentication required).

DynamoDB layout — data resides on the story item:
  PK = STORY#{uuid}, SK = METADATA
    raw_texts:    [{idText, lang, shortText, longText, idTextCopyright, linkCopyright, idCreator}, ...]
    raw_cards:    [{id, uuid, idTextTitle, idTextDescription, idTextCopyright, linkCopyright,
                    idCreator, imageUrl, alternativeImage, awesomeIcon, styleMain, styleDetail}, ...]
    raw_creators: [{id, uuid, idText, link, url, urlImage, urlEmote, urlInstagram}, ...]
"""

import json
import decimal
import re

from common import db_utils

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


def _get_lang(event):
    """Extract ?lang= query parameter (default 'en')."""
    qs = event.get('queryStringParameters') or {}
    return qs.get('lang', 'en') or 'en'


def _safe_int(val, default=0):
    """Safely convert a value to int, returning default on None/error."""
    if val is None:
        return default
    try:
        return int(val)
    except (ValueError, TypeError):
        return default


# ─── text / creator resolution helpers ────────────────────────────────────────

def _find_text(raw_texts, id_text, lang):
    """Find a text entry by idText and lang; returns (entry, resolved_lang) or (None, None)."""
    if id_text is None:
        return None, None
    id_text = _safe_int(id_text)
    # Try requested language first
    for t in raw_texts:
        if _safe_int(t.get('idText')) == id_text and t.get('lang') == lang:
            return t, lang
    # Fallback to English
    if lang != 'en':
        for t in raw_texts:
            if _safe_int(t.get('idText')) == id_text and t.get('lang') == 'en':
                return t, 'en'
    return None, None


def _resolve_text_value(raw_texts, id_text, lang):
    """Resolve a short text value by idText with English fallback."""
    entry, _ = _find_text(raw_texts, id_text, lang)
    if entry:
        return entry.get('shortText') or entry.get('longText')
    return None


def _find_creator_by_id(raw_creators, id_creator):
    """Find a creator by its integer id."""
    if id_creator is None:
        return None
    id_creator = _safe_int(id_creator)
    for c in raw_creators:
        if _safe_int(c.get('id')) == id_creator:
            return c
    return None


def _find_creator_by_uuid(raw_creators, creator_uuid):
    """Find a creator by its UUID string."""
    for c in raw_creators:
        if c.get('uuid') == creator_uuid:
            return c
    return None


def _build_creator_response(creator, raw_texts, lang):
    """Build a CreatorInfoResponse dict from a raw_creator entry."""
    if not creator:
        return None
    name = _resolve_text_value(raw_texts, creator.get('idText'), lang)
    return {
        'uuid':         creator.get('uuid'),
        'name':         name,
        'link':         creator.get('link'),
        'url':          creator.get('url'),
        'urlImage':     creator.get('urlImage'),
        'urlEmote':     creator.get('urlEmote'),
        'urlInstagram': creator.get('urlInstagram'),
    }


# ─── router ───────────────────────────────────────────────────────────────────

# Path patterns for content endpoints
_CARD_PATTERN = re.compile(r'^/api/content/([^/]+)/cards/([^/]+)$')
_TEXT_PATTERN = re.compile(r'^/api/content/([^/]+)/texts/([^/]+)/lang/([^/]+)$')
_CREATOR_PATTERN = re.compile(r'^/api/content/([^/]+)/creators/([^/]+)$')


def lambda_handler(event, context):
    path = _normalize_path(event.get('rawPath', event.get('path', '')))
    method = (event.get('requestContext', {})
                   .get('http', {})
                   .get('method', event.get('httpMethod', '')))
    params = event.get('pathParameters') or {}

    if method != 'GET':
        return _err(404, 'NOT_FOUND', f'Resource {path} not found')

    # Try card pattern
    m = _CARD_PATTERN.match(path)
    if m:
        story_uuid = params.get('uuidStory') or m.group(1)
        card_uuid = params.get('uuidCard') or m.group(2)
        return get_card(event, story_uuid, card_uuid)

    # Try text pattern
    m = _TEXT_PATTERN.match(path)
    if m:
        story_uuid = params.get('uuidStory') or m.group(1)
        id_text = params.get('idText') or m.group(2)
        lang = params.get('lang') or m.group(3)
        return get_text(event, story_uuid, id_text, lang)

    # Try creator pattern
    m = _CREATOR_PATTERN.match(path)
    if m:
        story_uuid = params.get('uuidCreator') and params.get('uuidStory') or m.group(1)
        story_uuid = params.get('uuidStory') or m.group(1)
        creator_uuid = params.get('uuidCreator') or m.group(2)
        return get_creator(event, story_uuid, creator_uuid)

    return _err(404, 'NOT_FOUND', f'Resource {path} not found')


# ─── endpoint handlers ────────────────────────────────────────────────────────

def get_card(event, story_uuid, card_uuid):
    """GET /api/content/{uuidStory}/cards/{uuidCard}"""
    lang = _get_lang(event)

    item = db_utils.get_item(f'STORY#{story_uuid}')
    if not item:
        return _err(404, 'CARD_NOT_FOUND',
                    f'No card found with UUID: {card_uuid} in story: {story_uuid}')

    raw_cards = item.get('raw_cards', [])
    raw_texts = item.get('raw_texts', [])
    raw_creators = item.get('raw_creators', [])

    # Find card by uuid
    card = None
    for c in raw_cards:
        if c.get('uuid') == card_uuid:
            card = c
            break

    if not card:
        return _err(404, 'CARD_NOT_FOUND',
                    f'No card found with UUID: {card_uuid} in story: {story_uuid}')

    # Resolve texts
    title = _resolve_text_value(raw_texts, card.get('idTextTitle'), lang)
    description = _resolve_text_value(raw_texts, card.get('idTextDescription'), lang)
    copyright_text = _resolve_text_value(raw_texts, card.get('idTextCopyright'), lang)

    # Resolve creator
    creator = _find_creator_by_id(raw_creators, card.get('idCreator'))
    creator_response = _build_creator_response(creator, raw_texts, lang)

    return _ok({
        'uuid':             card.get('uuid'),
        'imageUrl':         card.get('imageUrl'),
        'alternativeImage': card.get('alternativeImage'),
        'awesomeIcon':      card.get('awesomeIcon'),
        'styleMain':        card.get('styleMain'),
        'styleDetail':      card.get('styleDetail'),
        'title':            title,
        'description':      description,
        'copyrightText':    copyright_text,
        'linkCopyright':    card.get('linkCopyright'),
        'creator':          creator_response,
    })


def get_text(event, story_uuid, id_text_str, lang):
    """GET /api/content/{uuidStory}/texts/{idText}/lang/{lang}"""
    id_text = _safe_int(id_text_str, -1)

    item = db_utils.get_item(f'STORY#{story_uuid}')
    if not item:
        return _err(404, 'TEXT_NOT_FOUND',
                    f'No text found with id_text: {id_text} in story: {story_uuid}')

    raw_texts = item.get('raw_texts', [])
    raw_creators = item.get('raw_creators', [])

    # Find text entry with language fallback
    text_entry, resolved_lang = _find_text(raw_texts, id_text, lang)
    if not text_entry:
        return _err(404, 'TEXT_NOT_FOUND',
                    f'No text found with id_text: {id_text} in story: {story_uuid}')

    # Resolve copyright text
    copyright_text = None
    link_copyright = text_entry.get('linkCopyright')
    id_text_copyright = text_entry.get('idTextCopyright')
    if id_text_copyright is not None:
        copyright_text = _resolve_text_value(raw_texts, id_text_copyright, resolved_lang)

    # Resolve creator
    creator = _find_creator_by_id(raw_creators, text_entry.get('idCreator'))
    creator_response = _build_creator_response(creator, raw_texts, resolved_lang)

    return _ok({
        'idText':        id_text,
        'lang':          lang,
        'resolvedLang':  resolved_lang,
        'shortText':     text_entry.get('shortText'),
        'longText':      text_entry.get('longText'),
        'copyrightText': copyright_text,
        'linkCopyright': link_copyright,
        'creator':       creator_response,
    })


def get_creator(event, story_uuid, creator_uuid):
    """GET /api/content/{uuidStory}/creators/{uuidCreator}"""
    lang = _get_lang(event)

    item = db_utils.get_item(f'STORY#{story_uuid}')
    if not item:
        return _err(404, 'CREATOR_NOT_FOUND',
                    f'No creator found with UUID: {creator_uuid} in story: {story_uuid}')

    raw_creators = item.get('raw_creators', [])
    raw_texts = item.get('raw_texts', [])

    creator = _find_creator_by_uuid(raw_creators, creator_uuid)
    if not creator:
        return _err(404, 'CREATOR_NOT_FOUND',
                    f'No creator found with UUID: {creator_uuid} in story: {story_uuid}')

    return _ok(_build_creator_response(creator, raw_texts, lang))
