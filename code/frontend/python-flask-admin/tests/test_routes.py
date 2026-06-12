import app.api as api


# ── auth gating ──
def test_protected_redirects_to_login(client):
    for path in ("/", "/guests/", "/stories/", "/matches/", "/echo/"):
        r = client.get(path)
        assert r.status_code == 302
        assert "/login" in r.headers["Location"]


def test_login_get(client):
    r = client.get("/login")
    assert r.status_code == 200
    assert b"JWT access token" in r.data


def test_login_rejects_non_jwt(client):
    r = client.post("/login", data={"token": "not-a-jwt"})
    assert r.status_code == 200
    assert b"does not look like a valid JWT" in r.data


def test_login_sets_session_and_redirects(client):
    r = client.post("/login", data={"token": "eyJabc.def.ghi", "server": "http://x:8044"})
    assert r.status_code == 302
    with client.session_transaction() as s:
        assert s["admin_token"] == "eyJabc.def.ghi"
        assert s["admin_server"] == "http://x:8044"


# ── dashboard ──
def test_dashboard_ok(auth_client, monkeypatch):
    monkeypatch.setattr(api, "server_status", lambda: {"properties": {"version": "1.2.3"}, "timestamp": "now"})
    monkeypatch.setattr(api, "guest_stats", lambda: {"totalGuests": 9, "activeGuests": 4, "expiredGuests": 5})
    monkeypatch.setattr(api, "list_stories", lambda *a, **k: [{"uuid": "s1"}, {"uuid": "s2"}])
    r = auth_client.get("/")
    assert r.status_code == 200
    assert b"Dashboard" in r.data
    assert b"1.2.3" in r.data


# ── guests ──
def test_guests_page(auth_client, monkeypatch):
    monkeypatch.setattr(api, "list_guests", lambda: [{"uuid": "g1", "username": "bob", "expired": False}])
    monkeypatch.setattr(api, "guest_stats", lambda: {"totalGuests": 1, "activeGuests": 1, "expiredGuests": 0})
    r = auth_client.get("/guests/")
    assert r.status_code == 200
    assert b"bob" in r.data


# ── stories + editor ──
def test_stories_page(auth_client, monkeypatch):
    monkeypatch.setattr(api, "list_stories", lambda *a, **k: [{"uuid": "abcd1234", "author": "Me", "category": "adventure", "visibility": "PUBLIC"}])
    r = auth_client.get("/stories/")
    assert r.status_code == 200
    assert b"adventure" in r.data


def test_editor_metadata_tab(auth_client, monkeypatch):
    monkeypatch.setattr(api, "get_story", lambda u: {"uuid": "abcd", "author": "Me", "visibility": "PUBLIC"})
    r = auth_client.get("/stories/abcd/edit")
    assert r.status_code == 200
    assert b"Story metadata" in r.data
    assert b"Difficulties" in r.data  # tab present


def test_editor_entity_tab_lists_and_form(auth_client, monkeypatch):
    monkeypatch.setattr(api, "get_story", lambda u: {"uuid": "abcd"})
    def fake_list(u, et):
        if et == "texts":
            return [{"idText": 1, "lang": "en", "shortText": "Hero", "uuid": "t1"}]
        if et == "traits":
            return [{"uuid": "tr1", "idTextName": 1, "costPositive": 2}]
        return []
    monkeypatch.setattr(api, "list_entities", fake_list)
    r = auth_client.get("/stories/abcd/edit?tab=traits")
    assert r.status_code == 200
    assert b"Hero" in r.data          # idTextName resolved via text_map
    assert b"New traits" in r.data    # create form


def test_editor_create_entity_posts(auth_client, monkeypatch):
    seen = {}
    monkeypatch.setattr(api, "create_entity", lambda u, et, data: seen.update(u=u, et=et, data=data) or {"uuid": "new"})
    r = auth_client.post("/stories/abcd/entities/difficulties/create",
                         data={"idCard": "3", "expCost": "10"})
    assert r.status_code == 302
    assert seen["et"] == "difficulties"
    assert seen["data"]["idCard"] == 3 and seen["data"]["expCost"] == 10


def test_editor_invalid_entity_type_404(auth_client, monkeypatch):
    monkeypatch.setattr(api, "create_entity", lambda *a, **k: {})
    r = auth_client.post("/stories/abcd/entities/nonsense/create", data={})
    assert r.status_code == 404


def test_fast_card_returns_json(auth_client, monkeypatch):
    monkeypatch.setattr(api, "create_entity", lambda u, et, data: {"id": 42, "uuid": "c42"})
    r = auth_client.post("/stories/abcd/fast/card", data={"cardType": "card", "urlImage": "http://x"})
    assert r.status_code == 200
    body = r.get_json()
    assert body["ok"] is True and body["id"] == 42


# ── import ──
def test_import_get(auth_client):
    r = auth_client.get("/stories/import/")
    assert r.status_code == 200
    assert b"Import Story" in r.data


def test_import_invalid_json(auth_client):
    r = auth_client.post("/stories/import/", data={"payload": "{not json"})
    assert r.status_code == 200
    assert b"Invalid JSON" in r.data


def test_import_valid_json_calls_api(auth_client, monkeypatch):
    monkeypatch.setattr(api, "import_story", lambda doc: {"uuid": "imported"})
    r = auth_client.post("/stories/import/", data={"payload": '{"story": {"uuid": "x"}}'})
    assert r.status_code == 302
    assert "/stories/imported/edit" in r.headers["Location"]


# ── matches ──
def test_matches_page(auth_client, monkeypatch):
    monkeypatch.setattr(api, "list_matches", lambda: [{"uuid": "m1234567", "name": "Run", "status": "RUNNING", "storyUuid": "s1"}])
    monkeypatch.setattr(api, "list_match_statuses", lambda: [{"value": "RUNNING"}, {"value": "ENDED"}])
    r = auth_client.get("/matches/")
    assert r.status_code == 200
    assert b"Run" in r.data


def test_match_detail(auth_client, monkeypatch):
    monkeypatch.setattr(api, "get_match_info", lambda u: {"uuid": "m1", "name": "Run", "status": "RUNNING"})
    monkeypatch.setattr(api, "list_match_statuses", lambda: [{"value": "RUNNING"}])
    r = auth_client.get("/matches/m1")
    assert r.status_code == 200
    assert b"Match info" in r.data


def test_match_action(auth_client, monkeypatch):
    called = {}
    monkeypatch.setattr(api, "stop_match", lambda u: called.update(stop=u))
    r = auth_client.post("/matches/m1/action/stop")
    assert r.status_code == 302
    assert called["stop"] == "m1"


def test_match_invalid_action_404(auth_client):
    assert auth_client.post("/matches/m1/action/explode").status_code == 404


# ── echo ──
def test_echo_page(auth_client, monkeypatch):
    monkeypatch.setattr(api, "server_status", lambda: {"properties": {"version": "9.9"}})
    r = auth_client.get("/echo/")
    assert r.status_code == 200
    assert b"9.9" in r.data
