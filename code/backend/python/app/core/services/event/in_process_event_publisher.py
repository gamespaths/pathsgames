"""Step 25 — default in-process :class:`DomainEventPublisher`."""
import logging

from app.core.ports.event.event_ports import DomainEventPublisher

logger = logging.getLogger(__name__)


class InProcessDomainEventPublisher(DomainEventPublisher):
    """Logs the event and is a no-op transport. Exists so the domain can publish
    events today and later steps can replace/extend the transport (WebSocket in
    Step 64) without touching the domain services."""

    def publish(self, event) -> None:
        if event is None:
            return
        logger.debug("Domain event published: %s", event)
