*** Settings ***
# match_concurrency.robot — v1.7.0 V1 step 8: one match on two devices of the same player (two fake Google
# logins): matchVersion at every write, If-Match, 409 STALE_MATCH with nothing written, terminal first, races.
Resource   ../../resources/google_sso.resource
Resource   ../../resources/matches.resource
Resource   concurrency_common.resource
Library    ../../resources/ParallelWriteHelper.py

Suite Setup       Match Concurrency Suite Setup
Force Tags        v1_step08    match-concurrency


*** Test Cases ***

Echo Status Lists The Refetch Parameters
    [Documentation]    matchRefetchBrowsers (webkit or all, default webkit) and matchRefetchMinHiddenSeconds (default 30).
    ${resp}=    GET On Session    public_session    /api/echo/status    expected_status=200
    ${browsers}=    Set Variable    ${resp.json()}[matchRefetchBrowsers]
    Should Not Be Empty    ${browsers}
    FOR    ${browser}    IN    @{browsers}
        Should Contain Any    ${browser}    webkit    all
    END
    Should Be True    ${resp.json()}[matchRefetchMinHiddenSeconds] >= 0

The Match Version Changes At Every Write
    [Documentation]    Create, info, join, start and pass: every answer carries matchVersion, each write a new one.
    ${token_a}    ${token_b}=    Two Devices Of One Player
    ${created}=    Create Match    ${token_a}    ${STORY_UUID}    ${DIFFICULTY_UUID}    name=robottest_concurrency
    Status Should Be    ${created}    201
    ${match}=    Set Variable    ${created.json()}[uuid]
    ${v0}=    Set Variable    ${created.json()}[matchVersion]
    Should Not Be Empty    ${v0}
    ${info}=    Get Match Info    ${token_b}    ${match}    expected_status=200
    Should Be Equal    ${info.json()}[matchVersion]    ${v0}
    Should Be Equal    ${info.json()}[match][matchVersion]    ${v0}
    ${join}=    Versioned Join    ${token_a}    ${match}    ${v0}
    Status Should Be    ${join}    201
    ${v1}=    Set Variable    ${join.json()}[matchVersion]
    Should Not Be Equal    ${v1}    ${v0}
    ${start}=    Versioned Write    ${token_a}    /api/matches/${match}/start    ${v1}
    Status Should Be    ${start}    200
    ${v2}=    Set Variable    ${start.json()}[matchVersion]
    Should Not Be Equal    ${v2}    ${v1}
    ${pass}=    Versioned Write    ${token_b}    /api/gameplay/${match}/action/pass    ${v2}
    Status Should Be    ${pass}    200
    Should Not Be Equal    ${pass.json()}[matchVersion]    ${v2}
    ${after}=    Get Match Info    ${token_a}    ${match}    expected_status=200
    Should Be Equal    ${after.json()}[matchVersion]    ${pass.json()}[matchVersion]

An Old Version Is Stale And Nothing Is Written
    [Documentation]    Device A moves with the version both devices read; device B, still on it, gets 409 STALE_MATCH
    ...                with the current version, the match is untouched; after a refetch device B plays on.
    ${token_a}    ${token_b}=    Two Devices Of One Player
    ${match}    ${seen}=    Started Match Of    ${token_a}
    ${moved}=    Versioned Write    ${token_a}    /api/gameplay/${match}/action/pass    ${seen}
    Status Should Be    ${moved}    200
    ${current}=    Set Variable    ${moved.json()}[matchVersion]
    ${before}=    Pass Counters    ${token_b}    ${match}
    ${stale}=    Versioned Write    ${token_b}    /api/gameplay/${match}/action/pass    ${seen}
    Status Should Be    ${stale}    409
    Should Be Equal    ${stale.json()}[error]    STALE_MATCH
    Should Be Equal    ${stale.json()}[matchVersion]    ${current}
    ${after}=    Pass Counters    ${token_b}    ${match}
    Should Be Equal    ${after}    ${before}
    ${info}=    Get Match Info    ${token_b}    ${match}    expected_status=200
    Should Be Equal    ${info.json()}[matchVersion]    ${current}
    ${retry}=    Versioned Write    ${token_b}    /api/gameplay/${match}/action/pass    ${info.json()}[matchVersion]
    Status Should Be    ${retry}    200

