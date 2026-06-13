*** Settings ***
# ---------------------------------------------------------------------------
# turn_cycle.robot — Step 24 single-player turn cycle engine.
#
# Endpoints under test (player, Bearer access token from /api/auth/guest):
#   POST /api/matches/{uuidMatch}/start          → 200 | 401 | 404 | 409
#   POST /api/gameplay/{uuidMatch}/action/pass   → 200 | 401 | 404 | 409
#   GET  /api/match/{uuidMatch}/turn-sequence    → 200 | 401 | 404
#
# Backend-agnostic: runs against any backend implementing the shared contract.
#
# Tags: turn-cycle, step24
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource

Suite Setup    Suite Setup Turn Cycle


*** Test Cases ***

Start Match Transitions To Running
    [Documentation]    POST /start moves CREATED → RUNNING and builds the turn queue
    ...                with exactly one ACTIVE character.
    [Tags]    turn-cycle    step24
    ${match}=    New Match With Character
    ${response}=    Start Match    ${TOKEN}    ${match}
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Strings    ${body}[status]    RUNNING
    Should Not Be Empty    ${body}[queue]
    Should Not Be Equal    ${body}[activeCharacterUuid]    ${None}
    ${active}=    Count Status    ${body}[queue]    ACTIVE
    Should Be Equal As Integers    ${active}    1

Turn Sequence Returns Queue With Active Character
    [Documentation]    GET /turn-sequence returns the queue and the active character.
    [Tags]    turn-cycle    step24
    ${match}=    New Match With Character
    Start Match    ${TOKEN}    ${match}    200
    ${response}=    Get Turn Sequence    ${TOKEN}    ${match}
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Strings    ${body}[status]    RUNNING
    Should Not Be Empty    ${body}[queue]
    ${entry}=    Set Variable    ${body}[queue][0]
    Dictionary Should Contain Key    ${entry}    characterUuid
    Dictionary Should Contain Key    ${entry}    priority
    Dictionary Should Contain Key    ${entry}    status
    Dictionary Should Contain Key    ${entry}    passCounter

Turn Queue Is Ordered By Priority Descending
    [Documentation]    The queue is sorted by priority (highest first).
    [Tags]    turn-cycle    step24
    ${match}=    New Match With Character
    Start Match    ${TOKEN}    ${match}    200
    ${seq}=    Get Turn Sequence    ${TOKEN}    ${match}
    ${body}=    Set Variable    ${seq.json()}
    ${prev}=    Set Variable    ${None}
    FOR    ${entry}    IN    @{body}[queue]
        IF    $prev is not None
            Should Be True    ${entry}[priority] <= ${prev}
        END
        ${prev}=    Set Variable    ${entry}[priority]
    END

Start Already Running Match Returns 409
    [Documentation]    Starting a match that is already RUNNING → 409 MATCH_NOT_STARTABLE.
    [Tags]    turn-cycle    step24
    ${match}=    New Match With Character
    Start Match    ${TOKEN}    ${match}    200
    ${response}=    Start Match    ${TOKEN}    ${match}
    Status Should Be    ${response}    409
    Should Be Equal As Strings    ${response.json()}[error]    MATCH_NOT_STARTABLE

Start Without Characters Returns 409
    [Documentation]    Starting a match with no joined character → 409 NO_CHARACTERS_JOINED.
    [Tags]    turn-cycle    step24
    ${match}=    Create Match    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}    robottest_nochars
    Status Should Be    ${match}    201
    ${response}=    Start Match    ${TOKEN}    ${match.json()}[uuid]
    Status Should Be    ${response}    409
    Should Be Equal As Strings    ${response.json()}[error]    NO_CHARACTERS_JOINED

Pass Turn Advances The Cycle
    [Documentation]    POST /pass completes the active turn and activates the next character.
    [Tags]    turn-cycle    step24
    ${match}=    New Match With Character
    Start Match    ${TOKEN}    ${match}    200
    ${response}=    Pass Turn    ${TOKEN}    ${match}
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Strings    ${body}[status]    RUNNING
    Should Not Be Equal    ${body}[passedCharacterUuid]    ${None}
    Should Not Be Equal    ${body}[nextActiveCharacterUuid]    ${None}

Pass Turn Increments Pass Counter
    [Documentation]    After a pass, a queue entry records pass_counter >= 1.
    [Tags]    turn-cycle    step24
    ${match}=    New Match With Character
    Start Match    ${TOKEN}    ${match}    200
    Pass Turn    ${TOKEN}    ${match}    200
    ${seq}=    Get Turn Sequence    ${TOKEN}    ${match}
    ${body}=    Set Variable    ${seq.json()}
    ${max_pass}=    Set Variable    ${0}
    FOR    ${entry}    IN    @{body}[queue]
        ${max_pass}=    Evaluate    max(${max_pass}, ${entry}[passCounter])
    END
    Should Be True    ${max_pass} >= 1

Pass On Non Running Match Returns 409
    [Documentation]    Passing on a CREATED match → 409 MATCH_NOT_RUNNING.
    [Tags]    turn-cycle    step24
    ${match}=    New Match With Character
    ${response}=    Pass Turn    ${TOKEN}    ${match}
    Status Should Be    ${response}    409
    Should Be Equal As Strings    ${response.json()}[error]    MATCH_NOT_RUNNING

Start Unknown Match Returns 404
    [Documentation]    Starting a non-existent match → 404 MATCH_NOT_FOUND.
    [Tags]    turn-cycle    step24
    ${response}=    Start Match    ${TOKEN}    00000000-0000-0000-0000-000000000000
    Status Should Be    ${response}    404
    Should Be Equal As Strings    ${response.json()}[error]    MATCH_NOT_FOUND

Turn Sequence For Other User Returns 404
    [Documentation]    A second guest cannot read another user's turn sequence (ownership).
    [Tags]    turn-cycle    step24
    ${match}=    New Match With Character
    Start Match    ${TOKEN}    ${match}    200
    ${other}=    POST On Session    public_session    /api/auth/guest
    Status Should Be    ${other}    201
    ${response}=    Get Turn Sequence    ${other.json()}[accessToken]    ${match}
    Status Should Be    ${response}    404

Start Without Token Returns 401
    [Documentation]    POST /start without Authorization → 401.
    [Tags]    turn-cycle    step24
    ${response}=    POST On Session    public_session
    ...    /api/matches/00000000-0000-0000-0000-000000000000/start    expected_status=any
    Status Should Be    ${response}    401

Pass Without Token Returns 401
    [Documentation]    POST /pass without Authorization → 401.
    [Tags]    turn-cycle    step24
    ${response}=    POST On Session    public_session
    ...    /api/gameplay/00000000-0000-0000-0000-000000000000/action/pass    expected_status=any
    Status Should Be    ${response}    401


*** Keywords ***

Suite Setup Turn Cycle
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
    ${match}=    Create Match    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}    robottest_turn
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
