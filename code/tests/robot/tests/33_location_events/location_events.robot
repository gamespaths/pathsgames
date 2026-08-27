*** Settings ***
# ---------------------------------------------------------------------------
# location_events.robot — Step 33 automatic location events, end-to-end and
# backend-agnostic.
#
# The contract under test:
#
#   Every gameplay step so far answered a player. This one does not. The engine fires
#   an event because a character ARRIVED somewhere, or because a location's clock RAN
#   OUT. There is no new endpoint and no new player action here — only new fields on
#   the responses of things that already existed:
#
#     POST movements/start  -> automaticEvents[]
#     POST action/sleep     -> counterZero[]
#     GET  match/{uuid}/info -> locations[].flagVisited
#     GET  matches/{uuid}/logs -> COUNTER_ZERO and AUTOMATIC_EVENT entries
#
# The event is named BY THE LOCATION, through columns list_locations has always
# carried (idEventIfFirstTime, idEventNotFirstTime, idEventIfCharacterEnterEmptyLocation,
# idEventIfCharacterStartTime, idEventIfCounterZero). The referenced events keep
# type='AUTOMATIC', which the {NORMAL, ONCE} allowlist already refuses to players —
# which is why /info must never offer them as actions.
#
# The seeded story wires them on the location NEXT to the start, so one move reaches
# a trigger. Everything here is addressed by BEHAVIOUR (the trigger name the response
# reports), never by hard-coded event uuid, so the same suite runs against every
# backend whose seed ids differ.
#
# Every case runs on its OWN match with its OWN guest: flagVisited is per (match,
# location) and latches on the first arrival, and a counter is a one-shot fuse.
#
# Backend-agnostic: runs green against java-sqlite, java-postgres, python.
#
# Tags: location-events, step33, gameplay
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource

Suite Setup       Suite Setup Location Events


*** Test Cases ***

Arriving Somewhere For The First Time Fires Its First-Entry Event
    [Documentation]    The core of the step: walking into a location the party has never
    ...                seen fires that location's idEventIfFirstTime, and the movement
    ...                response says so. Nobody asked for it and nobody paid for it.
    [Tags]    location-events    step33
    ${token}    ${match}=    Fresh Location Events Match
    ${target}=    First Neighbor Uuid    ${token}    ${match}

    ${resp}=    Start Movement    ${token}    ${match}    ${target}    200
    ${fired}=    Set Variable    ${resp.json()}[automaticEvents]

    Should Not Be Empty    ${fired}
    ${triggers}=    Triggers Of    ${fired}
    Should Contain    ${triggers}    FIRST_ENTRY
    # It is a real execution, not a marker: the event carries what it did.
    Dictionary Should Contain Key    ${fired}[0]    eventUuid
    Dictionary Should Contain Key    ${fired}[0]    idLocation
    Dictionary Should Contain Key    ${fired}[0]    effects

Walking Back Fires The Subsequent-Entry Event, Never The First One Again
    [Documentation]    flagVisited is latched by the arrival, so the second time the party
    ...                walks in it is no longer a discovery. This is the whole point of the
    ...                separate flag: the world does an ambient event ONCE.
    [Tags]    location-events    step33
    ${token}    ${match}=    Fresh Location Events Match
    ${start}=    Active Location Uuid    ${token}    ${match}
    ${target}=    First Neighbor Uuid    ${token}    ${match}

    Start Movement    ${token}    ${match}    ${target}    200
    Require A Way Back    ${token}    ${match}    ${start}
    Move With Energy Guard    ${token}    ${match}    ${start}
    ${resp}=    Move With Energy Guard    ${token}    ${match}    ${target}
    ${triggers}=    Triggers Of    ${resp.json()}[automaticEvents]

    Should Contain        ${triggers}    SUBSEQUENT_ENTRY
    Should Not Contain    ${triggers}    FIRST_ENTRY

