import pytest
from unittest.mock import MagicMock
from app.core.services.story.story_query_service import StoryQueryService
from app.core.models.story.class_info import ClassInfo
from app.core.models.story.character_template_info import CharacterTemplateInfo
from app.core.models.story.trait_info import TraitInfo
from app.core.models.story.card_info import CardInfo

@pytest.fixture
def mock_read_port():
    port = MagicMock()
    port.find_public_stories.return_value = []
    port.find_all_stories.return_value = []
    port.find_story_by_uuid.return_value = None
    port.find_texts_for_story.return_value = []
    port.find_difficulties_for_story.return_value = []
    port.count_locations_for_story.return_value = 0
    port.count_events_for_story.return_value = 0
    port.count_items_for_story.return_value = 0
    port.find_classes_for_story.return_value = []
    port.find_character_templates_for_story.return_value = []
    port.find_traits_for_story.return_value = []
    port.find_card_for_story.return_value = None
    port.find_unique_categories.return_value = []
    port.find_unique_groups.return_value = []
    port.find_stories_by_category.return_value = []
    port.find_stories_by_group.return_value = []
    return port

def test_list_public_stories_empty(mock_read_port):
    service = StoryQueryService(mock_read_port)
    assert len(service.list_public_stories()) == 0

def test_list_public_stories_with_data(mock_read_port):
    mock_read_port.find_public_stories.return_value = [
        {"id": 1, "uuid": "u1", "id_text_title": 10}
    ]
    mock_read_port.find_texts_for_story.return_value = [
        {"id_text": 10, "lang": "en", "short_text": "Story T"}
    ]
    service = StoryQueryService(mock_read_port)
    results = service.list_public_stories()
    assert len(results) == 1
    assert results[0].title == "Story T"
    assert results[0].uuid == "u1"
    assert results[0].card is None

def test_list_public_stories_with_card(mock_read_port):
    mock_read_port.find_public_stories.return_value = [
        {"id": 1, "uuid": "u1", "id_text_title": 10, "id_card": 42}
    ]
    mock_read_port.find_texts_for_story.return_value = [
        {"id_text": 10, "lang": "en", "short_text": "Story T"},
        {"id_text": 400, "lang": "en", "short_text": "Card Title"},
        {"id_text": 401, "lang": "en", "short_text": "Card Desc"}
    ]
    mock_read_port.find_card_for_story.return_value = {
        "id": 42, "uuid": "card-uuid", "url_image": "https://img.png",
        "alternative_image": "alt", "awesome_icon": "fa-star",
        "style_main": "bg-dark", "style_detail": "text-light",
        "id_text_title": 400, "id_text_description": 401,
        "link_copyright": "https://lic.example.com"
    }
    service = StoryQueryService(mock_read_port)
    results = service.list_public_stories()
    assert len(results) == 1
    assert results[0].card is not None
    assert results[0].card.uuid == "card-uuid"
    assert results[0].card.urlImage == "https://img.png"
    assert results[0].card.title == "Card Title"
    assert results[0].card.description == "Card Desc"
    assert results[0].card.awesomeIcon == "fa-star"

def test_list_public_stories_card_not_found(mock_read_port):
    mock_read_port.find_public_stories.return_value = [
        {"id": 1, "uuid": "u1", "id_text_title": 10, "id_card": 99}
    ]
    mock_read_port.find_texts_for_story.return_value = [
        {"id_text": 10, "lang": "en", "short_text": "Story T"}
    ]
    mock_read_port.find_card_for_story.return_value = None
    service = StoryQueryService(mock_read_port)
    results = service.list_public_stories()
    assert len(results) == 1
    assert results[0].card is None

def test_list_all_stories(mock_read_port):
    mock_read_port.find_all_stories.return_value = [
        {"id": 1, "uuid": "u1", "visibility": "PRIVATE"}
    ]
    service = StoryQueryService(mock_read_port)
    results = service.list_all_stories()
    assert len(results) == 1
    assert results[0].visibility == "PRIVATE"

def test_get_story_detail_not_found(mock_read_port):
    service = StoryQueryService(mock_read_port)
    assert service.get_story_detail("u1") is None

