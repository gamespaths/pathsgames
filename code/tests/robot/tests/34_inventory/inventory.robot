# =============================================================================
# Step 34 — Inventory: what a character carries, and what the board can see of it.
#
# What is under test:
#   * GET /api/gameplay/{uuid}/inventory answers the caller's rows, with the carried
#     weight and the capacity;
#   * every row carries BOTH the row uuid and the story item uuid, plus the resolved
#     card — the board consumes the object, never an id;
#   * the same rows ride on /info players[].items, built by the same mapper, so the two
#     payloads cannot drift;
#   * a read is legal in any match status; the two actions are not.
#
# Backend-agnostic by construction: nothing is addressed by a seeded id or uuid. The
# items are discovered by BEHAVIOUR — execute the events the story offers until the
# inventory stops being empty — so the suite runs green on java-sqlite, java-postgres,
# python and aws alike.
# =============================================================================

*** Settings ***
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource

Suite Setup       Suite Setup Inventory


*** Test Cases ***

An Empty Inventory Is An Empty List And Weighs Nothing
    [Documentation]    A character that has picked nothing up carries nothing. The key is
    ...                present and the array is empty — never null, never absent.
    [Tags]    inventory    step34
    ${token}    ${match}=    Fresh Inventory Match

    ${response}=    Get Inventory    ${token}    ${match}    200

    ${body}=    Set Variable    ${response.json()}
    Response Should Contain Field    ${response}    items
    Should Be Empty    ${body}[items]
    Should Be Equal As Integers    ${body}[weight]    0
    Should Be True    ${body}[weightMax] > 0
    Should Be Equal As Strings    ${body}[matchUuid]    ${match}

A Granted Item Appears In The Inventory With Its Card
    [Documentation]    Somewhere in the story an event hands an item over. Once it has, the
    ...                row names both itself and its story item, and carries the resolved
    ...                card: react-game never resolves a card by id.
    [Tags]    inventory    step34
    ${token}    ${match}=    Fresh Inventory Match
    ${row}=    Grant Any Item    ${token}    ${match}

    Dictionary Should Contain Key    ${row}    uuid
    Dictionary Should Contain Key    ${row}    itemUuid
    Should Not Be Equal    ${row}[uuid]    ${row}[itemUuid]
    ...    msg=the row uuid and the story item uuid must be two different things
    Dictionary Should Contain Key    ${row}    isConsumabile
    Dictionary Should Contain Key    ${row}    card
    Should Not Be Empty    ${row}[uuid]
    Should Be True    ${row}[amount] >= 1

The Carried Weight Is The Sum Of The Rows
    [Documentation]    weight = SUM(item.weight x amount), and it never exceeds nothing:
    ...                it is the number the movement gate acts on.
    [Tags]    inventory    step34    step35
    ${token}    ${match}=    Fresh Inventory Match
    Grant Any Item    ${token}    ${match}

    ${response}=    Get Inventory    ${token}    ${match}    200
    ${body}=    Set Variable    ${response.json()}

    ${expected}=    Set Variable    ${0}
    FOR    ${row}    IN    @{body}[items]
        ${expected}=    Evaluate    ${expected} + (${row}[weight] or 0) * (${row}[amount] or 1)
    END
    Should Be Equal As Integers    ${body}[weight]    ${expected}

Match Info Reports The Very Same Rows
    [Documentation]    /info players[].items and /inventory items[] are built by one mapper,
    ...                so the board sees the same objects whichever endpoint served them.
    [Tags]    inventory    step34
    ${token}    ${match}=    Fresh Inventory Match
    Grant Any Item    ${token}    ${match}

    ${inventory}=    Get Inventory    ${token}    ${match}    200
    ${info}=         Get Match Info   ${token}    ${match}    200

    ${player}=    Set Variable    ${info.json()}[players][0]
    Should Be Equal As Integers    ${player}[weight]    ${inventory.json()}[weight]
    Should Be Equal As Integers
    ...    ${{ len($player['items']) }}    ${{ len($inventory.json()['items']) }}
    ${row_uuids}=       Evaluate    sorted(r['uuid'] for r in $player['items'])
    ${inv_uuids}=       Evaluate    sorted(r['uuid'] for r in $inventory.json()['items'])
    Should Be Equal    ${row_uuids}    ${inv_uuids}

The Inventory Is Readable Even When The Match Is Not Running
    [Documentation]    Reading what you carry is not an action: only use-item and drop-item
    ...                require a RUNNING match.
    [Tags]    inventory    step34
    ${token}    ${match}=    Fresh Inventory Match
    Admin Pause Match    ${ADMIN_TOKEN}    ${match}    200

    ${response}=    Get Inventory    ${token}    ${match}    200

    Response Should Contain Field    ${response}    items