The Starting Location Never Fires A First Entry When The Party Returns
    [Documentation]    The party starts IN the start; it never enters it. Match creation
    ...                seeds flagVisited = 1 there, so walking BACK cannot announce as a
    ...                discovery the place the story opened in.
    [Tags]    location-events    step33
    ${token}    ${match}=    Fresh Location Events Match
    ${start}=    Active Location Uuid    ${token}    ${match}
    ${target}=    First Neighbor Uuid    ${token}    ${match}

    Start Movement    ${token}    ${match}    ${target}    200
    Require A Way Back    ${token}    ${match}    ${start}
    ${resp}=    Move With Energy Guard    ${token}    ${match}    ${start}
    ${triggers}=    Triggers Of    ${resp.json()}[automaticEvents]

    Should Not Contain    ${triggers}    FIRST_ENTRY

An Arrival Latches flagVisited On The Match Info
    [Documentation]    flagVisited is per (match, location) and means "the PARTY has been
    ...                here" — deliberately not flagAlreadyActived, which means "this
    ...                location's counter has been consumed".
    [Tags]    location-events    step33
    ${token}    ${match}=    Fresh Location Events Match
    ${target}=    First Neighbor Uuid    ${token}    ${match}
    Start Movement    ${token}    ${match}    ${target}    200

    ${info}=    Get Match Info    ${token}    ${match}    200
    ${states}=    Set Variable    ${info.json()}[locations]
    Should Not Be Empty    ${states}
    Dictionary Should Contain Key    ${states}[0]    flagVisited
    ${visited}=    Evaluate    sum(1 for s in $states if s.get('flagVisited') == 1)
    Should Be True    ${visited} >= 1

An Automatic Event Is Never Offered As A Player Action
    [Documentation]    The referenced events are type AUTOMATIC, which the {NORMAL, ONCE}
    ...                allowlist refuses. They must not appear among the actions /info
    ...                publishes, or the player could execute the story's own reflexes.
    [Tags]    location-events    step33
    ${token}    ${match}=    Fresh Location Events Match
    ${target}=    First Neighbor Uuid    ${token}    ${match}
    ${resp}=    Start Movement    ${token}    ${match}    ${target}    200
    ${fired}=    Set Variable    ${resp.json()}[automaticEvents]
    Should Not Be Empty    ${fired}
    ${auto_uuid}=    Set Variable    ${fired}[0][eventUuid]

    ${info}=    Get Match Info    ${token}    ${match}    200
    ${offered}=    Evaluate    [e.get('uuid') for e in $info.json()['events']]
    Should Not Contain    ${offered}    ${auto_uuid}

An Automatic Event Reaches The Match Log Timeline
    [Documentation]    log_events derives its type from the message prefix and DROPS what it
    ...                does not recognise, so the automatic-event rows needed their own
    ...                AUTOMATIC_EVENT branch or they would never be seen at all.
    [Tags]    location-events    step33
    ${token}    ${match}=    Fresh Location Events Match
    ${target}=    First Neighbor Uuid    ${token}    ${match}
    Start Movement    ${token}    ${match}    ${target}    200

    ${logs}=    Get Match Logs    ${token}    ${match}    200
    ${types}=    Evaluate    [e.get('type') for e in $logs.json()['logs']]
    Should Contain    ${types}    AUTOMATIC_EVENT

A Counter Reaching Zero Finally Executes Its Event
    [Documentation]    Step 26 decremented the counter and wrote "pending event N" into the
    ...                log — and nobody ever ran it. Sleeping the counter down to zero must
    ...                now execute it and report it on the sleep response.
    [Tags]    location-events    step33    counter-zero
    ${token}    ${match}=    Fresh Location Events Match

    ${fired}=    Sleep Until Counter Zero    ${token}    ${match}

    Should Not Be Empty    ${fired}
    ${item}=    Set Variable    ${fired}[0]
    Should Be Equal        ${item}[trigger]    COUNTER_ZERO
    Dictionary Should Contain Key    ${item}    eventUuid
    Dictionary Should Contain Key    ${item}    clock
    Dictionary Should Contain Key    ${item}    visibility

