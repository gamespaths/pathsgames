*** Settings ***
# ---------------------------------------------------------------------------
# neighbor_card_back.robot — Step 0.28.2 neighbor "return card" (idCardBack).
#
# End-to-end regression for the cross-backend contract:
#   1. ADMIN sets a neighbor's idCard (forward) + idCardBack (return) via
#      PUT /api/admin/stories/{uuid}/location-neighbors/{euuid}  (port 8044).
#   2. PLAYER creates/joins/starts a match and reads
#      GET /api/match/{uuid}/info?lang=en.
#   3. The edited neighbor must surface a forward `card` (from idCard) AND a
#      DISTINCT return `cardBack` (from idCardBack); both resolve to real
#      catalog cards.
#
# This is the test that catches the AWS desync where match-info read the
# gameplay `neighbors` copy while admin edits only touched `locationNeighbors`
# (cardBack wrongly fell back to the forward card). Backend-agnostic: card ids
# and the start location are discovered at runtime, so it runs identically on
# Java (SQLite/Postgres), Python and AWS.
#
# Tags: match-info, movement-back, step28, regression
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource

Suite Setup    Suite Setup Neighbor Card Back


*** Variables ***
${NB_UUID}          ${EMPTY}
${NB_ORIG_CARD}     ${None}
${NB_ORIG_BACK}     ${None}


*** Test Cases ***

Admin-Set Neighbor idCardBack Is Reflected As A Distinct cardBack In Match Info
    [Documentation]    Wiring idCard + idCardBack on a neighbor via the admin API must produce,
    ...                in match-info, a forward card (idCard) and a distinct return card
    ...                (idCardBack) — both real catalog cards. Guards the gameplay/admin desync.
    [Tags]    match-info    movement-back    step28    regression
    [Teardown]    Restore Neighbor Cards

    # Two distinct catalog cards to wire as forward / return.
    ${cards}=    Admin List Entities    cards
    Should Be True    len($cards) >= 2    msg=story needs at least two cards to run this test
    ${id_a}    ${uuid_a}=    Card Id And Uuid    ${cards}[0]
    ${id_b}    ${uuid_b}=    Card Id And Uuid    ${cards}[1]
    Should Not Be Equal As Strings    ${uuid_a}    ${uuid_b}

    # A neighbor edge that touches the start location (so it shows in match-info).
    ${start}=    Story Start Location
    ${nb}=    Neighbor Touching    ${start}
    Set Suite Variable    ${NB_UUID}         ${nb}[uuid]
    ${orig_card}=    Evaluate    $nb.get('idCard')
    ${orig_back}=    Evaluate    $nb.get('idCardBack')
    Set Suite Variable    ${NB_ORIG_CARD}    ${orig_card}
    Set Suite Variable    ${NB_ORIG_BACK}    ${orig_back}
    ${nb_from}=    Set Variable    ${nb}[idLocationFrom]
    ${nb_to}=      Set Variable    ${nb}[idLocationTo]

    # Wire forward + return cards through the admin API (partial update).
    &{patch}=    Create Dictionary    idCard=${id_a}    idCardBack=${id_b}
    ${resp}=    PUT On Session    admin_session
    ...    /api/admin/stories/${STORY_UUID}/location-neighbors/${NB_UUID}    json=${patch}
    Status Should Be    ${resp}    200

    # Play through to a running match and read the enriched match-info.
    ${info}=    Start Match And Get Info
    ${active}=    Active Location    ${info}    ${start}
    ${nbi}=    Neighbor In Info By Edge    ${active}    ${nb_from}    ${nb_to}

    # Forward card from idCard, return card from idCardBack — distinct, both real.
    Should Not Be Equal    ${nbi}[card]      ${None}    msg=forward card missing
    Should Not Be Equal    ${nbi}[cardBack]  ${None}    msg=return card missing
    Should Be Equal As Strings    ${nbi}[card][uuid]      ${uuid_a}
    Should Be Equal As Strings    ${nbi}[cardBack][uuid]  ${uuid_b}
    Should Not Be Equal As Strings    ${nbi}[card][uuid]    ${nbi}[cardBack][uuid]
    ${ca}=    Get Card Info    ${STORY_UUID}    ${nbi}[card][uuid]
    Status Should Be    ${ca}    200
    ${cb}=    Get Card Info    ${STORY_UUID}    ${nbi}[cardBack][uuid]
    Status Should Be    ${cb}    200


*** Keywords ***

Suite Setup Neighbor Card Back
    [Documentation]    Admin session (port 8044) + a joinable public loadout + a guest token.
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

Card Id And Uuid
    [Documentation]    Returns (cardId, cardUuid). idCard/idCardBack reference the card PK `id`.
    [Arguments]    ${card}
    ${cid}=    Evaluate    $card.get('id') if $card.get('id') is not None else $card.get('idCard')
    RETURN    ${cid}    ${card}[uuid]

Story Start Location
    ${resp}=    GET On Session    admin_session    /api/admin/stories/${STORY_UUID}
    Status Should Be    ${resp}    200
    ${start}=    Set Variable    ${resp.json()}[idLocationStart]
    Should Not Be Equal    ${start}    ${None}    msg=story has no idLocationStart
    RETURN    ${start}

Neighbor Touching
    [Documentation]    First neighbor edge with an endpoint on ${loc_id} (so it appears in
    ...                the active location's neighbor list of match-info).
    [Arguments]    ${loc_id}
    ${neighbors}=    Admin List Entities    location-neighbors
    Should Not Be Empty    ${neighbors}
    FOR    ${n}    IN    @{neighbors}
        ${u}=    Evaluate    $n.get('uuid')
        IF    $u and ($n['idLocationFrom'] == $loc_id or $n['idLocationTo'] == $loc_id)
            RETURN    ${n}
        END
    END
    Fail    No addressable neighbor (with a uuid) touches the start location ${loc_id}

Start Match And Get Info
    ${match}=    Create Match    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}    robottest_cardback
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

Neighbor In Info By Edge
    [Arguments]    ${active}    ${nb_from}    ${nb_to}
    FOR    ${n}    IN    @{active}[neighbors]
        IF    $n['idLocationFrom'] == $nb_from and $n['idLocationTo'] == $nb_to
            RETURN    ${n}
        END
    END
    Fail    Edited neighbor (${nb_from}->${nb_to}) not found in match-info neighbors

Restore Neighbor Cards
    [Documentation]    Reset the edited neighbor's idCard/idCardBack to their original values.
    IF    '${NB_UUID}' == '${EMPTY}'    RETURN
    &{patch}=    Create Dictionary    idCard=${NB_ORIG_CARD}    idCardBack=${NB_ORIG_BACK}
    PUT On Session    admin_session
    ...    /api/admin/stories/${STORY_UUID}/location-neighbors/${NB_UUID}    json=${patch}    expected_status=any
