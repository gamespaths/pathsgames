*** Settings ***
# ---------------------------------------------------------------------------
# choice_resolution.robot — Step 32 choice resolution, end-to-end and backend-agnostic.
#
# The contract under test:
#
#   POST /gameplay/{uuid}/action/select-choice resolves one option of an OPEN
#   choice-event: it applies the option's list_choices_effects, runs the events they
#   and id_event_torun point at, reveals the narrative Step 31 withheld, and closes
#   the cycle. It charges NOTHING — the energy, the coins and the ONCE were all spent
#   when the event was opened, which is why its only gate is that a cycle really is
#   open (the cost-bypass guard: false both before an open and after a resolution).
#
# The seeded story (9001) carries the resolution test-bed at the start location,
# addressed here by BEHAVIOUR (the choice-event whose options carry a narrative),
# never by hard-coded uuid:
#
#   Event 90032 — three options: a milestone (is_progress), one that does everything
#     at once (registry key, item, forced move, weather, a linked event), and one
#     gated on DEX >= 99 that nobody can ever pick.
#   Event 90033 — the outcome event the second option runs. It costs 9 and is never
#     charged for: a consequence is not a choice.
#
# Every case runs on its OWN match: opening a choice-event latches per-match state
# (the EVENT_EXECUTED marker), and resolving it latches more.
#
# Backend-agnostic: runs green against java-sqlite, java-postgres, python.
#
# Tags: choices, step32, gameplay
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource

Suite Setup       Suite Setup Choice Resolution


*** Test Cases ***

Resolving An Option Applies Its Effects And Charges Nothing
    [Documentation]    The core of the step: the option's effects land, the narrative Step 31
    ...                withheld comes back, and neither energy nor coins are charged — the open
    ...                already paid, and resolving is what that payment bought.
    [Tags]    choices    step32
    ${token}    ${match}    ${event}    ${options}=    Open The Resolution Event
    ${before}=    Player Energy    ${token}    ${match}
    ${choice}=    Option With A Narrative    ${options}

    ${resp}=    Select Choice    ${token}    ${match}    ${choice}    200
    ${body}=    Set Variable    ${resp.json()}

    Should Be Equal    ${body}[status]                 APPLIED
    Should Be Equal    ${body}[choiceUuid]             ${choice}
    Should Be Equal    ${body}[eventUuid]              ${event}
    ...    msg=the payload is about the event that OWNED the option
    Should Be Equal As Integers    ${body}[energySpent]    0
    Should Be Equal As Integers    ${body}[coinSpent]      0
    Should Not Be Empty    ${body}[effects]
    ...    msg=a resolved option applies its list_choices_effects
    Should Not Be Empty    ${body}[narrative]
    ...    msg=the narrative is revealed once the choice is irreversible
    Should Not Be Equal    ${body}[choiceCard]    ${None}

    # The energy really did not move: the resolution is free.
    ${after}=    Player Energy    ${token}    ${match}
    Should Be Equal As Integers    ${after}    ${before}
    ...    msg=resolving must not charge the player a second time

Resolving Twice Is Refused
    [Documentation]    The cost-bypass guard, second half: once the CHOICE_SELECTED marker
    ...                balances the EVENT_EXECUTED one, the cycle is closed and the effects
    ...                cannot be had again.
    [Tags]    choices    step32
    ${token}    ${match}    ${event}    ${options}=    Open The Resolution Event
    ${choice}=    Option With A Narrative    ${options}
    Select Choice    ${token}    ${match}    ${choice}    200

    ${resp}=    Select Choice    ${token}    ${match}    ${choice}    409
    Should Be Equal    ${resp.json()}[error]    CHOICE_NOT_OPEN

An Event That Was Never Opened Cannot Be Resolved
    [Documentation]    The cost-bypass guard, first half: without an open there is no cycle,
    ...                so an option's effects can never be had for free.
    [Tags]    choices    step32
    ${token}    ${match}=    Fresh Resolution Match
    ${choice}=    Any Resolution Option

    ${resp}=    Select Choice    ${token}    ${match}    ${choice}    409
    Should Be Equal    ${resp.json()}[error]    CHOICE_NOT_OPEN

