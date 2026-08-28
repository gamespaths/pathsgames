*** Settings ***
# ---------------------------------------------------------------------------
# entry_triggers.robot — v0.33.2, the two location triggers nothing tested end-to-end.
#
# location_events.robot already owns the HISTORY axis (idEventIfFirstTime ->
# FIRST_ENTRY, idEventNotFirstTime -> SUBSEQUENT_ENTRY) and the whole counter-zero
# branch. Two columns were never asserted by any suite:
#
#   idEventIfCharacterEnterEmptyLocation -> MOVE_INTO_EMPTY_LOCATION
#   idEventIfCharacterStartTime          -> CHARACTER_START_TIME
#
# They are different axes and that is the point of the v0.33.2 rename:
#
#   HISTORY    — has the PARTY ever been here? gaming_state_locations.flag_visited,
#                per (match, location), latched on arrival. Fires once.
#   OCCUPANCY  — did the arriving character find NOBODY ELSE here?
#                countOtherCharactersAtLocation(...) == 0, evaluated at the arrival.
#                Orthogonal: it rides alongside FIRST_ENTRY *or* SUBSEQUENT_ENTRY, and
#                it can fire on every single visit. In singleplayer it always does,
#                which is precisely why the old name (…EnterFirstTime) was wrong.
#   TIME START — a time unit began with the character standing here. Reported on the
#                sleep that advanced the clock, in counterZero[], not on a movement.
#
# Single-player is a legitimate reading of the occupancy trigger, not a degenerate one:
# "the room is empty" is simply always true. The multiplayer case (a second character
# arriving does NOT fire it) needs two joined players and is left to a later suite.
#
# Backend-agnostic: nothing is addressed by seeded id or uuid. The suite walks the
# neighbour graph outward from the start and reads the trigger names the responses
# report, so it runs against every backend whose seed ids differ.
#
# Tags: location-events, step33, entry-triggers
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource

Suite Setup       Suite Setup Entry Triggers


*** Test Cases ***

Walking Into An Empty Location Fires Its Occupancy Event
    [Documentation]    The trigger nothing covered end-to-end. Somewhere along the seeded
    ...                chain a location authors idEventIfCharacterEnterEmptyLocation, and
    ...                arriving there alone must report MOVE_INTO_EMPTY_LOCATION.
    [Tags]    location-events    step33    entry-triggers
    ${token}    ${match}=    Fresh Entry Triggers Match

    ${triggers}=    Walk Outward Collecting Triggers    ${token}    ${match}    4

    Should Contain    ${triggers}    MOVE_INTO_EMPTY_LOCATION

The Occupancy Trigger Is Not A First-Time Trigger
    [Documentation]    The whole reason for the v0.33.2 rename. FIRST_ENTRY is latched by
    ...                flagVisited and never fires twice; the occupancy one is re-evaluated
    ...                at every arrival, so walking out and back into an empty location must
    ...                fire it AGAIN — alongside SUBSEQUENT_ENTRY, never FIRST_ENTRY.
    [Tags]    location-events    step33    entry-triggers
    ${token}    ${match}=    Fresh Entry Triggers Match
    ${from}    ${to}=    Reach A Location Firing    ${token}    ${match}    MOVE_INTO_EMPTY_LOCATION    4

    # Out and back in. The room is still empty: nobody else exists in a single-player match.
    Require A Way Back    ${token}    ${match}    ${from}
    Move With Energy Guard    ${token}    ${match}    ${from}
    ${resp}=    Move With Energy Guard    ${token}    ${match}    ${to}
    ${again}=    Triggers Of    ${resp.json()}[automaticEvents]

    Should Contain        ${again}    MOVE_INTO_EMPTY_LOCATION
    Should Not Contain    ${again}    FIRST_ENTRY

A Time Start Fires The Event Of The Location The Character Stands In
    [Documentation]    idEventIfCharacterStartTime is the only entry-side trigger that is not
    ...                an arrival: it fires when a time unit BEGINS with the character here,
    ...                so it is reported on the sleep that advanced the clock — in
    ...                counterZero[], next to the counter fuses, not on a movement.
    [Tags]    location-events    step33    entry-triggers
    ${token}    ${match}=    Fresh Entry Triggers Match

    ${triggers}=    Walk And Sleep Collecting Trigger    ${token}    ${match}    CHARACTER_START_TIME    5

    Should Contain    ${triggers}    CHARACTER_START_TIME

