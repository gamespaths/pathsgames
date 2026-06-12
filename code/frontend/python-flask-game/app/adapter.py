"""Python port of react-game ``src/mock/tutorialStoryAdapter.js``.

Transforms a ``tutorial_story.json`` document (backend import format) into the
frontend story-summary format consumed by the templates.
"""


def _get_text(texts, text_id, fallback=""):
    if not text_id:
        return fallback
    entry = next((t for t in texts if t.get("idText") == text_id), None)
    if entry is None:
        return fallback
    return entry.get("shortText") if entry.get("shortText") is not None else fallback


def _build_card(raw_card, texts, uuid_prefix="card"):
    if not raw_card:
        return None
    return {
        "uuid": f"{uuid_prefix}-{raw_card.get('id')}",
        "urlImage": raw_card.get("urlImage"),
        "alternativeImage": raw_card.get("alternativeImage"),
        "title": _get_text(texts, raw_card.get("idTextTitle")),
        "description": _get_text(texts, raw_card.get("idTextDescription")),
        "awesomeIcon": raw_card.get("awesomeIcon"),
        "copyrightText": _get_text(texts, raw_card.get("idTextCopyright")),
        "linkCopyright": raw_card.get("linkCopyright"),
    }


def adapt_tutorial_story(doc):
    """Convert one tutorial_story.json document into a frontend story summary."""
    story = doc.get("story", {})
    texts = doc.get("texts", []) or []
    cards = doc.get("cards", []) or []
    character_templates = doc.get("characterTemplates", []) or []
    difficulties = doc.get("difficulties", []) or []
    traits = doc.get("traits", []) or []
    classes = doc.get("classes", []) or []

    card_by_id = {c.get("id"): c for c in cards}

    card = _build_card(card_by_id.get(story.get("idCard")), texts, "card-story")

    mapped_templates = []
    for tpl in character_templates:
        raw_card = card_by_id.get(tpl.get("idCard"))
        mapped_templates.append({
            "uuid": f"char-{tpl.get('id')}",
            "name": _get_text(texts, tpl.get("idTextName"), f"Character {tpl.get('id')}"),
            "sub": _get_text(texts, tpl.get("idTextDescription"), ""),
            "icon": (raw_card or {}).get("awesomeIcon") or "fas fa-user",
            "card": _build_card(raw_card, texts, f"card-char-{tpl.get('id')}"),
            "stats": {
                "lifeMax": tpl.get("lifeMax"),
                "energyMax": tpl.get("energyMax"),
                "sadMax": tpl.get("sadMax"),
                "dexterityStart": tpl.get("dexterityStart"),
                "intelligenceStart": tpl.get("intelligenceStart"),
                "constitutionStart": tpl.get("constitutionStart"),
            },
        })

    mapped_difficulties = []
    for d in difficulties:
        mapped_difficulties.append({
            "uuid": f"diff-{d.get('id')}",
            "name": _get_text(texts, d.get("idTextName"), f"Difficulty {d.get('id')}"),
            "description": _get_text(texts, d.get("idTextDescription"), ""),
            "icon": d.get("awesomeIcon") or "fas fa-star",
            "card": _build_card(card_by_id.get(d.get("idCard")), texts, f"card-diff-{d.get('id')}"),
        })

    mapped_traits = []
    for t in traits:
        raw_card = card_by_id.get(t.get("idCard"))
        mapped_traits.append({
            "uuid": f"trait-{t.get('id')}",
            "name": _get_text(texts, t.get("idTextName"), f"Trait {t.get('id')}"),
            "description": _get_text(texts, t.get("idTextDescription"), ""),
            "icon": (raw_card or {}).get("awesomeIcon") or "fas fa-star",
            "card": _build_card(raw_card, texts, f"card-trait-{t.get('id')}"),
            "cost": {
                "positive": t.get("costPositive") or 0,
                "negative": t.get("costNegative"),
            },
            "bonuses": {
                "life": t.get("life"),
                "energy": t.get("energy"),
                "sad": t.get("sad"),
                "dexterity": t.get("dexterity"),
                "intelligence": t.get("intelligence"),
                "constitution": t.get("constitution"),
            },
            "idClassPermitted": t.get("idClassPermitted"),
            "idClassProhibited": t.get("idClassProhibited"),
            # numeric id kept so get_traits_for_class can map class uuid -> id
            "_id": t.get("id"),
        })

    mapped_classes = []
    for c in classes:
        raw_card = card_by_id.get(c.get("idCard"))
        mapped_classes.append({
            "uuid": f"class-{c.get('id')}",
            "id": c.get("id"),
            "name": _get_text(texts, c.get("idTextName"), f"Class {c.get('id')}"),
            "description": _get_text(texts, c.get("idTextDescription"), ""),
            "icon": (raw_card or {}).get("awesomeIcon") or "fas fa-shield-alt",
            "card": _build_card(raw_card, texts, f"card-class-{c.get('id')}"),
            "stats": {
                "weightMax": c.get("weightMax"),
                "dexterityBase": c.get("dexterityBase") or 0,
                "intelligenceBase": c.get("intelligenceBase") or 0,
                "constitutionBase": c.get("constitutionBase") or 0,
            },
        })

    return {
        "uuid": story.get("uuid"),
        "title": _get_text(texts, story.get("idTextTitle"), "Untitled"),
        "description": _get_text(texts, story.get("idTextDescription"), ""),
        "author": story.get("author") or "",
        "category": story.get("category") or "",
        "group": story.get("group") or "",
        "visibility": story.get("visibility") or "PUBLIC",
        "priority": story.get("priority") or 0,
        "copyrightText": _get_text(texts, story.get("idTextCopyright")),
        "linkCopyright": story.get("linkCopyright"),
        "card": card,
        "characterTemplates": mapped_templates,
        "difficulties": mapped_difficulties,
        "traits": mapped_traits,
        "classes": mapped_classes,
    }


def adapt_tutorial_story_list(doc):
    """Wrap a single adapted story in the list shape used by the catalog."""
    return [adapt_tutorial_story(doc)]