An Anonymous Caller Gets Nothing
    [Documentation]    Both reads sit behind the JWT filter.
    [Tags]    inventory    step34    security
    ${token}    ${match}=    Fresh Inventory Match

    ${response}=    Get Inventory    ${EMPTY}    ${match}    401

    Response Should Contain Field    ${response}    error

An Unknown Match Is A Not-Found
    [Documentation]    An unknown match and a match the caller is not in are deliberately
    ...                indistinguishable: neither leaks the other's existence.
    [Tags]    inventory    step34    security
    ${token}=    New Guest Token

    ${response}=    Get Inventory    ${token}    00000000-0000-4000-8000-000000000000    404

    Response Field Should Equal    ${response}    error    MATCH_NOT_FOUND


*** Keywords ***

Suite Setup Inventory
    [Documentation]    An admin session (to pause a match) plus the story loadout every case
    ...                builds its own match from.
    Create Admin Session
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}    ${story}
    Set Suite Variable    ${DIFFICULTY}    ${difficulty}
    Set Suite Variable    ${CHARACTER}    ${character}
    Set Suite Variable    ${CLASS}    ${class}
    Set Suite Variable    ${TRAIT}    ${trait}

Fresh Inventory Match
    [Documentation]    A fresh running single-player match on its own guest: the inventory
    ...                latches per match, so a spent one cannot be reused. The fresh guest is
    ...                the v0.32.1 duplicate-match guard.
    ${token}=    New Guest Token
    ${match}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY}    robottest_step34
    Status Should Be    ${match}    201
    ${uuid}=    Set Variable    ${match.json()}[uuid]
    ${trait_list}=    Create List
    IF    '${TRAIT}' != ''
        Append To List    ${trait_list}    ${TRAIT}
    END
    ${join}=    Join Match    ${token}    ${uuid}    ${CHARACTER}    ${CLASS}    ${trait_list}
    Status Should Be    ${join}    201
    Start Match    ${token}    ${uuid}    200
    RETURN    ${token}    ${uuid}

Grant Any Item
    [Documentation]    Executes the available events of the active location until the
    ...                inventory stops being empty, and returns the first row.
    ...
    ...                Addressed by BEHAVIOUR, never by a seeded id: which event happens to
    ...                grant an item differs between the seeds of the four backends.
    [Arguments]    ${token}    ${match_uuid}
    ${row}=    Execute Events Until An Item Appears    ${token}    ${match_uuid}
    Should Not Be Equal    ${row}    ${NONE}
    ...    msg=no event of the active location granted an item — the seed cannot exercise step 34
    RETURN    ${row}

Execute Events Until An Item Appears
    [Documentation]    Returns the first inventory row that shows up, or None.
    ...
    ...                The available list is re-read after EVERY execution, and never
    ...                iterated as a snapshot: the seeds contain events that teleport the
    ...                actor elsewhere or end the time unit, and after one of those every
    ...                other event of the old list is refused. Each uuid is tried once.
    [Arguments]    ${token}    ${match_uuid}
    ${tried}=    Create List
    FOR    ${attempt}    IN RANGE    30
        ${event_uuid}=    Next Untried Available Event    ${token}    ${match_uuid}    ${tried}
        IF    '${event_uuid}' == ''
            BREAK
        END
        Append To List    ${tried}    ${event_uuid}
        Execute Event    ${token}    ${match_uuid}    ${event_uuid}
        ${response}=    Get Inventory    ${token}    ${match_uuid}    200
        ${items}=    Set Variable    ${response.json()}[items]
        IF    ${items}
            RETURN    ${items}[0]
        END
    END
    RETURN    ${NONE}

Next Untried Available Event
    [Documentation]    The first currently-available event whose uuid is not in ${tried}, or
    ...                the empty string when there is none left.
    [Arguments]    ${token}    ${match_uuid}    ${tried}
    ${events}=    Available Event Uuids    ${token}    ${match_uuid}
    FOR    ${event_uuid}    IN    @{events}
        IF    '${event_uuid}' not in ${tried}
            RETURN    ${event_uuid}
        END
    END
    RETURN    ${EMPTY}

Available Event Uuids
    [Documentation]    The uuids of the events the board says the caller can trigger here.
    [Arguments]    ${token}    ${match_uuid}
    ${info}=    Get Match Info    ${token}    ${match_uuid}    200
    ${active}=    Set Variable    ${info.json()}[locationsActive]
    ${uuids}=    Create List
    FOR    ${location}    IN    @{active}
        ${events}=    Get From Dictionary    ${location}    events    ${EMPTY}
        FOR    ${event}    IN    @{events}
            IF    ${event}[available] == ${True}
                Append To List    ${uuids}    ${event}[uuid]
            END
        END
    END
    RETURN    ${uuids}
