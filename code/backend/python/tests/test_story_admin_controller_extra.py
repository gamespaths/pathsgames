"""Coverage for StoryAdminController error/admin-guard branches (Step 17/22).

Drives the async handlers directly with asyncio + a fake request and mock
ports, covering the admin guard, empty-body, validation-exception and
not-found error paths."""
import asyncio
import types

import pytest
from fastapi import HTTPException
from unittest.mock import MagicMock

from app.adapters.rest.story.story_admin_controller import StoryAdminController
from app.core.ports.story.story_validator_port import StoryValidationException


def _req(role="ADMIN"):
    return types.SimpleNamespace(state=types.SimpleNamespace(role=role))


def _run(coro):
    return asyncio.run(coro)


def _ctrl(validator_port=None):
    return StoryAdminController(MagicMock(), MagicMock(), validator_port)


def test_require_admin_blocks_non_admin():
    ctrl = _ctrl()
    with pytest.raises(HTTPException) as ei:
        _run(ctrl.list_all_stories(_req(role="PLAYER")))
    assert ei.value.status_code == 403


def test_list_all_stories_delegates_to_query_port():
    ctrl = _ctrl()
    ctrl.query_port.list_all_stories.return_value = ["s1"]
    assert _run(ctrl.list_all_stories(_req(), lang="it")) == ["s1"]
    ctrl.query_port.list_all_stories.assert_called_once_with("it")


def test_import_story_rejects_empty_body():
    ctrl = _ctrl()
    with pytest.raises(HTTPException) as ei:
        _run(ctrl.import_story(_req(), data=None))
    assert ei.value.status_code == 400
    assert ei.value.detail["error"] == "EMPTY_IMPORT_DATA"


def test_import_story_success():
    ctrl = _ctrl()
    ctrl.import_port.import_story.return_value = {"status": "OK"}
    assert _run(ctrl.import_story(_req(), data={"uuid": "x"})) == {"status": "OK"}


def test_import_story_maps_validation_exception():
    ctrl = _ctrl()
    report = MagicMock()
    report.summary.return_value = "2 issues"
    report.errors = []
    ctrl.import_port.import_story.side_effect = StoryValidationException(report)
    with pytest.raises(HTTPException) as ei:
        _run(ctrl.import_story(_req(), data={"uuid": "x"}))
    assert ei.value.status_code == 400
    assert ei.value.detail["error"] == "INVALID_STORY"


def test_import_story_maps_value_error():
    ctrl = _ctrl()
    ctrl.import_port.import_story.side_effect = ValueError("bad data")
    with pytest.raises(HTTPException) as ei:
        _run(ctrl.import_story(_req(), data={"uuid": "x"}))
    assert ei.value.status_code == 400
    assert ei.value.detail["error"] == "INVALID_IMPORT_DATA"


def test_validate_story_without_validator_returns_default():
    ctrl = _ctrl(validator_port=None)
    assert _run(ctrl.validate_story(_req(), uuid="u1")) == {"valid": True, "count": 0, "errors": []}


def test_validate_story_not_found():
    validator = MagicMock()
    validator.validate_story_by_uuid.return_value = None
    ctrl = _ctrl(validator_port=validator)
    with pytest.raises(HTTPException) as ei:
        _run(ctrl.validate_story(_req(), uuid="missing"))
    assert ei.value.status_code == 404


def test_validate_story_success():
    validator = MagicMock()
    report = MagicMock()
    report.to_dict.return_value = {"valid": True}
    validator.validate_story_by_uuid.return_value = report
    ctrl = _ctrl(validator_port=validator)
    assert _run(ctrl.validate_story(_req(), uuid="u1")) == {"valid": True}


def test_delete_story_success_and_not_found():
    ctrl = _ctrl()
    ctrl.import_port.delete_story.return_value = True
    assert _run(ctrl.delete_story(_req(), uuid="u1")) == {"status": "DELETED", "uuid": "u1"}

    ctrl.import_port.delete_story.return_value = False
    with pytest.raises(HTTPException) as ei:
        _run(ctrl.delete_story(_req(), uuid="u2"))
    assert ei.value.status_code == 404
