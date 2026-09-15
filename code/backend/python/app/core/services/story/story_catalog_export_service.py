from typing import List
from app.core.models.story.catalog_export_result import CatalogExportResult, CatalogFile
from app.core.ports.story.catalog_writer_port import CatalogWriterPort
from app.core.ports.story.story_catalog_export_port import (
    StoryCatalogExportPort, CatalogNotConfiguredError, catalog_path_for)
from app.core.ports.story.story_query_port import StoryQueryPort


class StoryCatalogExportService(StoryCatalogExportPort):
    """v0.37.6 — writes the public story list of every configured language through the writer."""

    def __init__(self, query_port: StoryQueryPort, writer: CatalogWriterPort, langs: List[str] | None = None):
        self.query_port = query_port
        self.writer = writer
        self.langs = list(langs) if langs else ["en"]

    def export_catalog(self) -> CatalogExportResult:
        if not self.writer.is_configured():
            raise CatalogNotConfiguredError()
        files = []
        for lang in self.langs:
            stories = self.query_port.list_public_stories(lang)
            path = catalog_path_for(lang)
            size = self.writer.write(path, stories)
            files.append(CatalogFile(lang=lang, path=path, count=len(stories), bytes=size))
        return CatalogExportResult(target=self.writer.target(), files=files)
