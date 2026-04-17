from dataclasses import dataclass, field
from typing import List, Optional
from app.core.models.story.difficulty_info import DifficultyInfo
from app.core.models.story.character_template_info import CharacterTemplateInfo
from app.core.models.story.class_info import ClassInfo
from app.core.models.story.trait_info import TraitInfo
from app.core.models.story.card_info import CardInfo

@dataclass
class StoryDetail:
    uuid: str
    title: str | None = None
    description: str | None = None
    author: str | None = None
    category: str | None = None
    group: str | None = None
    visibility: str | None = None
    priority: int = 0
    peghi: int = 0
    versionMin: str | None = None
    versionMax: str | None = None
    clockSingularDescription: str | None = None
    clockPluralDescription: str | None = None
    copyrightText: str | None = None
    linkCopyright: str | None = None
    locationCount: int = 0
    eventCount: int = 0
    itemCount: int = 0
    classCount: int = 0
    characterTemplateCount: int = 0
    traitCount: int = 0
    difficulties: List[DifficultyInfo] = field(default_factory=list)
    characterTemplates: List[CharacterTemplateInfo] = field(default_factory=list)
    classes: List[ClassInfo] = field(default_factory=list)
    traits: List[TraitInfo] = field(default_factory=list)
    card: Optional[CardInfo] = None
