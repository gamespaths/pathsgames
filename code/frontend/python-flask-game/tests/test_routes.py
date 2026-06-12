import re

from app.data import get_stories


def _first_uuid():
    return get_stories()[0]["uuid"]


def test_catalog_ok(client):
    r = client.get("/")
    assert r.status_code == 200
    assert b"hero-title" in r.data
    assert b"stories-grid" in r.data


def test_story_detail_ok(client):
    r = client.get(f"/story/{_first_uuid()}")
    assert r.status_code == 200
    assert b"book-wrapper" in r.data


def test_story_detail_404(client):
    assert client.get("/story/missing-uuid").status_code == 404


def test_select_get_and_post(client):
    uuid = _first_uuid()
    r = client.get(f"/story/{uuid}/select/class")
    assert r.status_code == 200
    # grab an option uuid from the rendered form
    m = re.search(r'name="uuid" value="([^"]+)"', r.data.decode())
    assert m
    chosen = m.group(1)
    r2 = client.post(f"/story/{uuid}/select/class", data={"uuid": chosen})
    assert r2.status_code == 302
    assert f"/story/{uuid}" in r2.headers["Location"]


def test_select_invalid_kind_404(client):
    assert client.get(f"/story/{_first_uuid()}/select/nonsense").status_code == 404


def test_start_match_shows_captcha(client):
    r = client.get(f"/story/{_first_uuid()}/start")
    assert r.status_code == 200
    assert b'name="captcha"' in r.data
    assert b"= ?" in r.data


def test_start_match_wrong_captcha_rerenders(client):
    uuid = _first_uuid()
    client.get(f"/story/{uuid}/start")
    r = client.post(f"/story/{uuid}/start", data={"captcha": "-999", "website": ""})
    assert r.status_code == 200  # re-rendered with error, no redirect
    assert b'name="captcha"' in r.data


def test_start_match_honeypot_blocks(client):
    uuid = _first_uuid()
    page = client.get(f"/story/{uuid}/start").data.decode()
    a, b = re.search(r"(\d+) \+ (\d+) = \?", page).groups()
    r = client.post(f"/story/{uuid}/start",
                    data={"captcha": str(int(a) + int(b)), "website": "bot"})
    assert r.status_code == 200  # honeypot filled -> blocked


def test_full_start_flow_creates_match(client):
    uuid = _first_uuid()
    page = client.get(f"/story/{uuid}/start").data.decode()
    a, b = re.search(r"(\d+) \+ (\d+) = \?", page).groups()
    r = client.post(f"/story/{uuid}/start",
                    data={"captcha": str(int(a) + int(b)), "website": ""})
    assert r.status_code == 302
    loc = r.headers["Location"]
    assert "/match/" in loc
    # the match page renders (half-mock)
    r2 = client.get(loc)
    assert r2.status_code == 200
    assert b"pg-match-grid" in r2.data


def test_user_page_ok(client):
    r = client.get("/me")
    assert r.status_code == 200
    assert b"matches-list-title" in r.data


def test_legal_pages_ok(client):
    for path in ("/privacy", "/terms", "/cookies"):
        r = client.get(path)
        assert r.status_code == 200
        assert b"pg-legal" in r.data


def test_prefs_lang_sets_cookie(client):
    r = client.post("/prefs/lang", data={"lang": "it", "next": "/"})
    assert r.status_code == 302
    assert any("pg_lang=it" in h for h in r.headers.get_all("Set-Cookie"))


def test_prefs_theme_applies_class(client):
    client.post("/prefs/theme", data={"theme": "access", "next": "/"})
    r = client.get("/")
    assert b"theme-access" in r.data


def test_cookie_banner_hidden_after_consent(client):
    assert b"pg-cookie-banner" in client.get("/").data
    client.post("/prefs/consent", data={"consent": "all", "next": "/"})
    assert b"pg-cookie-banner" not in client.get("/").data
