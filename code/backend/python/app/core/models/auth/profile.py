"""v1.7.0 the statistics and preferences of GET /api/auth/me (mirror of UserStats.java / UserPreferences.java)."""
from dataclasses import dataclass
from typing import Iterable, List, Optional

from app.core.models.match import match_statuses

THEME_DEFAULT = "default"
THEME_HIGH_CONTRAST = "high-contrast"
DEFAULT_LANGUAGES = ["en", "it"]
DEFAULT_THEMES = [THEME_DEFAULT, THEME_HIGH_CONTRAST]


@dataclass(frozen=True)
class MatchStatusTotals:
    status: str
    matches: int
    play_ms: int
    clocks: int


@dataclass(frozen=True)
class UserStats:
    matches_played: int = 0
    matches_completed: int = 0
    matches_game_over: int = 0
    play_time_ms: int = 0
    clocks_played: int = 0

    @staticmethod
    def of(totals: Optional[Iterable[MatchStatusTotals]]) -> "UserStats":
        """Folds the per-status totals; a status outside PLAYED counts nowhere."""
        played = completed = game_over = play_ms = clocks = 0
        for t in totals or []:
            if t.status not in match_statuses.PLAYED:
                continue
            played += t.matches
            play_ms += t.play_ms
            clocks += t.clocks
            if t.status == match_statuses.ENDED:
                completed += t.matches
            elif t.status == match_statuses.GAMEOVER:
                game_over += t.matches
        return UserStats(played, completed, game_over, play_ms, clocks)

    def to_body(self) -> dict:
        return {"matchesPlayed": self.matches_played, "matchesCompleted": self.matches_completed,
                "matchesGameOver": self.matches_game_over, "playTimeMs": self.play_time_ms,
                "clocksPlayed": self.clocks_played}


@dataclass(frozen=True)
class UserPreferences:
    language: Optional[str]
    theme: str = THEME_DEFAULT

    @property
    def high_contrast(self) -> bool:
        return self.theme == THEME_HIGH_CONTRAST

    def to_body(self) -> dict:
        return {"language": self.language, "theme": self.theme, "highContrast": self.high_contrast}


def parse_list(csv: Optional[str], fallback: List[str]) -> List[str]:
    """A comma-separated list, trimmed, lowercase, without blanks or duplicates; the fallback when empty."""
    out: List[str] = []
    for part in (csv or "").split(","):
        value = part.strip().lower()
        if value and value not in out:
            out.append(value)
    return out or list(fallback)
