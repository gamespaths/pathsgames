*** Settings ***
# ---------------------------------------------------------------------------
# match_info_visited_locations.robot — Step 0.28.6: the match-info `locations[]`
# lists ONLY the already-visited locations, the synthetic `name` fields are gone,
# and each neighbor carries the LOCATION card of its two endpoints (fog-gated).
#
#   GET /api/match/{uuidMatch}/info                — locations[] = visited only;
#                                                    no `name` / `currentLocationName`
#                                                    / `players[].locationName`;
#                                                    neighbors[].cardLocationFrom /
#                                                    cardLocationTo null until that
#                                                    endpoint has been visited
#   GET /api/admin/matches/{uuidMatch}/info        — EVERY location (no visited
#                                                    filter) but the SAME fog gating
#
# "Visited" = character positions ∪ movement-log endpoints — the very set the
# /locations endpoint returns as its `locations[]`, so the two payloads must agree
# id-for-id. Backend-agnostic: discovers a joinable loadout at runtime and never
# hardcodes the seed story's graph, so it runs on Java / Python / AWS alike.
#
# Tags: movement, match-info, visited-locations, fog-of-war, step28
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource

Suite Setup    Suite Setup Visited Locations


*** Test Cases ***

Info Locations Contains Only Visited Locations
    [Documentation]    The ids in /info locations[] are exactly the visited ids that
    ...                /locations reports — and strictly fewer than the story's
    ...                locations, proving the filter actually ran.
    [Tags]    movement    match-info    visited-locations    step28
    ${match}=    Running Match With Character
    ${locations}=    Get Locations    ${TOKEN}    ${match}
    Status Should Be    ${locations}    200
    ${visited}=    Visited Ids    ${locations.json()}[locations]
    ${info}=    Get Match Info    ${TOKEN}    ${match}    200
    ${info_ids}=    Info Location Ids    ${info.json()}
    Lists Should Be Equal    ${info_ids}    ${visited}    ignore_order=True
    # a fresh match has visited only the start location, so the filter must have
    # dropped something: /info must be SMALLER than the full admin list
    ${admin}=    Admin Get Match Info    ${ADMIN_TOKEN}    ${match}
    Status Should Be    ${admin}    200
    ${admin_ids}=    Info Location Ids    ${admin.json()}
    ${info_len}=     Get Length    ${info_ids}
    ${admin_len}=    Get Length    ${admin_ids}
    Should Be True    ${info_len} < ${admin_len}
    ...    msg=/info locations[] (${info_len}) is not filtered: admin returns ${admin_len}

Info Carries No Synthetic Location Name
    [Documentation]    locations[].name, currentLocationName and players[].locationName
    ...                are gone from the contract; the id/uuid/counter fields stay.
    [Tags]    movement    match-info    visited-locations    step28
    ${match}=    Running Match With Character
    ${info}=    Get Match Info    ${TOKEN}    ${match}    200
    ${body}=    Set Variable    ${info.json()}
    Dictionary Should Not Contain Key    ${body}    currentLocationName
    Dictionary Should Contain Key        ${body}    currentLocationId
    Dictionary Should Contain Key        ${body}    currentLocationUuid
    FOR    ${loc}    IN    @{body}[locations]
        Dictionary Should Not Contain Key    ${loc}    name
        Dictionary Should Contain Key        ${loc}    idLocation
        Dictionary Should Contain Key        ${loc}    uuid
        Dictionary Should Contain Key        ${loc}    flagAlreadyActived
        Dictionary Should Contain Key        ${loc}    clockCounter
    END
    FOR    ${player}    IN    @{body}[players]
        Dictionary Should Not Contain Key    ${player}    locationName
        Dictionary Should Contain Key        ${player}    idLocation
    END

Neighbor Location Cards Follow The Visited Gating
    [Documentation]    cardLocationFrom / cardLocationTo are resolved for a VISITED
    ...                endpoint and null for an unvisited one. The endpoint the
    ...                character stands on is always visited, so it always resolves.
    [Tags]    movement    match-info    visited-locations    fog-of-war    step28
    ${match}=    Running Match With Character
    ${locations}=    Get Locations    ${TOKEN}    ${match}
    ${visited}=    Visited Ids    ${locations.json()}[locations]
    ${info}=    Get Match Info    ${TOKEN}    ${match}    200
    ${checked}=    Set Variable    ${0}
    FOR    ${active}    IN    @{info.json()}[locationsActive]
        FOR    ${nb}    IN    @{active}[neighbors]
            Neighbor Endpoint Card Matches Visited    ${nb}    cardLocationFrom    idLocationFrom    ${visited}
            Neighbor Endpoint Card Matches Visited    ${nb}    cardLocationTo      idLocationTo      ${visited}
            ${checked}=    Evaluate    ${checked} + 1
        END
    END
    Should Be True    ${checked} > 0    msg=No neighbors found to assert the gating on

