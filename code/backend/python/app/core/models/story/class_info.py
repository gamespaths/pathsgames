from dataclasses import dataclass
from app.core.models.story.card_info import CardInfo

@dataclass
class ClassInfo:
    uuid: str
    name: str | None = None
    description: str | None = None
    weightMax: int = 0
    dexterityBase: int = 0
    intelligenceBase: int = 0
    constitutionBase: int = 0
    idCard: int | None = None
    card: CardInfo | None = None
