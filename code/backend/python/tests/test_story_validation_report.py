"""The report the validator hands back: its summary is what the HTTP 400 body says."""
import pytest

from app.core.ports.story.story_validator_port import (
    StoryValidationError, StoryValidationException, StoryValidationReport,
)


def _report(count):
    report = StoryValidationReport()
    for i in range(count):
        report.add("DANGLING_REF", "events", str(i), "idEventNext", f"error {i}")
    return report


def test_an_empty_report_is_valid():
    report = StoryValidationReport()
    assert report.is_valid()
    assert report.summary() == "story is valid"
    assert report.to_dict() == {"valid": True, "count": 0, "errors": []}


def test_a_short_report_lists_every_message():
    report = _report(2)
    assert not report.is_valid()
    assert report.summary() == "error 0; error 1"


def test_a_long_report_lists_five_and_counts_the_rest():
    report = _report(8)
    assert report.summary().endswith("; (+3 more)")
    assert report.summary().startswith("error 0; error 1; error 2; error 3; error 4")


def test_to_dict_carries_every_error():
    body = _report(1).to_dict()
    assert body["valid"] is False
    assert body["count"] == 1
    assert body["errors"] == [{
        "rule": "DANGLING_REF", "entityType": "events", "entityId": "0",
        "field": "idEventNext", "message": "error 0",
    }]


def test_error_to_dict_renames_the_field_key():
    error = StoryValidationError("R", "items", None, None, "boom")
    assert error.to_dict() == {
        "rule": "R", "entityType": "items", "entityId": None, "field": None, "message": "boom",
    }


def test_the_exception_carries_the_report_in_its_message():
    report = _report(1)
    with pytest.raises(StoryValidationException) as raised:
        raise StoryValidationException(report)
    assert raised.value.report is report
    assert "error 0" in str(raised.value)
