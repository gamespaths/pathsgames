"""Tests for PropertySystemModeService — Step 19."""
from app.core.services.match.property_system_mode_service import PropertySystemModeService


def test_maintenance_true_when_status_matches():
    assert PropertySystemModeService("MAINTENANCE").is_maintenance()
    assert PropertySystemModeService("maintenance").is_maintenance()
    assert PropertySystemModeService(" Maintenance ").is_maintenance()


def test_maintenance_false_when_other():
    assert not PropertySystemModeService("OK").is_maintenance()
    assert not PropertySystemModeService("").is_maintenance()
    assert not PropertySystemModeService(None).is_maintenance()
