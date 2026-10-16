*** Settings ***
# ---------------------------------------------------------------------------
# resource_costs.robot — v0.35.3: food, magic and coin as a COST of acting.
#
# Until this version only energy and coins could be charged, and only by an event:
# food and magic were numbers that went up and never came down. `cost_food` and
# `cost_magic` on list_events (and `coin_cost` renamed to `cost_coin`) are their first
# sink, and this suite walks the whole round trip:
#
#   1. GET /api/match/{uuid}/info advertises the price of every action — energy, coin,
#      food, magic — BEFORE the player commits to it;
#   2. an action nobody can afford is blocked with NOT_ENOUGH_FOOD / NOT_ENOUGH_MAGIC,
#      and execute-event refuses it with the very same code;
#   3. once the backpack can pay, the action executes and takes exactly what it
#      advertised — never more, never a resource it never mentioned;
#   4. the spend is persisted, so GET /api/matches/{uuid}/logs can say when and how much.
#
# Backend-agnostic: every event is found by BEHAVIOUR (the price it advertises, the
# reason it reports), never by a seeded uuid or id, and the backpack is filled through
# the admin override rather than by playing towards the state.
#
# Tags: events, resources, step35, v0353
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource

Suite Setup    Suite Setup Resource Costs


*** Test Cases ***

Every Event Advertises Its Full Price
    [Documentation]    A cost the player discovers only by being refused reads as a bug. Every
    ...                event of the location carries all four prices, always present and never
    ...                negative — absent keys would make the board render "free".
    [Tags]    events    resources    step35    match-info
    ${token}    ${match}    ${player}=    Fresh Costs Match

    ${events}=    Location Events For    ${token}    ${match}
    Should Not Be Empty    ${events}

    FOR    ${e}    IN    @{events}
        Dictionary Should Contain Key    ${e}    energy
        Dictionary Should Contain Key    ${e}    coin
        Dictionary Should Contain Key    ${e}    food
        Dictionary Should Contain Key    ${e}    magic
        Should Be True    ${e}[coin] >= 0 and ${e}[food] >= 0 and ${e}[magic] >= 0
        ...    msg=event ${e}[uuid] advertises a negative price
    END

    # The seed must be able to exercise the step at all: without a priced event the rest
    # of this suite would pass by testing nothing.
    ${priced}=    Cheapest Priced Event    ${events}
    Should Not Be Equal    ${priced}    ${None}
    ...    msg=no event of the start location costs food, magic or coin — the seed cannot exercise v0.35.3

An Unaffordable Food Cost Blocks The Event And The Endpoint Agrees
    [Documentation]    A fresh backpack holds nothing, so the event asking for food is blocked.
    ...                match-info and execute-event go through ONE check procedure: the flag the
    ...                board reads and the error the endpoint answers must be the same word.
    [Tags]    events    resources    step35
    ${token}    ${match}    ${player}=    Fresh Costs Match

    ${events}=    Location Events For    ${token}    ${match}
    ${blocked}=    Event With Reason    ${events}    NOT_ENOUGH_FOOD
    Should Not Be Equal    ${blocked}    ${None}
    ...    msg=no event reports NOT_ENOUGH_FOOD on a fresh backpack

    Should Not Be True    ${blocked}[available]
    Should Be True    ${blocked}[food] > 0    msg=an event blocked on food must advertise a food price

    ${response}=    Execute Event    ${token}    ${match}    ${blocked}[uuid]    409
    Response Field Should Equal    ${response}    error    NOT_ENOUGH_FOOD

An Unaffordable Magic Cost Blocks The Event And The Endpoint Agrees
    [Documentation]    The magic half of the same contract.
    [Tags]    events    resources    step35
    ${token}    ${match}    ${player}=    Fresh Costs Match

    ${events}=    Location Events For    ${token}    ${match}
    ${blocked}=    Event With Reason    ${events}    NOT_ENOUGH_MAGIC
    Should Not Be Equal    ${blocked}    ${None}
    ...    msg=no event reports NOT_ENOUGH_MAGIC on a fresh backpack

    Should Not Be True    ${blocked}[available]
    Should Be True    ${blocked}[magic] > 0

    ${response}=    Execute Event    ${token}    ${match}    ${blocked}[uuid]    409
    Response Field Should Equal    ${response}    error    NOT_ENOUGH_MAGIC

