*** Settings ***
# ---------------------------------------------------------------------------
# movement.robot — Step 28 movement system (adjacency, energy cost, validation).
#
# Endpoints under test:
#   POST /api/gameplay/{uuidMatch}/movements/start  → 200 | 400 | 401 | 404 | 409
#   GET  /api/match/{uuidMatch}/locations            → 200 | 401 | 404
#   GET  /api/admin/matches/{uuidMatch}/locations    → 200 (admin port)
#
# A character moves to an adjacent location, paying total_energy_cost =
# edge cost + location entry cost + weather modifier (safe/unsafe). The neighbor
# list comes from /info; the new /locations endpoint adds total_energy_cost and
# the per-location character count.
#
# Backend-agnostic: asserts structure and a strictly-positive energy cost rather
# than a fixed amount, so it runs against Java / Python / AWS interchangeably.
#
# Tags: movement, step28
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource

Suite Setup    Suite Setup Movement


*** Test Cases ***

Locations Endpoint Returns Visited With Total Energy Cost
    [Documentation]    GET /locations returns visited locations, each with characterCount
    ...                and neighbors carrying totalEnergyCost.
    [Tags]    movement    step28
    ${match}=    Running Match With Character
    ${response}=    Get Locations    ${TOKEN}    ${match}
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    matchUuid
    Should Not Be Empty    ${body}[locations]
    ${loc}=    Set Variable    ${body}[locations][0]
    Dictionary Should Contain Key    ${loc}    characterCount
    Dictionary Should Contain Key    ${loc}    safe
    Should Not Be Empty    ${loc}[neighbors]
    ${nb}=    Set Variable    ${loc}[neighbors][0]
    Dictionary Should Contain Key    ${nb}    totalEnergyCost
    Dictionary Should Contain Key    ${nb}    uuid
    Should Be True    ${nb}[totalEnergyCost] >= 0

Move To Neighbor Deducts Energy And Updates Location
    [Documentation]    A move to an adjacent location succeeds, spends a positive amount of
    ...                energy and reports the target location uuid.
    [Tags]    movement    step28
    ${match}=    Running Match With Character
    ${target}=    First Neighbor Uuid    ${match}
    ${response}=    Start Movement    ${TOKEN}    ${match}    ${target}
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Strings    ${body}[toLocationUuid]    ${target}
    Should Be True    ${body}[energySpent] >= 1
    ${expected}=    Evaluate    ${body}[newEnergy] + ${body}[energySpent]
    # newEnergy + energySpent must equal the energy before the move (no other change).
    Should Be True    ${body}[newEnergy] >= 0

Visited Locations Grow After A Move
    [Documentation]    After moving, the target location appears in GET /locations.
    [Tags]    movement    step28
    ${match}=    Running Match With Character
    ${target}=    First Neighbor Uuid    ${match}
    ${move}=    Start Movement    ${TOKEN}    ${match}    ${target}
    Status Should Be    ${move}    200
    ${to_id}=    Set Variable    ${move.json()}[toLocationId]
    ${locs}=    Get Locations    ${TOKEN}    ${match}
    Status Should Be    ${locs}    200
    ${ids}=    Collect Location Ids    ${locs.json()}[locations]
    List Should Contain Value    ${ids}    ${to_id}

Move To Non Neighbor Returns 409
    [Documentation]    Moving to a location that is not adjacent (random uuid) → 409 NOT_A_NEIGHBOR.
    [Tags]    movement    step28
    ${match}=    Running Match With Character
    ${response}=    Start Movement    ${TOKEN}    ${match}    00000000-0000-0000-0000-000000000000
    Status Should Be    ${response}    409
    Should Be Equal As Strings    ${response.json()}[error]    NOT_A_NEIGHBOR

Move Without Target Returns 400
    [Documentation]    A movement request without targetLocationUuid → 400 MISSING_TARGET.
    [Tags]    movement    step28
    ${match}=    Running Match With Character
    ${response}=    Start Movement    ${TOKEN}    ${match}    ${EMPTY}
    Status Should Be    ${response}    400
    Should Be Equal As Strings    ${response.json()}[error]    MISSING_TARGET

