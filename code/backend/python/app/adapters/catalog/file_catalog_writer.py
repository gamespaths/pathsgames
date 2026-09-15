import json
from pathlib import Path
from typing import List
from fastapi.encoders import jsonable_encoder
from app.core.models.story.story_summary import StorySummary
from app.core.ports.story.catalog_writer_port import CatalogWriterPort


class FileCatalogWriter(CatalogWriterPort):
    """v0.37.6 — writes the static catalog under CATALOG_EXPORT_DIR; empty = not configured."""

    def __init__(self, export_dir: str | None):
        self.export_dir = Path(export_dir) if export_dir and export_dir.strip() else None

    def is_configured(self) -> bool:
        return self.export_dir is not None

    def target(self) -> str | None:
        return str(self.export_dir.resolve()) if self.export_dir else None

    def write(self, relative_path: str, stories: List[StorySummary]) -> int:
        # Same encoder + separators as FastAPI's JSONResponse → same body as GET /api/stories.
        body = json.dumps(jsonable_encoder(stories), ensure_ascii=False, separators=(",", ":"))
        data = body.encode("utf-8")
        file = self.export_dir / relative_path
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_bytes(data)
        return len(data)
