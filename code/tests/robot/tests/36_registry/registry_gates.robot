*** Settings ***
# ---------------------------------------------------------------------------
# registry_gates.robot — every READER and every WRITER of the registry, end to end.
#
# Step 36 made one comparison serve four gates: an event condition, a movement edge, a
# weather rule and a choice option all call the same evaluate(operator, expected, set).
# The Robot suites so far exercised the event and the choice gates; the edge and the
# weather gates, the numeric operators (> and <), an operator column left UNSET, and the
# two choice-effect columns (value_to_add / value_to_remove) written on one row had no
# end-to-end case. This suite closes those gaps.
#
# The suite SHIPS ITS OWN STORY — story_registry_gates.json, next to this file — so no
# seed changes: it is imported in Suite Setup and deleted in Suite Teardown, with every
# match it created stopped and deleted first. Entities are addressed by their story-local
# `id` through the admin CRUD lists, never by uuid (uuids are generated per import).
#
#   keys      door / steps / storm / mood — single-valued, no default
#   writers   events 10..15, one effect row each (target=ALL): door=open, steps=5,
#             steps=2, steps=many, storm=yes, mood=sad
#   readers   events 20..24: door=open (=), door=open (operator UNSET), steps>3,
#             steps<3, door!=open
#             edges from the Hall: Vault (door=open, =), Garden (steps>3),
#             Cellar (door!=open), Chapel (door=open, operator UNSET)
#             weather: Clear (storm!=yes), Storm (storm=yes) — one always qualifies
#   choices   event 30 owns three options on `mood`: (1) valueToAdd=happy AND
#             valueToRemove=sad on ONE row, (2) valueToRemove=gloomy, (3) valueToRemove=sad
#
# Every case runs on its own guest and its own match: a key latches.
#
# Tags: registry, step36, gates
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Library    OperatingSystem
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource

Suite Setup       Suite Setup Registry Gates
Suite Teardown    Suite Teardown Registry Gates


*** Variables ***
${STORY_FILE}    ${CURDIR}/story_registry_gates.json
${STORY_UUID}    f0360005-0000-4000-8000-000000000365
@{CREATED_MATCHES}


*** Test Cases ***

The Gates Story Imports And Validates Clean
    [Documentation]    The fixture itself must pass the validator: an operator column left
    ...                unset, a `!=` weather rule and a two-column choice effect are all legal.
    [Tags]    registry    step36    gates
    ${report}=    Validate Admin Story    ${STORY_UUID}
    Status Should Be    ${report}    200
    Should Be True    ${report.json()}[valid]
    ...    msg=the gates story does not validate: ${report.json()}

A Fresh Match Holds Nothing For Any Of The Four Keys
    [Documentation]    No key has a default, so before anyone acts every one of them is an
    ...                empty set — present, never absent.
    [Tags]    registry    step36    gates
    ${token}    ${match}=    Fresh Gates Match
    FOR    ${key}    IN    door    steps    storm    mood
        ${members}=    Registry Members    ${token}    ${match}    ${key}
        Should Be Empty    ${members}    msg=key ${key} already held ${members} on a fresh match
    END

An Effect Row Writes Its Pair Exactly Once, Even With Target ALL
    [Documentation]    `target=ALL` fans a STAT out to every character; a registry pair is
    ...                per match, so the row writes once and leaves one REGISTRY_CHANGE.
    [Tags]    registry    step36    gates
    ${token}    ${match}=    Fresh Gates Match
    ${before}=    Registry Change Count    ${token}    ${match}

    ${resp}=    Run Event    ${token}    ${match}    10
    Length Should Be    ${resp.json()}[registryChanges]    1
    Should Be Equal    ${resp.json()}[registryChanges][0][key]         door
    Should Be Equal    ${resp.json()}[registryChanges][0][newValue]    open

    ${members}=    Registry Members    ${token}    ${match}    door
    Should Be Equal    ${members}    ${{ ['open'] }}
    ${after}=    Registry Change Count    ${token}    ${match}
    Should Be Equal As Integers    ${after}    ${{ $before + 1 }}
    ...    msg=one effect row left ${after} - ${before} REGISTRY_CHANGE rows, not one

