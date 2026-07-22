*** Settings ***
# ---------------------------------------------------------------------------
# choices.robot — Step 31 the choice engine, end-to-end and backend-agnostic.
#
# The contract under test:
#
#   POST /gameplay/{uuid}/action/execute-event on an event that OWNS choices
#   answers `status: CHOICES_PENDING` with the options — cost paid, marker written,
#   effects withheld — instead of applying anything. An event with no choices keeps
#   the Step 29 flow and answers `status: APPLIED`. Re-opening an already-open
#   choice-event serves the options again and charges nothing. And a new validator
#   rule (R8) makes every choice belong to an event.
#
# The seeded story (9001) carries two choice-events at the start location, addressed
# here by BEHAVIOUR (a NORMAL / ONCE event that owns choices), never by hard-coded uuid:
#
#   NORMAL choice-event (90030): four options — one always available, one gated on
#     INT > 99 (unavailable), one OR-combined (available), one otherwise fallback.
#   ONCE choice-event (90031): two options; opening it consumes the ONCE.
#
# Backend-agnostic: runs green against java-sqlite, java-postgres, python.
#
# Tags: choices, step31, gameplay
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource

Suite Setup       Suite Setup Choices
# Delete every story this suite imports (the val-step31 rows). Matches and guests are
# tagged "robottest_" and swept by POST /api/dev/cleanup at the end of each run; imported
# stories are not, so the suite removes its own. Delete tolerates a 404, so the two
# hard-fail-on-import rows (never persisted) are a harmless no-op here.
Suite Teardown    Delete Choices Test Stories


*** Variables ***
${R8_MISSING_EVENT_UUID}    a3111111-0001-4000-8000-000000000001
${R8_LOCATION_UUID}         a3111111-0002-4000-8000-000000000002
${R8_VALID_UUID}            a3111111-0003-4000-8000-000000000003


*** Test Cases ***

A No-Choice Event Answers APPLIED
    [Documentation]    An event with no choices keeps the Step 29 flow: its effects run and the
    ...                response is APPLIED with an empty pendingChoices.
    [Tags]    choices    step31
    ${uuid}=    No Choice Event Uuid
    ${resp}=    Execute Event    ${TOKEN}    ${MATCH_UUID}    ${uuid}    200
    ${body}=    Set Variable    ${resp.json()}
    Should Be Equal    ${body}[status]    APPLIED
    Should Be Empty    ${body}[pendingChoices]
    Should Not Be Empty    ${body}[effects]
    ...    msg=a no-choice event applies its effects, it does not present options

A Choice Event Answers CHOICES_PENDING With The Options
    [Documentation]    Opening the NORMAL choice-event pays the cost, presents the options and
    ...                withholds everything else. The options are priority-sorted, every one is
    ...                returned (disabled ones included) with its availability verdict, and the
    ...                post-selection narrative is never leaked.
    [Tags]    choices    step31
    ${token}    ${match}=    Fresh Choice Match
    ${uuid}=    Choice Event Uuid    NORMAL    ${token}    ${match}
    ${resp}=    Execute Event    ${token}    ${match}    ${uuid}    200
    ${body}=    Set Variable    ${resp.json()}

    Should Be Equal    ${body}[status]    CHOICES_PENDING
    # Presenting REPLACES applying: no effects, no stat changes, the event is the only entry.
    Should Be Empty    ${body}[effects]
    Should Be Empty    ${body}[statChanges]
    ${chain}=    Set Variable    ${body}[executedEventUuids]
    Length Should Be    ${chain}    1
    Should Be Equal    ${chain}[0]    ${uuid}
    # The cost is paid, once, on open (this NORMAL choice-event costs 2 energy).
    Should Be Equal As Integers    ${body}[energySpent]    2

    ${options}=    Set Variable    ${body}[pendingChoices]
    Length Should Be    ${options}    4

    # Priority order (ties by id): the returned priorities never decrease.
    ${is_sorted}=    Evaluate
    ...    [o.get('priority') for o in $options] == sorted([o.get('priority') for o in $options], key=lambda p: (p is None, p))
    Should Be True    ${is_sorted}
    ...    msg=the options must be priority-sorted

    # Exactly one option is gated out, and it says why; the rest are selectable.
    ${unavailable}=    Evaluate    [o for o in $options if not o['available']]
    Length Should Be    ${unavailable}    1
    Should Be Equal    ${unavailable}[0][reason]    CONDITION_STATISTICS_NOT_MET
    ${available}=    Evaluate    [o for o in $options if o['available']]
    Length Should Be    ${available}    3
    FOR    ${o}    IN    @{available}
        Should Be Equal    ${o}[reason]    ${None}
        ...    msg=an available option carries no reason
    END

    # The narrative and the outcome event are withheld until the choice is made (Step 32).
    FOR    ${o}    IN    @{options}
        Dictionary Should Not Contain Key    ${o}    idTextNarrative
        Dictionary Should Not Contain Key    ${o}    idEventTorun
        Dictionary Should Contain Key    ${o}    uuid
        Dictionary Should Contain Key    ${o}    available
    END