An Arrival Reports Every Trigger It Fired, Not Just The First
    [Documentation]    History and occupancy are orthogonal: the engine runs both on the same
    ...                arrival when the location authors both, and the response carries a LIST
    ...                — the board chains them behind its forward arrow. Whatever the seed
    ...                wires, no arrival may report a trigger twice.
    [Tags]    location-events    step33    entry-triggers
    ${token}    ${match}=    Fresh Entry Triggers Match
    ${triggers}=    Walk Outward Collecting Triggers    ${token}    ${match}    4

    Should Not Be Empty    ${triggers}
    FOR    ${trigger}    IN    @{triggers}
        Should Contain Any    ${trigger}    FIRST_ENTRY    SUBSEQUENT_ENTRY
        ...    MOVE_INTO_EMPTY_LOCATION
    END


A Move And A Sleep Both Answer A Step 30 Edge State
    [Documentation]    v0.35.6 — an arrival kills exactly as an executed event does, and so
    ...                can a time-start. Both answers carry the SAME object execute-event
    ...                carries, so the board has one code path for a collapse however it
    ...                happened. On a quiet move and a quiet sleep every field is empty —
    ...                present and empty, never absent, or the board would read a missing
    ...                key as "nothing happened" and be right by accident.
    [Tags]    location-events    step33    step30    edge
    ${token}    ${match}=    Fresh Entry Triggers Match
    ${seen}=    Create List
    ${to}=      Unvisited Neighbor Uuid    ${token}    ${match}    ${seen}
    Should Not Be Equal    ${to}    ${EMPTY}    msg=the start location has no neighbour to walk into

    ${moved}=    Move With Energy Guard    ${token}    ${match}    ${to}
    Edge State Should Be Well Formed    ${moved.json()}[edgeState]

    ${slept}=    Sleep Action    ${token}    ${match}    200
    Edge State Should Be Well Formed    ${slept.json()}[edgeState]


*** Keywords ***

Edge State Should Be Well Formed
    [Documentation]    The seven fields of a Step 30 verdict, in the shape execute-event
    ...                answers. A character who fell into a coma is named in comaUuids; on
    ...                the ordinary move and sleep this suite makes, nobody has.
    [Arguments]    ${edge}
    FOR    ${key}    IN    sadnessOverflowUuids    comaUuids    allPlayersInComa
    ...    comaEventUuid    comaEventCard    comaExecutedEventUuids    comaEffects
        Dictionary Should Contain Key    ${edge}    ${key}
    END
    Should Be True    isinstance($edge['comaUuids'], list)
    Should Be True    isinstance($edge['allPlayersInComa'], bool)

Suite Setup Entry Triggers
    [Documentation]    An admin session (to read the seed) plus the story loadout every case
    ...                builds its own match from.
    Create Admin Session
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}    ${story}
    Set Suite Variable    ${DIFFICULTY}    ${difficulty}
    Set Suite Variable    ${CHARACTER}    ${character}
    Set Suite Variable    ${CLASS}    ${class}
    Set Suite Variable    ${TRAIT}    ${trait}

Fresh Entry Triggers Match
    [Documentation]    A fresh running single-player match on its own guest: flagVisited
    ...                latches per (match, location), so a walked graph cannot be reused. The
    ...                fresh guest is the v0.32.1 duplicate-match guard.
    ${token}=    New Guest Token
    ${match}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY}    robottest_step332
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

Unvisited Neighbor Uuid
    [Documentation]    A neighbour of the active location the party has not walked into yet,
    ...                so the walk goes OUTWARD instead of bouncing between two rooms. Empty
    ...                string when the chain is exhausted.
    [Arguments]    ${token}    ${match_uuid}    ${seen}
    ${info}=    Get Match Info    ${token}    ${match_uuid}    200
    ${active}=    Set Variable    ${info.json()}[locationsActive]
    Should Not Be Empty    ${active}
    FOR    ${neighbor}    IN    @{active}[0][neighbors]
        ${already}=    Evaluate    $neighbor['uuid'] in $seen
        IF    not ${already}    RETURN    ${neighbor}[uuid]
    END
    RETURN    ${EMPTY}

Move With Energy Guard
    [Documentation]    Moves, and when the move is refused sleeps once and retries: the walk
    ...                crosses several locations and energy runs down on the way.
    [Arguments]    ${token}    ${match_uuid}    ${target}
    ${resp}=    Start Movement    ${token}    ${match_uuid}    ${target}    any
    IF    ${resp.status_code} == 200    RETURN    ${resp}
    Sleep Action    ${token}    ${match_uuid}    200
    ${retry}=    Start Movement    ${token}    ${match_uuid}    ${target}    200
    RETURN    ${retry}