def test_get_story_detail_success(mock_read_port):
    mock_read_port.find_story_by_uuid.return_value = {
        "id": 1, "uuid": "u1", "id_text_title": 10, "peghi": 2
    }
    mock_read_port.find_texts_for_story.return_value = [
        {"id_text": 10, "lang": "en", "long_text": "Title Long"}
    ]
    mock_read_port.find_difficulties_for_story.return_value = [
        {"uuid": "d1", "exp_cost": 5,
         "life": 150, "energy": 110, "sad": 5,
         "dexterity": 11, "intelligence": 12, "constitution": 13, "weight": 14}
    ]
    mock_read_port.count_locations_for_story.return_value = 5

    service = StoryQueryService(mock_read_port)
    detail = service.get_story_detail("u1", "en")

    assert detail is not None
    assert detail.title == "Title Long"
    assert detail.peghi == 2
    assert detail.locationCount == 5
    assert len(detail.difficulties) == 1
    assert detail.difficulties[0].expCost == 5
    assert detail.difficulties[0].life == 150
    assert detail.difficulties[0].energy == 110
    assert detail.difficulties[0].sad == 5
    assert detail.difficulties[0].dexterity == 11
    assert detail.difficulties[0].intelligence == 12
    assert detail.difficulties[0].constitution == 13
    assert detail.difficulties[0].weight == 14

def test_resolve_text_fallback(mock_read_port):
    mock_read_port.find_story_by_uuid.return_value = {"id": 1, "id_text_title": 10}
    
    # Text only in generic other language, fallback to English doesn't exist, generic is chosen
    mock_read_port.find_texts_for_story.return_value = [
        {"id_text": 10, "lang": "it", "short_text": "Titolo"}
    ]

    service = StoryQueryService(mock_read_port)
    detail = service.get_story_detail("x", "en")
    assert detail.title == "Titolo"

def test_resolve_text_en_fallback(mock_read_port):
    mock_read_port.find_story_by_uuid.return_value = {"id": 1, "id_text_title": 10}
    
    mock_read_port.find_texts_for_story.return_value = [
        {"id_text": 10, "lang": "it", "short_text": "Titolo"},
        {"id_text": 10, "lang": "en", "short_text": "Title"}
    ]

    service = StoryQueryService(mock_read_port)
    # Asking for 'fr' shouldn't find 'fr', so it falls back to 'en'
    detail = service.get_story_detail("x", "fr")
    assert detail.title == "Title"

def test_resolve_text_null_id(mock_read_port):
    service = StoryQueryService(mock_read_port)
    res = service._resolve_text([], None, "en")
    assert res is None

def test_resolve_text_no_candidates(mock_read_port):
    service = StoryQueryService(mock_read_port)
    res = service._resolve_text([{"id_text": 99}], 10, "en")
    assert res is None

# ─── Step 15: Categories & Groups ───

def test_list_categories_empty(mock_read_port):
    service = StoryQueryService(mock_read_port)
    assert service.list_categories() == []

def test_list_categories_with_data(mock_read_port):
    mock_read_port.find_unique_categories.return_value = ["adventure", "horror"]
    service = StoryQueryService(mock_read_port)
    cats = service.list_categories()
    assert cats == ["adventure", "horror"]

def test_list_groups_empty(mock_read_port):
    service = StoryQueryService(mock_read_port)
    assert service.list_groups() == []

def test_list_groups_with_data(mock_read_port):
    mock_read_port.find_unique_groups.return_value = ["dark", "fantasy"]
    service = StoryQueryService(mock_read_port)
    grps = service.list_groups()
    assert grps == ["dark", "fantasy"]

def test_list_stories_by_category(mock_read_port):
    mock_read_port.find_stories_by_category.return_value = [
        {"id": 1, "uuid": "u1", "id_text_title": 10, "category": "adventure"}
    ]
    mock_read_port.find_texts_for_story.return_value = [
        {"id_text": 10, "lang": "en", "short_text": "Adv Story"}
    ]
    service = StoryQueryService(mock_read_port)
    results = service.list_stories_by_category("adventure")
    assert len(results) == 1
    assert results[0].category == "adventure"
    assert results[0].title == "Adv Story"

def test_list_stories_by_category_empty(mock_read_port):
    service = StoryQueryService(mock_read_port)
    assert service.list_stories_by_category("noexist") == []

def test_list_stories_by_group(mock_read_port):
    mock_read_port.find_stories_by_group.return_value = [
        {"id": 2, "uuid": "u2", "id_text_title": 20, "group_name": "fantasy"}
    ]
    mock_read_port.find_texts_for_story.return_value = [
        {"id_text": 20, "lang": "en", "short_text": "Fantasy Story"}
    ]
    service = StoryQueryService(mock_read_port)
    results = service.list_stories_by_group("fantasy")
    assert len(results) == 1
    assert results[0].group == "fantasy"
    assert results[0].title == "Fantasy Story"