A Refused Event Takes Nothing At All
    [Documentation]    The check runs BEFORE the deduction: a refusal must leave the backpack
    ...                exactly where it was, including the resources the event could pay for.
    [Tags]    events    resources    step35
    ${token}    ${match}    ${player}=    Fresh Costs Match
    Admin Change Statistics    ${ADMIN_TOKEN}    ${match}    ${player}    200    food=1    magic=1    coin=5
    ${before}=    Get Resources    ${token}    ${match}    200

    ${events}=    Location Events For    ${token}    ${match}
    ${blocked}=    Event With Reason    ${events}    NOT_ENOUGH_FOOD
    Execute Event    ${token}    ${match}    ${blocked}[uuid]    409

    ${after}=    Get Resources    ${token}    ${match}    200
    Should Be Equal As Integers    ${after.json()}[food]     ${before.json()}[food]
    Should Be Equal As Integers    ${after.json()}[magic]    ${before.json()}[magic]
    Should Be Equal As Integers    ${after.json()}[coin]     ${before.json()}[coin]

Filling The Backpack Unlocks The Priced Event
    [Documentation]    The same event, the same match: blocked while the backpack is empty,
    ...                offered once it can pay. Nothing about the event changed — only what
    ...                the character carries.
    [Tags]    events    resources    step35
    ${token}    ${match}    ${player}=    Fresh Costs Match
    ${events}=    Location Events For    ${token}    ${match}
    ${priced}=    Cheapest Priced Event    ${events}
    Should Not Be True    ${priced}[available]    msg=an empty backpack cannot afford a priced event

    Admin Change Statistics    ${ADMIN_TOKEN}    ${match}    ${player}    200
    ...    food=50    magic=50    coin=50

    ${after}=    Location Events For    ${token}    ${match}
    ${same}=    Event By Uuid    ${after}    ${priced}[uuid]
    Should Be True    ${same}[available]
    ...    msg=event ${priced}[uuid] is still blocked (${same}[reason]) with a full backpack
    Should Be Equal    ${same}[reason]    ${None}

Executing A Priced Event Charges Exactly What It Advertised
    [Documentation]    The response reports what was taken and what is left, and GET /resources
    ...                agrees: one deduction, not one per reader.
    [Tags]    events    resources    step35
    ${token}    ${match}    ${player}=    Fresh Costs Match
    Admin Change Statistics    ${ADMIN_TOKEN}    ${match}    ${player}    200
    ...    food=50    magic=50    coin=50

    ${events}=    Location Events For    ${token}    ${match}
    ${priced}=    Cheapest Priced Event    ${events}
    ${before}=    Get Resources    ${token}    ${match}    200

    ${response}=    Execute Event    ${token}    ${match}    ${priced}[uuid]    200
    ${body}=    Set Variable    ${response.json()}

    # What was taken is what the board had shown.
    Should Be Equal As Integers    ${body}[foodSpent]     ${priced}[food]
    Should Be Equal As Integers    ${body}[magicSpent]    ${priced}[magic]
    Should Be Equal As Integers    ${body}[coinSpent]     ${priced}[coin]

    # What is left is what was there minus what was taken.
    ${expected_food}=     Evaluate    ${before.json()}[food] - ${priced}[food]
    ${expected_magic}=    Evaluate    ${before.json()}[magic] - ${priced}[magic]
    ${expected_coin}=     Evaluate    ${before.json()}[coin] - ${priced}[coin]
    Should Be Equal As Integers    ${body}[newFood]     ${expected_food}
    Should Be Equal As Integers    ${body}[newMagic]    ${expected_magic}
    Should Be Equal As Integers    ${body}[newCoin]     ${expected_coin}

    ${after}=    Get Resources    ${token}    ${match}    200
    Should Be Equal As Integers    ${after.json()}[food]     ${expected_food}
    Should Be Equal As Integers    ${after.json()}[magic]    ${expected_magic}
    Should Be Equal As Integers    ${after.json()}[coin]     ${expected_coin}

