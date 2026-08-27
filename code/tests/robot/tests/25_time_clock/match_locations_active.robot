*** Settings ***
# ---------------------------------------------------------------------------
# match_locations_active.robot — Step 27.x enriched match info.
#
# Endpoint under test (player, Bearer access token from /api/auth/guest):
#   GET /api/match/{uuidMatch}/info  → 200 MatchInfo
#
# Step 27.x adds the `locationsActive` block to the match-info payload: the
# locations occupied by ONE OR MORE players, each enriched with its `card`,
# the `neighbors` reachable from it (both directions) and the `events`
# specific to it — every element carrying a card. The endpoint's
# `currentLocation*` now reflects the player's position (players[].idLocation),
# not the story start location.
#
# Filtering rules verified here (backend-agnostic — does not assume the seed
# wires neighbors/events to the start location, so it asserts STRUCTURE and the
# player-presence rule rather than specific neighbor/event content):
#   * a location appears in locationsActive only when >= 1 player is on it;
#   * with no joined character the list is empty and currentLocation* falls back
#     to the story start;
#   * once a character has joined, the active location matches the player's
#     position and carries card / neighbors / events keys.
#
# Backend-agnostic: runs against any backend implementing the shared contract.
#
# Tags: locations-active, match-info, step27
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource

Suite Setup    Suite Setup Locations Active


*** Test Cases ***

Match Info Exposes Locations Active Block
    [Documentation]    GET /info always returns a `locationsActive` array.
    [Tags]    locations-active    match-info    step27
    ${match}=    New Match With Character
    Start Match    ${TOKEN}    ${match}    200
    ${response}=    Get Match Info    ${TOKEN}    ${match}    200
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    locationsActive
    ${type}=    Evaluate    isinstance($body['locationsActive'], list)
    Should Be True    ${type}    msg=locationsActive must be a list

Current Location Reflects The Player Position
    [Documentation]    After a character joins, currentLocation* is the player's location
    ...                (an active location), not necessarily the bare story start.
    [Tags]    locations-active    match-info    step27
    ${match}=    New Match With Character
    Start Match    ${TOKEN}    ${match}    200
    ${response}=    Get Match Info    ${TOKEN}    ${match}    200
    ${body}=    Set Variable    ${response.json()}
    Should Not Be Equal    ${body}[currentLocationId]    ${None}
    ...    msg=currentLocationId must reflect the player's location
    Should Not Be Empty    ${body}[locationsActive]
    ${active}=    Find Active Location    ${body}[locationsActive]    ${body}[currentLocationId]
    Should Not Be Equal    ${active}    ${None}
    ...    msg=locationsActive must contain the player's current location

Active Location Carries Card Neighbors And Events Keys
    [Documentation]    Each active location exposes the enriched structure: a `card`
    ...                and `neighbors` / `events` arrays (possibly empty per seed).
    [Tags]    locations-active    match-info    step27
    ${match}=    New Match With Character
    Start Match    ${TOKEN}    ${match}    200
    ${response}=    Get Match Info    ${TOKEN}    ${match}    200
    ${body}=    Set Variable    ${response.json()}
    ${active}=    Set Variable    ${body}[locationsActive][0]
    Dictionary Should Contain Key    ${active}    idLocation
    Dictionary Should Contain Key    ${active}    uuid
    Dictionary Should Contain Key    ${active}    card
    Dictionary Should Contain Key    ${active}    secureParam
    Dictionary Should Contain Key    ${active}    neighbors
    Dictionary Should Contain Key    ${active}    events
    ${neighbors_is_list}=    Evaluate    isinstance($active['neighbors'], list)
    ${events_is_list}=    Evaluate    isinstance($active['events'], list)
    Should Be True    ${neighbors_is_list}
    Should Be True    ${events_is_list}

Locations Active Is Empty Without A Joined Character
    [Documentation]    A match with no joined character has no player, so locationsActive is
    ...                empty and currentLocation* falls back to the story start location.
    [Tags]    locations-active    match-info    step27
    # v0.32.1 — its own guest: the suite token already owns an active match
    ${token}=    New Guest Token
    ${match}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY_UUID}    robottest_la_empty
    Status Should Be    ${match}    201
    ${match_uuid}=    Set Variable    ${match.json()}[uuid]
    ${response}=    Get Match Info    ${token}    ${match_uuid}    200
    ${body}=    Set Variable    ${response.json()}
    Should Be Empty    ${body}[locationsActive]
    Should Not Be Equal    ${body}[currentLocationId]    ${None}
    ...    msg=currentLocationId must fall back to the story start location

