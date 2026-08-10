*** Settings ***
# ---------------------------------------------------------------------------
# match_logs.robot — Step 28.7 match logs API.
#
# Endpoints under test:
#   GET /api/matches/{uuidMatch}/logs    → 200 | 401 | 404
#   GET /api/admin/matches/{uuid}/logs   → 200 | 400 (admin port)
#
# The suite creates a match, starts it (→ WEATHER entry), performs a movement
# (→ MOVEMENT entry), sleeps (→ SLEEP + possibly CLOCK_ADVANCE entries), and
# verifies the consolidated log structure and contract.
#
# Backend-agnostic: only asserts structure and entry-type presence,
# not exact counts, so it runs against Java / Python / AWS interchangeably.
#
# Tags: match-logs, step28-7
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource

Suite Setup    Suite Setup Logs


*** Test Cases ***

Logs Endpoint Returns 200 With Empty List On Created Match
    [Documentation]    A CREATED (not yet started) match returns 200 with an
    ...                empty logs list — no weather, movements, or sleep events yet.
    ...                The pagination envelope is present even when the timeline is empty.
    [Tags]    match-logs    step28-7
    ${match}=    New Logs Match
    ${response}=    Get Match Logs    ${TOKEN}    ${match}    200
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    matchUuid
    Dictionary Should Contain Key    ${body}    currentClock
    Dictionary Should Contain Key    ${body}    logs
    Dictionary Should Contain Key    ${body}    nextCursor
    Dictionary Should Contain Key    ${body}    limit
    Dictionary Should Contain Key    ${body}    total
    Should Be Equal As Strings    ${body}[matchUuid]    ${match}
    Should Be Equal As Integers    ${body}[total]    0
    Should Be Equal    ${body}[nextCursor]    ${None}

Logs Contains Weather Entry After Start
    [Documentation]    Starting the match triggers weather selection → the log
    ...                must contain at least one WEATHER entry.
    [Tags]    match-logs    step28-7
    ${match}=    New Logs Match
    Start Match    ${TOKEN}    ${match}    200
    ${response}=    Get Match Logs    ${TOKEN}    ${match}    200
    ${weather_count}=    Count Log Entries By Type    ${response.json()}[logs]    WEATHER
    Should Be True    ${weather_count} >= 1

Weather Entry Has Required Fields
    [Documentation]    WEATHER entries must carry type, clock, timestamp and idWeather.
    [Tags]    match-logs    step28-7
    ${match}=    New Logs Match
    Start Match    ${TOKEN}    ${match}    200
    ${response}=    Get Match Logs    ${TOKEN}    ${match}    200
    ${entry}=    First Log Entry By Type    ${response.json()}[logs]    WEATHER
    Dictionary Should Contain Key    ${entry}    type
    Dictionary Should Contain Key    ${entry}    clock
    Dictionary Should Contain Key    ${entry}    timestamp
    Dictionary Should Contain Key    ${entry}    idWeather
    Should Not Be Equal    ${entry}[idWeather]    ${None}

Logs Contains Movement Entry After Move
    [Documentation]    After a successful movement the log contains a MOVEMENT entry
    ...                with idLocationFrom, idLocationTo and energyCost.
    [Tags]    match-logs    step28-7
    ${match}=    New Logs Match
    Start Match    ${TOKEN}    ${match}    200
    ${target}=    First Neighbor Uuid    ${match}
    Start Movement    ${TOKEN}    ${match}    ${target}    200
    ${response}=    Get Match Logs    ${TOKEN}    ${match}    200
    ${movement_count}=    Count Log Entries By Type    ${response.json()}[logs]    MOVEMENT
    Should Be True    ${movement_count} >= 1
    ${entry}=    First Log Entry By Type    ${response.json()}[logs]    MOVEMENT
    Dictionary Should Contain Key    ${entry}    idLocationTo
    Dictionary Should Contain Key    ${entry}    energyCost
    Should Not Be Equal    ${entry}[idLocationTo]    ${None}

Logs Contains Sleep Entry After Sleep Action
    [Documentation]    After POST /api/gameplay/{uuid}/action/sleep the log
    ...                must contain a SLEEP entry.
    [Tags]    match-logs    step28-7
    ${match}=    New Logs Match
    Start Match    ${TOKEN}    ${match}    200
    Sleep Action    ${TOKEN}    ${match}    200
    ${response}=    Get Match Logs    ${TOKEN}    ${match}    200
    ${sleep_count}=    Count Log Entries By Type    ${response.json()}[logs]    SLEEP
    Should Be True    ${sleep_count} >= 1

