from dataclasses import dataclass, field
from typing import List
from app.core.models.story.card_info import CardInfo

@dataclass
class DifficultyInfo:
    uuid: str
    description: str | None = None
    expCost: int = 5
    maxWeight: int = 10
    minCharacter: int = 1
    maxCharacter: int = 4
    costHelpComa: int = 3
    costMaxCharacteristics: int = 3
    numberMaxFreeAction: int = 1
    idCard: int | None = None
    card: CardInfo | None = None
    life: int = 100
    energy: int = 100
    sad: int = 0
    dexterity: int = 10
    intelligence: int = 10
    constitution: int = 10
    weight: int = 10
