from dataclasses import dataclass, field
from typing import List
from app.core.models.story.difficulty_info import DifficultyInfo

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
    difficulties: List[DifficultyInfo] = field(default_factory=list)