An Open Choice Event Re-Fetches Idempotently
    [Documentation]    Re-opening an already-open choice-event serves the options again as a
    ...                pure read: no energy is charged the second time, and the character's
    ...                energy is unchanged between the two serves.
    [Tags]    choices    step31
    ${token}    ${match}=    Fresh Choice Match
    ${uuid}=    Choice Event Uuid    NORMAL    ${token}    ${match}

    ${first}=    Execute Event    ${token}    ${match}    ${uuid}    200
    ${first_body}=    Set Variable    ${first.json()}
    Should Be Equal As Integers    ${first_body}[energySpent]    2
    ${energy_after_open}=    Set Variable    ${first_body}[newEnergy]

    ${second}=    Execute Event    ${token}    ${match}    ${uuid}    200
    ${second_body}=    Set Variable    ${second.json()}
    Should Be Equal    ${second_body}[status]    CHOICES_PENDING
    Should Be Equal As Integers    ${second_body}[energySpent]    0
    ...    msg=a re-fetch of an open choice-event charges nothing
    Should Be Equal As Integers    ${second_body}[newEnergy]    ${energy_after_open}
    ...    msg=the re-fetch leaves the energy exactly where the open left it
    # The options are served again, same count.
    Length Should Be    ${second_body}[pendingChoices]    4

A ONCE Choice Event Stays Open After Consuming Its ONCE
    [Documentation]    Opening a ONCE choice-event consumes the ONCE, yet re-opening it still
    ...                serves the options (no ONCE_ALREADY_CONSUMED) while the cycle is open —
    ...                and match-info reports the event consumed once it has been opened.
    [Tags]    choices    step31
    ${token}    ${match}=    Fresh Choice Match
    ${uuid}=    Choice Event Uuid    ONCE    ${token}    ${match}

    ${first}=    Execute Event    ${token}    ${match}    ${uuid}    200
    Should Be Equal    ${first.json()}[status]    CHOICES_PENDING

    # match-info now reports the ONCE consumed — the marker fired on open.
    Should Be Blocked On Match    ${token}    ${match}    ${uuid}    ONCE_ALREADY_CONSUMED

    # ...but re-opening the still-open cycle serves the options, it does not reject.
    ${second}=    Execute Event    ${token}    ${match}    ${uuid}    200
    Should Be Equal    ${second.json()}[status]    CHOICES_PENDING
    Should Be Equal As Integers    ${second.json()}[energySpent]    0

Choices Are Never Nested Into Match Info
    [Documentation]    The options exist only on the execute-event response: match-info lists the
    ...                choice-event as an ordinary action and never nests its choices (no
    ...                narrative pre-leak before the event is opened and paid for).
    [Tags]    choices    step31    match-info
    ${token}    ${match}=    Fresh Choice Match
    ${uuid}=    Choice Event Uuid    NORMAL    ${token}    ${match}
    ${events}=    Location Events On    ${token}    ${match}
    ${entry}=    Evaluate    next(e for e in $events if e['uuid'] == '${uuid}')
    Should Be True    ${entry}[available]
    ...    msg=the NORMAL choice-event is offered like any action
    Dictionary Should Not Contain Key    ${entry}    choices
    Dictionary Should Not Contain Key    ${entry}    pendingChoices

