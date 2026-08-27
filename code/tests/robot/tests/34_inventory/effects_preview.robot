# =============================================================================
# Step 35 — The promise: what an item says it will do, before it is used.
#
# Until v0.35.0 the effects of an object reached the client only in the ANSWER of
# use-item, that is once the row was already spent: a healing potion and a poison
# looked exactly alike in the bag. Every inventory row now carries `effects[]`, the
# {statistic, value} of the very list_items_effects rows the usage would apply.
#
# The two halves under test:
#   * the promise is honest — it speaks the engine's vocabulary, it rides on BOTH
#     /inventory and /info players[].items (one mapper, so they cannot drift), and
#     what it names is what using the item actually moves;
#   * an author may withhold it. list_items.flag_show_effects = 0 empties effects[]
#     while leaving the item's behaviour untouched — the unlabelled bottle found in
#     the dark. An empty promise therefore never means "this item does nothing".
#
# Backend-agnostic by construction: no seeded id or uuid is ever named. The rows are
# discovered by BEHAVIOUR — fill the bag with whatever the start location hands out,
# then read the promises off the payload — so the suite runs green on java-sqlite,
# java-postgres, python and aws alike. All four seeds ship exactly one consumable
# whose promise is empty (the heavy ingot), which is what the secret case looks for.
# =============================================================================

*** Settings ***
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource

Suite Setup       Suite Setup Effects Preview


*** Variables ***
# The tokens the engine's applyStat switches on. A code outside this set is authored
# noise: the engine drops it in silence, so the promise must not carry it either.
@{ENGINE_STATISTICS}    life    energy    sad    exp    dex    int    cos    food    magic    coin


*** Test Cases ***

Every Inventory Row Promises Something Or Nothing But Never Null
    [Documentation]    `effects` is always an array. The board iterates it without a null
    ...                check, and "absent" would be indistinguishable from an old backend.
    [Tags]    inventory    step35    effects-preview
    ${token}    ${match}    ${rows}=    Character With A Filled Bag

    FOR    ${row}    IN    @{rows}
        Dictionary Should Contain Key    ${row}    effects
        ${is_list}=    Evaluate    isinstance($row['effects'], list)
        Should Be True    ${is_list}
        ...    msg=effects must be an array on every row, never null and never absent
    END

A Promise Speaks The Engine Vocabulary
    [Documentation]    Every entry is a {statistic, value} the engine would act on, with the
    ...                statistic already normalised server-side — the client never sees the
    ...                SADNESS spelling — and an integer, signed, value.
    [Tags]    inventory    step35    effects-preview
    ${token}    ${match}    ${rows}=    Character With A Filled Bag

    ${promises}=    Evaluate    [e for r in $rows for e in r['effects']]
    Should Not Be Empty    ${promises}
    ...    msg=no item the seed grants promises anything — step 35 cannot be exercised
    FOR    ${effect}    IN    @{promises}
        Dictionary Should Contain Key    ${effect}    statistic
        Dictionary Should Contain Key    ${effect}    value
        List Should Contain Value    ${ENGINE_STATISTICS}    ${effect}[statistic]
        ...    msg=the promise must be normalised to the engine vocabulary
        ${is_int}=    Evaluate    isinstance($effect['value'], int)
        Should Be True    ${is_int}    msg=an effect value is an integer delta
    END

Match Info Reports Exactly The Same Promise
    [Documentation]    One mapper serves the inventory endpoint and the players[] of /info,
    ...                so the two payloads cannot promise different things about one row.
    [Tags]    inventory    step35    effects-preview
    ${token}    ${match}    ${rows}=    Character With A Filled Bag
    ${info}=    Get Match Info    ${token}    ${match}    200

    ${info_rows}=    Info Rows Of The Caller    ${info}    ${match}    ${token}
    ${from_inventory}=    Evaluate    {r['uuid']: r['effects'] for r in $rows}
    ${from_info}=         Evaluate    {r['uuid']: r['effects'] for r in $info_rows}
    Should Be Equal    ${from_inventory}    ${from_info}

What An Item Promises Is What Using It Applies
    [Documentation]    The promise is read off the very rows the usage applies, so every
    ...                statistic it names must show up among the statChanges of the answer.
    ...
    ...                The VALUES are deliberately not compared: the promise is the authored
    ...                delta and statChanges reports what survived the clamp, so a +3 life on
    ...                a nearly-full character legitimately lands as +1.
    [Tags]    inventory    step35    effects-preview
    ${token}    ${match}    ${row}    ${response}=    Use A Row That Promises Something

    ${promised}=    Evaluate    sorted({e['statistic'] for e in $row['effects']})
    ${changed}=     Evaluate    sorted({c['statistic'] for c in $response.json().get('statChanges', [])})
    ${missing}=     Evaluate    [s for s in $promised if s not in $changed]
    Should Be Empty    ${missing}
    ...    msg=the item promised ${promised} and the usage moved ${changed}

