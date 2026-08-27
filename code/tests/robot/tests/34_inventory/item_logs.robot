# =============================================================================
# v0.35.4 — Items and resources in the match log.
#
# Until this version the timeline said nothing about items: taking one and
# dropping one left no trace at all, and the usage log was written by the engine
# and read by nobody. Resources were half-told too — v0.35.3 recorded what an
# action COST and nothing recorded what it GAVE, so a player who earned fifty
# coins saw them appear from nowhere.
#
# What is under test here is the OBSERVABLE half of the fix:
#
#   * ITEM_ADD  — an effect handed an item over, and the entry names the event;
#   * ITEM_USE  — the player consumed one, with the units on the entry;
#   * ITEM_DROP — the player put one down (a REMOVE by an effect shares the type);
#   * every entry carries idItem, itemAction and a card slot;
#   * an EVENT entry reports the four resources in two families, cost and gain,
#     and an item usage splits its signed deltas across the very same pair — so
#     one reader covers a move, an event and a potion.
#
# Backend-agnostic by construction: nothing is addressed by a seeded id or uuid.
# The bag is filled by BEHAVIOUR — run whatever the start location offers — so
# the suite runs green on java-sqlite, java-postgres, python and aws alike.
# =============================================================================

*** Settings ***
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource

Suite Setup       Suite Setup Item Logs


*** Test Cases ***

Taking An Item Writes An ITEM_ADD Entry Naming Its Event
    [Documentation]    v0.35.4 — an ADD used to change the bag and leave the timeline blank.
    ...                The entry names the story item, the units and the event whose effect
    ...                handed it over.
    [Tags]    inventory    logs    step35    item-log
    ${token}    ${match}    ${rows}=    Match With A Filled Bag

    ${entries}=    Log Entries Of Type    ${token}    ${match}    ITEM_ADD
    Should Not Be Empty    ${entries}
    ...    msg=no ITEM_ADD entry after an event granted an item — the ADD is not logged
    ${entry}=    Set Variable    ${entries}[0]
    Should Not Be Equal    ${entry}[idItem]    ${NONE}
    ...    msg=an item entry must name the story item it is about
    Should Be Equal    ${entry}[itemAction]    ADD
    Should Be True    ${entry}[counter] >= 1
    Should Not Be Equal    ${entry}[idEvent]    ${NONE}
    ...    msg=an ADD comes from an effect: the entry must name the event that carried it
    Should Not Be Equal    ${entry}[characterUuid]    ${NONE}
    ...    msg=an item entry is character-scoped: it must name who acted

Using An Item Writes An ITEM_USE Entry With The Units It Spent
    [Documentation]    The row the player consumed, and how much of it went.
    [Tags]    inventory    logs    step35    item-log
    ${token}    ${match}    ${rows}=    Match With A Filled Bag
    ${row}=    First Consumable Row    ${rows}
    Should Not Be Equal    ${row}    ${NONE}
    ...    msg=the bag holds no consumable item — use-item cannot be exercised

    Use Item    ${token}    ${match}    ${row}[uuid]    200

    ${entries}=    Log Entries Of Type    ${token}    ${match}    ITEM_USE
    Should Not Be Empty    ${entries}
    ...    msg=no ITEM_USE entry after a usage — log_item_usage is still read by nobody
    ${entry}=    Set Variable    ${entries}[-1]
    Should Be Equal    ${entry}[itemAction]    USE
    Should Be True    ${entry}[counter] >= 1
    # A usage is the player's own doing, so there is no event behind it.
    Should Be Equal    ${entry}[idEvent]    ${NONE}
    ...    msg=a use-item has no owning event: idEvent must stay null

Dropping An Item Writes An ITEM_DROP Entry
    [Documentation]    Without it the timeline would show the item arriving and being used
    ...                and never leaving.
    [Tags]    inventory    logs    step35    item-log
    ${token}    ${match}    ${rows}=    Match With A Filled Bag
    Should Not Be Empty    ${rows}
    ...    msg=no event of the active location granted an item — the case cannot run
    ${row}=    Set Variable    ${rows}[0]

    Drop Item    ${token}    ${match}    ${row}[uuid]    200

    ${entries}=    Log Entries Of Type    ${token}    ${match}    ITEM_DROP
    Should Not Be Empty    ${entries}
    ...    msg=no ITEM_DROP entry after a drop — putting an item down is still not logged
    ${entry}=    Set Variable    ${entries}[-1]
    Should Be Equal    ${entry}[itemAction]    DROP
    Should Be True    ${entry}[counter] >= 1

