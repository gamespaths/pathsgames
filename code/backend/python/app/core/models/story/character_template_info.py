from dataclasses import dataclass
from app.core.models.story.card_info import CardInfo

@dataclass
class CharacterTemplateInfo:
    uuid: str
    name: str | None = None
    description: str | None = None
    lifeMax: int = 0
    energyMax: int = 0
    sadMax: int = 0
    dexterityStart: int = 0
    intelligenceStart: int = 0
    constitutionStart: int = 0
    idCard: int | None = None
    card: CardInfo | None = None