# ── edges ─────────────────────────────────────────────────────────────────────

A Gated Edge Is Blocked Until The Key Says Open
    [Documentation]    The Vault edge reads door=open. Before the write /info greys it out
    ...                with MOVEMENT_CONDITION_NOT_MET and the move is refused with the very
    ...                same code; after the write the path is open and the move lands.
    [Tags]    registry    step36    gates    movement
    ${token}    ${match}=    Fresh Gates Match
    ${vault}=    Location Uuid    2

    Neighbor Should Be Blocked    ${token}    ${match}    ${vault}
    ${move}=    Start Movement    ${token}    ${match}    ${vault}    409
    Should Be Equal    ${move.json()}[error]    MOVEMENT_CONDITION_NOT_MET

    Run Event    ${token}    ${match}    10
    Neighbor Should Be Open    ${token}    ${match}    ${vault}
    ${move}=    Start Movement    ${token}    ${match}    ${vault}    200
    Should Be Equal    ${move.json()}[toLocationUuid]    ${vault}

An Edge Whose Operator Column Is Unset Reads As Equals
    [Documentation]    The Chapel edge was authored with a key and a value but no operator at
    ...                all. A null operator column is `=`, not "no condition" and not "never".
    [Tags]    registry    step36    gates    movement
    ${token}    ${match}=    Fresh Gates Match
    ${chapel}=    Location Uuid    5

    Neighbor Should Be Blocked    ${token}    ${match}    ${chapel}
    Run Event    ${token}    ${match}    10
    Neighbor Should Be Open    ${token}    ${match}    ${chapel}

An Edge Gated On Not-Equals Is Open Until The Key Matches
    [Documentation]    `!=` is the one operator an absent key satisfies: the Cellar is
    ...                reachable from the first turn and closes the moment the door opens.
    [Tags]    registry    step36    gates    movement
    ${token}    ${match}=    Fresh Gates Match
    ${cellar}=    Location Uuid    4

    Neighbor Should Be Open    ${token}    ${match}    ${cellar}
    Run Event    ${token}    ${match}    10
    Neighbor Should Be Blocked    ${token}    ${match}    ${cellar}
    ${move}=    Start Movement    ${token}    ${match}    ${cellar}    409
    Should Be Equal    ${move.json()}[error]    MOVEMENT_CONDITION_NOT_MET

A Numeric Edge Gate Compares Numbers, Not Strings
    [Documentation]    The Garden edge reads steps>3. Nothing written: blocked. steps=2:
    ...                still blocked. steps=5: open. A string compare would already have
    ...                let "5" > "3" through, so the last step alone proves nothing — the
    ...                three together do.
    [Tags]    registry    step36    gates    movement
    ${token}    ${match}=    Fresh Gates Match
    ${garden}=    Location Uuid    3

    Neighbor Should Be Blocked    ${token}    ${match}    ${garden}
    Run Event    ${token}    ${match}    12
    Neighbor Should Be Blocked    ${token}    ${match}    ${garden}
    Run Event    ${token}    ${match}    11
    Neighbor Should Be Open    ${token}    ${match}    ${garden}
    ${move}=    Start Movement    ${token}    ${match}    ${garden}    200
    Should Be Equal    ${move.json()}[toLocationUuid]    ${garden}

# ── weather ───────────────────────────────────────────────────────────────────