Every Item Entry Carries A Card Slot Like The Other Types
    [Documentation]    An item entry is narrated by the item's own card. The story need not
    ...                author one — what must hold is that a resolved idCard brings a card
    ...                with it, exactly as for WEATHER, MOVEMENT and EVENT.
    [Tags]    inventory    logs    step35    item-log
    ${token}    ${match}    ${rows}=    Match With A Filled Bag

    ${entries}=    Item Log Entries    ${token}    ${match}
    Should Not Be Empty    ${entries}
    ...    msg=the timeline carries no item entry at all
    FOR    ${entry}    IN    @{entries}
        Dictionary Should Contain Key    ${entry}    idCard
        Dictionary Should Contain Key    ${entry}    card
        IF    ${entry}[idCard] is not ${NONE}
            Should Not Be Equal    ${entry}[card]    ${NONE}
            ...    msg=an entry that resolved a card id came back without the card
        END
    END

An Event Entry Reports What It Took And What It Gave
    [Documentation]    v0.35.3 recorded the price alone. v0.35.4 adds the other half: the
    ...                four resources ride on every entry in two families, and both are
    ...                numbers — never null — so a client can sum a column blindly.
    [Tags]    inventory    logs    step35    resource-log
    ${token}    ${match}    ${rows}=    Match With A Filled Bag

    ${entries}=    Log Entries Of Type    ${token}    ${match}    EVENT
    Should Not Be Empty    ${entries}
    ...    msg=the bag was filled by events, so the timeline must carry EVENT entries
    FOR    ${entry}    IN    @{entries}
        Resource Fields Are Non Negative Numbers    ${entry}
    END

A Usage Splits Its Signed Deltas Across Cost And Gain
    [Documentation]    The same two families carry an item usage: what it drained is a cost,
    ...                what it restored is a gain. Neither is ever negative — that is what
    ...                makes one renderer enough for the whole timeline.
    [Tags]    inventory    logs    step35    resource-log
    ${token}    ${match}    ${rows}=    Match With A Filled Bag
    ${row}=    First Consumable Row    ${rows}
    Should Not Be Equal    ${row}    ${NONE}
    ...    msg=the bag holds no consumable item — use-item cannot be exercised

    Use Item    ${token}    ${match}    ${row}[uuid]    200

    ${entries}=    Log Entries Of Type    ${token}    ${match}    ITEM_USE
    Should Not Be Empty    ${entries}
    ${entry}=    Set Variable    ${entries}[-1]
    Resource Fields Are Non Negative Numbers    ${entry}
    # A resource is never charged and credited by the same action: at most one half moves.
    FOR    ${name}    IN    energy    food    magic    coin
        ${both}=    Evaluate    $entry['${name}Cost'] > 0 and $entry['${name}Gain'] > 0
        Should Not Be True    ${both}
        ...    msg=${name} came back as both spent and gained on one usage — the split is wrong
    END

The Item Entries Take Their Place In The Timeline
    [Documentation]    They are not a separate list: they are sorted in among the others and
    ...                counted in `total`, so paging over the timeline reaches them.
    [Tags]    inventory    logs    step35    item-log
    ${token}    ${match}    ${rows}=    Match With A Filled Bag

    ${response}=    Get Match Logs    ${token}    ${match}    200    limit=200    order=asc
    ${body}=    Set Variable    ${response.json()}
    ${logs}=    Set Variable    ${body}[logs]
    ${items}=    Evaluate    [e for e in $logs if e['type'].startswith('ITEM_')]
    Should Not Be Empty    ${items}
    ...    msg=the item entries are missing from the ordered page
    Should Be True    ${body}[total] >= len($logs)
    ${stamps}=    Evaluate    [e['timestamp'] or '' for e in $logs]
    ${sorted}=    Evaluate    sorted($stamps)
    Should Be Equal    ${stamps}    ${sorted}
    ...    msg=the item entries broke the ascending order of the timeline


*** Keywords ***

Suite Setup Item Logs
    [Documentation]    The story loadout every case builds its own match from, plus the
    ...                blacklist of events that disrupt the board while filling a bag.
    ${blacklist}=    Create List
    Set Suite Variable    ${DISRUPTIVE_EVENTS}    ${blacklist}
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}    ${story}
    Set Suite Variable    ${DIFFICULTY}    ${difficulty}
    Set Suite Variable    ${CHARACTER}    ${character}
    Set Suite Variable    ${CLASS}    ${class}
    Set Suite Variable    ${TRAIT}    ${trait}

Fresh Item Logs Match
    [Documentation]    A fresh running single-player match on its own guest — the v0.32.1
    ...                duplicate-match guard means one guest cannot hold two.
    ${token}=    New Guest Token
    ${match}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY}    robottest_v0354
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

Match With A Filled Bag
    [Documentation]    (token, match, inventory rows) after running whatever the start
    ...                location offers. Retried on a fresh match when an event disrupts the
    ...                board, exactly as item_quantities.robot does.
    FOR    ${attempt}    IN RANGE    6
        ${token}    ${match}=    Fresh Item Logs Match
        ${disrupted}=    Fill The Bag    ${token}    ${match}
        ${rows}=    Inventory Rows    ${token}    ${match}
        IF    not ${disrupted}
            BREAK
        END
    END
    RETURN    ${token}    ${match}    ${rows}

