"""Extra coverage for StoryCrudAdminController error branches (Step 17):
admin guard, empty-body / not-found exits and the validation-exception mapping
on entity create/update."""
import asyncio
import types

import pytest
from fastapi import HTTPException
from unittest.mock import MagicMock

from app.adapters.rest.story.story_crud_admin_controller import StoryCrudAdminController
from app.core.ports.story.story_validator_port import StoryValidationException


def _req(role="ADMIN"):
    return types.SimpleNamespace(state=types.SimpleNamespace(role=role))


def _run(coro):
    return asyncio.run(coro)


def _ctrl():
    return StoryCrudAdminController(MagicMock())


def _validation_exc():
    report = MagicMock()
    report.summary.return_value = "1 issue"
    report.errors = []
    return StoryValidationException(report)


def test_create_story_requires_admin():
    with pytest.raises(HTTPException) as ei:
        _run(_ctrl().create_story_route(_req(role="PLAYER"), data={"x": 1}))
    assert ei.value.status_code == 403


def test_update_story_empty_body_and_not_found():
    ctrl = _ctrl()
    with pytest.raises(HTTPException) as ei:
        _run(ctrl.update_story_route(_req(), uuidStory="u1", data=None))
    assert ei.value.detail["error"] == "EMPTY_DATA"

    ctrl.crud_port.update_story.return_value = None
    with pytest.raises(HTTPException) as ei2:
        _run(ctrl.update_story_route(_req(), uuidStory="u1", data={"x": 1}))
    assert ei2.value.status_code == 404


def test_create_entity_maps_validation_exception():
    ctrl = _ctrl()
    ctrl.crud_port.create_entity.side_effect = _validation_exc()
    with pytest.raises(HTTPException) as ei:
        _run(ctrl.create_entity(_req(), uuidStory="u1", entityType="locations", data={"x": 1}))
    assert ei.value.status_code == 400
    assert ei.value.detail["error"] == "INVALID_STORY"


def test_update_entity_maps_validation_exception():
    ctrl = _ctrl()
    ctrl.crud_port.update_entity.side_effect = _validation_exc()
    with pytest.raises(HTTPException) as ei:
        _run(ctrl.update_entity(_req(), uuidStory="u1", entityType="locations",
                                entityUuid="e1", data={"x": 1}))
    assert ei.value.status_code == 400


def test_delete_entity_not_found():
    ctrl = _ctrl()
    ctrl.crud_port.delete_entity.return_value = False
    with pytest.raises(HTTPException) as ei:
        _run(ctrl.delete_entity(_req(), uuidStory="u1", entityType="locations", entityUuid="e1"))
    assert ei.value.status_code == 404
