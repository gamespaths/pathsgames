from dataclasses import dataclass, field
from app.core.models.story.card_info import CardInfo
from app.core.models.story.class_bonus_info import ClassBonusInfo

@dataclass
class ClassInfo:
    uuid: str
    id: int | None = None
    name: str | None = None
    description: str | None = None
    weightMax: int = 0
    dexterityBase: int = 0
    intelligenceBase: int = 0
    constitutionBase: int = 0
    idCard: int | None = None
    card: CardInfo | None = None
    bonuses: list[ClassBonusInfo] = field(default_factory=list)
