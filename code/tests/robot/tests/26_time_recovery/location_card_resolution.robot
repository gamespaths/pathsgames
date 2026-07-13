*** Settings ***
# ---------------------------------------------------------------------------
# location_card_resolution.robot — locationsActive[].idCard + card resolution.
#
# Endpoint under test (player, Bearer access token from /api/auth/guest):
#   GET /api/match/{uuidMatch}/info  → 200 MatchInfo.locationsActive[]
#
# Regression guard for the cross-backend fix that made `idCard` the single
# source of truth for the visual card of an active location (and its neighbors
# and events):
#   * every active location exposes an `idCard` key alongside its `card`;
#   * when `idCard` is set, the `card` is resolved from the story's card
#     catalog — it is NOT an orphan object embedded on the location;
#   * the resolved card therefore RESOLVES against the public card-detail
#     endpoint (GET /api/content/{uuidStory}/cards/{uuidCard} → 200), which an
#     orphan card (the original AWS bug) never could.
#
# Backend-agnostic: runs against Java, Python and AWS via the shared contract.
#
# Tags: location-card, idcard, match-info, step27
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource

Suite Setup    Suite Setup Location Card


*** Test Cases ***

Active Location Exposes The idCard Key
    [Documentation]    Each active location carries an `idCard` key (integer or null)
    ...                next to its `card`, in addition to the Step 27.x structure.
    [Tags]    location-card    idcard    match-info    step27
    ${active}=    Get Active Location
    Dictionary Should Contain Key    ${active}    idCard
    Dictionary Should Contain Key    ${active}    card

Active Location Card Is Present When idCard Is Set
    [Documentation]    When the active location references a card via `idCard`, the resolved
    ...                `card` object is not null and exposes its uuid (idCard ↔ card coherent).
    [Tags]    location-card    idcard    match-info    step27
    ${active}=    Get Active Location
    IF    $active['idCard'] is not None
        Should Not Be Equal    ${active}[card]    ${None}
        ...    msg=card must be resolved from idCard, got null
        Dictionary Should Contain Key    ${active}[card]    uuid
        Should Not Be Empty    ${active}[card][uuid]
    END

Active Location Card Exists In The Story Catalog
    [Documentation]    THE regression test: the card returned for the active location must be a
    ...                real catalog card. Its uuid resolves via GET /api/content/{story}/cards/
    ...                {uuid} with 200 — an orphan card embedded only on the location (the
    ...                original AWS seed bug) would return 404 CARD_NOT_FOUND.
    [Tags]    location-card    idcard    match-info    step27    regression
    ${active}=    Get Active Location
    IF    $active['card'] is not None
        ${card_uuid}=    Set Variable    ${active}[card][uuid]
        ${response}=    Get Card Info    ${STORY_UUID}    ${card_uuid}
        # 200 = real catalog card; 404 CARD_NOT_FOUND would mean an orphan card.
        Status Should Be    ${response}    200
        Should Be Equal As Strings    ${response.json()}[uuid]    ${card_uuid}
    END

Resolved Location Card Matches The Catalog Card
    [Documentation]    The card fields exposed inside locationsActive are consistent with the
    ...                catalog card identified by the same uuid (same title / awesomeIcon),
    ...                proving the value came from idCard resolution, not a stale literal.
    [Tags]    location-card    idcard    match-info    step27    regression
    ${active}=    Get Active Location
    IF    $active['card'] is not None
        ${card}=    Set Variable    ${active}[card]
        ${response}=    Get Card Info    ${STORY_UUID}    ${card}[uuid]
        Status Should Be    ${response}    200
        ${catalog}=    Set Variable    ${response.json()}
        Should Be Equal As Strings    ${card}[title]          ${catalog}[title]
        Should Be Equal As Strings    ${card}[awesomeIcon]    ${catalog}[awesomeIcon]
    END

Neighbor Cards Resolve From The Catalog When Present
    [Documentation]    When the seed wires a neighbor with a card to the active location, that
    ...                neighbor card is also a real catalog card (resolves with 200). Skipped
    ...                when the start location has no neighbor cards (keeps it backend-agnostic).
    [Tags]    location-card    idcard    match-info    step27    regression
    ${active}=    Get Active Location
    FOR    ${n}    IN    @{active}[neighbors]
        IF    $n['card'] is not None
            ${response}=    Get Card Info    ${STORY_UUID}    ${n}[card][uuid]
            # 200 = real catalog card; 404 would mean an orphan neighbor card.
            Status Should Be    ${response}    200
        END
    END

Neighbors Expose Return Card And Edge Orientation
    [Documentation]    Step 0.28.2 — every neighbor exposes idLocationFrom / idLocationTo /
    ...                cardBack. When cardBack is present it is a real catalog card (resolves
    ...                with 200). Backend-agnostic: skips the catalog check when no cardBack.
    [Tags]    location-card    idcard    match-info    step28    movement-back
    ${active}=    Get Active Location
    FOR    ${n}    IN    @{active}[neighbors]
        Dictionary Should Contain Key    ${n}    idLocationFrom
        Dictionary Should Contain Key    ${n}    idLocationTo
        Dictionary Should Contain Key    ${n}    cardBack
        IF    $n['cardBack'] is not None
            ${response}=    Get Card Info    ${STORY_UUID}    ${n}[cardBack][uuid]
            Status Should Be    ${response}    200
        END
    END


*** Keywords ***

Suite Setup Location Card
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

Get Active Location
    [Documentation]    Creates a match, joins a character, starts it and returns the
    ...                locationsActive entry matching the player's current location.
    ${match}=    New Match With Character
    Start Match    ${TOKEN}    ${match}    200
    ${response}=    Get Match Info    ${TOKEN}    ${match}    200
    ${body}=    Set Variable    ${response.json()}
    Should Not Be Empty    ${body}[locationsActive]
    ${active}=    Find Active Location    ${body}[locationsActive]    ${body}[currentLocationId]
    Should Not Be Equal    ${active}    ${None}
    ...    msg=locationsActive must contain the player's current location
    RETURN    ${active}

New Match With Character
    [Documentation]    Creates a CREATED match and joins one character; returns the match uuid.
    ${match}=    Create Match    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}    robottest_loccard
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
