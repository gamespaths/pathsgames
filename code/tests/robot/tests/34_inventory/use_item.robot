# =============================================================================
# Step 34 — Using and dropping: what happens to the row, and to the world.
#
# The acceptance test the roadmap names explicitly lives here: using a CONSUMABLE item
# must make the row disappear, and the item must stop satisfying the item condition of an
# event that was open only because the character carried it. Anything less and the item
# would be spendable twice over.
#
# The other half of the contract is the response shape: use-item answers the
# execute-event payload, so the board reuses its event handler. On an item usage the
# event fields are null and the card is the ITEM's own.
#
# Backend-agnostic: no seeded id or uuid is ever named. The consumable, the item-gated
# event and the non-consumable are all discovered from the API's own answers.
# =============================================================================

*** Settings ***
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource

Suite Setup       Suite Setup Use Item


*** Test Cases ***

Using An Item Answers The Execute-Event Shape With No Event
    [Documentation]    The payload is execute-event's, so the frontend reuses its handler.
    ...                An item owns no event: eventUuid and eventType are null, no event ran,
    ...                nothing was charged, and no choices can be pending.
    [Tags]    inventory    step34    use-item
    ${token}    ${match}    ${row}=    Character Holding A Consumable

    ${response}=    Use Item    ${token}    ${match}    ${row}[uuid]    200

    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Strings    ${body}[status]    APPLIED
    Should Be Equal    ${body}[eventUuid]     ${None}
    Should Be Equal    ${body}[eventType]     ${None}
    Should Be Empty    ${body}[executedEventUuids]
    Should Be Empty    ${body}[pendingChoices]
    Should Be Equal As Integers    ${body}[energySpent]    0
    Should Be Equal As Integers    ${body}[coinSpent]      0
    Should Be True    ${body}[itemRemoved]

Using An Item Removes Its Row Entirely
    [Documentation]    The row is DELETED, not decremented: amount is never touched. That is
    ...                what stops one seeded item from being spent over and over.
    [Tags]    inventory    step34    use-item
    ${token}    ${match}    ${row}=    Character Holding A Consumable
    ${before}=    Inventory Row Uuids    ${token}    ${match}

    Use Item    ${token}    ${match}    ${row}[uuid]    200

    ${after}=    Inventory Row Uuids    ${token}    ${match}
    Should Contain        ${before}    ${row}[uuid]
    Should Not Contain    ${after}     ${row}[uuid]
    Should Be Equal As Integers    ${{ len($after) }}    ${{ len($before) - 1 }}

A Used Item No Longer Satisfies An Item Condition
    [Documentation]    THE acceptance test of step 34. An event gated on an item is open only
    ...                while the character carries it; consuming the item must close it again.
    ...                A backend that decremented instead of deleting, or that forgot to
    ...                refresh the check context, would leave the event open here.
    [Tags]    inventory    step34    use-item
    ${token}    ${match}    ${row}=    Character Holding The Gating Consumable

    ${open_before}=    Item Gated Event Is Available    ${token}    ${match}    ${row}[itemUuid]
    Should Be True    ${open_before}
    ...    msg=the seed offers no event gated on this item — the acceptance test cannot run

    Use Item    ${token}    ${match}    ${row}[uuid]    200

    ${open_after}=    Item Gated Event Is Available    ${token}    ${match}    ${row}[itemUuid]
    Should Not Be True    ${open_after}
    ...    msg=the event stayed open: the consumed item still satisfies its condition

A Non-Consumable Item Cannot Be Used
    [Documentation]    Carrying is not using. A non-consumable item adds weight and can gate
    ...                an event, but use-item refuses it and leaves the row alone.
    [Tags]    inventory    step34    use-item
    ${token}    ${match}    ${row}=    Character Holding A Non Consumable

    ${response}=    Use Item    ${token}    ${match}    ${row}[uuid]    409

    Response Field Should Equal    ${response}    error    ITEM_NOT_CONSUMABLE
    ${after}=    Inventory Row Uuids    ${token}    ${match}
    Should Contain    ${after}    ${row}[uuid]    msg=a refused use must not consume the row

