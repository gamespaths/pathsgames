import pytest
import sys
from app.core.services.echo_service import EchoService


def test_echo_service_status():
    service = EchoService(server_status="OK", server_properties={"env": "test"})
    assert service.get_server_status() == "OK"


def test_echo_service_properties_passthrough():
    service = EchoService(server_status="OK", server_properties={"env": "test"})
    props = service.get_server_properties()
    assert props["env"] == "test"


def test_echo_service_python_version_dynamic():
    """pythonVersion must reflect the actual running Python, not a hardcoded string."""
    service = EchoService(server_status="OK", server_properties={})
    props = service.get_server_properties()
    expected = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    assert props["pythonVersion"] == expected


def test_echo_service_properties_not_mutated():
    """Original properties dict must not be mutated by get_server_properties()."""
    original = {"env": "test"}
    service = EchoService(server_status="OK", server_properties=original)
    service.get_server_properties()
    assert "pythonVersion" not in original


def test_echo_service_timestamp():
    service = EchoService(server_status="OK", server_properties={})
    ts = service.get_timestamp()
    assert isinstance(ts, int)
    assert ts > 0

