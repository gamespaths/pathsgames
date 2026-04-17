from dataclasses import dataclass

@dataclass
class TraitInfo:
    uuid: str
    name: str | None = None
    description: str | None = None
    costPositive: int = 0
    costNegative: int = 0
    idClassPermitted: int | None = None
    idClassProhibited: int | None = None