A Write Without The Header Still Works
    [Documentation]    Old clients send no If-Match: the server compares against the version it read itself.
    ${token_a}    ${token_b}=    Two Devices Of One Player
    ${match}    ${seen}=    Started Match Of    ${token_a}
    ${pass}=    Pass Turn    ${token_b}    ${match}
    Status Should Be    ${pass}    200
    Should Not Be Equal    ${pass.json()}[matchVersion]    ${seen}
    ${sleep}=    Sleep Action    ${token_a}    ${match}
    Status Should Be    ${sleep}    200

The Terminal State Wins Over Stale
    [Documentation]    A stopped match answers MATCH_NOT_RUNNING even to an out-of-date If-Match.
    ${token_a}    ${token_b}=    Two Devices Of One Player
    ${match}    ${seen}=    Started Match Of    ${token_a}
    Admin Stop Match    ${ADMIN_TOKEN}    ${match}    expected_status=200
    ${resp}=    Versioned Write    ${token_b}    /api/gameplay/${match}/action/pass    ${seen}
    Status Should Be    ${resp}    409
    Should Be Equal    ${resp.json()}[error]    MATCH_NOT_RUNNING

Two Parallel Writes With The Same Version Exactly One Succeeds
    [Documentation]    Both devices pass at the same instant with the same If-Match: one 200, one 409 STALE_MATCH.
    ${token_a}    ${token_b}=    Two Devices Of One Player
    ${match}    ${seen}=    Started Match Of    ${token_a}
    ${headers_a}=    If Match Headers    ${token_a}    ${seen}
    ${headers_b}=    If Match Headers    ${token_b}    ${seen}
    ${list}=    Create List    ${headers_a}    ${headers_b}
    ${results}=    Parallel Posts    ${BASE_URL}/api/gameplay/${match}/action/pass    ${list}
    ...    timeout=${HTTP_POST_TIMEOUT}
    ${statuses}=    Evaluate    sorted(r['status'] for r in $results)
    ${expected}=    Create List    ${200}    ${409}
    Should Be Equal    ${statuses}    ${expected}
    ${loser}=    Evaluate    next(r for r in $results if r['status'] == 409)
    Should Be Equal    ${loser}[body][error]    STALE_MATCH


*** Keywords ***

Match Concurrency Suite Setup
    Create Public Session
    Create Admin Session
    Create Dev Session
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}       ${story}
    Set Suite Variable    ${DIFFICULTY_UUID}  ${difficulty}
    Set Suite Variable    ${CHARACTER_UUID}   ${character}
    Set Suite Variable    ${CLASS_UUID}       ${class}
    Set Suite Variable    ${TRAIT_UUID}       ${trait}

Versioned Join
    [Documentation]    POST /join with the story loadout and If-Match.
    [Arguments]    ${token}    ${match}    ${version}
    ${headers}=    If Match Headers    ${token}    ${version}
    ${traits}=    Create List
    IF    '${TRAIT_UUID}' != ''    Append To List    ${traits}    ${TRAIT_UUID}
    &{body}=    Create Dictionary    characterTemplateUuid=${CHARACTER_UUID}    traitUuids=${traits}
    IF    '${CLASS_UUID}' != ''    Set To Dictionary    ${body}    classUuid=${CLASS_UUID}
    ${resp}=    POST On Session    public_session    /api/matches/${match}/join    json=${body}
    ...    headers=${headers}    expected_status=any    timeout=${HTTP_POST_TIMEOUT}
    RETURN    ${resp}

Started Match Of
    [Documentation]    A robottest match of the player, joined and started: (uuid, its current matchVersion).
    [Arguments]    ${token}
    ${created}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY_UUID}    name=robottest_concurrency
    Status Should Be    ${created}    201
    ${match}=    Set Variable    ${created.json()}[uuid]
    ${join}=    Versioned Join    ${token}    ${match}    ${created.json()}[matchVersion]
    Status Should Be    ${join}    201
    ${start}=    Versioned Write    ${token}    /api/matches/${match}/start    ${join.json()}[matchVersion]
    Status Should Be    ${start}    200
    RETURN    ${match}    ${start.json()}[matchVersion]

Pass Counters
    [Documentation]    The pass counters of the turn queue, to prove a refused write changed nothing.
    [Arguments]    ${token}    ${match}
    ${seq}=    Get Turn Sequence    ${token}    ${match}    expected_status=200
    ${counters}=    Evaluate    [e.get('passCounter') for e in $seq.json()['queue']]
    RETURN    ${counters}
