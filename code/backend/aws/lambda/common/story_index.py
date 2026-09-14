"""v0.37.5 — the STORY_LIST index attributes: GSI2 keys plus a compact, per-language
summary so listing stories never reads the 300 KB item (GSI2Summary is an INCLUDE index)."""
from common.data_utils import resolve_raw_text, resolve_card_from_raw

STORY_LIST_PK = 'STORY_LIST'
# DynamoDB projects at most 20 non-key attributes per index, so a story row on GSI2Summary
# carries ONE attribute, ``summary``: ``{'meta': {the scalar fields below}, 'langs': {...}}``.
META_FIELDS = ('id', 'author', 'category', 'group', 'visibility', 'priority', 'peghi',
               'difficulty_count', 'idCard', 'idTextClockSingular', 'idTextClockPlural')


def languages_of(item):
    """Every language the story speaks, English always first."""
    langs = ['en']
    for row in (item.get('raw_texts') or []):
        lang = row.get('lang')
        if lang and lang not in langs:
            langs.append(lang)
    for lang in (item.get('texts') or {}):
        if lang and lang not in langs:
            langs.append(lang)
    return langs


def _text(item, lang, field, id_text):
    raw_texts = item.get('raw_texts') or []
    if id_text is not None and raw_texts:
        val = resolve_raw_text(raw_texts, id_text, lang)
        if val not in (None, ''):
            return val
    texts = item.get('texts') or {}
    val = (texts.get(lang) or {}).get(field)
    if val in (None, ''):
        val = (texts.get('en') or {}).get(field)
    return val


def build_summary_map(item):
    """``{'meta': scalars, 'langs': {lang: {title, description, card}}}`` — everything the
    story list needs, resolved the way _story_summary always did."""
    raw_cards = item.get('raw_cards') or []
    raw_texts = item.get('raw_texts') or []
    langs = {}
    for lang in languages_of(item):
        langs[lang] = {
            'title': _text(item, lang, 'title', item.get('idTextTitle')),
            'description': _text(item, lang, 'description', item.get('idTextDescription')),
            'card': resolve_card_from_raw(raw_cards, raw_texts, item.get('idCard'), lang),
        }
    return {'meta': {name: item.get(name) for name in META_FIELDS}, 'langs': langs}


def field(item, name):
    """A story scalar from the full item, or from ``summary.meta`` on an index row."""
    if name in item:
        return item.get(name)
    return ((item.get('summary') or {}).get('meta') or {}).get(name)


def lift(row):
    """An index row with its ``summary.meta`` scalars copied to the top level (in place)."""
    meta = (row.get('summary') or {}).get('meta') or {}
    for name, value in meta.items():
        row.setdefault(name, value)
    return row


def texts_for(item, lang):
    """The ``{title, description, card}`` of an index row for ``lang`` (English fallback)."""
    langs = (item.get('summary') or {}).get('langs') or {}
    return langs.get(lang) or langs.get('en') or {}


def index_attrs(item):
    """The attributes every story writer merges into the item before put_item."""
    return {
        'GSI2_PK': STORY_LIST_PK,
        'GSI2_SK': f"STORY#{item.get('uuid')}",
        'summary': build_summary_map(item),
    }


def stamp(item):
    """Merge the index attributes in place and return the item."""
    item.update(index_attrs(item))
    return item
