"""v1.2.0 nickname of a new Google user: the email local part without +tag, lowercase; a taken one gets
the first free suffix #2, #3, ... (same rule as Java NicknameGenerator)."""
from typing import Callable, Optional

MAX_LENGTH = 90
MAX_SUFFIX = 1000
FALLBACK = "player"


def base(email: Optional[str]) -> str:
    if email is None:
        return FALLBACK
    local = email.strip().lower().split("@", 1)[0]
    local = local.split("+", 1)[0]
    if not local.strip():
        return FALLBACK
    return local[:MAX_LENGTH]


def candidate(nick_base: str, n: int) -> str:
    return nick_base if n <= 1 else f"{nick_base}#{n}"


def first_free(nick_base: str, start: int, taken: Callable[[str], bool], uuid: str) -> str:
    for n in range(max(1, start), MAX_SUFFIX + 1):
        nickname = candidate(nick_base, n)
        if not taken(nickname):
            return nickname
    return f"{nick_base}#{uuid[:8]}"
