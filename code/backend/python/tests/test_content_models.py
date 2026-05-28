import pytest
from app.core.models.story.creator_info import CreatorInfo
from app.core.models.story.text_info import TextInfo


# ── CreatorInfo ──────────────────────────────────────────────────────────────

def test_creator_info_defaults():
    c = CreatorInfo(uuid="cr1")
    assert c.uuid == "cr1"
    assert c.name is None
    assert c.link is None
    assert c.url is None
    assert c.urlImage is None
    assert c.urlEmote is None
    assert c.urlInstagram is None

def test_creator_info_full():
    c = CreatorInfo(uuid="cr1", name="John", link="http://john.com",
                    url="http://john.com/p", urlImage="http://john.com/img",
                    urlEmote="http://john.com/emote", urlInstagram="http://ig.com/john")
    assert c.uuid == "cr1"
    assert c.name == "John"
    assert c.link == "http://john.com"
    assert c.url == "http://john.com/p"
    assert c.urlImage == "http://john.com/img"
    assert c.urlEmote == "http://john.com/emote"
    assert c.urlInstagram == "http://ig.com/john"


# ── TextInfo ─────────────────────────────────────────────────────────────────

def test_text_info_defaults():
    t = TextInfo(idText=1, lang="en", resolvedLang="en")
    assert t.idText == 1
    assert t.lang == "en"
    assert t.resolvedLang == "en"
    assert t.shortText is None
    assert t.longText is None
    assert t.copyrightText is None
    assert t.linkCopyright is None
    assert t.creator is None

def test_text_info_full():
    c = CreatorInfo(uuid="cr1", name="Author")
    t = TextInfo(idText=1, lang="it", resolvedLang="en", shortText="Hello",
                 longText="Hello World", copyrightText="(c) 2025",
                 linkCopyright="https://lic.example.com", creator=c)
    assert t.idText == 1
    assert t.lang == "it"
    assert t.resolvedLang == "en"
    assert t.shortText == "Hello"
    assert t.longText == "Hello World"
    assert t.copyrightText == "(c) 2025"
    assert t.linkCopyright == "https://lic.example.com"
    assert t.creator is not None
    assert t.creator.uuid == "cr1"
    assert t.creator.name == "Author"
