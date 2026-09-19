"""
v0.38.1 — logger levels shared by every Lambda. Called once per module import (cold start).
"""
import logging

# Loggers that spam INFO with nothing worth keeping (one line per cold start each).
NOISY_LOGGERS = ('botocore.credentials',)


def quiet_botocore(level=logging.WARNING):
    """Raise the noisy AWS SDK loggers to `level`; the application loggers stay as configured."""
    for name in NOISY_LOGGERS:
        logging.getLogger(name).setLevel(level)
