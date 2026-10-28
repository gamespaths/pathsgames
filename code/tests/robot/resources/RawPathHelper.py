# RawPathHelper.py — v1.10.0: a request whose path is sent byte for byte (requests would un-escape %61 into 'a'),
# to prove an encoded or ;-padded admin path never reaches an admin endpoint on the public URL.
import http.client
import ssl
from urllib.parse import urlsplit


def raw_request(base_url, method, raw_path, token=None, timeout=30):
    """`method` `raw_path` on the host of `base_url` (its path prefix kept): {status, body} with the body as text."""
    url = urlsplit(base_url)
    if url.scheme == "https":
        conn = http.client.HTTPSConnection(url.hostname, url.port or 443, timeout=float(timeout),
                                           context=ssl._create_unverified_context())
    else:
        conn = http.client.HTTPConnection(url.hostname, url.port or 80, timeout=float(timeout))
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        conn.request(method.upper(), url.path.rstrip("/") + raw_path, body="{}" if method.upper() != "GET" else None,
                     headers=headers)
        response = conn.getresponse()
        return {"status": response.status, "body": response.read().decode("utf-8", "replace")}
    finally:
        conn.close()
