*** Settings ***
# ---------------------------------------------------------------------------
# security.robot — v0.37.7, Step 41: the CSRF token and the per-IP rate limits.
#
# CSRF. Every login-shaped response (guest, resume, refresh) and GET /api/auth/me carry a
# `csrfToken` bound to the access token; POST /api/matches refuses a creation that does not
# echo it back as X-CSRF-TOKEN (403 CSRF_TOKEN_MISSING / CSRF_TOKEN_INVALID). The token is
# stateless — HMAC of the bearer under a server secret — so the same guest gets the same token
# on every endpoint and a different guest gets a different one. `${CSRF_ENFORCED}` (default
# true) says whether the server under test enforces the header; with it false the two refusal
# cases skip themselves and the issuing cases still run.
#
# RATE LIMITS. POST /api/auth/guest and POST /api/matches count attempts per source IP in a
# fixed window and answer 429 RATE_LIMITED with a Retry-After header past the limit. Every
# Robot run mints hundreds of guests from ONE address, so the limits are 0 (disabled)
# wherever the suites run and the two cases below SKIP unless `${RATE_LIMIT_GUEST_PER_IP}` /
# `${RATE_LIMIT_MATCH_PER_IP}` name the limit the server was started with. Run them ALONE
# (--variable RATE_LIMIT_GUEST_PER_IP:10 --variable RATE_LIMIT_MATCH_PER_IP:10): once
# tripped, the window stays shut for every suite after them.
#
# Tags: security, step41, csrf, rate-limit
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource

Suite Setup    Suite Setup Security


*** Variables ***
${CSRF_ENFORCED}              ${True}
${RATE_LIMIT_GUEST_PER_IP}    0
${RATE_LIMIT_MATCH_PER_IP}    0


*** Test Cases ***

Guest Login Issues A CSRF Token Bound To The Bearer
    [Documentation]    Two guests, two tokens: the token is a function of the bearer, and a
    ...                second login of the same kind never repeats it.
    [Tags]    security    step41    csrf
    ${first}=     Guest Login Body
    ${second}=    Guest Login Body
    Should Not Be Empty    ${first}[csrfToken]     msg=guest login answered no csrfToken
    Should Not Be Empty    ${second}[csrfToken]
    Should Not Be Equal    ${first}[csrfToken]    ${second}[csrfToken]
    ...    msg=two different bearers were issued the same CSRF token

Auth Me Answers The Same CSRF Token The Login Did
    [Documentation]    A client that lost the token can ask for it again with the bearer alone.
    [Tags]    security    step41    csrf
    ${login}=    Guest Login Body
    ${headers}=    Get Auth Headers    ${login}[accessToken]
    ${me}=    GET On Session    public_session    /api/auth/me    headers=${headers}
    Status Should Be    ${me}    200
    Should Be Equal    ${me.json()}[csrfToken]    ${login}[csrfToken]

Resuming The Guest Session Issues A Token For The New Bearer
    [Documentation]    Resume mints a fresh access token; its csrfToken must follow it.
    [Tags]    security    step41    csrf
    ${login}=    Guest Login Body
    ${resume}=    POST On Session    public_session    /api/auth/guest/resume    expected_status=any
    IF    ${resume.status_code} != 200    Skip    resume is not cookie-driven on this client
    Should Not Be Empty    ${resume.json()}[csrfToken]
    ${same_bearer}=    Evaluate    $resume.json()['accessToken'] == $login['accessToken']
    IF    ${same_bearer}
        Should Be Equal    ${resume.json()}[csrfToken]    ${login}[csrfToken]
    ELSE
        Should Not Be Equal    ${resume.json()}[csrfToken]    ${login}[csrfToken]
    END

Creating A Match Without The Header Is Refused
    [Documentation]    403 CSRF_TOKEN_MISSING, and nothing is created.
    [Tags]    security    step41    csrf
    Skip If    not ${CSRF_ENFORCED}    the server under test does not enforce X-CSRF-TOKEN
    ${token}=    New Guest Token
    ${headers}=    Get Auth Headers    ${token}
    Set To Dictionary    ${headers}    Content-Type=application/json
    ${resp}=    POST On Session    public_session    /api/matches    headers=${headers}
    ...    json=${{ {'storyUuid': $STORY_UUID, 'difficultyUuid': $DIFFICULTY_UUID, 'name': 'robottest_csrf'} }}
    ...    expected_status=any
    Status Should Be    ${resp}    403
    Should Be Equal    ${resp.json()}[error]    CSRF_TOKEN_MISSING
    ${mine}=    List Matches    ${token}    200
    Should Be Empty    ${mine.json()}    msg=a refused creation still created a match

