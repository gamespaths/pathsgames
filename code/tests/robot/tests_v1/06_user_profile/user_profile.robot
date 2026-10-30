*** Settings ***
# user_profile.robot — v1.7.0 V1 step 6: GET /api/auth/me statistics and preferences, PATCH /api/auth/me
# (round trip, unknown values, guest and CSRF refusals), play time growing and kept by a snapshot restore.
Resource   ../../resources/google_sso.resource
Resource   ../../resources/matches.resource

Suite Setup       User Profile Suite Setup
Force Tags        v1_step06    user-profile


*** Test Cases ***

Echo Status Lists The Profile Choices
    [Documentation]    supportedLanguages and supportedThemes (defaults en,it / default,high-contrast).
    ${resp}=    GET On Session    public_session    /api/echo/status    expected_status=200
    List Should Contain Value    ${resp.json()}[supportedLanguages]    en
    List Should Contain Value    ${resp.json()}[supportedLanguages]    it
    List Should Contain Value    ${resp.json()}[supportedThemes]    default
    List Should Contain Value    ${resp.json()}[supportedThemes]    high-contrast

A New User Has Empty Statistics And Default Preferences
    ${token}    ${csrf}=    New Google Player
    ${me}=    Call Me Endpoint    ${token}
    Should Be Equal As Integers    ${me.json()}[stats][matchesPlayed]    0
    Should Be Equal As Integers    ${me.json()}[stats][playTimeMs]    0
    Should Be Equal    ${me.json()}[preferences][theme]    default
    Should Not Be True    ${me.json()}[preferences][highContrast]

Preferences Round Trip
    [Documentation]    PATCH language + highContrast, then a partial body; GET /me reads them back.
    ${token}    ${csrf}=    New Google Player
    ${resp}=    Patch Me    ${token}    ${csrf}    language=it    highContrast=${True}
    Status Should Be    ${resp}    200
    Should Be Equal    ${resp.json()}[preferences][language]    it
    Should Be True    ${resp.json()}[preferences][highContrast]
    ${partial}=    Patch Me    ${token}    ${csrf}    highContrast=${False}
    Status Should Be    ${partial}    200
    ${me}=    Call Me Endpoint    ${token}
    Should Be Equal    ${me.json()}[preferences][language]    it
    Should Be Equal    ${me.json()}[preferences][theme]    default

Unknown Language And Theme Are Refused
    ${token}    ${csrf}=    New Google Player
    ${lang}=    Patch Me    ${token}    ${csrf}    language=xx
    Google Error Should Be    ${lang}    400    INVALID_REQUEST
    ${theme}=    Patch Me    ${token}    ${csrf}    theme=neon
    Google Error Should Be    ${theme}    400    INVALID_REQUEST
    ${me}=    Call Me Endpoint    ${token}
    Should Be Equal    ${me.json()}[preferences][theme]    default

A Guest Cannot Save Preferences
    [Documentation]    403 GOOGLE_ACCOUNT_REQUIRED: guest preferences live only in the browser.
    ${guest}=    New Guest Token
    ${me}=    Call Me Endpoint    ${guest}
    ${resp}=    Patch Me    ${guest}    ${me.json()}[csrfToken]    language=it
    Google Error Should Be    ${resp}    403    GOOGLE_ACCOUNT_REQUIRED
    Should Be Equal As Integers    ${me.json()}[stats][matchesPlayed]    0

A Missing Or Wrong CSRF Token Is Refused
    [Tags]    security
    ${token}    ${csrf}=    New Google Player
    ${missing}=    Patch Me    ${token}    ${EMPTY}    language=it
    Google Error Should Be    ${missing}    403    CSRF_TOKEN_MISSING
    ${wrong}=    Patch Me    ${token}    forged-token    language=it
    Google Error Should Be    ${wrong}    403    CSRF_TOKEN_INVALID

