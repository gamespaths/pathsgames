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

    def get_supported_languages(self) -> list[str]:
        """v1.7.0 the languages a profile may choose."""
        return []

    def get_supported_themes(self) -> list[str]:
        """v1.7.0 the themes a profile may choose."""
        return []

    def get_match_refetch_browsers(self) -> list[str]:
        """v1.7.0 step 8 the browsers that refetch a match on page return: webkit or all."""
        return ["webkit"]

    def get_match_refetch_min_hidden_seconds(self) -> int:
        """v1.7.0 step 8 the seconds a page must stay hidden before the return refetches the match."""
        return 30