Fill The Bag
    [Documentation]    Triggers the available events of ${match_uuid} until none is left, and
    ...                stops the moment one of them disrupts the board. The list is re-read
    ...                after EVERY execution, never iterated as a snapshot: after a teleport
    ...                or a time-end every other event of the old location is refused.
    [Arguments]    ${token}    ${match_uuid}
    ${tried}=    Create List
    FOR    ${attempt}    IN RANGE    30
        ${event_uuid}=    Next Untried Available Event    ${token}    ${match_uuid}    ${tried}
        IF    '${event_uuid}' == ''
            RETURN    ${False}
        END
        Append To List    ${tried}    ${event_uuid}
        ${response}=    Execute Event    ${token}    ${match_uuid}    ${event_uuid}
        ${disrupted}=    Execution Disrupted The Board    ${response}
        IF    ${disrupted}
            Append To List    ${DISRUPTIVE_EVENTS}    ${event_uuid}
            RETURN    ${True}
        END
    END
    RETURN    ${False}

Execution Disrupted The Board
    [Documentation]    True when the response says the actor no longer stands where it did,
    ...                or can no longer act at all.
    [Arguments]    ${response}
    ${ok}=    Run Keyword And Return Status
    ...    Should Be Equal As Integers    ${response.status_code}    200
    IF    not ${ok}
        RETURN    ${False}
    END
    ${body}=    Set Variable    ${response.json()}
    ${disrupted}=    Evaluate
    ...    bool($body.get('timeEnded') or $body.get('movementApplied') or $body.get('comaTriggered') or $body.get('forcedSleep'))
    RETURN    ${disrupted}

Next Untried Available Event
    [Documentation]    The first currently-available event whose uuid is neither tried nor
    ...                known to disrupt the board, or the empty string when there is none.
    [Arguments]    ${token}    ${match_uuid}    ${tried}
    ${info}=    Get Match Info    ${token}    ${match_uuid}    200
    FOR    ${location}    IN    @{info.json()}[locationsActive]
        ${events}=    Get From Dictionary    ${location}    events    ${EMPTY}
        FOR    ${event}    IN    @{events}
            ${skip}=    Evaluate    '${event}[uuid]' in ${tried} or '${event}[uuid]' in ${DISRUPTIVE_EVENTS}
            IF    ${event}[available] == ${True} and not ${skip}
                RETURN    ${event}[uuid]
            END
        END
    END
    RETURN    ${EMPTY}

Inventory Rows
    [Arguments]    ${token}    ${match_uuid}
    ${response}=    Get Inventory    ${token}    ${match_uuid}    200
    RETURN    ${response.json()}[items]

First Consumable Row
    [Documentation]    The first consumable row of the bag, or None. Only a consumable can
    ...                be used, so only a consumable can produce an ITEM_USE entry.
    [Arguments]    ${rows}
    FOR    ${row}    IN    @{rows}
        IF    ${row}[isConsumabile] == ${True}
            RETURN    ${row}
        END
    END
    RETURN    ${NONE}

Item Log Entries
    [Documentation]    Every ITEM_* entry of the whole timeline, oldest first.
    [Arguments]    ${token}    ${match_uuid}
    ${response}=    Get Match Logs    ${token}    ${match_uuid}    200    limit=200    order=asc
    ${entries}=    Evaluate
    ...    [e for e in $response.json()['logs'] if e['type'].startswith('ITEM_')]
    RETURN    ${entries}

Log Entries Of Type
    [Documentation]    Every entry of one type, oldest first.
    [Arguments]    ${token}    ${match_uuid}    ${type}
    ${response}=    Get Match Logs    ${token}    ${match_uuid}    200    limit=200    order=asc
    ${entries}=    Evaluate
    ...    [e for e in $response.json()['logs'] if e['type'] == '${type}']
    RETURN    ${entries}

Resource Fields Are Non Negative Numbers
    [Documentation]    The eight resource fields are always present and never negative: a
    ...                client sums a column without null checks, which is the whole point of
    ...                reporting zero rather than nothing.
    [Arguments]    ${entry}
    FOR    ${name}    IN    energy    food    magic    coin
        Dictionary Should Contain Key    ${entry}    ${name}Cost
        Dictionary Should Contain Key    ${entry}    ${name}Gain
        Should Be True    $entry['${name}Cost'] is not None and $entry['${name}Cost'] >= 0
        ...    msg=${name}Cost must be a number and never negative
        Should Be True    $entry['${name}Gain'] is not None and $entry['${name}Gain'] >= 0
        ...    msg=${name}Gain must be a number and never negative
    END