Moving Reveals The Destination In Locations And Its Card
    [Documentation]    After moving into an unvisited neighbor it appears in /info
    ...                locations[], the two payloads stay in sync, and the endpoint
    ...                card that was fogged is now resolved.
    [Tags]    movement    match-info    visited-locations    fog-of-war    step28
    ${match}=    Running Match With Character
    ${before}=    Get Locations    ${TOKEN}    ${match}
    ${target_uuid}    ${target_id}=    First Movable Unvisited Neighbor    ${before.json()}[locations]

    # BEFORE: the destination is absent from locations[] and its endpoint card is null
    ${info_before}=    Get Match Info    ${TOKEN}    ${match}    200
    ${ids_before}=     Info Location Ids    ${info_before.json()}
    Should Not Contain    ${ids_before}    ${target_id}
    ${card_before}=    Info Neighbor Endpoint Card    ${info_before.json()}    ${target_id}
    Should Be Equal    ${card_before}    ${None}
    ...    msg=The unvisited destination ${target_id} must not expose its location card

    Start Movement    ${TOKEN}    ${match}    ${target_uuid}    200

    # AFTER: it is visited, present in locations[], and in sync with /locations.
    ${info_after}=    Get Match Info    ${TOKEN}    ${match}    200
    ${ids_after}=     Info Location Ids    ${info_after.json()}
    Should Contain    ${ids_after}    ${target_id}
    ${locations_after}=    Get Locations    ${TOKEN}    ${match}
    ${visited_after}=      Visited Ids    ${locations_after.json()}[locations]
    Lists Should Be Equal    ${ids_after}    ${visited_after}    ignore_order=True

    # The card that was fogged is now revealed. Read it from the destination as the
    # ACTIVE location: the edge we came in on is not guaranteed to still be listed —
    # a one-way link (flagBack=NO) disappears once you stand on its `to` side, and the
    # destination may have no outgoing edge at all. The active entry always carries it.
    ${card_after}=    Active Location Card    ${info_after.json()}    ${target_id}
    Should Not Be Equal    ${card_after}    ${None}
    ...    msg=The visited destination ${target_id} must expose its location card
    # the revealed card is real content — cross-check it via the content API
    ${detail}=    Get Card Info    ${STORY_UUID}    ${card_after}[uuid]
    Status Should Be    ${detail}    200
    Card Info Should Have Required Fields    ${detail.json()}

    # ...and every neighbor edge still listed now honours the NEW visited set, so any
    # edge touching the destination exposes its endpoint card (no-op when none remain).
    FOR    ${active}    IN    @{info_after.json()}[locationsActive]
        FOR    ${nb}    IN    @{active}[neighbors]
            Neighbor Endpoint Card Matches Visited    ${nb}    cardLocationFrom    idLocationFrom    ${visited_after}
            Neighbor Endpoint Card Matches Visited    ${nb}    cardLocationTo      idLocationTo      ${visited_after}
        END
    END

Admin Info Returns All Locations With The Same Fog Gating
    [Documentation]    The admin console needs the full gaming_state_locations table,
    ...                so its locations[] is NOT filtered — but the neighbor cards
    ...                stay gated exactly like the player view, and `name` is gone.
    [Tags]    movement    match-info    visited-locations    admin    step28
    ${match}=    Running Match With Character
    ${locations}=    Get Locations    ${TOKEN}    ${match}
    ${visited}=    Visited Ids    ${locations.json()}[locations]

    ${admin}=    Admin Get Match Info    ${ADMIN_TOKEN}    ${match}
    Status Should Be    ${admin}    200
    ${admin_ids}=    Info Location Ids    ${admin.json()}
    ${player}=       Get Match Info    ${TOKEN}    ${match}    200
    ${player_ids}=   Info Location Ids    ${player.json()}

    # every location the player sees, plus the ones still unexplored
    ${admin_len}=     Get Length    ${admin_ids}
    ${player_len}=    Get Length    ${player_ids}
    Should Be True    ${admin_len} > ${player_len}
    FOR    ${id}    IN    @{player_ids}
        Should Contain    ${admin_ids}    ${id}
    END
    # ...but still no synthetic name, and the fog gating is unchanged
    FOR    ${loc}    IN    @{admin.json()}[locations]
        Dictionary Should Not Contain Key    ${loc}    name
    END
    Dictionary Should Not Contain Key    ${admin.json()}    currentLocationName
    FOR    ${active}    IN    @{admin.json()}[locationsActive]
        FOR    ${nb}    IN    @{active}[neighbors]
            Neighbor Endpoint Card Matches Visited    ${nb}    cardLocationFrom    idLocationFrom    ${visited}
            Neighbor Endpoint Card Matches Visited    ${nb}    cardLocationTo      idLocationTo      ${visited}
        END
    END