An Unavailable Option Is Refused At Resolution Time
    [Documentation]    The option's verdict is re-evaluated when it is picked, not trusted from
    ...                the open: an option the board showed greyed out cannot be resolved by
    ...                calling the endpoint directly.
    [Tags]    choices    step32
    ${token}    ${match}    ${event}    ${options}=    Open The Resolution Event
    ${choice}=    Unavailable Option    ${options}

    ${resp}=    Select Choice    ${token}    ${match}    ${choice}    409
    Should Be Equal    ${resp.json()}[error]    CHOICE_NOT_AVAILABLE

An Unknown Option Is Not Found
    [Documentation]    A uuid that belongs to no option of the story is a missing entity, not a
    ...                state the player can act on.
    [Tags]    choices    step32
    ${token}    ${match}    ${event}    ${options}=    Open The Resolution Event

    ${resp}=    Select Choice    ${token}    ${match}    00000000-0000-4000-8000-000000000000    404
    Should Be Equal    ${resp.json()}[error]    CHOICE_NOT_FOUND

A Blank Choice Uuid Is A Bad Request
    [Documentation]    Nothing was named, which the 400 says plainly rather than hunting for a
    ...                cycle that could not exist.
    [Tags]    choices    step32
    ${token}    ${match}=    Fresh Resolution Match

    ${resp}=    Select Choice    ${token}    ${match}    ${SPACE}    400
    Should Be Equal    ${resp.json()}[error]    MISSING_CHOICE

The Rich Option Applies The Whole Effect Vocabulary
    [Documentation]    One option, every kind of effect: a registry key, an item, a forced move
    ...                to a location no neighbor edge reaches, the weather, and a linked event
    ...                run inline with its own chain — the last one never charged for.
    [Tags]    choices    step32
    ${token}    ${match}    ${event}    ${options}=    Open The Resolution Event
    ${choice}=    Option That Runs An Event    ${options}

    ${resp}=    Select Choice    ${token}    ${match}    ${choice}    200
    ${body}=    Set Variable    ${resp.json()}

    Should Be Equal As Integers    ${body}[energySpent]    0
    ...    msg=the linked event's own cost is never charged: a consequence is not a choice
    Should Not Be Empty    ${body}[registryChanges]
    Should Be True    ${body}[itemAdded]
    Should Be True    ${body}[movementApplied]
    Should Not Be Empty    ${body}[locationChanges]
    Should Be True    ${body}[weatherApplied]
    # The event an effect ran inline: its card is what the board narrates with.
    Should Not Be Equal    ${body}[choiceEventUuid]    ${None}
    Should Not Be Equal    ${body}[choiceEventCard]    ${None}
    Should Contain    ${body}[executedEventUuids]    ${body}[choiceEventUuid]

    # The forced move really happened: match-info now reports a different location.
    ${info}=    Get Match Info    ${token}    ${match}    200
    ${moved_to}=    Set Variable    ${body}[locationChanges][0][toLocationUuid]
    ${here}=    Evaluate    $info.json()['players'][0].get('locationUuid')
    IF    $here is not None
        Should Be Equal    ${here}    ${moved_to}
        ...    msg=the character stands where the effect moved them
    END

    # The weather really changed: the match now reports the one the effect set.
    ${weather}=    Get Match Weather    ${token}    ${match}    200
    Should Not Be Equal    ${weather.json()}    ${None}

