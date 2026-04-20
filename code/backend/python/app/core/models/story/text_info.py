from __future__ import annotations
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.core.models.story.creator_info import CreatorInfo

@dataclass
class TextInfo:
    idText: int
    lang: str
    resolvedLang: str
    shortText: str | None = None
    longText: str | None = None
    copyrightText: str | None = None
    linkCopyright: str | None = None
    creator: CreatorInfo | None = None
