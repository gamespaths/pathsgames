from app.i18n import make_translator, normalize_lang, translate


def test_dot_path_lookup():
    assert translate("en", "book.startGame") == "Start Game"
    assert translate("en", "footer.privacy") == "Privacy Policy"


def test_interpolation():
    out = translate("en", "book.notAllowedRequires", **{"class": "Mage"})
    assert "Mage" in out and "{class}" not in out


def test_missing_key_returns_key():
    assert translate("en", "nope.not.here") == "nope.not.here"


def test_language_switch():
    # nav.guest: "Guest" (en) vs "Ospite" (it)
    en = translate("en", "nav.guest")
    it = translate("it", "nav.guest")
    assert en == "Guest"
    assert it and isinstance(it, str)
    assert it != en


def test_normalize_lang():
    assert normalize_lang("it") == "it"
    assert normalize_lang("xx") == "en"


def test_make_translator_binds_lang():
    t = make_translator("it")
    assert t("footer.privacy") == translate("it", "footer.privacy")