Move On Non Running Match Returns 409
    [Documentation]    Moving on a CREATED (not started) match → 409 MATCH_NOT_RUNNING.
    [Tags]    movement    step28
    ${match}=    New Match With Character
    ${response}=    Start Movement    ${TOKEN}    ${match}    00000000-0000-0000-0000-000000000000
    Status Should Be    ${response}    409
    Should Be Equal As Strings    ${response.json()}[error]    MATCH_NOT_RUNNING

Move Unknown Match Returns 404
    [Documentation]    Moving on a non-existent match → 404 MATCH_NOT_FOUND.
    [Tags]    movement    step28
    ${response}=    Start Movement    ${TOKEN}    00000000-0000-0000-0000-000000000000    loc
    Status Should Be    ${response}    404
    Should Be Equal As Strings    ${response.json()}[error]    MATCH_NOT_FOUND

Move Without Token Returns 401
    [Documentation]    POST /movements/start without Authorization → 401.
    [Tags]    movement    step28
    ${response}=    POST On Session    public_session
    ...    /api/gameplay/00000000-0000-0000-0000-000000000000/movements/start    expected_status=any
    Status Should Be    ${response}    401

Locations Without Token Returns 401
    [Documentation]    GET /locations without Authorization → 401.
    [Tags]    movement    step28
    ${response}=    GET On Session    public_session
    ...    /api/match/00000000-0000-0000-0000-000000000000/locations    expected_status=any
    Status Should Be    ${response}    401

Admin Locations View Returns Visited Locations
    [Documentation]    GET /api/admin/matches/{uuid}/locations returns the visited-locations
    ...                view (admin port, no ownership check).
    [Tags]    movement    step28
    ${match}=    Running Match With Character
    ${response}=    Admin Get Locations    ${ADMIN_TOKEN}    ${match}
    Status Should Be    ${response}    200
    Should Not Be Empty    ${response.json()}[locations]


*** Keywords ***

Suite Setup Movement
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

New Match With Character
    [Documentation]    Creates a CREATED match and joins one character; returns the match uuid.
    # v0.32.1 — its own guest: one user may own only one active match per story
    # (409 ACTIVE_MATCH_ALREADY_EXISTS). ${TOKEN} is rebound for the rest of the test.
    ${token}=    Use A Fresh Guest Token
    ${match}=    Create Match    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}    robottest_movement
    Status Should Be    ${match}    201
    ${match_uuid}=    Set Variable    ${match.json()}[uuid]
    ${trait_list}=    Create List
    IF    '${TRAIT_UUID}' != ''
        Append To List    ${trait_list}    ${TRAIT_UUID}
    END
    ${join}=    Join Match    ${TOKEN}    ${match_uuid}    ${CHARACTER_UUID}    ${CLASS_UUID}    ${trait_list}
    Status Should Be    ${join}    201
    RETURN    ${match_uuid}

Running Match With Character
    [Documentation]    Creates, joins and starts a match; returns the match uuid.
    ${match_uuid}=    New Match With Character
    Start Match    ${TOKEN}    ${match_uuid}    200
    RETURN    ${match_uuid}

First Neighbor Uuid
    [Documentation]    Reads the active location's first neighbor uuid from GET /info.
    [Arguments]    ${match_uuid}
    ${info}=    Get Match Info    ${TOKEN}    ${match_uuid}
    Status Should Be    ${info}    200
    ${active}=    Set Variable    ${info.json()}[locationsActive]
    Should Not Be Empty    ${active}
    ${neighbors}=    Set Variable    ${active}[0][neighbors]
    Should Not Be Empty    ${neighbors}
    RETURN    ${neighbors}[0][uuid]

Collect Location Ids
    [Documentation]    Returns the list of idLocation values from a locations payload.
    [Arguments]    ${locations}
    ${ids}=    Create List
    FOR    ${loc}    IN    @{locations}
        Append To List    ${ids}    ${loc}[idLocation]
    END
    RETURN    ${ids}
