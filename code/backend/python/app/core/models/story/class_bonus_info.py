from dataclasses import dataclass


@dataclass
class ClassBonusInfo:
    """Single bonus row attached to a class (from list_classes_bonus)."""
    uuid: str | None = None
    statistic: str | None = None
    value: int = 0
