from dataclasses import dataclass, field
from typing import List


@dataclass
class CatalogFile:
    lang: str
    path: str
    count: int
    bytes: int


@dataclass
class CatalogExportResult:
    """v0.37.6 — outcome of a static catalog export: destination + one entry per language."""
    target: str
    files: List[CatalogFile] = field(default_factory=list)