A Non-Consumable Item Can Still Be Dropped
    [Documentation]    Dropping applies neither the consumable gate nor the class gate — being
    ...                able to put a thing down is the whole point of being able to carry it.
    [Tags]    inventory    step34    drop-item
    ${token}    ${match}    ${row}=    Character Holding A Non Consumable

    ${response}=    Drop Item    ${token}    ${match}    ${row}[uuid]    200

    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Strings    ${body}[itemInstanceUuid]    ${row}[uuid]
    Should Be Equal As Integers   ${body}[amountDropped]       ${row}[amount]
    ${after}=    Inventory Row Uuids    ${token}    ${match}
    Should Not Contain    ${after}    ${row}[uuid]

Dropping Lowers The Carried Weight
    [Documentation]    The response reports the weight AFTER the drop, and /inventory agrees.
    [Tags]    inventory    step34    drop-item    step35
    ${token}    ${match}    ${row}=    Character Holding Anything
    ${before}=    Get Inventory    ${token}    ${match}    200

    ${response}=    Drop Item    ${token}    ${match}    ${row}[uuid]    200

    ${after}=    Get Inventory    ${token}    ${match}    200
    Should Be Equal As Integers    ${response.json()}[weight]    ${after.json()}[weight]
    Should Be True    ${after.json()}[weight] <= ${before.json()}[weight]

The Row Uuid Is What Both Actions Name
    [Documentation]    itemInstanceUuid is the INVENTORY ROW, never the story item. Passing
    ...                the story item uuid must be a not-found, not a lucky hit.
    [Tags]    inventory    step34    use-item
    ${token}    ${match}    ${row}=    Character Holding A Consumable

    ${response}=    Use Item    ${token}    ${match}    ${row}[itemUuid]    404

    Response Field Should Equal    ${response}    error    ITEM_NOT_FOUND

Both Actions Refuse A Body Without The Row Uuid
    [Documentation]    A missing field is the caller's mistake: 400, before anything is read.
    [Tags]    inventory    step34
    ${token}    ${match}=    Fresh Use Item Match

    ${used}=     Use Item     ${token}    ${match}    ${EMPTY}    400
    ${dropped}=  Drop Item    ${token}    ${match}    ${EMPTY}    400

    Response Field Should Equal    ${used}       error    MISSING_ITEM
    Response Field Should Equal    ${dropped}    error    MISSING_ITEM

Another Player's Row Is Indistinguishable From One That Does Not Exist
    [Documentation]    The lookup only ever searches the caller's own rows, so an unknown
    ...                uuid and somebody else's row answer exactly the same thing. Nothing
    ...                leaks about what anyone else is carrying.
    [Tags]    inventory    step34    security
    ${token}    ${match}=    Fresh Use Item Match

    ${response}=    Use Item    ${token}    ${match}    11111111-1111-4111-8111-111111111111    404

    Response Field Should Equal    ${response}    error    ITEM_NOT_FOUND

Neither Action Works On A Match That Is Not Running
    [Documentation]    Using and dropping are actions; reading is not.
    [Tags]    inventory    step34
    ${token}    ${match}    ${row}=    Character Holding Anything
    Admin Pause Match    ${ADMIN_TOKEN}    ${match}    200

    ${used}=     Use Item     ${token}    ${match}    ${row}[uuid]    409
    ${dropped}=  Drop Item    ${token}    ${match}    ${row}[uuid]    409

    Response Field Should Equal    ${used}       error    MATCH_NOT_RUNNING
    Response Field Should Equal    ${dropped}    error    MATCH_NOT_RUNNING


*** Keywords ***

