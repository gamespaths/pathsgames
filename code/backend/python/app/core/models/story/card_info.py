from dataclasses import dataclass
from app.core.models.story.creator_info import CreatorInfo

@dataclass
class CardInfo:
    uuid: str
    imageUrl: str | None = None
    alternativeImage: str | None = None
    awesomeIcon: str | None = None
    styleMain: str | None = None
    styleDetail: str | None = None
    title: str | None = None
    description: str | None = None
    copyrightText: str | None = None
    linkCopyright: str | None = None
    creator: CreatorInfo | None = None
