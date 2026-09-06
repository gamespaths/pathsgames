*** Settings ***
# ---------------------------------------------------------------------------
# forced_move.robot — v0.36.3, an event effect that MOVES the character.
#
# Forced movement is v0.29.3 and has been tested since (29_events teleports with an
# ordinary event). What was never tested is the two things that happen AROUND the move,
# and both of them were broken:
#
#   1. An event that moves the actor AND ends the time unit (flag_end_time = 1). The time
#      start re-reads the roster and writes it back; on AWS that read is eventually
#      consistent, so it handed back the character as they were BEFORE the move and wrote
#      that row on top — the player executed the event, saw the response say
#      movementApplied, and stayed exactly where they were.
#   2. The ARRIVAL a forced move produces. Walking in fires the destination's entry
#      triggers (Step 33); being pushed in is the same arrival, and java and python have
#      drained it since. execute-event on AWS never did, and neither AWS nor python
#      carried the fired events in the response, so a board reading `automaticEvents`
#      found the key missing.
#
# The fixture is the seeded "bell": the only event of the story that BOTH ends the time
# unit and carries an effect with an idLocation. It is found by that behaviour, never by a
# seeded uuid, so the suite runs unchanged on java-sqlite, java-postgres, python and aws.
# It deliberately does not live at the start location — a suite picking "any available
# event" there must not be able to trip over it.
#
# Endpoints under test:
#   POST /api/gameplay/{uuid}/action/execute-event
#   POST /api/gameplay/{uuid}/movements/start
#   GET  /api/match/{uuid}/info
#   GET  /api/matches/{uuid}/logs
#
# Every case runs on its own guest and its own match: the move strands the character and
# the arrival latches flagVisited.
#
# Tags: events, movement, step29, step33, v0363
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource

Suite Setup    Suite Setup Forced Move


*** Test Cases ***

The Bell Fixture Is The One The Suite Thinks It Is
    [Documentation]    Asserted first, so a seed that lost the fixture fails here and not as
    ...                four unreadable failures below. The event must end the time unit, move
    ...                somebody, and move them somewhere that answers an arrival — otherwise
    ...                the cases that follow prove nothing.
    [Tags]    events    movement    v0363
    Should Be True    ${BELL_END_TIME}
    ...    msg=the fixture event must carry flagEndTime — that is half of what is under test
    Should Not Be Equal As Integers    ${BELL_LOCATION_ID}    ${TARGET_LOCATION_ID}
    ...    msg=an effect moving somebody to where they already stand moves nobody
    Should Not Be Equal    ${TARGET_FIRST_ENTRY}    ${None}
    ...    msg=the destination must declare a first-entry event, or no arrival can fire

An Event That Ends The Time Unit Still Moves The Character
    [Documentation]    The regression. The response has always said movementApplied; what is
    ...                asserted here is where the character actually IS afterwards, read back
    ...                from match-info rather than believed from the answer.
    [Tags]    events    movement    v0363
    ${token}    ${match}=    Fresh Bell Match

    ${response}=    Ring The Bell    ${token}    ${match}
    ${body}=    Set Variable    ${response.json()}
    Should Be True    ${body}[movementApplied]
    Should Be True    ${body}[timeEnded]
    ...    msg=the fixture is the event that does both; without the time end this proves nothing

    ${info}=    Get Match Info    ${token}    ${match}    200
    Should Be Equal As Integers    ${info.json()}[currentLocationId]    ${TARGET_LOCATION_ID}
    ...    msg=the time start wrote the character back where they stood before the move

The Move Survives On The Timeline Too
    [Documentation]    A cost-0 MOVEMENT row is what makes the fog of war and the logs agree
    ...                with the character row. If the move was undone, the two disagree.
    [Tags]    events    movement    v0363
    ${token}    ${match}=    Fresh Bell Match
    Ring The Bell    ${token}    ${match}

    ${logs}=    Get Match Logs    ${token}    ${match}    200
    ${rows}=    Set Variable    ${logs.json()}[logs]
    ${moves}=    Evaluate    [e for e in $rows if e.get('type') == 'MOVEMENT' and str(e.get('idLocationTo')) == '${TARGET_LOCATION_ID}']
    Should Not Be Empty    ${moves}    msg=the forced move left no MOVEMENT row behind
    Should Be Equal As Integers    ${moves}[-1][energyCost]    0
    ...    msg=a forced move is free — only the event's own cost is charged

A Forced Move Fires The Destination Entry Trigger
    [Documentation]    Step 33 — being pushed into a place is arriving there. java and python
    ...                drained these arrivals; AWS execute-event never resolved its own, so
    ...                the destination stayed silent about a character standing in it.
    [Tags]    events    movement    step33    v0363
    ${token}    ${match}=    Fresh Bell Match

    ${response}=    Ring The Bell    ${token}    ${match}
    ${fired}=    Set Variable    ${response.json()}[automaticEvents]
    Should Not Be Empty    ${fired}
    ...    msg=the arrival the move produced fired nothing
    ${here}=    Evaluate
    ...    [f for f in $fired if str(f.get('idLocation')) == '${TARGET_LOCATION_ID}']
    Should Not Be Empty    ${here}    msg=nothing fired at the destination of the move
    Should Be Equal As Strings    ${here}[0][trigger]    FIRST_ENTRY
    ...    msg=the first arrival must take the first-entry branch, never the later one

