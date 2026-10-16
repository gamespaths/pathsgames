*** Settings ***
# ---------------------------------------------------------------------------
# neighbor_flag_back.robot — Step 28 / v0.28.3 one-way neighbor links (flagBack).
#
# A neighbor edge A -> B has a `flagBack` flag:
#   flagBack = 1 (YES) → two-way: standing on B you can go back to A, so A is
#                        listed as a neighbor of B in the gameplay APIs.
#   flagBack = 0 (NO)  → one-way: standing on B the link back to A is hidden, so
#                        A is NOT listed as a neighbor of B.
#
# This regression drives the contract end-to-end:
#   1. ADMIN picks a forward edge A->B that leaves the start location and reads
#      its current flagBack (port 8044).
#   2. PLAYER creates/joins/starts a match and MOVES the character from A to B
#      (a forward move, always allowed regardless of flagBack).
#   3. With the character standing on B:
#        - flagBack = 1 → GET /api/match/{uuid}/info AND /locations list A among
#          B's neighbors.
#        - flagBack = 0 → A is absent from B's neighbors in both APIs, while B's
#          own forward neighbors stay intact.
#
# Backend-agnostic: edge, locations and ids are discovered at runtime, so it runs
# identically on Java (SQLite/Postgres), Python and AWS.
#
# Tags: match-info, movement-back, flag-back, step28, regression
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource

Suite Setup       Suite Setup Neighbor Flag Back
Suite Teardown    Restore Neighbor Flag Back


*** Variables ***
${NB_UUID}            ${EMPTY}
${NB_ORIG_FLAGBACK}   ${None}
${START_ID}           ${None}
${B_ID}               ${None}
${MATCH_UUID}         ${EMPTY}


*** Test Cases ***

Flag Back YES Returns The Backward Neighbor
    [Documentation]    With the character standing on B (the edge destination) and flagBack = 1,
    ...                the link back to the source A must be listed among B's neighbors in both
    ...                /info and /locations.
    [Tags]    match-info    movement-back    flag-back    step28    regression
    Set Neighbor Flag Back    1

    ${info}=    Get Match Info    ${TOKEN}    ${MATCH_UUID}    200    lang=en
    ${active}=    Active Location    ${info.json()}    ${B_ID}
    ${present}=    Backward Neighbor Present In Info    ${active}
    Should Be True    ${present}
    ...    msg=flagBack=YES but the backward neighbor A->B is missing from /info

    ${locs}=    Get Locations    ${TOKEN}    ${MATCH_UUID}    200
    ${present_loc}=    Backward Neighbor Present In Locations    ${locs.json()}
    Should Be True    ${present_loc}
    ...    msg=flagBack=YES but the backward neighbor is missing from /locations

Flag Back NO Hides The Backward Neighbor
    [Documentation]    With the character standing on B and flagBack = 0, the link back to A must
    ...                NOT appear among B's neighbors in /info or /locations, while B keeps its own
    ...                forward neighbors.
    [Tags]    match-info    movement-back    flag-back    step28    regression
    Set Neighbor Flag Back    0

    ${info}=    Get Match Info    ${TOKEN}    ${MATCH_UUID}    200    lang=en
    ${active}=    Active Location    ${info.json()}    ${B_ID}
    ${present}=    Backward Neighbor Present In Info    ${active}
    Should Not Be True    ${present}
    ...    msg=flagBack=NO but the backward neighbor A->B is still returned by /info

    ${locs}=    Get Locations    ${TOKEN}    ${MATCH_UUID}    200
    ${present_loc}=    Backward Neighbor Present In Locations    ${locs.json()}
    Should Not Be True    ${present_loc}
    ...    msg=flagBack=NO but the backward neighbor is still returned by /locations


*** Keywords ***

Suite Setup Neighbor Flag Back
    [Documentation]    Admin + public sessions, a joinable loadout, a forward edge A->B leaving the
    ...                start location, and a running match with the character moved onto B.
    Create Public Session
    Create Admin Session
    ${guest}=    POST On Session    public_session    /api/auth/guest
    Status Should Be    ${guest}    201
    Set Suite Variable    ${TOKEN}    ${guest.json()}[accessToken]

    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}        ${story}
    Set Suite Variable    ${DIFFICULTY_UUID}   ${difficulty}
    Set Suite Variable    ${CHARACTER_UUID}    ${character}
    Set Suite Variable    ${CLASS_UUID}        ${class}
    Set Suite Variable    ${TRAIT_UUID}        ${trait}

    # A forward edge that leaves the start location: A == start, B == destination.
    ${start}=    Story Start Location
    Set Suite Variable    ${START_ID}    ${start}
    ${edge}=    Forward Edge From    ${start}
    Set Suite Variable    ${NB_UUID}          ${edge}[uuid]
    Set Suite Variable    ${B_ID}             ${edge}[idLocationTo]
    ${orig}=    Evaluate    $edge.get('flagBack')
    Set Suite Variable    ${NB_ORIG_FLAGBACK}    ${orig}

    # The destination must be two-way for the setup move to land us on B with a
    # backward edge to observe; the per-test keywords flip flagBack afterwards.
    Set Neighbor Flag Back    1

    # Start a match and move the character A -> B (forward move, always allowed).
    ${match_uuid}=    Running Match With Character
    Set Suite Variable    ${MATCH_UUID}    ${match_uuid}
    ${b_uuid}=    Destination Uuid From Info    ${match_uuid}    ${start}
    ${move}=    Start Movement    ${TOKEN}    ${match_uuid}    ${b_uuid}
    Status Should Be    ${move}    200
    Should Be Equal As Integers    ${move.json()}[toLocationId]    ${B_ID}