def test_list_stories_by_group_empty(mock_read_port):
    service = StoryQueryService(mock_read_port)
    assert service.list_stories_by_group("noexist") == []

# ─── Step 15: Enriched detail (classes, templates, traits, card) ───

def test_get_story_detail_with_classes(mock_read_port):
    mock_read_port.find_story_by_uuid.return_value = {
        "id": 1, "uuid": "u1", "id_text_title": 10
    }
    mock_read_port.find_texts_for_story.return_value = [
        {"id_text": 10, "lang": "en", "short_text": "Title"},
        {"id_text": 100, "lang": "en", "short_text": "Knight"},
        {"id_text": 101, "lang": "en", "short_text": "A noble warrior"}
    ]
    mock_read_port.find_classes_for_story.return_value = [
        {"id": 1, "uuid": "cls-uuid", "id_text_name": 100, "id_text_description": 101,
         "weight_max": 15, "dexterity_base": 2, "intelligence_base": 1, "constitution_base": 3}
    ]

    service = StoryQueryService(mock_read_port)
    detail = service.get_story_detail("u1", "en")

    assert detail.classCount == 1
    assert len(detail.classes) == 1
    cls = detail.classes[0]
    assert isinstance(cls, ClassInfo)
    assert cls.uuid == "cls-uuid"
    assert cls.name == "Knight"
    assert cls.description == "A noble warrior"
    assert cls.weightMax == 15
    assert cls.dexterityBase == 2
    assert cls.intelligenceBase == 1
    assert cls.constitutionBase == 3

def test_get_story_detail_with_character_templates(mock_read_port):
    mock_read_port.find_story_by_uuid.return_value = {
        "id": 1, "uuid": "u1", "id_text_title": 10
    }
    mock_read_port.find_texts_for_story.return_value = [
        {"id_text": 10, "lang": "en", "short_text": "Title"},
        {"id_text": 200, "lang": "en", "short_text": "Warrior"},
        {"id_text": 201, "lang": "en", "short_text": "A strong fighter"}
    ]
    mock_read_port.find_character_templates_for_story.return_value = [
        {"id": 1, "uuid": "ct-uuid", "id_text_name": 200, "id_text_description": 201,
         "life_max": 20, "energy_max": 10, "sad_max": 5,
         "dexterity_start": 2, "intelligence_start": 1, "constitution_start": 3}
    ]

    service = StoryQueryService(mock_read_port)
    detail = service.get_story_detail("u1", "en")

    assert detail.characterTemplateCount == 1
    assert len(detail.characterTemplates) == 1
    tpl = detail.characterTemplates[0]
    assert isinstance(tpl, CharacterTemplateInfo)
    assert tpl.uuid == "ct-uuid"
    assert tpl.name == "Warrior"
    assert tpl.lifeMax == 20
    assert tpl.energyMax == 10
    assert tpl.sadMax == 5
    assert tpl.dexterityStart == 2
    assert tpl.intelligenceStart == 1
    assert tpl.constitutionStart == 3

def test_get_story_detail_with_traits(mock_read_port):
    mock_read_port.find_story_by_uuid.return_value = {
        "id": 1, "uuid": "u1", "id_text_title": 10
    }
    mock_read_port.find_texts_for_story.return_value = [
        {"id_text": 10, "lang": "en", "short_text": "Title"},
        {"id_text": 300, "lang": "en", "short_text": "Brave"},
        {"id_text": 301, "lang": "en", "short_text": "Fearless"}
    ]
    mock_read_port.find_traits_for_story.return_value = [
        {"id": 1, "uuid": "tr-uuid", "id_text_name": 300, "id_text_description": 301,
         "cost_positive": 2, "cost_negative": 0, "id_class_permitted": None, "id_class_prohibited": 5}
    ]

    service = StoryQueryService(mock_read_port)
    detail = service.get_story_detail("u1", "en")

    assert detail.traitCount == 1
    assert len(detail.traits) == 1
    tr = detail.traits[0]
    assert isinstance(tr, TraitInfo)
    assert tr.uuid == "tr-uuid"
    assert tr.name == "Brave"
    assert tr.costPositive == 2
    assert tr.costNegative == 0
    assert tr.idClassPermitted is None
    assert tr.idClassProhibited == 5
    # v0.35.2 — a trait that authored nothing is pickable, and says so.
    assert tr.hideOnStartMatch is False