A Weather Rule Reads The Registry At Every Time Start
    [Documentation]    Two rules, one key: Clear wants storm!=yes, Storm wants storm=yes, so
    ...                exactly one qualifies at any time and the roll is deterministic without
    ...                a seed. The match starts under Clear; after the key is written the next
    ...                time-start picks Storm. The admin view says why: registryMet flips.
    [Tags]    registry    step36    gates    weather
    ${token}    ${match}=    Fresh Gates Match

    Current Weather Rule Should Be    ${match}    1
    Rule Registry Verdict Should Be    ${match}    1    ${True}
    Rule Registry Verdict Should Be    ${match}    2    ${False}

    Run Event    ${token}    ${match}    14
    Rule Registry Verdict Should Be    ${match}    1    ${False}
    Rule Registry Verdict Should Be    ${match}    2    ${True}
    # The registry moved but the weather does not: it is rolled at time-start only.
    Current Weather Rule Should Be    ${match}    1

    Sleep Action    ${token}    ${match}    200
    Current Weather Rule Should Be    ${match}    2

# ── events, one operator each ─────────────────────────────────────────────────

An Event Gate With No Operator Reads As Equals
    [Documentation]    Event 21 carries door=open and NO operator. Blocked with the reason
    ...                the endpoint would answer; available once the door is open.
    [Tags]    registry    step36    gates    events
    ${token}    ${match}=    Fresh Gates Match

    Event Should Be Blocked    ${token}    ${match}    21
    Run Event    ${token}    ${match}    10
    Event Should Be Available    ${token}    ${match}    21
    Run Event    ${token}    ${match}    21

Greater Than Is Met Only By A Larger Number
    [Documentation]    steps>3: never over an empty set, not by 2, yes by 5.
    [Tags]    registry    step36    gates    events
    ${token}    ${match}=    Fresh Gates Match

    Event Should Be Blocked    ${token}    ${match}    22
    Run Event    ${token}    ${match}    12
    Event Should Be Blocked    ${token}    ${match}    22
    Run Event    ${token}    ${match}    11
    Event Should Be Available    ${token}    ${match}    22
    Run Event    ${token}    ${match}    22

Less Than Is Met Only By A Smaller Number
    [Documentation]    steps<3: never over an empty set, not by 5, yes by 2.
    [Tags]    registry    step36    gates    events
    ${token}    ${match}=    Fresh Gates Match

    Event Should Be Blocked    ${token}    ${match}    23
    Run Event    ${token}    ${match}    11
    Event Should Be Blocked    ${token}    ${match}    23
    Run Event    ${token}    ${match}    12
    Event Should Be Available    ${token}    ${match}    23
    Run Event    ${token}    ${match}    23

A Value That Is Not A Number Meets Neither Side Of A Numeric Gate
    [Documentation]    steps=many: > and < both read "not met", never an error, and the
    ...                event that wrote the word still answered 200.
    [Tags]    registry    step36    gates    events
    ${token}    ${match}=    Fresh Gates Match

    Run Event    ${token}    ${match}    13
    ${members}=    Registry Members    ${token}    ${match}    steps
    Should Be Equal    ${members}    ${{ ['many'] }}
    Event Should Be Blocked    ${token}    ${match}    22
    Event Should Be Blocked    ${token}    ${match}    23

Not-Equals Is Met By An Absent Key And Broken By The Value
    [Documentation]    Event 24 reads door!=open: runnable on a fresh match, refused with
    ...                REGISTRY_CONDITION_NOT_MET once the door is open.
    [Tags]    registry    step36    gates    events
    ${token}    ${match}=    Fresh Gates Match

    Event Should Be Available    ${token}    ${match}    24
    Run Event    ${token}    ${match}    10
    Event Should Be Blocked    ${token}    ${match}    24
    ${resp}=    Execute Event    ${token}    ${match}    ${EVENTS}[24]    409
    Should Be Equal    ${resp.json()}[error]    REGISTRY_CONDITION_NOT_MET

# ── choice effects ────────────────────────────────────────────────────────────

