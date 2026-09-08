*** Settings ***
# ---------------------------------------------------------------------------
# missions.resource — Step 37 helpers shared by the mission suites.
#
# Everything here finds its fixtures BY BEHAVIOUR: the missions and their steps are read
# from the story through the admin CRUD, and the events that satisfy a condition are found
# by the key their effects write. No seeded id or uuid is ever named, so the suites run on
# java-sqlite, java-postgres, python and aws alike.
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   common.resource
Resource   auth.resource
Resource   matches.resource
Resource   stories.resource


*** Keywords ***

Suite Setup Missions
    [Documentation]    An admin session (for the story's missions and its event effects) plus
    ...                the loadout every case builds its own match from.
    Create Admin Session
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}    ${story}
    Set Suite Variable    ${DIFFICULTY}    ${difficulty}
    Set Suite Variable    ${CHARACTER}    ${character}
    Set Suite Variable    ${CLASS}    ${class}
    Set Suite Variable    ${TRAIT}    ${trait}

Fresh Mission Match
    [Documentation]    A running single-player match on its own guest. Fresh per case,
    ...                because a mission latches and cannot be re-opened.
    ${token}=    New Guest Token
    ${match}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY}    robottest_step37
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

Story Missions
    [Documentation]    The missions the story declares, read through the admin CRUD so no
    ...                seeded id is ever named here.
    ${response}=    GET On Session    admin_session    /api/admin/stories/${STORY_UUID}/missions
    Status Should Be    ${response}    200
    RETURN    ${response.json()}

Story Mission Steps
    ${response}=    GET On Session    admin_session
    ...    /api/admin/stories/${STORY_UUID}/mission-steps
    Status Should Be    ${response}    200
    RETURN    ${response.json()}

Key Writing Event Uuids
    [Documentation]    Registry key to the uuids of the events whose effects write it. Read
    ...                from the story, so any story with mission writers works.
    ${effects}=    GET On Session    admin_session
    ...    /api/admin/stories/${STORY_UUID}/event-effects
    Status Should Be    ${effects}    200
    ${events}=    GET On Session    admin_session    /api/admin/stories/${STORY_UUID}/events
    Status Should Be    ${events}    200

    ${by_id}=    Create Dictionary
    FOR    ${event}    IN    @{events.json()}
        Set To Dictionary    ${by_id}    ${event}[id]    ${event}[uuid]
    END
    ${writers}=    Create Dictionary
    FOR    ${effect}    IN    @{effects.json()}
        ${key}=    Set Variable    ${effect.get('keyToAdd')}
        ${id}=     Set Variable    ${effect.get('idEvent')}
        IF    $key and $id in $by_id
            ${uuids}=    Get From Dictionary    ${writers}    ${key}    default=${NONE}
            IF    $uuids is None
                ${uuids}=    Create List
                Set To Dictionary    ${writers}    ${key}    ${uuids}
            END
            Append To List    ${uuids}    ${by_id}[${id}]
        END
    END
    RETURN    ${writers}

Execute Board Event
    [Documentation]    Run one event by uuid if the board is offering it; fail loudly when it
    ...                is not, since every later assertion would then be meaningless.
    [Arguments]    ${token}    ${match_uuid}    ${event_uuid}
    ${response}=    Execute Event    ${token}    ${match_uuid}    ${event_uuid}    200
    RETURN    ${response}

Match With One Mission Open
    [Documentation]    A fresh match whose FIRST mission has been opened by running the event
    ...                that writes its condition key. Returns the token, the match and the
    ...                story's mission row.
    ${token}    ${match}=    Fresh Mission Match
    ${missions}=    Story Missions
    ${writers}=     Key Writing Event Uuids
    FOR    ${mission}    IN    @{missions}
        ${key}=    Set Variable    ${{ $mission.get('conditionKey') }}
        IF    $key in $writers and $mission.get('conditionValue')
            Execute Board Event    ${token}    ${match}    ${writers}[${key}][0]
            RETURN    ${token}    ${match}    ${mission}
        END
    END
    Fail    the story declares no mission whose condition key an event writes

Missions Of
    [Arguments]    ${token}    ${match_uuid}    ${status}=${EMPTY}
    ${response}=    Get Missions    ${token}    ${match_uuid}    200    status=${status}
    RETURN    ${response.json()}[missions]

Mission By Uuid
    [Arguments]    ${missions}    ${uuid}
    FOR    ${mission}    IN    @{missions}
        IF    $mission['uuid'] == $uuid    RETURN    ${mission}
    END
    Fail    mission ${uuid} is not in the payload

Registry Keys Of
    [Arguments]    ${token}    ${match_uuid}
    ${response}=    Get Registry    ${token}    ${match_uuid}    200    include_hidden=true
    ${keys}=    Create List
    FOR    ${group}    IN    @{response.json()}[groups]
        FOR    ${entry}    IN    @{group}[entries]
            Append To List    ${keys}    ${entry}[key]
        END
    END
    RETURN    ${keys}

Steps Of Mission
    [Documentation]    The story's step rows of one mission, in the order the engine walks
    ...                them. Read from the story, so nothing is addressed by a seeded id.
    [Arguments]    ${mission}
    ${steps}=    Story Mission Steps
    ${mine}=    Create List
    FOR    ${step}    IN    @{steps}
        IF    $step.get('idMission') == $mission.get('id')
            Append To List    ${mine}    ${step}
        END
    END
    ${sorted}=    Evaluate    sorted($mine, key=lambda s: s.get('step') or 0)
    RETURN    ${sorted}

Mission With Steps
    [Documentation]    The first story mission that has at least ${count} steps AND whose own
    ...                condition an event writes. The one the progression cases play through.
    [Arguments]    ${count}=2
    ${missions}=    Story Missions
    ${writers}=     Key Writing Event Uuids
    FOR    ${mission}    IN    @{missions}
        ${steps}=    Steps Of Mission    ${mission}
        ${ok}=    Set Variable    ${{ len($steps) >= int($count) }}
        IF    not $ok or $mission.get('conditionKey') not in $writers
            CONTINUE
        END
        FOR    ${step}    IN    @{steps}
            IF    $step.get('conditionKey') not in $writers
                ${ok}=    Set Variable    ${FALSE}
            END
        END
        IF    $ok
            RETURN    ${mission}    ${steps}    ${writers}
        END
    END
    Fail    the story declares no mission with ${count} steps whose conditions events write

Satisfy
    [Documentation]    Run the event that writes one condition key on this match.
    [Arguments]    ${token}    ${match_uuid}    ${writers}    ${key}
    Should Contain    ${{ list($writers) }}    ${key}
    ...    msg=no seeded event writes '${key}'
    Execute Board Event    ${token}    ${match_uuid}    ${writers}[${key}][0]

Status Of
    [Documentation]    The status of one mission as the endpoint currently answers it, or
    ...                NONE when this match has not reached it at all.
    [Arguments]    ${token}    ${match_uuid}    ${mission}
    ${missions}=    Missions Of    ${token}    ${match_uuid}
    FOR    ${found}    IN    @{missions}
        IF    $found['uuid'] == $mission['uuid']    RETURN    ${found}[status]
    END
    RETURN    ${NONE}

Mission Payload
    [Arguments]    ${token}    ${match_uuid}    ${mission}
    ${missions}=    Missions Of    ${token}    ${match_uuid}
    ${found}=    Mission By Uuid    ${missions}    ${mission}[uuid]
    RETURN    ${found}
