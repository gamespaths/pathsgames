*** Settings ***
# ---------------------------------------------------------------------------
# missions.robot — Step 37, the mission read API.
#
# The contract under test, end-to-end and backend-agnostic:
#
#   1. GET /api/match/{uuid}/missions answers the missions this match has REACHED, each
#      carrying its status, how far down the steps it is, and every step in order.
#   2. A mission the match has never reached is ABSENT — not LOCKED, not an empty shell.
#      Listing it would spoil it.
#   3. ?status= filters within the missions already reached, whatever case it is asked in.
#   4. GET .../missions/{uuidMission} answers one mission with all its steps, and 404s for
#      one this match has not reached — the same masking the match itself gets.
#   5. The same missions ride on /info, so the board needs no second request and the two
#      payloads cannot disagree.
#   6. The bookkeeping rows the engine writes are NOT registry keys: they never appear on
#      /registry, not even with includeHidden.
#
# Nothing here is addressed by a seeded id or uuid: the missions and the events that open
# them are discovered from the story itself, so the suite runs green on java-sqlite,
# java-postgres, python and aws alike.
#
# Tags: missions, step37
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource
Resource   ../../resources/missions.resource

Suite Setup    Suite Setup Missions


*** Test Cases ***

A Fresh Match Has Reached No Mission At All
    [Documentation]    Nothing is written yet, so nothing has opened. The endpoint answers an
    ...                empty list, never the whole story's missions with a LOCKED status.
    [Tags]    missions    step37
    ${token}    ${match}=    Fresh Mission Match

    ${response}=    Get Missions    ${token}    ${match}    200

    Response Should Contain Field    ${response}    missions
    Should Be Empty    ${response.json()}[missions]
    ...    msg=a mission never reached must not be listed at all

Opening A Mission Puts It In The List With Its Steps
    [Documentation]    Executing the event that writes a mission's condition key opens it.
    ...                The payload then carries the status, the step total and every step.
    [Tags]    missions    step37
    ${token}    ${match}    ${mission}=    Match With One Mission Open

    ${missions}=    Missions Of    ${token}    ${match}
    ${found}=    Mission By Uuid    ${missions}    ${mission}[uuid]

    Dictionary Should Contain Key    ${found}    status
    Dictionary Should Contain Key    ${found}    stepsTotal
    Dictionary Should Contain Key    ${found}    steps
    Should Be True    $found['status'] in ('AVAILABLE', 'ACTIVE', 'COMPLETED')
    ...    msg=a mission just opened may not be FAILED
    Should Be Equal As Integers    ${found}[stepsTotal]    ${{ len($found['steps']) }}

Every Step Says Where It Is And Whether It Is Done
    [Documentation]    Steps come in the order the story authored them, each flagged done.
    ...                Nothing has closed a step yet, so none of them is.
    [Tags]    missions    step37
    ${token}    ${match}    ${mission}=    Match With One Mission Open

    ${missions}=    Missions Of    ${token}    ${match}
    ${found}=    Mission By Uuid    ${missions}    ${mission}[uuid]

    ${steps}=    Set Variable    ${found}[steps]
    IF    len($steps) > 0
        ${ns}=       Create Dictionary    _s=${steps}
        ${order}=    Evaluate    [s['step'] for s in _s]    namespace=${ns}
        Should Be True    $order == sorted($order)    msg=steps must come in authored order
        Should Not Be True    $steps[0]['done']    msg=nothing has closed the first step yet
        Should Be Equal    ${found}[stepReached]    ${NONE}
    END

The Status Filter Narrows The List, Whatever Case It Is Asked In
    [Documentation]    ?status= only ever selects among the missions already reached; a
    ...                status nothing holds answers an empty list, not everything.
    [Tags]    missions    step37
    ${token}    ${match}    ${mission}=    Match With One Mission Open

    ${all}=       Missions Of    ${token}    ${match}
    ${status}=    Set Variable    ${{ $all[0]['status'] }}
    ${same}=      Missions Of    ${token}    ${match}    status=${status.lower()}
    ${none}=      Missions Of    ${token}    ${match}    status=NOTASTATUS

    Should Be True    len($same) > 0    msg=the filter must accept the status the payload gave
    Should Be Empty    ${none}

