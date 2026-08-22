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
    # v0.35.2 — true when the trait is not offered at character creation. Reported, never
    # filtered: the same list resolves the traits a character already has.
    hideOnStartMatch: bool = False
    life: int = 0
    energy: int = 0
    sad: int = 0
    dexterity: int = 0
    intelligence: int = 0
    constitution: int = 0
    weight: int = 0