*** Keywords ***

Suite Setup Visited Locations
    [Documentation]    Guest login + admin session + resolve a joinable loadout.
    Create Public Session
    Create Admin Session
    ${response}=    POST On Session    public_session    /api/auth/guest
    Status Should Be    ${response}    201
    Set Suite Variable    ${TOKEN}    ${response.json()}[accessToken]
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}        ${story}
    Set Suite Variable    ${DIFFICULTY_UUID}   ${difficulty}
    Set Suite Variable    ${CHARACTER_UUID}    ${character}
    Set Suite Variable    ${CLASS_UUID}        ${class}
    Set Suite Variable    ${TRAIT_UUID}        ${trait}

Running Match With Character
    [Documentation]    Creates, joins and starts a match; returns the match uuid.
    ${match}=    Create Match    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}    robottest_visited
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

Visited Ids
    [Documentation]    The set of visited location ids = the /locations entries.
    [Arguments]    ${locations}
    ${ids}=    Create List
    FOR    ${loc}    IN    @{locations}
        Append To List    ${ids}    ${loc}[idLocation]
    END
    RETURN    ${ids}

Info Location Ids
    [Documentation]    The location ids projected by /info locations[].
    [Arguments]    ${info}
    ${ids}=    Create List
    FOR    ${loc}    IN    @{info}[locations]
        Append To List    ${ids}    ${loc}[idLocation]
    END
    RETURN    ${ids}

Neighbor Endpoint Card Matches Visited
    [Documentation]    Asserts one endpoint of a neighbor edge: its LOCATION card is
    ...                resolved when that endpoint is visited, null when it is not.
    [Arguments]    ${nb}    ${card_key}    ${id_key}    ${visited}
    ${endpoint_id}=    Set Variable    ${nb}[${id_key}]
    ${card}=           Set Variable    ${nb}[${card_key}]
    IF    $endpoint_id is None
        RETURN
    END
    ${is_visited}=    Evaluate    ${endpoint_id} in ${visited}
    IF    ${is_visited}
        Should Not Be Equal    ${card}    ${None}
        ...    msg=${card_key} must be resolved for the visited location ${endpoint_id}
        Dictionary Should Contain Key    ${card}    uuid
    ELSE
        Should Be Equal    ${card}    ${None}
        ...    msg=${card_key} must be null for the unvisited location ${endpoint_id}
    END

Active Location Card
    [Documentation]    The card of ${target_id} as a player-occupied (active) location.
    [Arguments]    ${info}    ${target_id}
    FOR    ${active}    IN    @{info}[locationsActive]
        IF    ${active}[idLocation] == ${target_id}    RETURN    ${active}[card]
    END
    Fail    Location ${target_id} is not active after moving into it

Info Neighbor Endpoint Card
    [Documentation]    The LOCATION card that /info exposes for ${target_id} on any
    ...                neighbor edge touching it (cardLocationFrom or cardLocationTo,
    ...                whichever endpoint is the target). None when never resolved.
    [Arguments]    ${info}    ${target_id}
    FOR    ${active}    IN    @{info}[locationsActive]
        FOR    ${nb}    IN    @{active}[neighbors]
            IF    ${nb}[idLocationFrom] == ${target_id} and $nb['cardLocationFrom'] is not None
                RETURN    ${nb}[cardLocationFrom]
            END
            IF    ${nb}[idLocationTo] == ${target_id} and $nb['cardLocationTo'] is not None
                RETURN    ${nb}[cardLocationTo]
            END
        END
    END
    RETURN    ${None}

First Movable Unvisited Neighbor
    [Documentation]    Returns (uuid, idLocation) of the first neighbor whose
    ...                destination is not visited and whose move condition is met.
    [Arguments]    ${locations}
    ${visited}=    Visited Ids    ${locations}
    FOR    ${loc}    IN    @{locations}
        FOR    ${nb}    IN    @{loc}[neighbors]
            ${is_visited}=    Evaluate    ${nb}[idLocation] in ${visited}
            ${ok}=    Evaluate    (not ${is_visited}) and ${nb}.get('conditionMet', True) and $nb['uuid'] is not None
            IF    ${ok}    RETURN    ${nb}[uuid]    ${nb}[idLocation]
        END
    END
    Fail    No movable unvisited neighbor found in the current locations