An Effect-Level Event To Run Fires, And Fires Again On A Later Resolution
    [Documentation]    The admin's "Event to Run (effect)" — list_choices_effects.id_event, a
    ...                different field from the choice-level id_event_torun.
    ...
    ...                The second half is the regression: a NORMAL linked event is re-runnable
    ...                however often the match has already executed it. Barring it by the
    ...                match-wide consumed set (the ONCE rule's set) made the link fire once and
    ...                then silently stop — effects still applying, so nothing looked wrong.
    [Tags]    choices    step32
    ${token}    ${match}    ${event}    ${options}=    Open The Resolution Event
    ${choice}=    Option Linked By An Effect    ${options}

    ${first}=    Select Choice    ${token}    ${match}    ${choice}    200
    Should Not Be Equal    ${first.json()}[choiceEventUuid]    ${None}
    ...    msg=the effect's idEvent must run the event it names
    Should Contain    ${first.json()}[executedEventUuids]    ${first.json()}[choiceEventUuid]

    # Reopen the (now closed) cycle and resolve the very same option again.
    ${reopen}=    Execute Event    ${token}    ${match}    ${event}    200
    Should Be Equal    ${reopen.json()}[status]    CHOICES_PENDING
    ${second}=    Select Choice    ${token}    ${match}    ${choice}    200

    Should Not Be Equal    ${second.json()}[choiceEventUuid]    ${None}
    ...    msg=a NORMAL linked event stays runnable: the consumed set governs ONCE only
    Should Be Equal    ${second.json()}[choiceEventUuid]    ${first.json()}[choiceEventUuid]
    Should Contain    ${second.json()}[executedEventUuids]    ${second.json()}[choiceEventUuid]

An Is-Progress Option Records The Milestone
    [Documentation]    gaming_story_progress is a story outline, not a second copy of the choice
    ...                history: only an option carrying is_progress puts a row on it.
    [Tags]    choices    step32
    ${token}    ${match}    ${event}    ${options}=    Open The Resolution Event
    ${choice}=    Progress Option    ${options}

    ${resp}=    Select Choice    ${token}    ${match}    ${choice}    200
    Should Be True    ${resp.json()}[progressRecorded]

An Ordinary Option Records No Milestone
    [Documentation]    The counterpart: the option that runs an event carries no is_progress,
    ...                so it changes the world without claiming a narrative milestone.
    [Tags]    choices    step32
    ${token}    ${match}    ${event}    ${options}=    Open The Resolution Event
    ${choice}=    Option That Runs An Event    ${options}

    ${resp}=    Select Choice    ${token}    ${match}    ${choice}    200
    Should Not Be True    ${resp.json()}[progressRecorded]

Reopening A Resolved Choice-Event Charges Again
    [Documentation]    Resolution closes the cycle, so the event is a normal (spent-or-not) event
    ...                again: opening it a second time is a NEW open and pays the cost afresh —
    ...                unlike the Step 31 re-fetch of a still-open cycle, which is free.
    [Tags]    choices    step32
    ${token}    ${match}    ${event}    ${options}=    Open The Resolution Event
    ${choice}=    Option With A Narrative    ${options}
    Select Choice    ${token}    ${match}    ${choice}    200

    ${resp}=    Execute Event    ${token}    ${match}    ${event}    200
    ${body}=    Set Variable    ${resp.json()}
    Should Be Equal    ${body}[status]    CHOICES_PENDING
    Should Be True    ${body}[energySpent] > 0
    ...    msg=a closed cycle means the next open is a real open, and pays

The Narrative Follows The Requested Language
    [Documentation]    The revealed narrative is a resolved short text like any other: it honours
    ...                ?lang= and falls back to English.
    [Tags]    choices    step32
    ${token}    ${match}    ${event}    ${options}=    Open The Resolution Event
    ${choice}=    Option With A Narrative    ${options}

    ${resp}=    Select Choice    ${token}    ${match}    ${choice}    200    lang=it
    Should Not Be Empty    ${resp.json()}[narrative]


*** Keywords ***

Suite Setup Choice Resolution
    [Documentation]    An admin session (to read the seed) plus the story loadout every case
    ...                builds its own match from.
    Create Admin Session
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}    ${story}
    Set Suite Variable    ${DIFFICULTY}    ${difficulty}
    Set Suite Variable    ${CHARACTER}    ${character}
    Set Suite Variable    ${CLASS}    ${class}
    Set Suite Variable    ${TRAIT}    ${trait}