Suite Setup Use Item
    Create Admin Session
    # Learned across the suite: the uuids of events that END THE TIME UNIT, teleport the
    # actor or knock it out. Any of those makes every other event of the location refuse,
    # so once one is identified it is never triggered again while filling a bag.
    ${blacklist}=    Create List
    Set Suite Variable    ${DISRUPTIVE_EVENTS}    ${blacklist}
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}    ${story}
    Set Suite Variable    ${DIFFICULTY}    ${difficulty}
    Set Suite Variable    ${CHARACTER}    ${character}
    Set Suite Variable    ${CLASS}    ${class}
    Set Suite Variable    ${TRAIT}    ${trait}

Fresh Use Item Match
    [Documentation]    A fresh running single-player match on its own guest: an inventory is
    ...                spent once, so no match can be reused. The fresh guest is the v0.32.1
    ...                duplicate-match guard.
    ${token}=    New Guest Token
    ${match}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY}    robottest_step34use
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

Fill The Inventory
    [Documentation]    Triggers the available events of ${match_uuid} until none is left, and
    ...                stops the moment one of them disrupts the board.
    ...
    ...                The list is re-read after EVERY execution, never iterated as a
    ...                snapshot: the seeds contain events that end the time unit or teleport
    ...                the actor, and after one of those every other event of the old
    ...                location is refused — so continuing would prove nothing.
    ...
    ...                Returns True when it stopped on a disruption, so the caller can retry
    ...                on a fresh match with that event now blacklisted.
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

Match With A Filled Bag
    [Documentation]    (token, match, rows) on a match whose bag holds everything the story
    ...                hands out at the start location.
    ...
    ...                Retries on a FRESH match whenever a disruptive event cut the filling
    ...                short. The blacklist is shared across the whole suite, so every
    ...                attempt gets further than the last and a handful is enough.
    FOR    ${attempt}    IN RANGE    6
        ${token}    ${match}=    Fresh Use Item Match
        ${disrupted}=    Fill The Inventory    ${token}    ${match}
        ${rows}=    Inventory Rows    ${token}    ${match}
        IF    not ${disrupted}
            RETURN    ${token}    ${match}    ${rows}
        END
    END
    RETURN    ${token}    ${match}    ${rows}

Next Untried Available Event
    [Documentation]    The first currently-available event whose uuid is not in ${tried}, or
    ...                the empty string when there is none left.
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

Character Holding Anything
    [Documentation]    (token, match, row) with at least one row in the bag.
    ${token}    ${match}    ${rows}=    Match With A Filled Bag
    Should Not Be Empty    ${rows}
    ...    msg=no event of the active location granted an item — the seed cannot exercise step 34
    RETURN    ${token}    ${match}    ${rows}[0]

Character Holding A Consumable
    [Documentation]    (token, match, row) where the row is an item the character may USE.
    ${token}    ${match}    ${rows}=    Match With A Filled Bag
    ${row}=    First Row Matching    ${token}    ${match}    ${True}
    Should Not Be Equal    ${row}    ${NONE}
    ...    msg=the seed grants no consumable item — step 34 cannot be exercised
    RETURN    ${token}    ${match}    ${row}

Character Holding A Non Consumable
    [Documentation]    (token, match, row) where the row is an item that can only be carried.
    ${token}    ${match}    ${rows}=    Match With A Filled Bag
    ${row}=    First Row Matching    ${token}    ${match}    ${False}
    Should Not Be Equal    ${row}    ${NONE}
    ...    msg=the seed grants no non-consumable item — the carried-only rule cannot be exercised
    RETURN    ${token}    ${match}    ${row}

Character Holding The Gating Consumable
    [Documentation]    (token, match, row) where the row is a CONSUMABLE that some event of
    ...                the active location is gated on. Discovered by behaviour: the gate is
    ...                visible as an event that became available once the item was obtained.
    ${token}    ${match}=    Fresh Use Item Match
    ${closed}=    Unavailable Event Uuids For Item Condition    ${token}    ${match}
    ${token}    ${match}    ${rows}=    Match With A Filled Bag
    ${row}=    First Consumable Row Opening One Of    ${token}    ${match}    ${closed}
    Should Not Be Equal    ${row}    ${NONE}
    ...    msg=no consumable item of the seed gates an event — the acceptance test cannot run
    RETURN    ${token}    ${match}    ${row}