An Option Carrying Both Columns Adds And Never Removes
    [Documentation]    One choice-effect row with valueToAdd=happy AND valueToRemove=sad on
    ...                the same key: the add wins outright, the remove is never consulted.
    [Tags]    registry    step36    gates    choices
    ${token}    ${match}=    Fresh Gates Match
    Run Event    ${token}    ${match}    15
    ${before}=    Registry Change Count    ${token}    ${match}

    Pick Mood Option    ${token}    ${match}    1

    ${members}=    Registry Members    ${token}    ${match}    mood
    Should Be Equal    ${members}    ${{ ['happy'] }}
    ...    msg=valueToAdd did not win over valueToRemove on the same row
    ${after}=    Registry Change Count    ${token}    ${match}
    Should Be Equal As Integers    ${after}    ${{ $before + 1 }}

A Compare-And-Clear Against Another Value Leaves The Key Alone
    [Documentation]    valueToRemove=gloomy while the key holds sad: the story has moved on
    ...                from what the row names, so nothing is wiped and nothing is logged.
    [Tags]    registry    step36    gates    choices
    ${token}    ${match}=    Fresh Gates Match
    Run Event    ${token}    ${match}    15
    ${before}=    Registry Change Count    ${token}    ${match}

    Pick Mood Option    ${token}    ${match}    2

    ${members}=    Registry Members    ${token}    ${match}    mood
    Should Be Equal    ${members}    ${{ ['sad'] }}
    ...    msg=a valueToRemove naming a value the key does not hold still emptied it
    ${after}=    Registry Change Count    ${token}    ${match}
    Should Be Equal As Integers    ${after}    ${before}
    ...    msg=a refused remove still left a REGISTRY_CHANGE row

A Compare-And-Clear Against The Value Held Empties The Key
    [Documentation]    valueToRemove=sad while the key holds sad: the key is emptied — an
    ...                empty set, never an absent entry — and one REGISTRY_CHANGE says so.
    [Tags]    registry    step36    gates    choices
    ${token}    ${match}=    Fresh Gates Match
    Run Event    ${token}    ${match}    15
    ${before}=    Registry Change Count    ${token}    ${match}

    Pick Mood Option    ${token}    ${match}    3

    ${members}=    Registry Members    ${token}    ${match}    mood
    Should Be Empty    ${members}    msg=the compare-and-clear did not empty the key
    ${after}=    Registry Change Count    ${token}    ${match}
    Should Be Equal As Integers    ${after}    ${{ $before + 1 }}

A Remove On An Empty Key Changes Nothing And Logs Nothing
    [Documentation]    valueToRemove=sad on a fresh match: no row to compare with, so the
    ...                key stays empty and the audit log stays as it was.
    [Tags]    registry    step36    gates    choices
    ${token}    ${match}=    Fresh Gates Match
    ${before}=    Registry Change Count    ${token}    ${match}

    Pick Mood Option    ${token}    ${match}    3

    ${members}=    Registry Members    ${token}    ${match}    mood
    Should Be Empty    ${members}
    ${after}=    Registry Change Count    ${token}    ${match}
    Should Be Equal As Integers    ${after}    ${before}


*** Keywords ***

Suite Setup Registry Gates
    [Documentation]    Import the fixture (after removing a leftover copy) and resolve every
    ...                entity the cases address: story-local id → uuid, per entity type.
    Create Admin Session
    Create Public Session
    Run Keyword And Ignore Error    Delete Admin Story    ${STORY_UUID}
    ${import}=    Import Story From File    ${STORY_FILE}
    Should Be Equal As Integers    ${import.status_code}    201
    ...    msg=the gates story did not import: ${import.text}

    # The loadout: the fixture ships exactly one of each, so the first row is the one.
    ${difficulty}=    First Admin Uuid    difficulties
    ${template}=      First Admin Uuid    character-templates
    ${class}=         First Admin Uuid    classes
    Set Suite Variable    ${DIFFICULTY}    ${difficulty}
    Set Suite Variable    ${CHARACTER}     ${template}
    Set Suite Variable    ${CLASS}         ${class}

    ${events}=       Admin Rows    events
    ${choices}=      Admin Rows    choices
    ${locations}=    Admin Rows    locations
    Set Suite Variable    ${EVENTS}       ${events}
    Set Suite Variable    ${CHOICES}      ${choices}
    Set Suite Variable    ${LOCATIONS}    ${locations}