Require A Way Back
    [Documentation]    Skips the case when the seeded graph offers no return edge — the walk
    ...                back is the premise, not the assertion.
    [Arguments]    ${token}    ${match_uuid}    ${target}
    ${info}=    Get Match Info    ${token}    ${match_uuid}    200
    ${active}=    Set Variable    ${info.json()}[locationsActive]
    ${uuids}=    Evaluate    [n['uuid'] for n in $active[0]['neighbors']]
    IF    $target not in $uuids
        Skip    The seeded graph has no edge back to the previous location
    END

Triggers Of
    [Documentation]    The trigger names of a list of fired automatic events.
    [Arguments]    ${fired}
    ${triggers}=    Evaluate    [f.get('trigger') for f in $fired]
    RETURN    ${triggers}

Walk Outward Collecting Triggers
    [Documentation]    Walks up to ${hops} locations away from the start, always into a
    ...                neighbour never entered before, and returns every trigger the moves
    ...                reported. Addressed by behaviour: no seeded uuid is assumed.
    [Arguments]    ${token}    ${match_uuid}    ${hops}=4
    ${seen}=    Create List
    ${start}=    Active Location Uuid    ${token}    ${match_uuid}
    Append To List    ${seen}    ${start}
    ${all}=    Create List
    FOR    ${i}    IN RANGE    ${hops}
        ${target}=    Unvisited Neighbor Uuid    ${token}    ${match_uuid}    ${seen}
        IF    '${target}' == '${EMPTY}'    BREAK
        Append To List    ${seen}    ${target}
        ${resp}=    Move With Energy Guard    ${token}    ${match_uuid}    ${target}
        ${fired}=    Triggers Of    ${resp.json()}[automaticEvents]
        Append To List    ${all}    @{fired}
    END
    RETURN    ${all}

Reach A Location Firing
    [Documentation]    Walks outward until an arrival reports ${trigger}, and returns the
    ...                location walked FROM and the one walked INTO — the pair the "walk out
    ...                and back in" case needs. Fails when the seed wires no such location.
    [Arguments]    ${token}    ${match_uuid}    ${trigger}    ${hops}=4
    ${seen}=    Create List
    ${here}=    Active Location Uuid    ${token}    ${match_uuid}
    Append To List    ${seen}    ${here}
    FOR    ${i}    IN RANGE    ${hops}
        ${target}=    Unvisited Neighbor Uuid    ${token}    ${match_uuid}    ${seen}
        IF    '${target}' == '${EMPTY}'    BREAK
        Append To List    ${seen}    ${target}
        ${resp}=    Move With Energy Guard    ${token}    ${match_uuid}    ${target}
        ${fired}=    Triggers Of    ${resp.json()}[automaticEvents]
        ${hit}=    Evaluate    '${trigger}' in $fired
        IF    ${hit}    RETURN    ${here}    ${target}
        ${here}=    Set Variable    ${target}
    END
    Fail    No location within ${hops} hops fires ${trigger} in this seed

Walk And Sleep Collecting Trigger
    [Documentation]    Sleeps where the character stands, and when nothing fires walks one
    ...                location further out and sleeps again — up to ${stops} places.
    ...
    ...                The time-start trigger belongs to a LOCATION, and which location the
    ...                seed puts it on is a seed's business: walking a fixed number of hops
    ...                first and only then sleeping tests the seed's graph, not the engine.
    ...                Sleeping at every stop finds the trigger wherever it was authored,
    ...                which is what "backend-agnostic" has to mean here. Returns every
    ...                counterZero trigger collected on the way — a counter fuse burning
    ...                down elsewhere rides in the same list and is not an error.
    [Arguments]    ${token}    ${match_uuid}    ${trigger}    ${stops}=5
    ${seen}=    Create List
    ${here}=    Active Location Uuid    ${token}    ${match_uuid}
    Append To List    ${seen}    ${here}
    ${all}=    Create List
    FOR    ${i}    IN RANGE    ${stops}
        ${resp}=    Sleep Action    ${token}    ${match_uuid}    200
        ${fired}=    Triggers Of    ${resp.json()}[counterZero]
        Append To List    ${all}    @{fired}
        ${hit}=    Evaluate    '${trigger}' in $all
        IF    ${hit}    RETURN    ${all}
        ${target}=    Unvisited Neighbor Uuid    ${token}    ${match_uuid}    ${seen}
        IF    '${target}' == '${EMPTY}'    BREAK
        Append To List    ${seen}    ${target}
        Move With Energy Guard    ${token}    ${match_uuid}    ${target}
    END
    RETURN    ${all}