Detail Answers One Mission With All Its Steps
    [Documentation]    The detail endpoint answers the same shape the list does, for one
    ...                mission, addressed by the uuid the list itself handed out.
    [Tags]    missions    step37
    ${token}    ${match}    ${mission}=    Match With One Mission Open

    ${response}=    Get Mission    ${token}    ${match}    ${mission}[uuid]    200

    Should Be Equal    ${response.json()}[uuid]    ${mission}[uuid]
    Dictionary Should Contain Key    ${response.json()}    steps
    Dictionary Should Contain Key    ${response.json()}    stepsTotal

A Mission This Match Has Not Reached Is Not Found
    [Documentation]    The story has it; this match has not opened it. That reads 404 with the
    ...                same code an unknown match gets, so nothing leaks about what exists.
    [Tags]    missions    step37
    ${token}    ${match}=    Fresh Mission Match
    ${missions}=    Story Missions
    Should Not Be Empty    ${missions}    msg=the seeded story declares no mission

    ${response}=    Get Mission    ${token}    ${match}    ${missions}[0][uuid]    404

    Should Be Equal    ${response.json()}[error]    MATCH_NOT_FOUND

An Unknown Match Reads The Same As One Somebody Else Owns
    [Documentation]    Both are 404 MATCH_NOT_FOUND, never 403: a match nobody may see must
    ...                not be distinguishable from one that does not exist.
    [Tags]    missions    step37
    ${token}    ${match}=    Fresh Mission Match
    ${other}=    New Guest Token

    ${unknown}=    Get Missions    ${token}    ${UNKNOWN_UUID}    404
    ${foreign}=    Get Missions    ${other}    ${match}    404

    Should Be Equal    ${unknown.json()}[error]    MATCH_NOT_FOUND
    Should Be Equal    ${foreign.json()}[error]    MATCH_NOT_FOUND

Missions Ride On Info Too, Exactly As The Endpoint Answers Them
    [Documentation]    The deliberate duplication Step 36 gave the registry: the board reads
    ...                the missions off /info and the two payloads cannot disagree.
    [Tags]    missions    step37
    ${token}    ${match}    ${mission}=    Match With One Mission Open

    ${endpoint}=    Missions Of    ${token}    ${match}
    ${info}=        Get Match Info    ${token}    ${match}    200

    Dictionary Should Contain Key    ${info.json()}    missions
    ${ns}=             Create Dictionary    _e=${endpoint}    _i=${info.json()}[missions]
    ${by_endpoint}=    Evaluate    sorted(m['uuid'] for m in _e)    namespace=${ns}
    ${by_info}=        Evaluate    sorted(m['uuid'] for m in _i)    namespace=${ns}
    Should Be Equal    ${by_endpoint}    ${by_info}

Mission State Is Never A Registry Key
    [Documentation]    The engine keeps its bookkeeping on gaming_state_registry, but those
    ...                rows are not part of the registry: they never reach /registry, not even
    ...                with includeHidden, and never /info's registry block.
    [Tags]    missions    step37
    ${token}    ${match}    ${mission}=    Match With One Mission Open

    ${keys}=    Registry Keys Of    ${token}    ${match}
    FOR    ${key}    IN    @{keys}
        Should Not Start With    ${key}    mission:
        ...    msg=a mission bookkeeping row leaked into the registry
    END

    ${info}=    Get Match Info    ${token}    ${match}    200
    FOR    ${entry}    IN    @{info.json()}[registry]
        Should Not Start With    ${entry}[key]    mission:
    END

An Unauthenticated Caller Is Refused Before Anything Is Looked Up
    [Documentation]    No bearer, no lookup. The auth filter answers first, so the code is the
    ...                filter's MISSING_TOKEN and not the controller's own UNAUTHENTICATED —
    ...                the point being that nothing about the match is revealed either way.
    [Tags]    missions    step37
    ${response}=    Get Missions    ${EMPTY}    ${UNKNOWN_UUID}    401
    Should Be Equal    ${response.json()}[error]    MISSING_TOKEN
