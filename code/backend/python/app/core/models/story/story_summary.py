from dataclasses import dataclass, field

@dataclass
class StorySummary:
    uuid: str
    title: str | None = None
    description: str | None = None
    author: str | None = None
    category: str | None = None
    group: str | None = None
    visibility: str | None = None
    priority: int = 0
    peghi: int = 0
    difficultyCount: int = 0