Suite Teardown Registry Gates
    [Documentation]    Every match first — a story with live matches cannot go — then the story.
    FOR    ${match}    IN    @{CREATED_MATCHES}
        Run Keyword And Ignore Error    Admin Stop Match      ${ADMIN_TOKEN}    ${match}
        Run Keyword And Ignore Error    Admin Delete Match    ${ADMIN_TOKEN}    ${match}
    END
    Run Keyword And Ignore Error    Delete Admin Story    ${STORY_UUID}

Admin Rows
    [Documentation]    {story-local id: uuid} for one entity type of the fixture, from the
    ...                admin CRUD list. Ids are integers in the JSON and may come back as
    ...                strings from a document backend, so both are normalised.
    [Arguments]    ${entity_type}
    ${resp}=    List Admin Entities    ${STORY_UUID}    ${entity_type}
    Status Should Be    ${resp}    200
    ${rows}=    Evaluate    {str(r['id']): r['uuid'] for r in $resp.json() if r.get('id') is not None and r.get('uuid')}
    Should Not Be Empty    ${rows}    msg=the fixture has no ${entity_type} rows
    RETURN    ${rows}

First Admin Uuid
    [Documentation]    The uuid of the fixture's only row of one entity type. Not every admin
    ...                list echoes the story-local `id` (character-templates does not), so the
    ...                loadout rows are taken by position rather than by id.
    [Arguments]    ${entity_type}
    ${resp}=    List Admin Entities    ${STORY_UUID}    ${entity_type}
    Status Should Be    ${resp}    200
    Should Not Be Empty    ${resp.json()}    msg=the fixture has no ${entity_type} rows
    RETURN    ${resp.json()}[0][uuid]

Fresh Gates Match
    [Documentation]    A running single-player match on its own guest, remembered for the
    ...                teardown. Fresh per case: a key latches.
    ${token}=    New Guest Token
    ${match}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY}    robottest_gates
    Status Should Be    ${match}    201
    ${uuid}=    Set Variable    ${match.json()}[uuid]
    Append To List    ${CREATED_MATCHES}    ${uuid}
    ${no_traits}=    Create List
    ${join}=    Join Match    ${token}    ${uuid}    ${CHARACTER}    ${CLASS}    ${no_traits}
    Status Should Be    ${join}    201
    Start Match    ${token}    ${uuid}    200
    RETURN    ${token}    ${uuid}

Location Uuid
    [Arguments]    ${id}
    RETURN    ${LOCATIONS}[${id}]

Run Event
    [Documentation]    Execute one fixture event by story-local id and insist it ran: a silent
    ...                refusal would make every gate assertion vacuous.
    [Arguments]    ${token}    ${match}    ${id}
    ${resp}=    Execute Event    ${token}    ${match}    ${EVENTS}[${id}]    200
    RETURN    ${resp}

Info Neighbor
    [Documentation]    The /info entry of one neighbor of the location the party stands on.
    [Arguments]    ${token}    ${match}    ${location_uuid}
    ${info}=    Get Match Info    ${token}    ${match}    200
    FOR    ${active}    IN    @{info.json()}[locationsActive]
        FOR    ${nb}    IN    @{active}[neighbors]
            IF    $nb['uuid'] == $location_uuid    RETURN    ${nb}
        END
    END
    Fail    /info lists no neighbor ${location_uuid}

Neighbor Should Be Blocked
    [Arguments]    ${token}    ${match}    ${location_uuid}
    ${nb}=    Info Neighbor    ${token}    ${match}    ${location_uuid}
    Should Not Be True    ${nb}[available]    msg=the gated edge reads as open
    Should Be Equal    ${nb}[reason]    MOVEMENT_CONDITION_NOT_MET

