"""v0.41.0 — Step 41, decision 25: only dev, development and test are dev/test.
Anything else, a blank or a missing value included, is treated as production."""
from typing import Optional

_DEV_OR_TEST = frozenset({"dev", "development", "test"})


def is_dev_or_test(env: Optional[str]) -> bool:
    return env is not None and env.strip().lower() in _DEV_OR_TEST
