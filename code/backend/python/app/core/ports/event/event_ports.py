"""Step 25 — domain event publisher port."""
from abc import ABC, abstractmethod


class DomainEventPublisher(ABC):
    """Outbound port for publishing in-process domain events.

    Introduced in Step 25 so later steps (e.g. the WebSocket broadcast in Step 64)
    can subscribe to events such as ``TimeAdvanced`` instead of being retrofitted.
    The current implementation is in-process only; no transport."""

    @abstractmethod
    def publish(self, event) -> None:
        """Publish a domain event to any in-process subscribers."""
