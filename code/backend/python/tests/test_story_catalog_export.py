"""v0.37.6 — static catalog export: service, file writer, admin route, config."""
import json
import pytest
from unittest.mock import MagicMock
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app.adapters.catalog.file_catalog_writer import FileCatalogWriter
from app.adapters.rest.story.story_admin_controller import StoryAdminController
from app.core.models.story.card_info import CardInfo
from app.core.models.story.catalog_export_result import CatalogExportResult, CatalogFile
from app.core.models.story.story_summary import StorySummary
from app.core.ports.story.story_catalog_export_port import CatalogNotConfiguredError, catalog_path_for
from app.core.services.story.story_catalog_export_service import StoryCatalogExportService
from app.config import Settings


def _story(uuid="s1"):
    return StorySummary(uuid=uuid, title="T", category="cat", visibility="PUBLIC",
                        card=CardInfo(uuid="c1", cardType="story", urlImage="http://img"))


# ── service ──────────────────────────────────────────────────────────────

def test_service_writes_every_language():
    query = MagicMock()
    query.list_public_stories.side_effect = lambda lang: [_story("a"), _story("b")] if lang == "en" else [_story("a")]
    writer = MagicMock()
    writer.is_configured.return_value = True
    writer.target.return_value = "/srv/site"
    writer.write.side_effect = [200, 100]

    result = StoryCatalogExportService(query, writer, ["en", "it"]).export_catalog()

    assert result.target == "/srv/site"
    assert result.files == [CatalogFile("en", "data/stories-en.json", 2, 200),
                            CatalogFile("it", "data/stories-it.json", 1, 100)]
    writer.write.assert_any_call("data/stories-en.json", [_story("a"), _story("b")])


def test_service_defaults_to_english():
    query = MagicMock()
    query.list_public_stories.return_value = []
    writer = MagicMock()
    writer.is_configured.return_value = True
    writer.write.return_value = 2
    assert [f.lang for f in StoryCatalogExportService(query, writer, None).export_catalog().files] == ["en"]
    assert [f.lang for f in StoryCatalogExportService(query, writer, []).export_catalog().files] == ["en"]


def test_service_refuses_when_not_configured():
    query = MagicMock()
    writer = MagicMock()
    writer.is_configured.return_value = False
    with pytest.raises(CatalogNotConfiguredError):
        StoryCatalogExportService(query, writer, ["en"]).export_catalog()
    writer.write.assert_not_called()
    query.list_public_stories.assert_not_called()


def test_catalog_path_for():
    assert catalog_path_for("fr") == "data/stories-fr.json"


# ── file writer ──────────────────────────────────────────────────────────

def test_writer_not_configured_when_blank():
    for v in ("", "   ", None):
        w = FileCatalogWriter(v)
        assert not w.is_configured()
        assert w.target() is None


def test_writer_writes_rest_shaped_json(tmp_path):
    w = FileCatalogWriter(str(tmp_path))
    assert w.is_configured()
    assert w.target() == str(tmp_path.resolve())

    size = w.write("data/stories-en.json", [_story()])

    file = tmp_path / "data" / "stories-en.json"
    assert file.exists()
    assert file.stat().st_size == size
    body = json.loads(file.read_text(encoding="utf-8"))
    assert isinstance(body, list)
    assert body[0]["uuid"] == "s1"
    assert body[0]["card"]["urlImage"] == "http://img"
    # compact separators like FastAPI's JSONResponse
    assert ", " not in file.read_text(encoding="utf-8")


def test_writer_null_card(tmp_path):
    w = FileCatalogWriter(str(tmp_path))
    w.write("x.json", [StorySummary(uuid="s2")])
    assert json.loads((tmp_path / "x.json").read_text())[0]["card"] is None


# ── admin route ──────────────────────────────────────────────────────────

def _client(export_port):
    app = FastAPI()

    @app.middleware("http")
    async def auth_middleware(request: Request, call_next):
        if request.headers.get("X-Test-Admin") == "true":
            request.state.role = "ADMIN"
        return await call_next(request)

    app.include_router(StoryAdminController(MagicMock(), MagicMock(), None, export_port).router)
    return TestClient(app)


def test_route_writes_catalog():
    port = MagicMock()
    port.export_catalog.return_value = CatalogExportResult(
        target="/srv/site", files=[CatalogFile("en", "data/stories-en.json", 3, 999)])
    res = _client(port).post("/api/admin/stories/catalog", headers={"X-Test-Admin": "true"})
    assert res.status_code == 200
    assert res.json() == {"status": "WRITTEN", "target": "/srv/site",
                          "files": [{"lang": "en", "path": "data/stories-en.json", "count": 3, "bytes": 999}]}


def test_route_503_when_not_configured():
    port = MagicMock()
    port.export_catalog.side_effect = CatalogNotConfiguredError()
    res = _client(port).post("/api/admin/stories/catalog", headers={"X-Test-Admin": "true"})
    assert res.status_code == 503
    assert res.json()["detail"]["error"] == "CATALOG_TARGET_NOT_CONFIGURED"


def test_route_503_when_no_port_wired():
    res = _client(None).post("/api/admin/stories/catalog", headers={"X-Test-Admin": "true"})
    assert res.status_code == 503


def test_route_requires_admin():
    port = MagicMock()
    assert _client(port).post("/api/admin/stories/catalog").status_code == 403
    port.export_catalog.assert_not_called()


# ── config ───────────────────────────────────────────────────────────────

def test_config_catalog_langs_list():
    s = Settings(catalog_langs=" en, it ,,fr")
    assert s.catalog_langs_list == ["en", "it", "fr"]
    assert Settings().catalog_export_dir == ""
