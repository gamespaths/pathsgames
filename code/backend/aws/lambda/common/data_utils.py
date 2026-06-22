"""common/data_utils.py — Shared data-conversion helpers for all Lambda handlers."""


def safe_int(val, default=0):
    """Safely convert a value to int, returning default on None or parse error."""
    if val is None:
        return default
    try:
        return int(val)
    except (ValueError, TypeError):
        return default


def resolve_raw_text(raw_texts, id_text, lang='en'):
    """Resolve shortText/longText from a flat raw_texts list by idText + lang.

    Falls back to the English entry when the requested language is absent.
    Returns None when id_text is None or no match is found.
    """
    if id_text is None:
        return None
    id_text_int = safe_int(id_text)
    fallback = None
    for t in raw_texts:
        if safe_int(t.get('idText')) == id_text_int:
            if t.get('lang') == lang:
                return t.get('shortText') or t.get('longText')
            if t.get('lang') == 'en':
                fallback = t.get('shortText') or t.get('longText')
    return fallback


def resolve_card_from_raw(raw_cards, raw_texts, id_card, lang='en'):
    """Resolve a card object from raw_cards by integer id.

    Cards are stored inline on the story item. Text fields are resolved from
    raw_texts via resolve_raw_text. Returns None when id_card is None or not found.
    """
    if id_card is None:
        return None
    id_card_int = safe_int(id_card)
    card = next((c for c in raw_cards if safe_int(c.get('id')) == id_card_int), None)
    if not card:
        return None
    return {
        'uuid':             card.get('uuid'),
        'cardType':         card.get('cardType'),
        'urlImage':         card.get('urlImage'),
        'alternativeImage': card.get('alternativeImage'),
        'awesomeIcon':      card.get('awesomeIcon'),
        'styleMain':        card.get('styleMain'),
        'styleDetail':      card.get('styleDetail'),
        'styleImageLittle': card.get('styleImageLittle'),
        'styleImageMedium': card.get('styleImageMedium'),
        'styleImageLarge':  card.get('styleImageLarge'),
        'title':            resolve_raw_text(raw_texts, card.get('idTextTitle'), lang),
        'description':      resolve_raw_text(raw_texts, card.get('idTextDescription'), lang),
        'copyrightText':    resolve_raw_text(raw_texts, card.get('idTextCopyright'), lang),
        'linkCopyright':    card.get('linkCopyright'),
    }
