*** Settings ***
# ---------------------------------------------------------------------------
# time_clock.robot — Step 25 time advancement & clock cycle.
#
# Endpoints under test (player, Bearer access token from /api/auth/guest):
#   POST /api/gameplay/{uuidMatch}/action/sleep  → 200 | 401 | 404 | 409
#   GET  /api/match/{uuidMatch}/clock            → 200 | 401 | 404
#
# Single-player: the active-character list is size 1, so a voluntary sleep makes
# "all characters done" and advances the clock by one time unit, logging the
# advance and rebuilding the turn queue for the new clock.
#
# Backend-agnostic: runs against any backend implementing the shared contract.
#
# Tags: time-clock, step25
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource

Suite Setup    Suite Setup Time Clock


*** Test Cases ***

Clock Endpoint Returns Current State
    [Documentation]    GET /clock returns the current clock, labels and per-character state.
    [Tags]    time-clock    step25
    ${match}=    New Match With Character
    Start Match    ${TOKEN}    ${match}    200
    ${response}=    Get Clock    ${TOKEN}    ${match}
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    currentClock
    Dictionary Should Contain Key    ${body}    clockLabelSingular
    Dictionary Should Contain Key    ${body}    clockLabelPlural
    Dictionary Should Contain Key    ${body}    anyCharacterSleeping
    Should Not Be Empty    ${body}[characters]
    ${entry}=    Set Variable    ${body}[characters][0]
    Dictionary Should Contain Key    ${entry}    characterUuid
    Dictionary Should Contain Key    ${entry}    isSleeping
    Dictionary Should Contain Key    ${entry}    energy

Sleep Triggers Time End And Advances Clock
    [Documentation]    In single-player a sleep makes every character "done", so the clock
    ...                advances by one and timeEndTriggered is true.
    [Tags]    time-clock    step25
    ${match}=    New Match With Character
    ${start}=    Start Match    ${TOKEN}    ${match}
    ${clock_before}=    Set Variable    ${start.json()}[currentClock]
    ${response}=    Sleep Action    ${TOKEN}    ${match}
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Strings    ${body}[timeEndTriggered]    ${True}
    ${expected}=    Evaluate    ${clock_before} + 1
    Should Be Equal As Integers    ${body}[currentClock]    ${expected}

Clock Increments After Sleep
    [Documentation]    GET /clock reflects the advanced clock after a time-end.
    [Tags]    time-clock    step25
    ${match}=    New Match With Character
    Start Match    ${TOKEN}    ${match}    200
    ${before}=    Get Clock    ${TOKEN}    ${match}
    ${clock_before}=    Set Variable    ${before.json()}[currentClock]
    Sleep Action    ${TOKEN}    ${match}    200
    ${after}=    Get Clock    ${TOKEN}    ${match}
    ${expected}=    Evaluate    ${clock_before} + 1
    Should Be Equal As Integers    ${after.json()}[currentClock]    ${expected}

Time End Rebuilds Queue As Fresh Round
    [Documentation]    After a time-end the queue is rebuilt for the new clock: exactly one
    ...                ACTIVE entry and the active character is set.
    [Tags]    time-clock    step25
    ${match}=    New Match With Character
    Start Match    ${TOKEN}    ${match}    200
    Sleep Action    ${TOKEN}    ${match}    200
    ${seq}=    Get Turn Sequence    ${TOKEN}    ${match}
    Status Should Be    ${seq}    200
    ${body}=    Set Variable    ${seq.json()}
    Should Be Equal As Strings    ${body}[status]    RUNNING
    Should Not Be Equal    ${body}[activeCharacterUuid]    ${None}
    ${active}=    Count Status    ${body}[queue]    ACTIVE
    Should Be Equal As Integers    ${active}    1

Characters Wake After Time End
    [Documentation]    Sleeping characters are woken at the new time start: anyCharacterSleeping
    ...                is false again after the time-end.
    [Tags]    time-clock    step25
    ${match}=    New Match With Character
    Start Match    ${TOKEN}    ${match}    200
    Sleep Action    ${TOKEN}    ${match}    200
    ${clock}=    Get Clock    ${TOKEN}    ${match}
    Should Be Equal As Strings    ${clock.json()}[anyCharacterSleeping]    ${False}