Creating A Match With Another Guest's Token Is Refused
    [Documentation]    The token is bound to the bearer: a valid token of ANOTHER guest is
    ...                403 CSRF_TOKEN_INVALID, and so is a garbled one.
    [Tags]    security    step41    csrf
    Skip If    not ${CSRF_ENFORCED}    the server under test does not enforce X-CSRF-TOKEN
    ${victim}=    New Guest Token
    ${other}=     Guest Login Body
    FOR    ${bad}    IN    ${other}[csrfToken]    not-a-token
        ${headers}=    Get Auth Headers    ${victim}
        Set To Dictionary    ${headers}    Content-Type=application/json    X-CSRF-TOKEN=${bad}
        ${resp}=    POST On Session    public_session    /api/matches    headers=${headers}
        ...    json=${{ {'storyUuid': $STORY_UUID, 'difficultyUuid': $DIFFICULTY_UUID, 'name': 'robottest_csrf'} }}
        ...    expected_status=any
        Status Should Be    ${resp}    403
        Should Be Equal    ${resp.json()}[error]    CSRF_TOKEN_INVALID
    END

Creating A Match With The Issued Token Succeeds
    [Documentation]    The shared keyword echoes the remembered token; the plain path works.
    [Tags]    security    step41    csrf
    ${token}=    New Guest Token
    ${resp}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY_UUID}    robottest_csrf_ok
    Status Should Be    ${resp}    201
    [Teardown]    Run Keyword And Ignore Error    Admin Delete Match    ${ADMIN_TOKEN}    ${resp.json()}[uuid]

Match Creation Is Rate Limited Per Source Address
    [Documentation]    Same contract on POST /api/matches. ONE guest for every attempt — the
    ...                match it created is stopped and deleted before the next one, so the
    ...                one-active-match guard never gets in the way and the guest window is
    ...                not spent by this case; it runs before the guest case for that reason.
    [Tags]    security    step41    rate-limit
    Skip If    ${RATE_LIMIT_MATCH_PER_IP} <= 0    RATE_LIMIT_MATCH_PER_IP is not set for this run
    ${token}=    New Guest Token
    ${refused}=    Set Variable    ${None}
    FOR    ${i}    IN RANGE    ${{ int($RATE_LIMIT_MATCH_PER_IP) + 1 }}
        ${resp}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY_UUID}    robottest_ratelimit
        IF    ${resp.status_code} == 429
            ${refused}=    Set Variable    ${resp}
            BREAK
        END
        Status Should Be    ${resp}    201
        Admin Stop Match      ${ADMIN_TOKEN}    ${resp.json()}[uuid]
        Admin Delete Match    ${ADMIN_TOKEN}    ${resp.json()}[uuid]
    END
    Should Not Be Equal    ${refused}    ${None}
    ...    msg=${RATE_LIMIT_MATCH_PER_IP}+1 match creations from one address were all accepted
    Should Be Equal    ${refused.json()}[error]    RATE_LIMITED
    Should Be True    int('${refused.headers}[Retry-After]') >= 1

Guest Creation Is Rate Limited Per Source Address
    [Documentation]    Within limit+1 attempts the server must answer 429 RATE_LIMITED with a
    ...                Retry-After header; the earlier attempts of this very run may already
    ...                have spent part of the window, so only the ceiling is asserted.
    [Tags]    security    step41    rate-limit
    Skip If    ${RATE_LIMIT_GUEST_PER_IP} <= 0    RATE_LIMIT_GUEST_PER_IP is not set for this run
    ${refused}=    Set Variable    ${None}
    FOR    ${i}    IN RANGE    ${{ int($RATE_LIMIT_GUEST_PER_IP) + 1 }}
        ${resp}=    POST On Session    public_session    /api/auth/guest    expected_status=any
        IF    ${resp.status_code} == 429
            ${refused}=    Set Variable    ${resp}
            BREAK
        END
        Status Should Be    ${resp}    201
    END
    Should Not Be Equal    ${refused}    ${None}
    ...    msg=${RATE_LIMIT_GUEST_PER_IP}+1 guest logins from one address were all accepted
    Should Be Equal    ${refused.json()}[error]    RATE_LIMITED
    Should Be True    int(${refused.json()}[retryAfterSeconds]) >= 1
    Should Be True    int('${refused.headers}[Retry-After]') >= 1


*** Keywords ***

Suite Setup Security
    Create Public Session
    Create Admin Session
    ${story}    ${difficulty}=    Pick First Public Story With Difficulty
    Set Suite Variable    ${STORY_UUID}    ${story}
    Set Suite Variable    ${DIFFICULTY_UUID}    ${difficulty}

Guest Login Body
    [Documentation]    A fresh guest's whole login body, remembered for the creation keyword.
    ${resp}=    POST On Session    public_session    /api/auth/guest
    Status Should Be    ${resp}    201
    Remember Csrf Token    ${resp.json()}[accessToken]    ${resp.json().get('csrfToken', '')}
    RETURN    ${resp.json()}