Every Execution Answers With The Automatic Events List
    [Documentation]    Empty is the normal case, and the board must not have to tell it from
    ...                a backend too old to send the key at all.
    [Tags]    events    step33    v0363
    ${token}    ${match}=    Fresh Bell Match
    ${uuid}=    Any Available Event Uuid At The Start Location    ${token}    ${match}

    ${response}=    Execute Event    ${token}    ${match}    ${uuid}    200
    Dictionary Should Contain Key    ${response.json()}    automaticEvents
    ...    msg=execute-event must always carry automaticEvents, even when nothing fired


*** Keywords ***

Suite Setup Forced Move
    [Documentation]    The loadout every case builds its own match from, plus the seeded bell
    ...                — the event that ends the time unit AND moves somebody — discovered
    ...                from the story's own rows.
    Create Admin Session
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}    ${story}
    Set Suite Variable    ${DIFFICULTY}    ${difficulty}
    Set Suite Variable    ${CHARACTER}    ${character}
    Set Suite Variable    ${CLASS}    ${class}
    Set Suite Variable    ${TRAIT}    ${trait}

    ${uuid}    ${from_id}    ${to_id}    ${end_time}=    Bell Event
    Set Suite Variable    ${BELL_EVENT}    ${uuid}
    Set Suite Variable    ${BELL_LOCATION_ID}    ${from_id}
    Set Suite Variable    ${TARGET_LOCATION_ID}    ${to_id}
    Set Suite Variable    ${BELL_END_TIME}    ${end_time}

    ${first_entry}    ${target_uuid}=    Entry Trigger Of    ${to_id}
    Set Suite Variable    ${TARGET_FIRST_ENTRY}    ${first_entry}
    Set Suite Variable    ${TARGET_LOCATION_UUID}    ${target_uuid}

Bell Event
    [Documentation]    (uuid, owning location id, destination id, flagEndTime) of the event
    ...                whose effect carries an idLocation and which also ends the time unit.
    ...                Behaviour, never a seeded uuid.
    ${effects}=    Story Rows    event-effects
    ${events}=     Story Rows    events
    FOR    ${effect}    IN    @{effects}
        IF    not $effect.get('idLocation')    CONTINUE
        FOR    ${event}    IN    @{events}
            ${is_owner}=    Evaluate
            ...    $event.get('id') == $effect.get('idEvent') and bool($event.get('flagEndTime'))
            IF    ${is_owner}
                RETURN    ${event}[uuid]    ${event}[idSpecificLocation]
                ...       ${effect}[idLocation]    ${True}
            END
        END
    END
    Fail    no seeded event both ends the time unit and moves somebody (v0.36.3 fixture)

Entry Trigger Of
    [Documentation]    (idEventIfFirstTime, uuid) of one location, by its story-local id.
    [Arguments]    ${id_location}
    ${locations}=    Story Rows    locations
    FOR    ${location}    IN    @{locations}
        IF    str($location.get('id')) == '${id_location}'
            RETURN    ${location.get('idEventIfFirstTime')}    ${location}[uuid]
        END
    END
    Fail    the story has no location ${id_location}

Story Rows
    [Documentation]    The admin rows of one entity type of the suite's story.
    [Arguments]    ${entity_type}
    ${response}=    GET On Session    admin_session
    ...    /api/admin/stories/${STORY_UUID}/${entity_type}
    Status Should Be    ${response}    200
    RETURN    ${response.json()}

Fresh Bell Match
    [Documentation]    A running single-player match on its own guest. Fresh per case: the
    ...                bell strands the character and its arrival latches flagVisited, so no
    ...                two cases may share one.
    ${token}=    New Guest Token
    ${match}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY}    robottest_v0363
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

Ring The Bell
    [Documentation]    Walk to where the bell hangs and execute it. The walk is asserted: a
    ...                refused move would leave the character at the start, where the event
    ...                is not offered, and every assertion below would fail for the wrong
    ...                reason.
    [Arguments]    ${token}    ${match_uuid}
    ${bell_uuid}=    Location Uuid Of    ${BELL_LOCATION_ID}
    ${walk}=    Start Movement    ${token}    ${match_uuid}    ${bell_uuid}
    Status Should Be    ${walk}    200
    ${response}=    Execute Event    ${token}    ${match_uuid}    ${BELL_EVENT}    200
    RETURN    ${response}

Location Uuid Of
    [Documentation]    The uuid of one location of the suite's story, by its story-local id.
    [Arguments]    ${id_location}
    ${locations}=    Story Rows    locations
    FOR    ${location}    IN    @{locations}
        IF    str($location.get('id')) == '${id_location}'    RETURN    ${location}[uuid]
    END
    Fail    the story has no location ${id_location}

Any Available Event Uuid At The Start Location
    [Documentation]    An event the character can execute where they stand right now, so the
    ...                shape of an ordinary answer can be read. Skips the bell: it moves.
    [Arguments]    ${token}    ${match_uuid}
    ${info}=    Get Match Info    ${token}    ${match_uuid}    200
    FOR    ${location}    IN    @{info.json()}[locationsActive]
        FOR    ${event}    IN    @{location}[events]
            ${usable}=    Evaluate
            ...    bool($event.get('available')) and $event.get('uuid') != '${BELL_EVENT}'
            IF    ${usable}    RETURN    ${event}[uuid]
        END
    END
    Fail    the start location offers no available event