Inventory Rows
    [Arguments]    ${token}    ${match_uuid}
    ${response}=    Get Inventory    ${token}    ${match_uuid}    200
    RETURN    ${response.json()}[items]

Inventory Row Uuids
    [Arguments]    ${token}    ${match_uuid}
    ${rows}=    Inventory Rows    ${token}    ${match_uuid}
    ${uuids}=    Evaluate    [r['uuid'] for r in $rows]
    RETURN    ${uuids}

First Row Matching
    [Documentation]    The first row whose isConsumabile equals ${consumable}, or None.
    [Arguments]    ${token}    ${match_uuid}    ${consumable}
    ${rows}=    Inventory Rows    ${token}    ${match_uuid}
    FOR    ${row}    IN    @{rows}
        IF    ${row}[isConsumabile] == ${consumable}
            RETURN    ${row}
        END
    END
    RETURN    ${NONE}

Unavailable Event Uuids For Item Condition
    [Documentation]    The events the board refuses with ITEM_CONDITION_NOT_MET right now:
    ...                exactly the ones an item in the bag would open.
    [Arguments]    ${token}    ${match_uuid}
    ${info}=    Get Match Info    ${token}    ${match_uuid}    200
    ${uuids}=    Create List
    FOR    ${location}    IN    @{info.json()}[locationsActive]
        ${events}=    Get From Dictionary    ${location}    events    ${EMPTY}
        FOR    ${event}    IN    @{events}
            ${reason}=    Get From Dictionary    ${event}    reason    ${EMPTY}
            IF    '${reason}' == 'ITEM_CONDITION_NOT_MET'
                Append To List    ${uuids}    ${event}[uuid]
            END
        END
    END
    RETURN    ${uuids}

First Consumable Row Opening One Of
    [Documentation]    The first CONSUMABLE row whose presence turned one of ${closed}
    ...                available. None when no such pair exists in the seed.
    [Arguments]    ${token}    ${match_uuid}    ${closed}
    IF    not ${closed}
        RETURN    ${NONE}
    END
    ${open_now}=    Available Event Uuids Among    ${token}    ${match_uuid}    ${closed}
    IF    not ${open_now}
        RETURN    ${NONE}
    END
    ${row}=    First Row Matching    ${token}    ${match_uuid}    ${True}
    RETURN    ${row}

Available Event Uuids Among
    [Documentation]    Which of ${candidates} the board now says are available.
    [Arguments]    ${token}    ${match_uuid}    ${candidates}
    ${info}=    Get Match Info    ${token}    ${match_uuid}    200
    ${open}=    Create List
    FOR    ${location}    IN    @{info.json()}[locationsActive]
        ${events}=    Get From Dictionary    ${location}    events    ${EMPTY}
        FOR    ${event}    IN    @{events}
            IF    ${event}[available] == ${True} and '${event}[uuid]' in ${candidates}
                Append To List    ${open}    ${event}[uuid]
            END
        END
    END
    RETURN    ${open}

Item Gated Event Is Available
    [Documentation]    True when some event of the active location is currently available AND
    ...                was refused with ITEM_CONDITION_NOT_MET before the item was obtained.
    ...                Used on both sides of a use-item to prove the gate closed again.
    [Arguments]    ${token}    ${match_uuid}    ${item_uuid}
    ${info}=    Get Match Info    ${token}    ${match_uuid}    200
    FOR    ${location}    IN    @{info.json()}[locationsActive]
        ${events}=    Get From Dictionary    ${location}    events    ${EMPTY}
        FOR    ${event}    IN    @{events}
            ${reason}=    Get From Dictionary    ${event}    reason    ${EMPTY}
            IF    ${event}[available] == ${False} and '${reason}' == 'ITEM_CONDITION_NOT_MET'
                RETURN    ${False}
            END
        END
    END
    RETURN    ${True}