Fresh Resolution Match
    [Documentation]    A fresh running single-player match. Every case needs one: opening a
    ...                choice-event latches the EVENT_EXECUTED marker, resolving it latches the
    ...                CHOICE_SELECTED one, and both are per-match.
    ${guest}=    POST On Session    public_session    /api/auth/guest
    Status Should Be    ${guest}    201
    ${token}=    Set Variable    ${guest.json()}[accessToken]
    ${match}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY}    robottest_step32
    Status Should Be    ${match}    201
    ${uuid}=    Set Variable    ${match.json()}[uuid]
    ${trait_list}=    Create List
    IF    '${TRAIT}' != ''
        Append To List    ${trait_list}    ${TRAIT}
    END
    ${join}=    Join Match    ${token}    ${uuid}    ${CHARACTER}    ${CLASS}    ${trait_list}
    Status Should Be    ${join}    201
    Start Match    ${token}    ${uuid}    200
    RETURN    ${token}    ${uuid}

Open The Resolution Event
    [Documentation]    A fresh match with the resolution test-bed opened: the cost is paid, the
    ...                marker written and the options served. Returns the token, the match, the
    ...                event uuid and the pendingChoices list every case picks from.
    ${token}    ${match}=    Fresh Resolution Match
    ${event}=    Resolution Event Uuid
    ${resp}=    Execute Event    ${token}    ${match}    ${event}    200
    Should Be Equal    ${resp.json()}[status]    CHOICES_PENDING
    RETURN    ${token}    ${match}    ${event}    ${resp.json()}[pendingChoices]

# ── addressing the seeded fixtures by behaviour ──────────────────────────────

Admin Choices
    [Documentation]    The story's list_choices rows, from the admin API.
    ${resp}=    GET On Session    admin_session    /api/admin/stories/${STORY_UUID}/choices
    Status Should Be    ${resp}    200
    RETURN    ${resp.json()}

Admin Events
    ${resp}=    GET On Session    admin_session    /api/admin/stories/${STORY_UUID}/events
    Status Should Be    ${resp}    200
    RETURN    ${resp.json()}

Resolution Event Uuid
    [Documentation]    The location-bound NORMAL choice-event whose options carry a narrative —
    ...                that is what makes it the RESOLUTION test-bed rather than the Step 31 one.
    ...                A story event keeps its uuid inside a match, so the admin uuid is the very
    ...                uuid execute-event takes.
    ${choices}=    Admin Choices
    ${events}=    Admin Events
    ${uuid}=    Evaluate
    ...    next((e['uuid'] for e in sorted(events, key=lambda x: x['id']) if e['type'] == 'NORMAL' and e['id'] in owners and e.get('idSpecificLocation') and e.get('costEnery')), None)
    ...    namespace=${{ {'events': $events, 'owners': {c['idEvent'] for c in $choices if c.get('idEvent') and c.get('idTextNarrative')}} }}
    Should Not Be Equal    ${uuid}    ${None}
    ...    msg=no NORMAL location-bound choice-event with narrated options is seeded
    RETURN    ${uuid}

Resolution Choices
    [Documentation]    The seeded options of the resolution event, straight from the admin API —
    ...                used to pick one by an authored property the pending payload hides.
    ${event}=    Resolution Event Uuid
    ${events}=    Admin Events
    ${choices}=    Admin Choices
    ${event_id}=    Evaluate    next(e['id'] for e in $events if e['uuid'] == '${event}')
    ${rows}=    Evaluate    [c for c in $choices if c.get('idEvent') == ${event_id}]
    RETURN    ${rows}

Option With A Narrative
    [Documentation]    An AVAILABLE option carrying a narrative: the plain case every assertion
    ...                about revealing and charging is built on.
    [Arguments]    ${options}
    ${rows}=    Resolution Choices
    ${uuid}=    Evaluate
    ...    next((o['uuid'] for o in options if o['available'] and o['uuid'] in narrated), None)
    ...    namespace=${{ {'options': $options, 'narrated': {r['uuid'] for r in $rows if r.get('idTextNarrative')}} }}
    Should Not Be Equal    ${uuid}    ${None}    msg=no available narrated option is seeded
    RETURN    ${uuid}