Statistics Count A Started Match And Play Time Grows
    [Documentation]    After start and a few moves the match is played, the clocks are counted and the
    ...                play time (capped gap between gameplay writes) grows; a refused write adds nothing.
    ${token}    ${csrf}=    New Google Player
    ${match}=    New Started Match    ${token}
    Sleep    1.2s
    Pass Turn    ${token}    ${match}    200
    ${first}=    Call Me Endpoint    ${token}
    Should Be Equal As Integers    ${first.json()}[stats][matchesPlayed]    1
    Should Be True    ${first.json()}[stats][playTimeMs] >= 1000
    Sleep    1.2s
    Sleep Action    ${token}    ${match}    200
    ${second}=    Call Me Endpoint    ${token}
    Should Be True    ${second.json()}[stats][playTimeMs] > ${first.json()}[stats][playTimeMs]
    Should Be True    ${second.json()}[stats][clocksPlayed] >= 1
    ${refused}=    Start Match    ${token}    ${match}
    Should Not Be Equal As Integers    ${refused.status_code}    200
    ${third}=    Call Me Endpoint    ${token}
    Should Be Equal As Integers    ${third.json()}[stats][playTimeMs]    ${second.json()}[stats][playTimeMs]

Play Time Is Not Rolled Back By A Snapshot Restore
    [Documentation]    The sleep writes a snapshot; more play after it; the admin restore brings the match
    ...                back (PAUSED) but the play time stays where it was.
    ${token}    ${csrf}=    New Google Player
    ${match}=    New Started Match    ${token}
    Sleep Action    ${token}    ${match}    200
    ${headers}=    Get Auth Headers    ${ADMIN_TOKEN}
    ${list}=    GET On Session    admin_session    /api/admin/matches/${match}/snapshots    headers=${headers}
    ...    expected_status=200
    Should Not Be Empty    ${list.json()}
    ${snapshot}=    Set Variable    ${list.json()}[0][uuid]
    Sleep    1.2s
    Pass Turn    ${token}    ${match}    200
    ${before}=    Call Me Endpoint    ${token}
    ${restore}=    POST On Session    admin_session    /api/admin/matches/${match}/snapshots/${snapshot}/restore
    ...    headers=${headers}    expected_status=200    timeout=${HTTP_POST_TIMEOUT}
    Should Be Equal    ${restore.json()}[matchStatus]    PAUSED
    ${after}=    Call Me Endpoint    ${token}
    Should Be Equal As Integers    ${after.json()}[stats][playTimeMs]    ${before.json()}[stats][playTimeMs]
    Should Be Equal As Integers    ${after.json()}[stats][matchesPlayed]    1


*** Keywords ***

User Profile Suite Setup
    Create Public Session
    Create Admin Session
    Create Dev Session
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}       ${story}
    Set Suite Variable    ${DIFFICULTY_UUID}  ${difficulty}
    Set Suite Variable    ${CHARACTER_UUID}   ${character}
    Set Suite Variable    ${CLASS_UUID}       ${class}
    Set Suite Variable    ${TRAIT_UUID}       ${trait}

New Google Player
    [Documentation]    A new Google user: (access token, csrf token).
    ${resp}    ${email}    ${sub}=    Login As New Google User
    RETURN    ${resp.json()}[accessToken]    ${resp.json()}[csrfToken]

Patch Me
    [Documentation]    PATCH /api/auth/me with the X-CSRF-TOKEN (none when empty) and the given fields.
    [Arguments]    ${token}    ${csrf}    &{fields}
    ${headers}=    Get Auth Headers    ${token}
    Set To Dictionary    ${headers}    Content-Type=application/json
    IF    '${csrf}' != ''    Set To Dictionary    ${headers}    X-CSRF-TOKEN=${csrf}
    ${resp}=    PATCH On Session    public_session    /api/auth/me    json=${fields}    headers=${headers}
    ...    expected_status=any    timeout=${HTTP_POST_TIMEOUT}
    RETURN    ${resp}

New Started Match
    [Documentation]    A robottest match of the player, joined with the story loadout and started.
    [Arguments]    ${token}
    ${match}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY_UUID}    name=robottest_profile
    Status Should Be    ${match}    201
    ${uuid}=    Set Variable    ${match.json()}[uuid]
    ${traits}=    Create List
    IF    '${TRAIT_UUID}' != ''    Append To List    ${traits}    ${TRAIT_UUID}
    ${join}=    Join Match    ${token}    ${uuid}    ${CHARACTER_UUID}    ${CLASS_UUID}    ${traits}
    Status Should Be    ${join}    201
    Start Match    ${token}    ${uuid}    200
    RETURN    ${uuid}