def test_get_story_detail_reports_a_hidden_trait_without_dropping_it(mock_read_port):
    """v0.35.2 — hideOnStartMatch is REPORTED, never filtered: the same list resolves the
    traits a character already owns, and an event or an item may grant a hidden one."""
    mock_read_port.find_story_by_uuid.return_value = {"id": 1, "uuid": "u1", "id_text_title": 10}
    mock_read_port.find_texts_for_story.return_value = [
        {"id_text": 10, "lang": "en", "short_text": "Title"},
    ]
    mock_read_port.find_traits_for_story.return_value = [
        {"id": 1, "uuid": "tr-open", "cost_positive": 0, "cost_negative": 0,
         "hide_on_start_match": 0},
        {"id": 2, "uuid": "tr-hidden", "cost_positive": 0, "cost_negative": 0,
         "hide_on_start_match": 1},
    ]

    detail = StoryQueryService(mock_read_port).get_story_detail("u1", "en")

    assert [t.uuid for t in detail.traits] == ["tr-open", "tr-hidden"]
    assert [t.hideOnStartMatch for t in detail.traits] == [False, True]


def test_get_story_detail_with_card(mock_read_port):
    mock_read_port.find_story_by_uuid.return_value = {
        "id": 1, "uuid": "u1", "id_text_title": 10, "id_card": 42
    }
    mock_read_port.find_texts_for_story.return_value = [
        {"id_text": 10, "lang": "en", "short_text": "Title"},
        {"id_text": 400, "lang": "en", "short_text": "Card Title"},
        {"id_text": 401, "lang": "en", "short_text": "Card Desc"},
        {"id_text": 402, "lang": "en", "short_text": "Card (c)"}
    ]
    mock_read_port.find_card_for_story.return_value = {
        "id": 42, "uuid": "card-uuid", "url_image": "https://img.png",
        "alternative_image": "alt-img", "awesome_icon": "fa-star",
        "style_main": "bg-dark", "style_detail": "text-light",
        "id_text_title": 400, "id_text_description": 401,
        "id_text_copyright": 402, "link_copyright": "https://lic.example.com"
    }

    service = StoryQueryService(mock_read_port)
    detail = service.get_story_detail("u1", "en")

    assert detail.card is not None
    assert isinstance(detail.card, CardInfo)
    assert detail.card.uuid == "card-uuid"
    assert detail.card.urlImage == "https://img.png"
    assert detail.card.alternativeImage == "alt-img"
    assert detail.card.awesomeIcon == "fa-star"
    assert detail.card.styleMain == "bg-dark"
    assert detail.card.styleDetail == "text-light"
    assert detail.card.title == "Card Title"
    assert detail.card.description == "Card Desc"
    assert detail.card.copyrightText == "Card (c)"
    assert detail.card.linkCopyright == "https://lic.example.com"

def test_get_story_detail_without_card(mock_read_port):
    mock_read_port.find_story_by_uuid.return_value = {
        "id": 1, "uuid": "u1", "id_text_title": 10
    }
    mock_read_port.find_texts_for_story.return_value = [
        {"id_text": 10, "lang": "en", "short_text": "Title"}
    ]

    service = StoryQueryService(mock_read_port)
    detail = service.get_story_detail("u1", "en")
    assert detail.card is None

def test_get_story_detail_card_not_found(mock_read_port):
    mock_read_port.find_story_by_uuid.return_value = {
        "id": 1, "uuid": "u1", "id_text_title": 10, "id_card": 99
    }
    mock_read_port.find_texts_for_story.return_value = [
        {"id_text": 10, "lang": "en", "short_text": "Title"}
    ]
    mock_read_port.find_card_for_story.return_value = None

    service = StoryQueryService(mock_read_port)
    detail = service.get_story_detail("u1", "en")
    assert detail.card is None

def test_get_story_detail_card_uses_id_text_name_fallback(mock_read_port):
    mock_read_port.find_story_by_uuid.return_value = {
        "id": 1, "uuid": "u1", "id_text_title": 10, "id_card": 42
    }
    mock_read_port.find_texts_for_story.return_value = [
        {"id_text": 10, "lang": "en", "short_text": "Title"},
        {"id_text": 500, "lang": "en", "short_text": "Name Fallback"}
    ]
    mock_read_port.find_card_for_story.return_value = {
        "id": 42, "uuid": "card-uuid", "url_image": None,
        "id_text_name": 500
    }

    service = StoryQueryService(mock_read_port)
    detail = service.get_story_detail("u1", "en")
    assert detail.card is not None
    assert detail.card.title == "Name Fallback"

