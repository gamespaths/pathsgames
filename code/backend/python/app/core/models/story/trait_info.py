from dataclasses import dataclass
from app.core.models.story.card_info import CardInfo

@dataclass
class TraitInfo:
    uuid: str
    name: str | None = None
    description: str | None = None
    costPositive: int = 0
    costNegative: int = 0
    idClassPermitted: int | None = None
    idClassProhibited: int | None = None
    idCard: int | None = None
    card: CardInfo | None = None