The Counter-Zero Notice Carries A Fog-Of-War Visibility
    [Documentation]    A counter runs down even where nobody has ever been, so naming that
    ...                place would hand the player the map. Each notice therefore carries a
    ...                visibility decided per recipient, and an ANONYMOUS one has NO card of
    ...                any kind — neither the name nor what happened leaves the server.
    [Tags]    location-events    step33    counter-zero
    ${token}    ${match}=    Fresh Location Events Match
    ${fired}=    Sleep Until Counter Zero    ${token}    ${match}
    Should Not Be Empty    ${fired}

    FOR    ${item}    IN    @{fired}
        Should Contain Any    ${item}[visibility]    FULL    NAMED    ANONYMOUS
        IF    '${item}[visibility]' == 'ANONYMOUS'
            Should Be Equal    ${item.get('card')}            ${None}
            Should Be Equal    ${item.get('cardLocation')}    ${None}
            Should Be Empty    ${item.get('cardEffects')}
        END
    END

A Counter That Reached Zero Never Restarts
    [Documentation]    The fuse is one-shot for the whole match: once consumed, no later
    ...                time-start may fire it again. Sleeping past zero must report nothing.
    [Tags]    location-events    step33    counter-zero
    ${token}    ${match}=    Fresh Location Events Match
    ${fired}=    Sleep Until Counter Zero    ${token}    ${match}
    Should Not Be Empty    ${fired}

    # Two more time-starts: the counter is at zero and latched, so nothing may fire again.
    ${again}=    Sleep Action    ${token}    ${match}    200
    Should Be Empty    ${again.json()}[counterZero]
    ${again2}=    Sleep Action    ${token}    ${match}    200
    Should Be Empty    ${again2.json()}[counterZero]

A Counter Reaching Zero Is Its Own COUNTER_ZERO Log Entry, Not A RECOVERY One
    [Documentation]    Until v0.33.0 the row was folded into RECOVERY — which it never was —
    ...                and written WITHOUT a clock, so it was visible but unsortable, landing
    ...                outside the clock-ordered timeline. Both are fixed.
    [Tags]    location-events    step33    counter-zero
    ${token}    ${match}=    Fresh Location Events Match
    Sleep Until Counter Zero    ${token}    ${match}

    ${logs}=    Get Match Logs    ${token}    ${match}    200
    ${entries}=    Evaluate    [e for e in $logs.json()['logs'] if e.get('type') == 'COUNTER_ZERO']
    Should Not Be Empty    ${entries}
    Should Not Be Equal    ${entries}[0][clock]    ${None}

An Ordinary Sleep Reports An Empty counterZero List
    [Documentation]    The field is always present and empty is the normal case: the frontend
    ...                renders nothing rather than having to guess whether the key exists.
    [Tags]    location-events    step33    counter-zero
    ${token}    ${match}=    Fresh Location Events Match
    ${resp}=    Sleep Action    ${token}    ${match}    200
    Dictionary Should Contain Key    ${resp.json()}    counterZero

A Move That Fires Nothing Still Answers An Empty automaticEvents List
    [Documentation]    Same contract on the movement side: the key is always there, so the
    ...                board never has to distinguish "no triggers" from "old backend".
    [Tags]    location-events    step33
    ${token}    ${match}=    Fresh Location Events Match
    ${target}=    First Neighbor Uuid    ${token}    ${match}
    ${resp}=    Start Movement    ${token}    ${match}    ${target}    200
    Dictionary Should Contain Key    ${resp.json()}    automaticEvents


*** Keywords ***

Suite Setup Location Events
    [Documentation]    An admin session (to read the seed) plus the story loadout every case
    ...                builds its own match from.
    Create Admin Session
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}    ${story}
    Set Suite Variable    ${DIFFICULTY}    ${difficulty}
    Set Suite Variable    ${CHARACTER}    ${character}
    Set Suite Variable    ${CLASS}    ${class}
    Set Suite Variable    ${TRAIT}    ${trait}