Neighbor Should Be Open
    [Arguments]    ${token}    ${match}    ${location_uuid}
    ${nb}=    Info Neighbor    ${token}    ${match}    ${location_uuid}
    Should Be True    ${nb}[available]
    ...    msg=the edge is still blocked (${nb}[reason]) although its condition is met

Info Event
    [Documentation]    The /info entry of one fixture event, by story-local id.
    [Arguments]    ${token}    ${match}    ${id}
    ${info}=    Get Match Info    ${token}    ${match}    200
    FOR    ${active}    IN    @{info.json()}[locationsActive]
        FOR    ${ev}    IN    @{active}[events]
            IF    $ev['uuid'] == $EVENTS['${id}']    RETURN    ${ev}
        END
    END
    Fail    /info lists no event ${id}

Event Should Be Blocked
    [Arguments]    ${token}    ${match}    ${id}
    ${ev}=    Info Event    ${token}    ${match}    ${id}
    Should Not Be True    ${ev}[available]    msg=event ${id} reads as available
    Should Be Equal    ${ev}[reason]    REGISTRY_CONDITION_NOT_MET

Event Should Be Available
    [Arguments]    ${token}    ${match}    ${id}
    ${ev}=    Info Event    ${token}    ${match}    ${id}
    Should Be True    ${ev}[available]
    ...    msg=event ${id} is still blocked (${ev}[reason]) although its condition is met

Admin Weather Rules
    [Arguments]    ${match}
    ${resp}=    Get Admin Match Weather    ${ADMIN_TOKEN}    ${match}    200
    RETURN    ${resp.json()}[rules]

Current Weather Rule Should Be
    [Documentation]    The rule flagged `current` on the admin view is the one with this id.
    [Arguments]    ${match}    ${id}
    ${rules}=    Admin Weather Rules    ${match}
    ${current}=    Evaluate    [int(r['id']) for r in $rules if r.get('current')]
    Should Be Equal    ${current}    ${{ [${id}] }}
    ...    msg=expected weather rule ${id} to be current, the admin view flags ${current}

Rule Registry Verdict Should Be
    [Arguments]    ${match}    ${id}    ${expected}
    ${rules}=    Admin Weather Rules    ${match}
    ${met}=    Evaluate    next(r.get('registryMet') for r in $rules if int(r['id']) == ${id})
    Should Be Equal    ${met}    ${expected}
    ...    msg=registryMet of weather rule ${id} is ${met}, expected ${expected}

Pick Mood Option
    [Documentation]    Open the mood choice-event and resolve the option with this story-local
    ...                id; both calls must succeed for the registry assertion to mean anything.
    [Arguments]    ${token}    ${match}    ${id}
    ${open}=    Run Event    ${token}    ${match}    30
    Should Be Equal    ${open.json()}[status]    CHOICES_PENDING
    ${offered}=    Evaluate    [o['uuid'] for o in $open.json()['pendingChoices'] if o.get('available')]
    List Should Contain Value    ${offered}    ${CHOICES}[${id}]
    ...    msg=option ${id} is not offered as available
    ${resp}=    Select Choice    ${token}    ${match}    ${CHOICES}[${id}]    200
    Should Be Equal    ${resp.json()}[status]    APPLIED
    RETURN    ${resp}

Registry Members
    [Documentation]    The SET one key holds right now, as the registry answers it.
    [Arguments]    ${token}    ${match}    ${key}
    ${response}=    Get Registry    ${token}    ${match}    200    include_hidden=true
    FOR    ${group}    IN    @{response.json()}[groups]
        FOR    ${entry}    IN    @{group}[entries]
            IF    $entry['key'] == $key    RETURN    ${entry}[values]
        END
    END
    Fail    the registry carries no entry for ${key}

Registry Change Count
    [Arguments]    ${token}    ${match}
    ${logs}=    Get Match Logs    ${token}    ${match}    200
    ${count}=    Evaluate
    ...    len([e for e in $logs.json()['logs'] if e.get('type') == 'REGISTRY_CHANGE'])
    RETURN    ${count}
