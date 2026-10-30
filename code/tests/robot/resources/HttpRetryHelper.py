# HttpRetryHelper.py — retries of a RequestsLibrary session: DNS/connection errors up to `connect`,
# read timeouts up to `read` on every method (POST too); an HTTP status is never retried.
from requests.adapters import HTTPAdapter
from robot.libraries.BuiltIn import BuiltIn
from urllib3.util.retry import Retry


def build_retry(connect, read, backoff_factor):
    """The urllib3 Retry of the shared sessions (allowed_methods=None = any verb)."""
    connect, read = int(connect), int(read)
    return Retry(total=max(connect, read), connect=connect, read=read, status=0, other=0,
                 backoff_factor=float(backoff_factor), allowed_methods=None, raise_on_status=False)


def mount_http_retry(alias, connect, read, backoff_factor):
    """Replace the adapters of the RequestsLibrary session `alias` with the shared Retry."""
    session = BuiltIn().get_library_instance("RequestsLibrary")._cache.get_connection(alias)
    adapter = HTTPAdapter(max_retries=build_retry(connect, read, backoff_factor))
    session.mount("http://", adapter)
    session.mount("https://", adapter)
