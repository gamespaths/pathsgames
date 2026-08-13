*** Settings ***
# ---------------------------------------------------------------------------
# neighbor_edge_orientation.robot — the authored endpoints of a neighbor edge on
# GET /api/match/{uuid}/locations.
#
# A story authors an edge ONCE, as A -> B with ONE direction. A two-way edge
# (flagBack = 1) is then listed by /locations from BOTH endpoints, and both
# entries carry that same authored `direction`: it is NOT the way the character
# walks. Standing on B and heading for A the character travels the OPPOSITE way,
# and until v0.33.3 the payload said nothing that let a client tell the two
# traversals apart — so a map had to guess an edge's orientation from the order
# the payload happened to list it in, and drew half of them mirrored.
#
# `idLocationFrom` / `idLocationTo` now travel with every neighbor entry, exactly
# as they already did on /info. This suite pins the contract that matters:
#
#   THE ENDPOINTS ARE THE AUTHORED ONES, NEVER THE TRAVERSAL ONES — the entry that
#   describes walking B -> A must still report from = A, to = B. Reporting B / A
#   would read as a second, opposite edge and lose the orientation entirely.
#
# Both sides of the same edge must therefore be byte-for-byte identical in their
# (from, to, direction) triple; what tells them apart is which location LISTS the
# entry. The suite drives it end-to-end:
#   1. ADMIN picks a forward edge A->B leaving the start location and forces it
#      two-way (flagBack = 1), restoring the original value on teardown.
#   2. PLAYER creates/joins/starts a match and moves A -> B, so both endpoints are
#      visited and /locations lists the edge from both sides.
#   3. The forward entry (listed by A), the return entry (listed by B), the admin
#      view and /info are all checked to agree on A -> B.
#
# Backend-agnostic: edge, locations and ids are discovered at runtime, so it runs
# identically on Java (SQLite/Postgres), Python and AWS.
#
# Tags: locations, movement-back, edge-orientation, step28, regression
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource

Suite Setup       Suite Setup Neighbor Edge Orientation
Suite Teardown    Restore Neighbor Edge Flag Back


*** Variables ***
${NB_UUID}            ${EMPTY}
${NB_ORIG_FLAGBACK}   ${None}
${NB_DIRECTION}       ${EMPTY}
${A_ID}               ${None}
${B_ID}               ${None}
${MATCH_UUID}         ${EMPTY}


*** Test Cases ***

Forward Entry Reports The Authored Endpoints
    [Documentation]    Location A lists B as a neighbor. A is the edge's authored `from`, so the
    ...                entry must report from = A and to = B — the plain, unswapped case.
    [Tags]    locations    edge-orientation    step28    regression
    ${locs}=    Get Locations    ${TOKEN}    ${MATCH_UUID}    200
    ${entry}=    Neighbor Entry    ${locs.json()}    ${A_ID}    ${B_ID}
    Endpoints Should Be Authored    ${entry}    listed by A (forward traversal)

Return Entry Keeps The Authored Endpoints And Does Not Swap Them
    [Documentation]    The character stands on B and can walk back to A. That entry describes the
    ...                RETURN traversal, but the endpoints it carries are still the authored ones:
    ...                from = A, to = B. Reporting from = B / to = A (the way the character walks)
    ...                is the regression this test exists for — it erases the story orientation and
    ...                leaves a client unable to tell a return move from a forward one.
    [Tags]    locations    movement-back    edge-orientation    step28    regression
    ${locs}=    Get Locations    ${TOKEN}    ${MATCH_UUID}    200
    ${entry}=    Neighbor Entry    ${locs.json()}    ${B_ID}    ${A_ID}
    Endpoints Should Be Authored    ${entry}    listed by B (return traversal)
    # Said the other way round, and this is the whole point: the listing location
    # being the edge's `to` is EXACTLY what marks the entry as a return.
    Should Be Equal As Integers    ${entry}[idLocationTo]    ${B_ID}
    ...    msg=the return entry must keep B as the authored `to`, not as the destination

