from abc import ABC, abstractmethod

class EchoPort(ABC):
    @abstractmethod
    def get_server_status(self) -> str:
        """Returns the current server status."""
        pass

    @abstractmethod
    def get_timestamp(self) -> int:
        """Returns the current server timestamp in milliseconds."""
        pass

    @abstractmethod
    def get_server_properties(self) -> dict[str, str]:
        """Returns the server properties."""
        pass