Running Match With Character
    [Documentation]    Creates, joins and starts a match; returns the match uuid.
    ${match}=    Create Match    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}    robottest_flagback
    Status Should Be    ${match}    201
    ${match_uuid}=    Set Variable    ${match.json()}[uuid]
    ${trait_list}=    Create List
    IF    '${TRAIT_UUID}' != ''
        Append To List    ${trait_list}    ${TRAIT_UUID}
    END
    ${join}=    Join Match    ${TOKEN}    ${match_uuid}    ${CHARACTER_UUID}    ${CLASS_UUID}    ${trait_list}
    Status Should Be    ${join}    201
    Start Match    ${TOKEN}    ${match_uuid}    200
    RETURN    ${match_uuid}

Admin List Entities
    [Arguments]    ${entity_type}
    ${resp}=    GET On Session    admin_session    /api/admin/stories/${STORY_UUID}/${entity_type}
    Status Should Be    ${resp}    200
    RETURN    ${resp.json()}

Story Start Location
    ${resp}=    GET On Session    admin_session    /api/admin/stories/${STORY_UUID}
    Status Should Be    ${resp}    200
    ${start}=    Set Variable    ${resp.json()}[idLocationStart]
    Should Not Be Equal    ${start}    ${None}    msg=story has no idLocationStart
    RETURN    ${start}

Forward Edge From
    [Documentation]    First addressable neighbor edge leaving ${loc_id} (idLocationFrom == loc_id),
    ...                so a forward move lands the character on idLocationTo.
    [Arguments]    ${loc_id}
    ${neighbors}=    Admin List Entities    location-neighbors
    Should Not Be Empty    ${neighbors}
    FOR    ${n}    IN    @{neighbors}
        ${u}=    Evaluate    $n.get('uuid')
        IF    $u and $n.get('idLocationFrom') == $loc_id and $n.get('idLocationTo') is not None
            RETURN    ${n}
        END
    END
    Fail    No addressable forward edge leaves the start location ${loc_id}

Destination Uuid From Info
    [Documentation]    The destination location uuid (B), read from the start location's forward
    ...                neighbor in match-info, used as the movement target.
    [Arguments]    ${match_uuid}    ${start}
    ${info}=    Get Match Info    ${TOKEN}    ${match_uuid}    200    lang=en
    ${active}=    Active Location    ${info.json()}    ${start}
    FOR    ${n}    IN    @{active}[neighbors]
        IF    $n['idLocationFrom'] == $START_ID and $n['idLocationTo'] == $B_ID
            RETURN    ${n}[uuid]
        END
    END
    Fail    Forward neighbor ${START_ID}->${B_ID} not visible from the start location

Set Neighbor Flag Back
    [Documentation]    Partial admin update of the edge's flagBack (1 = YES, 0 = NO).
    [Arguments]    ${value}
    &{patch}=    Create Dictionary    flagBack=${value}
    ${resp}=    PUT On Session    admin_session
    ...    /api/admin/stories/${STORY_UUID}/location-neighbors/${NB_UUID}    json=${patch}
    Status Should Be    ${resp}    200

Active Location
    [Arguments]    ${info}    ${loc_id}
    Should Not Be Empty    ${info}[locationsActive]
    FOR    ${entry}    IN    @{info}[locationsActive]
        IF    $entry['idLocation'] == $loc_id
            RETURN    ${entry}
        END
    END
    Fail    Location ${loc_id} not active in match-info

Backward Neighbor Present In Info
    [Documentation]    True when the edge A->B (START_ID -> B_ID) is listed among the active
    ...                location's neighbors in match-info.
    [Arguments]    ${active}
    FOR    ${n}    IN    @{active}[neighbors]
        IF    $n['idLocationFrom'] == $START_ID and $n['idLocationTo'] == $B_ID
            RETURN    ${True}
        END
    END
    RETURN    ${False}

Backward Neighbor Present In Locations
    [Documentation]    True when location B (B_ID) in /locations lists A (START_ID) among its
    ...                neighbors (the /locations payload exposes the other endpoint as idLocation).
    [Arguments]    ${locs}
    Should Not Be Empty    ${locs}[locations]
    FOR    ${loc}    IN    @{locs}[locations]
        IF    $loc['idLocation'] == $B_ID
            FOR    ${n}    IN    @{loc}[neighbors]
                IF    $n['idLocation'] == $START_ID
                    RETURN    ${True}
                END
            END
            RETURN    ${False}
        END
    END
    Fail    Location ${B_ID} not present in /locations payload

Restore Neighbor Flag Back
    [Documentation]    Reset the edited edge's flagBack to its original value.
    IF    '${NB_UUID}' == '${EMPTY}'    RETURN
    &{patch}=    Create Dictionary    flagBack=${NB_ORIG_FLAGBACK}
    PUT On Session    admin_session
    ...    /api/admin/stories/${STORY_UUID}/location-neighbors/${NB_UUID}    json=${patch}    expected_status=any