A Free Event Takes No Resources
    [Documentation]    The deduction touches only what the event asked for. An event with no
    ...                resource price leaves the backpack alone — food and magic included, which
    ...                no event could spend before v0.35.3.
    [Tags]    events    resources    step35
    ${token}    ${match}    ${player}=    Fresh Costs Match
    Admin Change Statistics    ${ADMIN_TOKEN}    ${match}    ${player}    200
    ...    food=50    magic=50    coin=50
    ${before}=    Get Resources    ${token}    ${match}    200

    ${events}=    Location Events For    ${token}    ${match}
    ${free}=    Free Available Event    ${events}
    Should Not Be Equal    ${free}    ${None}    msg=the location offers no free event
    ${response}=    Execute Event    ${token}    ${match}    ${free}[uuid]    200

    Should Be Equal As Integers    ${response.json()}[foodSpent]     0
    Should Be Equal As Integers    ${response.json()}[magicSpent]    0
    Should Be Equal As Integers    ${response.json()}[coinSpent]     0
    # The event may still GRANT resources through its effects; what it must not do is
    # spend any, so the numbers can only have gone up.
    ${after}=    Get Resources    ${token}    ${match}    200
    Should Be True    ${after.json()}[food] >= ${before.json()}[food]
    Should Be True    ${after.json()}[magic] >= ${before.json()}[magic]
    Should Be True    ${after.json()}[coin] >= ${before.json()}[coin]

The Spend Is Recorded In The Match Log
    [Documentation]    Before v0.35.3 an event's price lived only in the HTTP response and was
    ...                never persisted, so nobody could ask when or how much was spent. The
    ...                EVENT row of the timeline now carries it.
    [Tags]    events    resources    step35    logs
    ${token}    ${match}    ${player}=    Fresh Costs Match
    Admin Change Statistics    ${ADMIN_TOKEN}    ${match}    ${player}    200
    ...    food=50    magic=50    coin=50

    ${events}=    Location Events For    ${token}    ${match}
    ${priced}=    Cheapest Priced Event    ${events}
    Execute Event    ${token}    ${match}    ${priced}[uuid]    200

    ${logs}=    Get Match Logs    ${token}    ${match}    200
    ${row}=    Event Log Row With A Price    ${logs.json()}[logs]
    Should Not Be Equal    ${row}    ${None}
    ...    msg=no EVENT row of the timeline carries the price that was just paid

    Should Be Equal As Integers    ${row}[foodCost]     ${priced}[food]
    Should Be Equal As Integers    ${row}[magicCost]    ${priced}[magic]
    Should Be Equal As Integers    ${row}[coinCost]     ${priced}[coin]

Every Neighbor Advertises Its Resource Price
    [Documentation]    The movement half of the same promise. Unlike energy — which sums the
    ...                edge, the destination entry cost and the weather modifier and is reported
    ...                pre-summed — the resources come from the EDGE alone, so what a neighbor
    ...                advertises is exactly what the move will take.
    [Tags]    movement    resources    step35
    ${token}    ${match}    ${player}=    Fresh Costs Match

    ${info}=    Get Match Info    ${token}    ${match}    200
    ${neighbors}=    Current Location Neighbors    ${info.json()}
    Should Not Be Empty    ${neighbors}    msg=the start location has no neighbor

    FOR    ${n}    IN    @{neighbors}
        Dictionary Should Contain Key    ${n}    costFood
        Dictionary Should Contain Key    ${n}    costMagic
        Dictionary Should Contain Key    ${n}    costCoin
        Should Be True    ${n}[costFood] >= 0 and ${n}[costMagic] >= 0 and ${n}[costCoin] >= 0
    END

    # /locations serves the same edges through the movement port: the two readings of one
    # price must agree, or the map and the book would quote different tolls.
    ${locations}=    Get Locations    ${token}    ${match}    200
    FOR    ${loc}    IN    @{locations.json()}[locations]
        FOR    ${n}    IN    @{loc}[neighbors]
            Dictionary Should Contain Key    ${n}    costFood
            Dictionary Should Contain Key    ${n}    costMagic
            Dictionary Should Contain Key    ${n}    costCoin
        END
    END


*** Keywords ***

Suite Setup Resource Costs
    [Documentation]    One story loadout for the whole suite; every test mints its own guest and
    ...                its own match, because a priced event spends a per-match backpack.
    Create Admin Session
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}    ${story}
    Set Suite Variable    ${DIFFICULTY}    ${difficulty}
    Set Suite Variable    ${CHARACTER}    ${character}
    Set Suite Variable    ${CLASS}    ${class}
    Set Suite Variable    ${TRAIT}    ${trait}

