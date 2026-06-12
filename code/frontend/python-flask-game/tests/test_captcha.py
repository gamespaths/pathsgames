from app import captcha


def _answer_from_prompt(prompt):
    a, b = prompt.split(" + ")
    return int(a) + int(b)


def test_challenge_and_correct_answer():
    session = {}
    prompt = captcha.new_challenge(session)
    assert " + " in prompt
    assert captcha.verify(session, _answer_from_prompt(prompt)) is True
    # one-shot: the answer is consumed, replay fails
    assert captcha.verify(session, _answer_from_prompt(prompt)) is False


def test_wrong_answer():
    session = {}
    captcha.new_challenge(session)
    session[captcha._QUESTION_KEY] = 5
    assert captcha.verify(session, 6) is False


def test_honeypot_blocks():
    session = {}
    prompt = captcha.new_challenge(session)
    assert captcha.verify(session, _answer_from_prompt(prompt), honeypot="i am a bot") is False


def test_human_gate_ttl():
    session = {}
    captcha.mark_human(session, ttl=1000)
    assert captcha.is_human(session) is True

    expired = {}
    captcha.mark_human(expired, ttl=-1)
    assert captcha.is_human(expired) is False

    assert captcha.is_human({}) is False
