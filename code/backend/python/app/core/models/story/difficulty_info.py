from dataclasses import dataclass, field
from typing import List

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