Sleep On Non Running Match Returns 409
    [Documentation]    Sleeping on a CREATED (not started) match → 409 MATCH_NOT_RUNNING.
    [Tags]    time-clock    step25
    ${match}=    New Match With Character
    ${response}=    Sleep Action    ${TOKEN}    ${match}
    Status Should Be    ${response}    409
    Should Be Equal As Strings    ${response.json()}[error]    MATCH_NOT_RUNNING

Sleep Unknown Match Returns 404
    [Documentation]    Sleeping on a non-existent match → 404 MATCH_NOT_FOUND.
    [Tags]    time-clock    step25
    ${response}=    Sleep Action    ${TOKEN}    00000000-0000-0000-0000-000000000000
    Status Should Be    ${response}    404
    Should Be Equal As Strings    ${response.json()}[error]    MATCH_NOT_FOUND

Sleep By Non Participant Returns 404
    [Documentation]    A user with no character in the match cannot sleep → 404 MATCH_NOT_FOUND.
    [Tags]    time-clock    step25
    ${match}=    New Match With Character
    Start Match    ${TOKEN}    ${match}    200
    ${other}=    POST On Session    public_session    /api/auth/guest
    Status Should Be    ${other}    201
    ${response}=    Sleep Action    ${other.json()}[accessToken]    ${match}
    Status Should Be    ${response}    404
    Should Be Equal As Strings    ${response.json()}[error]    MATCH_NOT_FOUND

Clock For Other User Returns 404
    [Documentation]    A second guest cannot read another user's clock (ownership).
    [Tags]    time-clock    step25
    ${match}=    New Match With Character
    Start Match    ${TOKEN}    ${match}    200
    ${other}=    POST On Session    public_session    /api/auth/guest
    Status Should Be    ${other}    201
    ${response}=    Get Clock    ${other.json()}[accessToken]    ${match}
    Status Should Be    ${response}    404

Sleep Without Token Returns 401
    [Documentation]    POST /action/sleep without Authorization → 401.
    [Tags]    time-clock    step25
    ${response}=    POST On Session    public_session
    ...    /api/gameplay/00000000-0000-0000-0000-000000000000/action/sleep    expected_status=any
    Status Should Be    ${response}    401

Clock Without Token Returns 401
    [Documentation]    GET /clock without Authorization → 401.
    [Tags]    time-clock    step25
    ${response}=    GET On Session    public_session
    ...    /api/match/00000000-0000-0000-0000-000000000000/clock    expected_status=any
    Status Should Be    ${response}    401


*** Keywords ***

Suite Setup Time Clock
    [Documentation]    Guest login + resolve a joinable loadout from a public story.
    Create Public Session
    ${response}=    POST On Session    public_session    /api/auth/guest
    Status Should Be    ${response}    201
    Set Suite Variable    ${TOKEN}    ${response.json()}[accessToken]
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}        ${story}
    Set Suite Variable    ${DIFFICULTY_UUID}   ${difficulty}
    Set Suite Variable    ${CHARACTER_UUID}    ${character}
    Set Suite Variable    ${CLASS_UUID}        ${class}
    Set Suite Variable    ${TRAIT_UUID}        ${trait}

New Match With Character
    [Documentation]    Creates a CREATED match and joins one character; returns the match uuid.
    ${match}=    Create Match    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}    robottest_clock
    Status Should Be    ${match}    201
    ${match_uuid}=    Set Variable    ${match.json()}[uuid]
    ${trait_list}=    Create List
    IF    '${TRAIT_UUID}' != ''
        Append To List    ${trait_list}    ${TRAIT_UUID}
    END
    ${join}=    Join Match    ${TOKEN}    ${match_uuid}    ${CHARACTER_UUID}    ${CLASS_UUID}    ${trait_list}
    Status Should Be    ${join}    201
    RETURN    ${match_uuid}

Count Status
    [Documentation]    Counts queue entries with the given status.
    [Arguments]    ${queue}    ${status}
    ${count}=    Set Variable    ${0}
    FOR    ${entry}    IN    @{queue}
        IF    '${entry}[status]' == '${status}'
            ${count}=    Evaluate    ${count} + 1
        END
    END
    RETURN    ${count}
