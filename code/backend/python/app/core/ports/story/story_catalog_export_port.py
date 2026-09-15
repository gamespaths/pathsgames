from abc import ABC, abstractmethod
from app.core.models.story.catalog_export_result import CatalogExportResult


def catalog_path_for(lang: str) -> str:
    return f"data/stories-{lang}.json"


class CatalogNotConfiguredError(RuntimeError):
    def __init__(self):
        super().__init__("No static catalog destination configured (CATALOG_EXPORT_DIR / WEBSITE_BUCKET)")


class StoryCatalogExportPort(ABC):
    """v0.37.6 — inbound port: (re)writes data/stories-{lang}.json for the game home page."""

    @abstractmethod
    def export_catalog(self) -> CatalogExportResult:
        pass