Import Choice With No Event Fails R8
    [Documentation]    Step 31 — every choice must belong to an event: a choice with no idEvent
    ...                hard-fails import with R8_CHOICE_EVENT on the idEvent field.
    [Tags]    choices    step31    admin    validation
    ${payload}=    Catenate    SEPARATOR=
    ...    {"uuid":"${R8_MISSING_EVENT_UUID}","author":"val-step31",
    ...    "events":[{"id":1,"type":"NORMAL"}],
    ...    "choices":[{"id":1,"otherwiseFlag":1}]}
    ${body}=    Import Payload Should Fail Validation    ${payload}
    ${hits}=    Evaluate    [e for e in $body['errors'] if e['rule'] == 'R8_CHOICE_EVENT' and e['field'] == 'idEvent']
    Should Not Be Empty    ${hits}    msg=a choice without idEvent must raise R8_CHOICE_EVENT

Import Choice With A Location Fails R8
    [Documentation]    Step 31 — the location binding is deprecated: a choice carrying a
    ...                (valid) idLocation hard-fails import with R8_CHOICE_EVENT on idLocation.
    [Tags]    choices    step31    admin    validation
    ${payload}=    Catenate    SEPARATOR=
    ...    {"uuid":"${R8_LOCATION_UUID}","author":"val-step31",
    ...    "locations":[{"id":1}],
    ...    "events":[{"id":1,"type":"NORMAL"}],
    ...    "choices":[{"id":1,"idEvent":1,"idLocation":1,"otherwiseFlag":1}]}
    ${body}=    Import Payload Should Fail Validation    ${payload}
    ${hits}=    Evaluate    [e for e in $body['errors'] if e['rule'] == 'R8_CHOICE_EVENT' and e['field'] == 'idLocation']
    Should Not Be Empty    ${hits}    msg=a choice with idLocation must raise R8_CHOICE_EVENT

Import Choice With A Statistics Condition Validates Clean
    [Documentation]    Step 31 — a choice bound to an event, with a non-KEYS condition whose
    ...                `key` names a stat (not a registry key), imports 201: the keys check must
    ...                not false-fail it (the pre-Step-31 validator did).
    [Tags]    choices    step31    admin    validation
    ${payload}=    Catenate    SEPARATOR=
    ...    {"uuid":"${R8_VALID_UUID}","author":"val-step31",
    ...    "events":[{"id":1,"type":"NORMAL"}],
    ...    "choices":[{"id":1,"idEvent":1,"otherwiseFlag":1}],
    ...    "choiceConditions":[{"id":1,"idChoices":1,"type":"statistics","key":"int","value":"3","operator":">"}]}
    ${response}=    Post Admin Story Import    ${payload}
    Should Be Equal As Integers    ${response.status_code}    201
    # The Suite Teardown deletes it (with the other val-step31 rows).


*** Keywords ***

Delete Choices Test Stories
    [Documentation]    Remove the stories this suite imports (the val-step31 rows), so no
    ...                orphan stories survive the run. Delete tolerates a 404, so the rows
    ...                that never persisted (the hard-fail-on-import cases) are a no-op.
    Delete Admin Story    ${R8_MISSING_EVENT_UUID}
    Delete Admin Story    ${R8_LOCATION_UUID}
    Delete Admin Story    ${R8_VALID_UUID}

Suite Setup Choices
    [Documentation]    A running single-player match whose character stands at the start location,
    ...                where the seeded Step 31 choice-events live. Also opens an admin session,
    ...                used both to read the seed and to run the import-validation cases.
    Create Admin Session
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}    ${story}
    Set Suite Variable    ${DIFFICULTY}    ${difficulty}
    Set Suite Variable    ${CHARACTER}    ${character}
    Set Suite Variable    ${CLASS}    ${class}
    Set Suite Variable    ${TRAIT}    ${trait}

    ${guest}=    POST On Session    public_session    /api/auth/guest
    Status Should Be    ${guest}    201
    Set Suite Variable    ${TOKEN}    ${guest.json()}[accessToken]
    ${match}=    Create Match    ${TOKEN}    ${story}    ${difficulty}    robottest_step31
    Status Should Be    ${match}    201
    Set Suite Variable    ${MATCH_UUID}    ${match.json()}[uuid]
    Join And Start    ${TOKEN}    ${MATCH_UUID}

Join And Start
    [Documentation]    Join the caller's character to a match and start it.
    [Arguments]    ${token}    ${match_uuid}
    ${trait_list}=    Create List
    IF    '${TRAIT}' != ''
        Append To List    ${trait_list}    ${TRAIT}
    END
    ${join}=    Join Match    ${token}    ${match_uuid}    ${CHARACTER}    ${CLASS}    ${trait_list}
    Status Should Be    ${join}    201
    Start Match    ${token}    ${match_uuid}    200

