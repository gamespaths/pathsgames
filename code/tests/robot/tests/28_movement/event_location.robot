*** Settings ***
# ---------------------------------------------------------------------------
# event_location.robot — Step 0.28.2 event-to-location binding (idSpecificLocation).
#
# End-to-end, backend-agnostic regression for the contract:
#   1. ADMIN sets an event's owning location via
#      PUT /api/admin/stories/{uuid}/events/{euuid}  (idSpecificLocation).
#   2. PLAYER creates/joins/starts a match and reads
#      GET /api/match/{uuid}/info?lang=en.
#   3. The event must appear under that location's `events` list in locationsActive.
#
# Guards the AWS bug where match-info filtered events by a stale `idLocation`
# alias (set only at import) instead of the admin-canonical `idSpecificLocation`,
# and the Python field-name mismatch (id_location vs id_specific_location).
#
# Tags: match-info, event-location, step28, regression
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource

Suite Setup    Suite Setup Event Location


*** Variables ***
${EV_UUID}          ${EMPTY}
${EV_ORIG_LOC}      ${None}


*** Test Cases ***

Admin-Set Event Location Is Reflected In Match Info LocationsActive
    [Documentation]    Setting an event's idSpecificLocation to the start location via the
    ...                admin API must make the event appear under that location's events in
    ...                match-info. Catches the AWS stale-idLocation-alias bug and the Python
    ...                idSpecificLocation/id_location mismatch.
    [Tags]    match-info    event-location    step28    regression
    [Teardown]    Restore Event Location

    ${events}=    Admin List Entities    events
    Should Not Be Empty    ${events}
    ${ev}=    First Addressable Event    ${events}
    Set Suite Variable    ${EV_UUID}    ${ev}[uuid]
    ${orig}=    Evaluate    $ev.get('idSpecificLocation')
    Set Suite Variable    ${EV_ORIG_LOC}    ${orig}

    ${start}=    Story Start Location

    # Bind the event to the start location through the admin API.
    &{patch}=    Create Dictionary    idSpecificLocation=${start}
    ${resp}=    PUT On Session    admin_session
    ...    /api/admin/stories/${STORY_UUID}/events/${EV_UUID}    json=${patch}
    Status Should Be    ${resp}    200

    # Play through and confirm the event shows under the start location.
    ${info}=    Start Match And Get Info
    ${active}=    Active Location    ${info}    ${start}
    ${uuids}=    Event Uuids    ${active}
    List Should Contain Value    ${uuids}    ${EV_UUID}
    ...    msg=event ${EV_UUID} must appear under start location ${start} after admin set its idSpecificLocation


*** Keywords ***

Suite Setup Event Location
    Create Admin Session
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}        ${story}
    Set Suite Variable    ${DIFFICULTY_UUID}   ${difficulty}
    Set Suite Variable    ${CHARACTER_UUID}    ${character}
    Set Suite Variable    ${CLASS_UUID}        ${class}
    Set Suite Variable    ${TRAIT_UUID}        ${trait}
    ${guest}=    POST On Session    public_session    /api/auth/guest
    Status Should Be    ${guest}    201
    Set Suite Variable    ${TOKEN}    ${guest.json()}[accessToken]

Admin List Entities
    [Arguments]    ${entity_type}
    ${resp}=    GET On Session    admin_session    /api/admin/stories/${STORY_UUID}/${entity_type}
    Status Should Be    ${resp}    200
    RETURN    ${resp.json()}

First Addressable Event
    [Documentation]    First event carrying a uuid (so it is addressable via the admin API).
    [Arguments]    ${events}
    FOR    ${e}    IN    @{events}
        ${u}=    Evaluate    $e.get('uuid')
        IF    $u    RETURN    ${e}
    END
    Fail    No addressable event (with a uuid) in the story

Story Start Location
    ${resp}=    GET On Session    admin_session    /api/admin/stories/${STORY_UUID}
    Status Should Be    ${resp}    200
    ${start}=    Set Variable    ${resp.json()}[idLocationStart]
    Should Not Be Equal    ${start}    ${None}    msg=story has no idLocationStart
    RETURN    ${start}

Start Match And Get Info
    ${match}=    Create Match    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}    robottest_eventloc
    Status Should Be    ${match}    201
    ${match_uuid}=    Set Variable    ${match.json()}[uuid]
    ${trait_list}=    Create List
    IF    '${TRAIT_UUID}' != ''
        Append To List    ${trait_list}    ${TRAIT_UUID}
    END
    ${join}=    Join Match    ${TOKEN}    ${match_uuid}    ${CHARACTER_UUID}    ${CLASS_UUID}    ${trait_list}
    Status Should Be    ${join}    201
    Start Match    ${TOKEN}    ${match_uuid}    200
    ${info}=    Get Match Info    ${TOKEN}    ${match_uuid}    200    lang=en
    RETURN    ${info.json()}

Active Location
    [Arguments]    ${info}    ${start}
    Should Not Be Empty    ${info}[locationsActive]
    FOR    ${entry}    IN    @{info}[locationsActive]
        IF    $entry['idLocation'] == $start
            RETURN    ${entry}
        END
    END
    Fail    Start location ${start} not active in match-info

Event Uuids
    [Arguments]    ${active}
    ${uuids}=    Create List
    FOR    ${e}    IN    @{active}[events]
        Append To List    ${uuids}    ${e}[uuid]
    END
    RETURN    ${uuids}

Restore Event Location
    IF    '${EV_UUID}' == '${EMPTY}'    RETURN
    &{patch}=    Create Dictionary    idSpecificLocation=${EV_ORIG_LOC}
    PUT On Session    admin_session
    ...    /api/admin/stories/${STORY_UUID}/events/${EV_UUID}    json=${patch}    expected_status=any