Both Sides Of The Edge Agree On Orientation And Direction
    [Documentation]    One authored edge, one orientation: the entry listed by A and the entry
    ...                listed by B must carry the SAME (from, to, direction) triple. The direction
    ...                is the authored one on both sides — it is never pre-flipped for the return —
    ...                so a client flips it itself when the listing location is `idLocationTo`.
    [Tags]    locations    edge-orientation    step28    regression
    ${locs}=    Get Locations    ${TOKEN}    ${MATCH_UUID}    200
    ${forward}=    Neighbor Entry    ${locs.json()}    ${A_ID}    ${B_ID}
    ${back}=       Neighbor Entry    ${locs.json()}    ${B_ID}    ${A_ID}
    Should Be Equal As Integers    ${forward}[idLocationFrom]    ${back}[idLocationFrom]
    ...    msg=the two sides of one edge disagree on the authored `from`
    Should Be Equal As Integers    ${forward}[idLocationTo]      ${back}[idLocationTo]
    ...    msg=the two sides of one edge disagree on the authored `to`
    Should Be Equal    ${forward}[direction]    ${back}[direction]
    ...    msg=`direction` must stay the authored one on both sides, never the traversal one
    IF    '${NB_DIRECTION}' != '${EMPTY}' and '${NB_DIRECTION}' != 'None'
        Should Be Equal    ${forward}[direction]    ${NB_DIRECTION}
        ...    msg=/locations reports a direction the story never authored
    END

Admin Locations Carry The Same Endpoints
    [Documentation]    The admin view is the same payload without the ownership check, so it must
    ...                carry the endpoints too — an admin map is drawn from it.
    [Tags]    locations    admin    edge-orientation    step28    regression
    ${locs}=    Admin Get Locations    ${TOKEN}    ${MATCH_UUID}    200
    ${forward}=    Neighbor Entry    ${locs.json()}    ${A_ID}    ${B_ID}
    Endpoints Should Be Authored    ${forward}    admin view, listed by A
    ${back}=       Neighbor Entry    ${locs.json()}    ${B_ID}    ${A_ID}
    Endpoints Should Be Authored    ${back}    admin view, listed by B

Locations And Match Info Report One And The Same Orientation
    [Documentation]    /info has carried `idLocationFrom`/`idLocationTo` since v0.28.2 and is the
    ...                orientation a client already trusts. /locations must not contradict it —
    ...                two endpoints describing the same edge mirrored would be worse than one of
    ...                them staying silent.
    [Tags]    locations    match-info    edge-orientation    step28    regression
    ${info}=    Get Match Info    ${TOKEN}    ${MATCH_UUID}    200    lang=en
    ${active}=    Active Location    ${info.json()}    ${B_ID}
    ${info_entry}=    Info Neighbor Entry    ${active}    ${A_ID}
    ${locs}=    Get Locations    ${TOKEN}    ${MATCH_UUID}    200
    ${loc_entry}=    Neighbor Entry    ${locs.json()}    ${B_ID}    ${A_ID}
    Should Be Equal As Integers    ${loc_entry}[idLocationFrom]    ${info_entry}[idLocationFrom]
    ...    msg=/locations and /info disagree on the authored `from` of the same edge
    Should Be Equal As Integers    ${loc_entry}[idLocationTo]      ${info_entry}[idLocationTo]
    ...    msg=/locations and /info disagree on the authored `to` of the same edge


*** Keywords ***

