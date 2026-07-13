"""Tests for InProcessDomainEventPublisher — lines 15-17."""
from unittest.mock import MagicMock, patch

from app.core.services.event.in_process_event_publisher import InProcessDomainEventPublisher


def test_publish_none_is_noop():
    pub = InProcessDomainEventPublisher()
    pub.publish(None)  # must not raise


def test_publish_event_logs_debug():
    pub = InProcessDomainEventPublisher()
    event = MagicMock()
    event.__str__ = lambda self: "TestEvent"
    with patch("app.core.services.event.in_process_event_publisher.logger") as mock_logger:
        pub.publish(event)
        mock_logger.debug.assert_called_once()


def test_publish_string_event():
    pub = InProcessDomainEventPublisher()
    with patch("app.core.services.event.in_process_event_publisher.logger") as mock_logger:
        pub.publish("some-event")
        mock_logger.debug.assert_called_once()