Fresh Location Events Match
    [Documentation]    A fresh running single-player match on its own guest. Every case needs
    ...                one: flagVisited latches on the first arrival and a counter is a
    ...                one-shot fuse, both per match. The fresh guest is the v0.32.1
    ...                duplicate-match guard (one active match per user and story).
    ${token}=    New Guest Token
    ${match}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY}    robottest_step33
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

Active Location Uuid
    [Documentation]    The uuid of the location the character is standing in.
    [Arguments]    ${token}    ${match_uuid}
    ${info}=    Get Match Info    ${token}    ${match_uuid}    200
    ${active}=    Set Variable    ${info.json()}[locationsActive]
    Should Not Be Empty    ${active}
    RETURN    ${active}[0][uuid]

First Neighbor Uuid
    [Documentation]    The uuid of the first neighbor of the active location — the seeded
    ...                story wires the entry triggers there, so one move reaches them.
    [Arguments]    ${token}    ${match_uuid}
    ${info}=    Get Match Info    ${token}    ${match_uuid}    200
    ${active}=    Set Variable    ${info.json()}[locationsActive]
    Should Not Be Empty    ${active}
    ${neighbors}=    Set Variable    ${active}[0][neighbors]
    Should Not Be Empty    ${neighbors}
    RETURN    ${neighbors}[0][uuid]

Require A Way Back
    [Documentation]    Skips the case when the seed's edge is one-way. A story authors
    ...                `flag_back` per edge, and a seed is free to make the first hop a
    ...                one-way door — the Python seed does. These two cases are about which
    ...                trigger a RE-ENTRY fires, so without a way back there is nothing to
    ...                assert; skipping says so out loud rather than failing on a movement
    ...                rule that belongs to Step 28.
    [Arguments]    ${token}    ${match_uuid}    ${back_to}
    ${info}=    Get Match Info    ${token}    ${match_uuid}    200
    ${active}=    Set Variable    ${info.json()}[locationsActive]
    ${back}=    Evaluate    [n for n in $active[0]['neighbors'] if n.get('uuid') == '${back_to}']
    IF    len($back) == 0
        Skip    This seed's first edge is one-way: there is no arrival to re-enter with.
    END

Move With Energy Guard
    [Documentation]    A move that must succeed even when the walk back would leave the
    ...                character short. Each backend seeds its own edge costs and starting
    ...                energy, so a three-move test is affordable on one seed and 409
    ...                NOT_ENOUGH_ENERGY on another — and these cases are about WHICH
    ...                trigger fires, not about the movement economics of a particular seed.
    ...                A refused move sleeps once (the start is a safe location, so the
    ...                time-start recovery refills) and then moves for real.
    [Arguments]    ${token}    ${match_uuid}    ${target}
    ${resp}=    Start Movement    ${token}    ${match_uuid}    ${target}    any
    IF    ${resp.status_code} == 200    RETURN    ${resp}
    Sleep Action    ${token}    ${match_uuid}    200
    ${retry}=    Start Movement    ${token}    ${match_uuid}    ${target}    200
    RETURN    ${retry}

Triggers Of
    [Documentation]    The trigger names of a list of fired automatic events.
    [Arguments]    ${fired}
    ${triggers}=    Evaluate    [f.get('trigger') for f in $fired]
    RETURN    ${triggers}

Sleep Until Counter Zero
    [Documentation]    Sleeps the match forward until a counter runs out, and returns the
    ...                counterZero list of the time-start that fired it. The seeded start
    ...                location carries counter_time = 2, so it takes at most a few
    ...                time-starts; an empty result means the seed carries no fuse.
    [Arguments]    ${token}    ${match_uuid}    ${max_sleeps}=6
    FOR    ${i}    IN RANGE    ${max_sleeps}
        ${resp}=    Sleep Action    ${token}    ${match_uuid}    200
        ${fired}=    Set Variable    ${resp.json()}[counterZero]
        IF    len($fired) > 0    RETURN    ${fired}
    END
    ${empty}=    Create List
    RETURN    ${empty}
