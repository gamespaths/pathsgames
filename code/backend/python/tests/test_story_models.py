import pytest
from app.core.models.story.story_summary import StorySummary
from app.core.models.story.story_detail import StoryDetail
from app.core.models.story.difficulty_info import DifficultyInfo
from app.core.models.story.story_import_result import StoryImportResult
from app.core.models.story.class_info import ClassInfo
from app.core.models.story.character_template_info import CharacterTemplateInfo
from app.core.models.story.trait_info import TraitInfo
from app.core.models.story.card_info import CardInfo

def test_story_summary_defaults():
    s = StorySummary(uuid="u1")
    assert s.priority == 0
    assert s.title is None

def test_difficulty_info_defaults():
    d = DifficultyInfo(uuid="u1")
    assert d.expCost == 5
    assert d.maxWeight == 10

def test_story_detail_defaults():
    d = StoryDetail(uuid="u1")
    assert d.locationCount == 0
    assert isinstance(d.difficulties, list)
    assert len(d.difficulties) == 0
    assert isinstance(d.classes, list)
    assert len(d.classes) == 0
    assert isinstance(d.characterTemplates, list)
    assert len(d.characterTemplates) == 0
    assert isinstance(d.traits, list)
    assert len(d.traits) == 0
    assert d.card is None

def test_story_detail_with_card():
    card = CardInfo(uuid="c1", imageUrl="https://img.png", title="T")
    d = StoryDetail(uuid="u1", card=card)
    assert d.card is not None
    assert d.card.uuid == "c1"
    assert d.card.imageUrl == "https://img.png"

def test_story_import_result_defaults():
    r = StoryImportResult(storyUuid="u1", status="IMPORTED")
    assert r.textsImported == 0
    assert r.locationsImported == 0

def test_class_info_defaults():
    c = ClassInfo(uuid="cls1")
    assert c.name is None
    assert c.description is None
    assert c.weightMax == 0
    assert c.dexterityBase == 0
    assert c.intelligenceBase == 0
    assert c.constitutionBase == 0

def test_class_info_full():
    c = ClassInfo(uuid="cls1", name="Knight", description="Noble", weightMax=15,
                  dexterityBase=2, intelligenceBase=1, constitutionBase=3)
    assert c.uuid == "cls1"
    assert c.name == "Knight"
    assert c.weightMax == 15

def test_character_template_info_defaults():
    t = CharacterTemplateInfo(uuid="ct1")
    assert t.name is None
    assert t.lifeMax == 0
    assert t.energyMax == 0
    assert t.sadMax == 0
    assert t.dexterityStart == 0
    assert t.intelligenceStart == 0
    assert t.constitutionStart == 0

def test_character_template_info_full():
    t = CharacterTemplateInfo(uuid="ct1", name="Warrior", description="Strong",
                               lifeMax=20, energyMax=10, sadMax=5,
                               dexterityStart=2, intelligenceStart=1, constitutionStart=3)
    assert t.uuid == "ct1"
    assert t.name == "Warrior"
    assert t.lifeMax == 20
    assert t.constitutionStart == 3

def test_trait_info_defaults():
    t = TraitInfo(uuid="tr1")
    assert t.name is None
    assert t.costPositive == 0
    assert t.costNegative == 0
    assert t.idClassPermitted is None
    assert t.idClassProhibited is None

def test_trait_info_full():
    t = TraitInfo(uuid="tr1", name="Brave", description="Fearless",
                  costPositive=2, costNegative=1, idClassPermitted=3, idClassProhibited=5)
    assert t.uuid == "tr1"
    assert t.costPositive == 2
    assert t.idClassPermitted == 3
    assert t.idClassProhibited == 5

def test_card_info_defaults():
    c = CardInfo(uuid="cd1")
    assert c.imageUrl is None
    assert c.alternativeImage is None
    assert c.awesomeIcon is None
    assert c.styleMain is None
    assert c.styleDetail is None
    assert c.title is None

def test_card_info_full():
    c = CardInfo(uuid="cd1", imageUrl="https://img.png", alternativeImage="alt",
                 awesomeIcon="fa-star", styleMain="bg-dark", styleDetail="text-light",
                 title="My Card")
    assert c.uuid == "cd1"
    assert c.imageUrl == "https://img.png"
    assert c.awesomeIcon == "fa-star"
    assert c.title == "My Card"