Fresh Costs Match
    [Documentation]    A running single-player match, and the character uuid the admin override
    ...                needs to fill its backpack.
    ${token}=    New Guest Token
    ${match}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY}    robottest_v0353
    Status Should Be    ${match}    201
    ${uuid}=    Set Variable    ${match.json()}[uuid]
    ${trait_list}=    Create List
    IF    '${TRAIT}' != ''
        Append To List    ${trait_list}    ${TRAIT}
    END
    ${join}=    Join Match    ${token}    ${uuid}    ${CHARACTER}    ${CLASS}    ${trait_list}
    Status Should Be    ${join}    201
    Start Match    ${token}    ${uuid}    200
    ${info}=    Get Match Info    ${token}    ${uuid}    200
    ${player}=    Set Variable    ${info.json()}[players][0][uuid]
    RETURN    ${token}    ${uuid}    ${player}

# ── reading match-info ───────────────────────────────────────────────────────

Location Events For
    [Documentation]    The events of the location the character currently stands in.
    [Arguments]    ${token}    ${match_uuid}
    ${info}=    Get Match Info    ${token}    ${match_uuid}    200    lang=en
    ${body}=    Set Variable    ${info.json()}
    Should Not Be Empty    ${body}[locationsActive]
    ${current}=    Set Variable    ${body}[currentLocationId]
    FOR    ${entry}    IN    @{body}[locationsActive]
        IF    $entry['idLocation'] == $current    RETURN    ${entry}[events]
    END
    Fail    the character's location ${current} is not among locationsActive

Current Location Neighbors
    [Documentation]    The neighbor entries of the location the character stands in.
    [Arguments]    ${info}
    ${current}=    Set Variable    ${info}[currentLocationId]
    FOR    ${entry}    IN    @{info}[locationsActive]
        IF    $entry['idLocation'] == $current    RETURN    ${entry}[neighbors]
    END
    RETURN    @{EMPTY}

Event By Uuid
    [Arguments]    ${events}    ${uuid}
    FOR    ${e}    IN    @{events}
        IF    $e['uuid'] == $uuid    RETURN    ${e}
    END
    Fail    event ${uuid} is no longer listed at the character's location

Event With Reason
    [Documentation]    The first event blocked for exactly this reason, or None.
    [Arguments]    ${events}    ${reason}
    FOR    ${e}    IN    @{events}
        IF    $e['reason'] == $reason    RETURN    ${e}
    END
    RETURN    ${None}

Cheapest Priced Event
    [Documentation]    The event with the smallest POSITIVE resource price — the one a filled
    ...                backpack can actually pay, as opposed to the deliberately impossible ones
    ...                the seed keeps for the refusal cases. None when the seed prices nothing.
    [Arguments]    ${events}
    ${best}=      Set Variable    ${None}
    ${best_sum}=  Set Variable    ${999999}
    FOR    ${e}    IN    @{events}
        ${total}=    Evaluate    ${e}[food] + ${e}[magic] + ${e}[coin]
        IF    ${total} > 0 and ${total} < ${best_sum}
            ${best}=        Set Variable    ${e}
            ${best_sum}=    Set Variable    ${total}
        END
    END
    RETURN    ${best}

Free Available Event
    [Documentation]    An offered event that asks for no resource at all.
    [Arguments]    ${events}
    FOR    ${e}    IN    @{events}
        ${total}=    Evaluate    ${e}[food] + ${e}[magic] + ${e}[coin]
        IF    ${total} == 0 and ${e}[available] == ${True}    RETURN    ${e}
    END
    RETURN    ${None}

Event Log Row With A Price
    [Documentation]    The EVENT entry of the timeline that carries a non-zero resource spend.
    ...                Every other row of a chain logs zeros, so this finds the one the player
    ...                actually paid for.
    [Arguments]    ${entries}
    FOR    ${row}    IN    @{entries}
        IF    $row['type'] != 'EVENT'    CONTINUE
        ${food}=     Get From Dictionary    ${row}    foodCost     ${0}
        ${magic}=    Get From Dictionary    ${row}    magicCost    ${0}
        ${coin}=     Get From Dictionary    ${row}    coinCost     ${0}
        ${total}=    Evaluate    (${food} or 0) + (${magic} or 0) + (${coin} or 0)
        IF    ${total} > 0    RETURN    ${row}
    END
    RETURN    ${None}