Suite Setup Neighbor Edge Orientation
    [Documentation]    Admin + public sessions, a joinable loadout, a two-way forward edge A->B
    ...                leaving the start location, and a running match with the character moved
    ...                onto B — so /locations lists the edge from BOTH endpoints.
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

    # A forward edge leaving the start location: A == start (authored `from`),
    # B == destination (authored `to`).
    ${start}=    Story Start Location
    Set Suite Variable    ${A_ID}    ${start}
    ${edge}=    Forward Edge From    ${start}
    Set Suite Variable    ${NB_UUID}    ${edge}[uuid]
    Set Suite Variable    ${B_ID}       ${edge}[idLocationTo]
    ${orig}=    Evaluate    $edge.get('flagBack')
    Set Suite Variable    ${NB_ORIG_FLAGBACK}    ${orig}
    ${dir}=    Evaluate    $edge.get('direction') or ''
    Set Suite Variable    ${NB_DIRECTION}    ${dir}

    # Two-way, so standing on B the edge is still listed and the return entry exists.
    Set Neighbor Edge Flag Back    1

    # Start a match and move the character A -> B (forward move, always allowed).
    ${match_uuid}=    Running Match With Character
    Set Suite Variable    ${MATCH_UUID}    ${match_uuid}
    ${b_uuid}=    Destination Uuid From Info    ${match_uuid}
    ${move}=    Start Movement    ${TOKEN}    ${match_uuid}    ${b_uuid}
    Status Should Be    ${move}    200
    Should Be Equal As Integers    ${move.json()}[toLocationId]    ${B_ID}

Running Match With Character
    [Documentation]    Creates, joins and starts a match; returns the match uuid.
    ${match}=    Create Match    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}    robottest_edgeorient
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
    [Arguments]    ${match_uuid}
    ${info}=    Get Match Info    ${TOKEN}    ${match_uuid}    200    lang=en
    ${active}=    Active Location    ${info.json()}    ${A_ID}
    FOR    ${n}    IN    @{active}[neighbors]
        IF    $n['idLocationFrom'] == $A_ID and $n['idLocationTo'] == $B_ID
            RETURN    ${n}[uuid]
        END
    END
    Fail    Forward neighbor ${A_ID}->${B_ID} not visible from the start location

Set Neighbor Edge Flag Back
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

Neighbor Entry
    [Documentation]    The /locations neighbor entry that location ${listed_by} publishes for the
    ...                other endpoint ${other} (the payload names the other endpoint `idLocation`).
    [Arguments]    ${locs}    ${listed_by}    ${other}
    Should Not Be Empty    ${locs}[locations]
    FOR    ${loc}    IN    @{locs}[locations]
        IF    $loc['idLocation'] == $listed_by
            FOR    ${n}    IN    @{loc}[neighbors]
                IF    $n['idLocation'] == $other
                    RETURN    ${n}
                END
            END
            Fail    Location ${listed_by} does not list ${other} among its neighbors
        END
    END
    Fail    Location ${listed_by} is not present in the /locations payload

Info Neighbor Entry
    [Documentation]    The /info neighbor entry of the active location pointing at ${other}.
    [Arguments]    ${active}    ${other}
    FOR    ${n}    IN    @{active}[neighbors]
        IF    $n['idLocation'] == $other
            RETURN    ${n}
        END
    END
    Fail    /info does not list ${other} among the active location's neighbors

Endpoints Should Be Authored
    [Documentation]    The entry carries the story orientation A -> B, whichever side lists it.
    [Arguments]    ${entry}    ${where}
    Dictionary Should Contain Key    ${entry}    idLocationFrom
    ...    msg=neighbor entry (${where}) carries no idLocationFrom — a client cannot orient the edge
    Dictionary Should Contain Key    ${entry}    idLocationTo
    ...    msg=neighbor entry (${where}) carries no idLocationTo — a client cannot orient the edge
    Should Be Equal As Integers    ${entry}[idLocationFrom]    ${A_ID}
    ...    msg=neighbor entry (${where}) reports ${entry}[idLocationFrom] as `from`; the story authored ${A_ID} -> ${B_ID}, so A and B are swapped
    Should Be Equal As Integers    ${entry}[idLocationTo]    ${B_ID}
    ...    msg=neighbor entry (${where}) reports ${entry}[idLocationTo] as `to`; the story authored ${A_ID} -> ${B_ID}, so A and B are swapped

Restore Neighbor Edge Flag Back
    [Documentation]    Reset the edited edge's flagBack to its original value.
    IF    '${NB_UUID}' == '${EMPTY}'    RETURN
    &{patch}=    Create Dictionary    flagBack=${NB_ORIG_FLAGBACK}
    PUT On Session    admin_session
    ...    /api/admin/stories/${STORY_UUID}/location-neighbors/${NB_UUID}    json=${patch}    expected_status=any