An Item Can Keep Its Secret And Still Do Its Work
    [Documentation]    flag_show_effects = 0: the row promises nothing, and using it applies
    ...                its effects all the same. That pair IS the feature — the flag hides
    ...                the promise, it does not author a different item.
    ...
    ...                Discovered by behaviour: a CONSUMABLE whose promise is empty. Every
    ...                seed gives its consumables an effect row, so an empty promise on one
    ...                of them can only come from the flag.
    [Tags]    inventory    step35    effects-preview    flag-show-effects
    ${token}    ${match}    ${row}=    Character Holding A Secret Item

    ${response}=    Use Item    ${token}    ${match}    ${row}[uuid]    200

    ${changes}=    Set Variable    ${response.json()}[statChanges]
    Should Not Be Empty    ${changes}
    ...    msg=the secret item promised nothing AND did nothing — the flag must hide the promise, not the effect
    # And the row is gone: a secret item is spent exactly like any other.
    ${after}=    Inventory Rows    ${token}    ${match}
    ${uuids}=    Evaluate    [r['uuid'] for r in $after]
    Should Not Contain    ${uuids}    ${row}[uuid]

A Non Consumable Item Is Listed With Its Promise Like Any Other
    [Documentation]    The gate is on the ITEM, not on the shelf: an item that can only be
    ...                carried is still described. What refuses it is use-item, not the read.
    [Tags]    inventory    step35    effects-preview
    ${token}    ${match}    ${rows}=    Character With A Filled Bag

    ${carried}=    Evaluate    [r for r in $rows if r['isConsumabile'] is False]
    Skip If    not ${carried}    the seed grants no carried-only item in the start location
    FOR    ${row}    IN    @{carried}
        Dictionary Should Contain Key    ${row}    effects
    END


*** Keywords ***

Suite Setup Effects Preview
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

Fresh Effects Match
    [Documentation]    A fresh running single-player match on its own guest: a bag is filled
    ...                once and an item is spent once, so no match is ever reused. The fresh
    ...                guest is the v0.32.1 duplicate-match guard.
    ${token}=    New Guest Token
    ${match}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY}    robottest_step35fx
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

Fill The Bag
    [Documentation]    Triggers the available events of ${match_uuid} until none is left, and
    ...                stops the moment one of them disrupts the board.
    ...
    ...                The list is re-read after EVERY execution, never iterated as a
    ...                snapshot: the seeds contain events that end the time unit or teleport
    ...                the actor, and after one of those every other event of the old
    ...                location is refused. Returns True when it stopped on a disruption, so
    ...                the caller can retry on a fresh match with that event blacklisted.
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

Character With A Filled Bag
    [Documentation]    (token, match, rows) on a match whose bag holds everything the story
    ...                hands out at the start location.
    ...
    ...                Retries on a FRESH match whenever a disruptive event cut the filling
    ...                short. The blacklist is shared across the suite, so every attempt gets
    ...                further than the last and a handful is enough.
    FOR    ${attempt}    IN RANGE    6
        ${token}    ${match}=    Fresh Effects Match
        ${disrupted}=    Fill The Bag    ${token}    ${match}
        ${rows}=    Inventory Rows    ${token}    ${match}
        IF    not ${disrupted}
            BREAK
        END
    END
    Should Not Be Empty    ${rows}
    ...    msg=no event of the active location granted an item — the seed cannot exercise step 35
    RETURN    ${token}    ${match}    ${rows}

Use A Row That Promises Something
    [Documentation]    (token, match, row, response) for the first row that both promises an
    ...                effect and can actually be used — a promise on a class-restricted item
    ...                is refused at usage time, and that refusal is Step 34's business.
    ${token}    ${match}    ${rows}=    Character With A Filled Bag
    ${candidates}=    Evaluate    [r for r in $rows if r['effects'] and r['isConsumabile'] is True]
    Should Not Be Empty    ${candidates}
    ...    msg=no usable item of the seed promises anything — step 35 cannot be exercised
    FOR    ${row}    IN    @{candidates}
        ${response}=    Use Item    ${token}    ${match}    ${row}[uuid]
        IF    ${response.status_code} == 200
            RETURN    ${token}    ${match}    ${row}    ${response}
        END
    END
    Fail    every item that promised something refused to be used — cannot compare promise and effect

Character Holding A Secret Item
    [Documentation]    (token, match, row) where the row is a CONSUMABLE whose promise is
    ...                empty: the only way a seed produces that is flag_show_effects = 0.
    ${token}    ${match}    ${rows}=    Character With A Filled Bag
    ${secret}=    Evaluate    [r for r in $rows if not r['effects'] and r['isConsumabile'] is True]
    Should Not Be Empty    ${secret}
    ...    msg=the seed grants no item with flag_show_effects = 0 — the secret case cannot run
    RETURN    ${token}    ${match}    ${secret}[0]

Info Rows Of The Caller
    [Documentation]    The items[] of the calling character inside /info players[]. Another
    ...                player's inventory is masked, so the caller's row is the one to read.
    [Arguments]    ${response}    ${match_uuid}    ${token}
    ${players}=    Set Variable    ${response.json()}[players]
    FOR    ${player}    IN    @{players}
        ${items}=    Get From Dictionary    ${player}    items    ${NONE}
        IF    ${items} is not ${NONE} and ${items}
            RETURN    ${items}
        END
    END
    RETURN    @{EMPTY}

Inventory Rows
    [Arguments]    ${token}    ${match_uuid}
    ${response}=    Get Inventory    ${token}    ${match_uuid}    200
    RETURN    ${response.json()}[items]
