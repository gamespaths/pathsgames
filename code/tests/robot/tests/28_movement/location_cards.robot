*** Settings ***
# ---------------------------------------------------------------------------
# location_cards.robot — Step 0.28.5: the /locations endpoint now returns a full
# `card` object for every visited location AND every neighbor (previously only
# idCard). The card mirrors CardInfoResponse and is resolved from idCard for the
# requested language.
#
# Endpoints under test:
#   GET  /api/match/{uuidMatch}/locations[?lang=]     → 200
#   GET  /api/admin/matches/{uuidMatch}/locations     → 200 (admin port)
#
# Backend-agnostic: discovers a joinable loadout at runtime and asserts card
# structure + cross-checks each card uuid against GET /api/content/.../cards/...,
# so it runs against Java / Python / AWS interchangeably. Read-only, no teardown.
#
# Tags: movement, locations, location-card, step28
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource

Suite Setup    Suite Setup Location Cards


*** Test Cases ***

Locations Endpoint Returns A Card For Every Visited Location
    [Documentation]    Every location with an idCard exposes a matching `card`
    ...                object whose uuid resolves via the content API.
    [Tags]    movement    locations    location-card    step28
    ${match}=    Running Match With Character
    ${response}=    Get Locations    ${TOKEN}    ${match}
    Status Should Be    ${response}    200
    ${locations}=    Set Variable    ${response.json()}[locations]
    Should Not Be Empty    ${locations}
    FOR    ${loc}    IN    @{locations}
        Dictionary Should Contain Key    ${loc}    card
        IF    $loc['idCard'] is not None
            Card Should Be Resolved    ${loc}[card]
        END
    END

Locations Endpoint Returns A Card For Every Neighbor
    [Documentation]    Each neighbor carries idCard + a matching `card` object
    ...                (the neighbor LOCATION's card).
    [Tags]    movement    locations    location-card    step28
    ${match}=    Running Match With Character
    ${response}=    Get Locations    ${TOKEN}    ${match}
    Status Should Be    ${response}    200
    ${with_neighbors}=    Location With Neighbors    ${response.json()}[locations]
    FOR    ${nb}    IN    @{with_neighbors}[neighbors]
        Dictionary Should Contain Key    ${nb}    idCard
        Dictionary Should Contain Key    ${nb}    card
        IF    $nb['idCard'] is not None
            Card Should Be Resolved    ${nb}[card]
        END
    END

Location Card Has All Required Fields
    [Documentation]    A resolved location card carries the full CardInfoResponse shape.
    [Tags]    movement    locations    location-card    step28
    ${match}=    Running Match With Character
    ${response}=    Get Locations    ${TOKEN}    ${match}
    ${card}=    First Non Null Card    ${response.json()}[locations]
    Card Info Should Have Required Fields    ${card}

Locations Endpoint Accepts The Lang Parameter
    [Documentation]    ?lang= is honored; cards still resolve and titles stay non-empty.
    [Tags]    movement    locations    location-card    step28
    ${match}=    Running Match With Character
    ${headers}=    Get Auth Headers    ${TOKEN}
    ${params}=    Create Dictionary    lang=en
    ${response}=    GET On Session    public_session    /api/match/${match}/locations
    ...    headers=${headers}    params=${params}    expected_status=200
    ${card}=    First Non Null Card    ${response.json()}[locations]
    Should Not Be Empty    ${card}[uuid]

Admin Locations Returns The Same Cards As The Player View
    [Documentation]    The admin view resolves the same card uuids for the first location.
    [Tags]    movement    locations    location-card    step28
    ${match}=    Running Match With Character
    ${player}=    Get Locations    ${TOKEN}    ${match}
    ${admin}=    Admin Get Locations    ${ADMIN_TOKEN}    ${match}
    Status Should Be    ${admin}    200
    ${player_card}=    First Non Null Card    ${player.json()}[locations]
    ${admin_card}=     First Non Null Card    ${admin.json()}[locations]
    Should Be Equal As Strings    ${player_card}[uuid]    ${admin_card}[uuid]


*** Keywords ***

Suite Setup Location Cards
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
    ${match}=    Create Match    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}    robottest_loccards
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

Card Should Be Resolved
    [Documentation]    A card object is present, has a uuid and resolves via the content API.
    [Arguments]    ${card}
    Should Not Be Equal    ${card}    ${None}
    Dictionary Should Contain Key    ${card}    uuid
    Should Not Be Empty    ${card}[uuid]
    ${detail}=    Get Card Info    ${STORY_UUID}    ${card}[uuid]
    Status Should Be    ${detail}    200

Location With Neighbors
    [Documentation]    Returns the first location that has at least one neighbor.
    [Arguments]    ${locations}
    FOR    ${loc}    IN    @{locations}
        ${count}=    Get Length    ${loc}[neighbors]
        IF    ${count} > 0    RETURN    ${loc}
    END
    Fail    No visited location exposes a neighbor

First Non Null Card
    [Documentation]    Returns the first non-null location card in the payload.
    [Arguments]    ${locations}
    FOR    ${loc}    IN    @{locations}
        IF    $loc['card'] is not None    RETURN    ${loc}[card]
    END
    Fail    No visited location exposes a resolved card