Logs Contains Clock Advance After Time End
    [Documentation]    When a sleep triggers time-end the log contains a
    ...                CLOCK_ADVANCE entry. Skipped gracefully if sleep did not
    ...                trigger time-end in this run.
    [Tags]    match-logs    step28-7
    ${match}=    New Logs Match
    Start Match    ${TOKEN}    ${match}    200
    ${sleep_resp}=    Sleep Action    ${TOKEN}    ${match}    200
    ${triggered}=    Set Variable    ${sleep_resp.json()}[timeEndTriggered]
    IF    ${triggered}
        ${response}=    Get Match Logs    ${TOKEN}    ${match}    200
        ${clock_count}=    Count Log Entries By Type    ${response.json()}[logs]    CLOCK_ADVANCE
        Should Be True    ${clock_count} >= 1
    ELSE
        Log    Sleep did not trigger time-end — CLOCK_ADVANCE check skipped    WARN
    END

Log Entries Have Required Fields
    [Documentation]    Every entry in the logs list carries at minimum a 'type'
    ...                and a 'timestamp' key.
    [Tags]    match-logs    step28-7
    ${match}=    New Logs Match
    Start Match    ${TOKEN}    ${match}    200
    ${response}=    Get Match Logs    ${TOKEN}    ${match}    200
    FOR    ${entry}    IN    @{response.json()}[logs]
        Dictionary Should Contain Key    ${entry}    type
        Dictionary Should Contain Key    ${entry}    timestamp
    END

Weather Entry Carries Its Card And Title
    [Documentation]    v0.28.7 — a WEATHER entry exposes idCard and the resolved card
    ...                (with its title) of the weather itself.
    [Tags]    match-logs    step28-7
    ${match}=    New Logs Match
    Start Match    ${TOKEN}    ${match}    200
    ${response}=    Get Match Logs    ${TOKEN}    ${match}    200
    ${entry}=    First Log Entry By Type    ${response.json()}[logs]    WEATHER
    Dictionary Should Contain Key    ${entry}    idCard
    Dictionary Should Contain Key    ${entry}    card
    Should Not Be Equal    ${entry}[card]    ${None}
    Dictionary Should Contain Key    ${entry}[card]    title
    Should Not Be Empty    ${entry}[card][title]

Movement Entry Carries Destination Card And Character
    [Documentation]    v0.28.7 — a MOVEMENT entry exposes the destination location's
    ...                card (with title) and names the character that moved.
    [Tags]    match-logs    step28-7
    ${match}=    New Logs Match
    Start Match    ${TOKEN}    ${match}    200
    ${target}=    First Neighbor Uuid    ${match}
    Start Movement    ${TOKEN}    ${match}    ${target}    200
    ${response}=    Get Match Logs    ${TOKEN}    ${match}    200
    ${entry}=    First Log Entry By Type    ${response.json()}[logs]    MOVEMENT
    Dictionary Should Contain Key    ${entry}    idCard
    Dictionary Should Contain Key    ${entry}    card
    Should Not Be Equal    ${entry}[card]    ${None}
    Should Not Be Empty    ${entry}[card][title]
    Dictionary Should Contain Key    ${entry}    characterUuid
    Dictionary Should Contain Key    ${entry}    characterName
    Should Not Be Equal    ${entry}[characterUuid]    ${None}

Logs Respect The Requested Page Limit
    [Documentation]    v0.28.7 — ?limit=1 returns at most one entry and, when more
    ...                exist, a nextCursor to fetch the following page.
    [Tags]    match-logs    step28-7
    ${match}=    New Logs Match
    Start Match    ${TOKEN}    ${match}    200
    Sleep Action    ${TOKEN}    ${match}    200
    ${response}=    Get Match Logs    ${TOKEN}    ${match}    200    limit=1
    ${body}=    Set Variable    ${response.json()}
    Length Should Be    ${body}[logs]    1
    Should Be Equal As Integers    ${body}[limit]    1
    Should Be True    ${body}[total] >= 2
    Should Not Be Equal    ${body}[nextCursor]    ${None}

Next Cursor Walks The Timeline Without Repeating Entries
    [Documentation]    v0.28.7 — following nextCursor yields the next entry, never the
    ...                same one twice, and the cursor eventually goes null.
    [Tags]    match-logs    step28-7
    ${match}=    New Logs Match
    Start Match    ${TOKEN}    ${match}    200
    Sleep Action    ${TOKEN}    ${match}    200
    ${page1}=    Get Match Logs    ${TOKEN}    ${match}    200    limit=1
    ${cursor}=    Set Variable    ${page1.json()}[nextCursor]
    ${page2}=    Get Match Logs    ${TOKEN}    ${match}    200    limit=1    cursor=${cursor}
    ${first}=     Set Variable    ${page1.json()}[logs][0]
    ${second}=    Set Variable    ${page2.json()}[logs][0]
    Should Not Be Equal    ${first}[timestamp]    ${second}[timestamp]
    # Walk to the end: the last page must expose a null cursor.
    ${total}=    Set Variable    ${page1.json()}[total]
    ${last}=    Get Match Logs    ${TOKEN}    ${match}    200    limit=${total}
    Should Be Equal    ${last.json()}[nextCursor]    ${None}

