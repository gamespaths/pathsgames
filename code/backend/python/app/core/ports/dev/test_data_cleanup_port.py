from abc import ABC, abstractmethod

from app.core.models.dev.cleanup_result import CleanupResult


class TestDataCleanupPort(ABC):
    """Inbound port for the dev-only test-data cleanup use case."""

    # Tells pytest this is not a test class despite the "Test" name prefix.
    __test__ = False

    @abstractmethod
    def cleanup_test_data(self) -> CleanupResult:
        """Delete every guest and match created by automated test runs."""
        ...
