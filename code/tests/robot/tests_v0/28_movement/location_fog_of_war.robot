*** Settings ***
# ---------------------------------------------------------------------------
# location_fog_of_war.robot — Step 0.28.6: a neighbor pointing at a location the
# match has NEVER visited must not expose that location's card.
#
#   GET /api/match/{uuidMatch}/locations          — neighbor.card / neighbor.idCard
#                                                    null for unvisited destinations
#   GET /api/admin/matches/{uuidMatch}/locations  — same gating (admin port)
#   GET /api/match/{uuidMatch}/info                — authored LINK cards kept; the
#                                                    LOCATION-card fallback hidden
#                                                    until the destination is visited
#
# "Visited" = character positions ∪ movement-log endpoints (the set the
# /locations endpoint returns as its `locations[]`). Backend-agnostic: discovers
# a joinable loadout at runtime and cross-checks card existence via /content, so
# it runs on Java / Python / AWS interchangeably.
#
# Tags: movement, locations, fog-of-war, step28
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource

Suite Setup    Suite Setup Fog Of War


*** Test Cases ***

Locations Hides The Card Of Unvisited Neighbor Locations
    [Documentation]    Every neighbor whose destination is not in the visited set
    ...                exposes neither idCard nor card.
    [Tags]    movement    locations    fog-of-war    step28
    ${match}=    Running Match With Character
    ${response}=    Get Locations    ${TOKEN}    ${match}
    Status Should Be    ${response}    200
    ${locations}=    Set Variable    ${response.json()}[locations]
    ${visited}=    Visited Ids    ${locations}
    FOR    ${loc}    IN    @{locations}
        FOR    ${nb}    IN    @{loc}[neighbors]
            ${is_visited}=    Evaluate    ${nb}[idLocation] in ${visited}
            IF    not ${is_visited}
                Should Be Equal    ${nb}[card]      ${None}
                Should Be Equal    ${nb}[idCard]    ${None}
            END
        END
    END

Moving Into A Neighbor Reveals Its Card And It Resolves Via Content
    [Documentation]    Cross-check: the hidden card EXISTS (fog, not absent). After
    ...                moving into an unvisited neighbor its location card appears
    ...                and its uuid resolves via GET /api/content/.../cards.
    [Tags]    movement    locations    fog-of-war    step28
    ${match}=    Running Match With Character
    ${before}=    Get Locations    ${TOKEN}    ${match}
    ${target_uuid}    ${target_id}=    First Movable Unvisited Neighbor    ${before.json()}[locations]
    # move into it (the neighbor uuid is the destination LOCATION uuid)
    ${move}=    Start Movement    ${TOKEN}    ${match}    ${target_uuid}    200
    ${after}=    Get Locations    ${TOKEN}    ${match}
    ${visited_after}=    Visited Ids    ${after.json()}[locations]
    Should Contain    ${visited_after}    ${target_id}
    ${dest}=    Location By Id    ${after.json()}[locations]    ${target_id}
    Should Not Be Equal    ${dest}[card]    ${None}
    # the card that was hidden as a neighbor DOES exist — resolve it via /content
    ${detail}=    Get Card Info    ${STORY_UUID}    ${dest}[card][uuid]
    Status Should Be    ${detail}    200
    Card Info Should Have Required Fields    ${detail.json()}

Info Never Exposes The Location Card Of An Unvisited Neighbor
    [Documentation]    In /info the neighbor card is either null or an authored LINK
    ...                card — never the destination LOCATION's card before visiting.
    [Tags]    movement    match-info    fog-of-war    step28
    ${match}=    Running Match With Character
    ${before}=    Get Locations    ${TOKEN}    ${match}
    ${target_uuid}    ${target_id}=    First Movable Unvisited Neighbor    ${before.json()}[locations]
    # /info BEFORE moving: record the neighbor card toward the target (may be null)
    ${info_before}=    Get Match Info    ${TOKEN}    ${match}    200
    ${nb_card_before}=    Info Neighbor Card    ${info_before.json()}    ${target_id}
    # move in, then read the destination's OWN card from /info
    Start Movement    ${TOKEN}    ${match}    ${target_uuid}    200
    ${info_after}=    Get Match Info    ${TOKEN}    ${match}    200
    ${dest_card_uuid}=    Active Location Card Uuid    ${info_after.json()}    ${target_id}
    # the pre-visit neighbor card must NOT have been the destination's location card
    IF    $nb_card_before is not None
        Should Not Be Equal    ${nb_card_before}[uuid]    ${dest_card_uuid}
    END

Admin Locations Applies The Same Fog Gating
    [Documentation]    The admin view hides unvisited neighbor cards exactly like
    ...                the player view.
    [Tags]    movement    locations    fog-of-war    step28
    ${match}=    Running Match With Character
    ${response}=    Admin Get Locations    ${ADMIN_TOKEN}    ${match}
    Status Should Be    ${response}    200
    ${locations}=    Set Variable    ${response.json()}[locations]
    ${visited}=    Visited Ids    ${locations}
    FOR    ${loc}    IN    @{locations}
        FOR    ${nb}    IN    @{loc}[neighbors]
            ${is_visited}=    Evaluate    ${nb}[idLocation] in ${visited}
            IF    not ${is_visited}
                Should Be Equal    ${nb}[card]    ${None}
            END
        END
    END


*** Keywords ***

Suite Setup Fog Of War
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
    # v0.32.1 — its own guest: one user may own only one active match per story
    # (409 ACTIVE_MATCH_ALREADY_EXISTS). ${TOKEN} is rebound for the rest of the test.
    ${token}=    Use A Fresh Guest Token
    ${match}=    Create Match    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}    robottest_fog
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

Location By Id
    [Documentation]    Returns the /locations entry with the given idLocation.
    [Arguments]    ${locations}    ${id}
    FOR    ${loc}    IN    @{locations}
        IF    ${loc}[idLocation] == ${id}    RETURN    ${loc}
    END
    Fail    Location ${id} not present in the payload

Info Neighbor Card
    [Documentation]    The card of the neighbor toward ${target_id} in /info (or None).
    [Arguments]    ${info}    ${target_id}
    FOR    ${active}    IN    @{info}[locationsActive]
        FOR    ${nb}    IN    @{active}[neighbors]
            IF    ${nb}[idLocation] == ${target_id}    RETURN    ${nb}[card]
        END
    END
    RETURN    ${None}

Active Location Card Uuid
    [Documentation]    The card uuid of the now-active destination location in /info.
    [Arguments]    ${info}    ${target_id}
    FOR    ${active}    IN    @{info}[locationsActive]
        IF    ${active}[idLocation] == ${target_id}    RETURN    ${active}[card][uuid]
    END
    Fail    Destination ${target_id} is not the active location after moving