Event Cards Expose The End Game Flag
    [Documentation]    Step 0.25.4 — every event under an active location carries a boolean
    ...                `endGame` flag (true only for the story's end-game event). Backend-
    ...                agnostic: asserts the key/type on whatever events the seed wires to the
    ...                player's location; when the story's end-game event is present at that
    ...                location it must be flagged true.
    [Tags]    locations-active    match-info    step27    end-game
    ${match}=    New Match With Character
    Start Match    ${TOKEN}    ${match}    200
    ${response}=    Get Match Info    ${TOKEN}    ${match}    200
    ${active}=    Set Variable    ${response.json()}[locationsActive][0]
    FOR    ${event}    IN    @{active}[events]
        Dictionary Should Contain Key    ${event}    endGame
        ${is_bool}=    Evaluate    isinstance($event['endGame'], bool)
        Should Be True    ${is_bool}    msg=endGame must be a boolean
    END

Neighbor And Event Cards Match The Active Location Schema
    [Documentation]    When the seed wires neighbors/events to the player's location, each
    ...                neighbor exposes idLocation/direction/energyCost/card and secureParam;
    ...                each event exposes uuid/type/card. Skipped when the seed has none at
    ...                the start location (keeps the suite backend-agnostic).
    [Tags]    locations-active    match-info    step27
    ${match}=    New Match With Character
    Start Match    ${TOKEN}    ${match}    200
    ${response}=    Get Match Info    ${TOKEN}    ${match}    200
    ${active}=    Set Variable    ${response.json()}[locationsActive][0]
    IF    len($active['neighbors']) > 0
        ${n}=    Set Variable    ${active}[neighbors][0]
        Dictionary Should Contain Key    ${n}    idLocation
        Dictionary Should Contain Key    ${n}    direction
        Dictionary Should Contain Key    ${n}    energyCost
        Dictionary Should Contain Key    ${n}    card
        Dictionary Should Contain Key    ${n}    secureParam
    END
    IF    len($active['events']) > 0
        ${e}=    Set Variable    ${active}[events][0]
        Dictionary Should Contain Key    ${e}    uuid
        Dictionary Should Contain Key    ${e}    type
        Dictionary Should Contain Key    ${e}    card
    END

Neighbor SecureParam Is Integer Or Null
    [Documentation]    Every neighbor of an active location must carry a `secureParam` key
    ...                whose value is an integer (positive = safe destination) or null.
    ...                Skipped when the player's start location has no neighbors in the seed.
    [Tags]    locations-active    match-info    step27    secure-param
    ${match}=    New Match With Character
    Start Match    ${TOKEN}    ${match}    200
    ${response}=    Get Match Info    ${TOKEN}    ${match}    200
    ${active}=    Set Variable    ${response.json()}[locationsActive][0]
    FOR    ${n}    IN    @{active}[neighbors]
        Dictionary Should Contain Key    ${n}    secureParam
        ${val}=    Set Variable    ${n}[secureParam]
        IF    $val is not None
            ${is_int}=    Evaluate    isinstance($val, int)
            Should Be True    ${is_int}    msg=secureParam must be an integer, got: ${val}
        END
    END


*** Keywords ***

Suite Setup Locations Active
    [Documentation]    Guest login + resolve a joinable loadout from a public story.
    Create Public Session
    ${response}=    POST On Session    public_session    /api/auth/guest
    Status Should Be    ${response}    201
    Set Suite Variable    ${TOKEN}    ${response.json()}[accessToken]
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}        ${story}
    Set Suite Variable    ${DIFFICULTY_UUID}   ${difficulty}
    Set Suite Variable    ${CHARACTER_UUID}    ${character}
    Set Suite Variable    ${CLASS_UUID}        ${class}
    Set Suite Variable    ${TRAIT_UUID}        ${trait}

New Match With Character
    [Documentation]    Creates a CREATED match and joins one character; returns the match uuid.
    # v0.32.1 — its own guest: one user may own only one active match per story
    # (409 ACTIVE_MATCH_ALREADY_EXISTS). ${TOKEN} is rebound for the rest of the test.
    ${token}=    Use A Fresh Guest Token
    ${match}=    Create Match    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}    robottest_la
    Status Should Be    ${match}    201
    ${match_uuid}=    Set Variable    ${match.json()}[uuid]
    ${trait_list}=    Create List
    IF    '${TRAIT_UUID}' != ''
        Append To List    ${trait_list}    ${TRAIT_UUID}
    END
    ${join}=    Join Match    ${TOKEN}    ${match_uuid}    ${CHARACTER_UUID}    ${CLASS_UUID}    ${trait_list}
    Status Should Be    ${join}    201
    RETURN    ${match_uuid}

Find Active Location
    [Documentation]    Returns the locationsActive entry with the given idLocation, or None.
    [Arguments]    ${locations_active}    ${id_location}
    FOR    ${entry}    IN    @{locations_active}
        IF    ${entry}[idLocation] == ${id_location}
            RETURN    ${entry}
        END
    END
    RETURN    ${None}