def test_get_story_detail_class_uuid_fallback_to_id(mock_read_port):
    """When uuid is missing from class row, falls back to str(id)"""
    mock_read_port.find_story_by_uuid.return_value = {
        "id": 1, "uuid": "u1", "id_text_title": 10
    }
    mock_read_port.find_texts_for_story.return_value = [
        {"id_text": 10, "lang": "en", "short_text": "Title"}
    ]
    mock_read_port.find_classes_for_story.return_value = [
        {"id": 99, "id_text_name": None, "id_text_description": None}
    ]

    service = StoryQueryService(mock_read_port)
    detail = service.get_story_detail("u1", "en")
    assert detail.classes[0].uuid == "99"

def test_get_story_detail_trait_null_stat_defaults(mock_read_port):
    """When stat columns are None, defaults to 0"""
    mock_read_port.find_story_by_uuid.return_value = {
        "id": 1, "uuid": "u1", "id_text_title": 10
    }
    mock_read_port.find_texts_for_story.return_value = [
        {"id_text": 10, "lang": "en", "short_text": "Title"}
    ]
    mock_read_port.find_traits_for_story.return_value = [
        {"id": 1, "uuid": "tr-1", "id_text_name": None, "id_text_description": None,
         "cost_positive": None, "cost_negative": None,
         "id_class_permitted": None, "id_class_prohibited": None}
    ]

    service = StoryQueryService(mock_read_port)
    detail = service.get_story_detail("u1", "en")
    assert detail.traits[0].costPositive == 0
    assert detail.traits[0].costNegative == 0

def test_list_public_stories_default_lang(mock_read_port):
    """When lang is None, defaults to 'en'"""
    mock_read_port.find_public_stories.return_value = [
        {"id": 1, "uuid": "u1", "id_text_title": 10}
    ]
    mock_read_port.find_texts_for_story.return_value = [
        {"id_text": 10, "lang": "en", "short_text": "T"}
    ]
    service = StoryQueryService(mock_read_port)
    results = service.list_public_stories(None)
    assert len(results) == 1

def test_list_stories_by_category_default_lang(mock_read_port):
    service = StoryQueryService(mock_read_port)
    results = service.list_stories_by_category("cat", None)
    assert results == []

def test_list_stories_by_group_default_lang(mock_read_port):
    service = StoryQueryService(mock_read_port)
    results = service.list_stories_by_group("grp", None)
    assert results == []

def test_get_story_detail_default_lang(mock_read_port):
    service = StoryQueryService(mock_read_port)
    result = service.get_story_detail("u1", None)
    assert result is None

def test_list_all_stories_default_lang(mock_read_port):
    service = StoryQueryService(mock_read_port)
    results = service.list_all_stories(None)
    assert results == []

# ─── Step 23: trait listing filtered by class ───────────────────────────────

def _trait_row(uuid, permitted=None, prohibited=None):
    return {"id": 1, "uuid": uuid, "id_text_name": None, "id_text_description": None,
            "cost_positive": 2, "cost_negative": 1,
            "id_class_permitted": permitted, "id_class_prohibited": prohibited,
            "life": 0, "energy": 0, "sad": 0, "dexterity": 0,
            "intelligence": 0, "constitution": 0, "weight": 0}

def test_traits_for_class_story_not_found(mock_read_port):
    service = StoryQueryService(mock_read_port)
    status, traits = service.list_traits_for_class("ghost", "c1")
    assert status == "STORY_NOT_FOUND"
    assert traits == []

def test_traits_for_class_class_not_found(mock_read_port):
    mock_read_port.find_story_by_uuid.return_value = {"id": 1, "uuid": "s1"}
    service = StoryQueryService(mock_read_port)
    status, traits = service.list_traits_for_class("s1", "ghost")
    assert status == "CLASS_NOT_FOUND"
    assert traits == []

def test_traits_for_class_filters_by_restrictions(mock_read_port):
    mock_read_port.find_story_by_uuid.return_value = {"id": 1, "uuid": "s1"}
    mock_read_port.find_classes_for_story.return_value = [{"id": 30, "uuid": "c1"}]
    mock_read_port.find_traits_for_story.return_value = [
        _trait_row("tr-unrestricted"),
        _trait_row("tr-permitted-match", permitted=30),
        _trait_row("tr-permitted-other", permitted=999),
        _trait_row("tr-prohibited-match", prohibited=30),
        _trait_row("tr-prohibited-other", prohibited=999),
    ]
    service = StoryQueryService(mock_read_port)
    status, traits = service.list_traits_for_class("s1", "c1")
    assert status == "OK"
    assert [t.uuid for t in traits] == ["tr-unrestricted", "tr-permitted-match", "tr-prohibited-other"]
    assert traits[0].costPositive == 2
    assert traits[0].costNegative == 1