Fresh Choice Match
    [Documentation]    A fresh running single-player match on the suite's story. Each open of a
    ...                choice-event latches per-match state (the EVENT_EXECUTED marker), so a
    ...                pristine-event test must run on its own match.
    ${guest}=    POST On Session    public_session    /api/auth/guest
    Status Should Be    ${guest}    201
    ${token}=    Set Variable    ${guest.json()}[accessToken]
    ${match}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY}    robottest_step31_fresh
    Status Should Be    ${match}    201
    ${uuid}=    Set Variable    ${match.json()}[uuid]
    Join And Start    ${token}    ${uuid}
    RETURN    ${token}    ${uuid}

# ── addressing the seeded choice-events by behaviour ─────────────────────────

Admin Choices
    [Documentation]    The story's list_choices rows, from the admin API.
    ${resp}=    GET On Session    admin_session    /api/admin/stories/${STORY_UUID}/choices
    Status Should Be    ${resp}    200
    RETURN    ${resp.json()}

Admin Events
    ${resp}=    GET On Session    admin_session    /api/admin/stories/${STORY_UUID}/events
    Status Should Be    ${resp}    200
    RETURN    ${resp.json()}

Choice Event Uuid
    [Documentation]    The uuid of the location-bound choice-event of the given type: a NORMAL /
    ...                ONCE event, at a location, with a positive cost, that OWNS at least one
    ...                choice. A story event keeps its uuid inside a match, so the admin uuid is
    ...                the very uuid `/info` and execute-event expose (as Event Uuid By Cost).
    [Arguments]    ${type}    ${token}    ${match_uuid}
    ${choices}=    Admin Choices
    ${events}=    Admin Events
    ${uuid}=    Evaluate
    ...    next((e['uuid'] for e in sorted(events, key=lambda x: x['id']) if e['type'] == '${type}' and e['id'] in owners and e.get('idSpecificLocation') and e.get('costEnery')), None)
    ...    namespace=${{ {'events': $events, 'owners': {c['idEvent'] for c in $choices if c.get('idEvent')}} }}
    Should Not Be Equal    ${uuid}    ${None}
    ...    msg=no ${type} location-bound choice-event is seeded
    RETURN    ${uuid}

No Choice Event Uuid
    [Documentation]    A NORMAL location-bound event with a positive cost that owns NO choices —
    ...                so executing it applies its effects (APPLIED), never presents options.
    ${choices}=    Admin Choices
    ${events}=    Admin Events
    ${uuid}=    Evaluate
    ...    next((e['uuid'] for e in sorted(events, key=lambda x: x['id']) if e['type'] == 'NORMAL' and e['id'] not in owners and e.get('idSpecificLocation') and e.get('costEnery') and not e.get('idEventNext') and not e.get('registryKeyCondition') and not e.get('idItemCondition') and not e.get('idClassCondition') and not e.get('idWeather')), None)
    ...    namespace=${{ {'events': $events, 'owners': {c['idEvent'] for c in $choices if c.get('idEvent')}} }}
    Should Not Be Equal    ${uuid}    ${None}
    ...    msg=no plain no-choice NORMAL event is seeded
    RETURN    ${uuid}

Location Events On
    [Documentation]    The events of the location the given match's character stands in.
    [Arguments]    ${token}    ${match_uuid}
    ${info}=    Get Match Info    ${token}    ${match_uuid}    200    lang=en
    ${body}=    Set Variable    ${info.json()}
    Should Not Be Empty    ${body}[locationsActive]
    ${current}=    Set Variable    ${body}[currentLocationId]
    FOR    ${entry}    IN    @{body}[locationsActive]
        IF    $entry['idLocation'] == $current    RETURN    ${entry}[events]
    END
    Fail    the character's location ${current} is not among locationsActive

Should Be Blocked On Match
    [Documentation]    match-info on the given match must block this event for exactly this reason.
    [Arguments]    ${token}    ${match_uuid}    ${uuid}    ${reason}
    ${events}=    Location Events On    ${token}    ${match_uuid}
    FOR    ${e}    IN    @{events}
        IF    $e['uuid'] == $uuid
            Should Not Be True    ${e}[available]
            Should Be Equal    ${e}[reason]    ${reason}
            RETURN
        END
    END
    Fail    event ${uuid} is not listed at the character's location