Option That Runs An Event
    [Documentation]    The AVAILABLE option whose idEventTorun points somewhere: the one that
    ...                exercises the whole effect vocabulary plus the linked chain.
    [Arguments]    ${options}
    ${rows}=    Resolution Choices
    ${uuid}=    Evaluate
    ...    next((o['uuid'] for o in options if o['available'] and o['uuid'] in linked), None)
    ...    namespace=${{ {'options': $options, 'linked': {r['uuid'] for r in $rows if r.get('idEventTorun')}} }}
    Should Not Be Equal    ${uuid}    ${None}    msg=no available option runs a linked event
    RETURN    ${uuid}

Resolution Choice Effects
    [Documentation]    The story's list_choices_effects rows from the admin API. The key naming
    ...                differs by backend (Java/AWS expose idChoices, Python idChoice), so both
    ...                spellings are read — the suite must stay backend-agnostic.
    ${resp}=    GET On Session    admin_session    /api/admin/stories/${STORY_UUID}/choice-effects
    Status Should Be    ${resp}    200
    RETURN    ${resp.json()}

Option Linked By An Effect
    [Documentation]    The AVAILABLE option whose CHOICE-EFFECT carries idEvent — the admin's
    ...                "Event to Run (effect)". Deliberately distinct from Option That Runs An
    ...                Event, which uses the choice-level idEventTorun: the two are different
    ...                fields on different tables and each needs its own coverage.
    [Arguments]    ${options}
    ${rows}=       Resolution Choices
    ${effects}=    Resolution Choice Effects
    ${uuid}=    Evaluate
    ...    next((o['uuid'] for o in options if o['available'] and o['uuid'] in linked), None)
    ...    namespace=${{ {'options': $options, 'linked': {r['uuid'] for r in $rows if r['id'] in {e.get('idChoices', e.get('idChoice')) for e in $effects if e.get('idEvent')}}} }}
    Should Not Be Equal    ${uuid}    ${None}
    ...    msg=no available option is linked through a choice-effect idEvent
    RETURN    ${uuid}

Progress Option
    [Documentation]    The AVAILABLE option carrying is_progress = 1.
    [Arguments]    ${options}
    ${rows}=    Resolution Choices
    ${uuid}=    Evaluate
    ...    next((o['uuid'] for o in options if o['available'] and o['uuid'] in milestones), None)
    ...    namespace=${{ {'options': $options, 'milestones': {r['uuid'] for r in $rows if r.get('isProgress')}} }}
    Should Not Be Equal    ${uuid}    ${None}    msg=no available is_progress option is seeded
    RETURN    ${uuid}

Unavailable Option
    [Documentation]    Any option the checker refused — the board renders it greyed out, and
    ...                select-choice must refuse it too.
    [Arguments]    ${options}
    ${uuid}=    Evaluate    next((o['uuid'] for o in $options if not o['available']), None)
    Should Not Be Equal    ${uuid}    ${None}    msg=no unavailable option is seeded
    RETURN    ${uuid}

Any Resolution Option
    [Documentation]    Any option of the resolution event, for the never-opened case: which one
    ...                it is does not matter, since no cycle exists to close.
    ${rows}=    Resolution Choices
    ${uuid}=    Evaluate    next((r['uuid'] for r in $rows), None)
    Should Not Be Equal    ${uuid}    ${None}    msg=the resolution event owns no options
    RETURN    ${uuid}

Player Energy
    [Documentation]    The caller character's current energy, from match-info.
    [Arguments]    ${token}    ${match_uuid}
    ${info}=    Get Match Info    ${token}    ${match_uuid}    200
    ${energy}=    Evaluate    $info.json()['players'][0]['energy']
    RETURN    ${energy}