Admin Logs Are Paginated Too
    [Documentation]    v0.28.7 — the admin endpoint honours the same limit/cursor envelope.
    [Tags]    match-logs    step28-7
    ${match}=    New Logs Match
    Start Match    ${TOKEN}    ${match}    200
    Sleep Action    ${TOKEN}    ${match}    200
    ${response}=    Get Admin Match Logs    ${ADMIN_TOKEN}    ${match}    200    limit=1
    ${body}=    Set Variable    ${response.json()}
    Length Should Be    ${body}[logs]    1
    Should Be Equal As Integers    ${body}[limit]    1
    Should Not Be Equal    ${body}[nextCursor]    ${None}

Logs Returns 401 Without Auth
    [Documentation]    Missing bearer token → 401.
    [Tags]    match-logs    step28-7
    Create Public Session
    ${headers}=    Create Dictionary    Content-Type=application/json
    ${response}=    GET On Session    public_session
    ...    /api/matches/00000000-0000-0000-0000-000000000001/logs
    ...    headers=${headers}    expected_status=any
    Should Be Equal As Integers    ${response.status_code}    401

Logs Returns 404 For Unknown Match
    [Documentation]    Unknown match uuid → 404 MATCH_NOT_FOUND.
    [Tags]    match-logs    step28-7
    ${response}=    Get Match Logs    ${TOKEN}    00000000-0000-0000-0000-000000000000    404
    Should Be Equal As Strings    ${response.json()}[error]    MATCH_NOT_FOUND

Admin Logs Returns 200 For Any Match
    [Documentation]    Admin endpoint returns logs for any match without an
    ...                ownership check.
    [Tags]    match-logs    step28-7
    ${match}=    New Logs Match
    Start Match    ${TOKEN}    ${match}    200
    ${response}=    Get Admin Match Logs    ${ADMIN_TOKEN}    ${match}    200
    Dictionary Should Contain Key    ${response.json()}    logs
    Dictionary Should Contain Key    ${response.json()}    matchUuid

Admin Logs Returns 400 For Blank Uuid
    [Documentation]    Blank uuid on the admin endpoint → 400 INVALID_INPUT.
    [Tags]    match-logs    step28-7
    ${response}=    Get Admin Match Logs    ${ADMIN_TOKEN}    %20    400
    Should Be Equal As Strings    ${response.json()}[error]    INVALID_INPUT


*** Keywords ***

Suite Setup Logs
    [Documentation]    Guest + admin sessions and story loadout for the logs suite.
    Create Public Session
    Create Admin Session
    ${response}=    POST On Session    public_session    /api/auth/guest
    Status Should Be    ${response}    201
    Set Suite Variable    ${TOKEN}    ${response.json()}[accessToken]
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}       ${story}
    Set Suite Variable    ${DIFFICULTY_UUID}  ${difficulty}
    Set Suite Variable    ${CHARACTER_UUID}   ${character}
    Set Suite Variable    ${CLASS_UUID}       ${class}
    Set Suite Variable    ${TRAIT_UUID}       ${trait}

New Logs Match
    [Documentation]    Creates a CREATED match with rngSeed=42 and joins one character.
    # v0.32.1 — its own guest: one user may own only one active match per story
    # (409 ACTIVE_MATCH_ALREADY_EXISTS). ${TOKEN} is rebound for the rest of the test.
    ${token}=    Use A Fresh Guest Token
    ${match}=    Create Match With Rng Seed    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}    42
    Status Should Be    ${match}    201
    ${match_uuid}=    Set Variable    ${match.json()}[uuid]
    ${trait_list}=    Create List
    IF    '${TRAIT_UUID}' != ''
        Append To List    ${trait_list}    ${TRAIT_UUID}
    END
    ${join}=    Join Match    ${TOKEN}    ${match_uuid}    ${CHARACTER_UUID}    ${CLASS_UUID}    ${trait_list}
    Status Should Be    ${join}    201
    RETURN    ${match_uuid}

First Neighbor Uuid
    [Documentation]    Reads the active location's first neighbor uuid from GET /info.
    ...                Mirrors the keyword of the same name in the 28_movement suite.
    [Arguments]    ${match_uuid}
    ${info}=    Get Match Info    ${TOKEN}    ${match_uuid}
    Status Should Be    ${info}    200
    ${active}=    Set Variable    ${info.json()}[locationsActive]
    Should Not Be Empty    ${active}
    ${neighbors}=    Set Variable    ${active}[0][neighbors]
    Should Not Be Empty    ${neighbors}
    RETURN    ${neighbors}[0][uuid]

Count Log Entries By Type
    [Documentation]    Returns the count of log entries with the given type.
    [Arguments]    ${logs}    ${entry_type}
    ${count}=    Evaluate    sum(1 for e in $logs if e.get('type') == '${entry_type}')
    RETURN    ${count}

First Log Entry By Type
    [Documentation]    Returns the first log entry matching the given type.
    ...                Fails if no entry of that type exists.
    [Arguments]    ${logs}    ${entry_type}
    FOR    ${entry}    IN    @{logs}
        IF    '${entry}[type]' == '${entry_type}'
            RETURN    ${entry}
        END
    END
    Fail    No log entry with type '${entry_type}' found in logs list
