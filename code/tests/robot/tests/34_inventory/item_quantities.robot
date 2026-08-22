# =============================================================================
# v0.35.1 — How MANY: the cap on what a character may carry, and the units each
# action moves.
#
# Until this version every quantity was hardcoded: an event ADD gave one unit, an
# event REMOVE took one, and use-item / drop-item discarded the whole row whatever
# it held. Three columns on list_items give those numbers back to the author, and
# what is under test here is the OBSERVABLE half of them:
#
#   * max_per_character — an ADD past the cap is refused WITHOUT failing the event:
#     the response carries an `itemChanges` entry with action NOT_ADDED, the other
#     effects of that same event still land, and the amount held does not grow;
#   * amount_use — one unit by default, so a row of two survives a usage with one;
#   * amount_drop — the authored number of units, and `amountDropped` reports what
#     was actually put down;
#   * one row per (character, item): a second grant stacks onto the row it already
#     has, it never opens a second one.
#
# Backend-agnostic by construction: nothing is addressed by a seeded id or uuid.
# The capped item is found by BEHAVIOUR — run the granting events twice and see
# which item the backend refuses — so the suite runs green on java-sqlite,
# java-postgres, python and aws alike. All four seeds cap exactly one item that a
# repeatable event of the start location hands over.
# =============================================================================

*** Settings ***
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource

Suite Setup       Suite Setup Item Quantities


*** Test Cases ***

A Second Grant Stacks Onto The Row It Already Has
    [Documentation]    v0.35.1 — one row per (character, item), enforced by the schema. A
    ...                second ADD raises the amount; it never opens a second row.
    [Tags]    inventory    step35    quantities
    ${token}    ${match}    ${before}    ${after}=    Bag Filled Twice

    ${uuids}=    Evaluate    [r['itemUuid'] for r in $after]
    ${unique}=   Evaluate    sorted(set($uuids))
    ${sorted}=   Evaluate    sorted($uuids)
    Should Be Equal    ${sorted}    ${unique}
    ...    msg=the same story item came back on two rows — the one-row rule is not enforced
    # And the second round did land somewhere: at least one row holds more than it did.
    # RF7: $var in generator/comprehension body is out of scope — use FOR loop instead
    ${before_map}=    Evaluate    {r['itemUuid']: r['amount'] for r in $before}
    ${grew}=    Set Variable    ${False}
    FOR    ${row}    IN    @{after}
        ${prev}=    Evaluate    $before_map.get($row['itemUuid'], 0)
        IF    ${row}[amount] > ${prev}
            ${grew}=    Set Variable    ${True}
        END
    END
    Should Be True    ${grew}
    ...    msg=the second round of the same events raised no amount at all — nothing stacked

An Item Can Be Capped Per Character
    [Documentation]    max_per_character: the second unit is refused. Not an error — the
    ...                event that offered it ran, and the payload says NOT_ADDED.
    [Tags]    inventory    step35    quantities    max-per-character
    ${token}    ${match}    ${before}    ${after}    ${changes}=    Bag Filled Twice With Changes

    ${refused}=    Evaluate    [c for c in $changes if c.get('action') == 'NOT_ADDED']
    Should Not Be Empty    ${refused}
    ...    msg=no item of the seed is capped — max_per_character cannot be exercised
    # The refusal names the item, and that item did not grow between the two rounds.
    ${item_uuid}=    Set Variable    ${refused}[0][itemUuid]
    ${held_before}=    Amount Of    ${before}    ${item_uuid}
    ${held_after}=     Amount Of    ${after}     ${item_uuid}
    Should Be Equal As Integers    ${held_before}    ${held_after}
    ...    msg=the cap reported a refusal and let the unit in anyway

A Refused Add Does Not Fail The Event That Offered It
    [Documentation]    The whole point of "no error": the same run that was refused one item
    ...                still handed over the others and still answered 200.
    [Tags]    inventory    step35    quantities    max-per-character
    ${token}    ${match}    ${before}    ${after}    ${changes}=    Bag Filled Twice With Changes

    ${refused}=    Evaluate    [c for c in $changes if c.get('action') == 'NOT_ADDED']
    Should Not Be Empty    ${refused}
    ...    msg=no item of the seed is capped — max_per_character cannot be exercised
    ${added}=    Evaluate    [c for c in $changes if c.get('action') == 'ADD']
    Should Not Be Empty    ${added}
    ...    msg=the refused round handed over nothing at all — the refusal stopped the event

Using One Unit Leaves The Rest In The Bag
    [Documentation]    v0.35.1 — amount_use is one by default, so a row of two survives with
    ...                one. Before this version the whole row went, however much it held.
    [Tags]    inventory    step35    quantities    amount-use
    ${token}    ${match}    ${before}    ${after}=    Bag Filled Twice
    ${row}=    First Usable Row With At Least Two    ${after}
    Should Not Be Equal    ${row}    ${NONE}
    ...    msg=no usable item of the seed can be held twice — amount_use cannot be exercised

    ${response}=    Use Item    ${token}    ${match}    ${row}[uuid]    200

    ${rows}=    Inventory Rows    ${token}    ${match}
    ${left}=    Amount Of    ${rows}    ${row}[itemUuid]
    ${expected}=    Evaluate    ${row}[amount] - 1
    Should Be Equal As Integers    ${left}    ${expected}

Dropping Puts Down What The Story Says And Reports It
    [Documentation]    amount_drop units, and `amountDropped` is what actually left the bag —
    ...                never more than the row held.
    [Tags]    inventory    step35    quantities    amount-drop
    ${token}    ${match}    ${before}    ${after}=    Bag Filled Twice
    Should Not Be Empty    ${after}
    ...    msg=no event of the active location granted an item — the seed cannot exercise v0.35.1
    ${row}=    Set Variable    ${after}[0]
    ${held}=   Set Variable    ${row}[amount]

    ${response}=    Drop Item    ${token}    ${match}    ${row}[uuid]    200

    ${dropped}=    Set Variable    ${response.json()}[amountDropped]
    Should Be True    1 <= ${dropped} <= ${held}
    ...    msg=amountDropped must be at least one unit and never more than the row held
    ${rows}=    Inventory Rows    ${token}    ${match}
    ${left}=    Amount Of    ${rows}    ${row}[itemUuid]
    ${expected}=    Evaluate    ${held} - ${dropped}
    Should Be Equal As Integers    ${left}    ${expected}
    ...    msg=what is left in the bag must be what was held minus what was reported


*** Keywords ***

Suite Setup Item Quantities
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

Fresh Quantities Match
    [Documentation]    A fresh running single-player match on its own guest: a bag is filled
    ...                once and an item is spent once, so no match is ever reused. The fresh
    ...                guest is the v0.32.1 duplicate-match guard.
    ${token}=    New Guest Token
    ${match}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY}    robottest_v0351
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

Bag Filled Twice
    [Documentation]    (token, match, rows after ONE round, rows after TWO). The second round
    ...                is what makes a cap observable: every granting event of the start
    ...                location is repeatable, so running them again offers the same items a
    ...                second time.
    ${token}    ${match}    ${before}    ${after}    ${changes}=    Bag Filled Twice With Changes
    RETURN    ${token}    ${match}    ${before}    ${after}

Bag Filled Twice With Changes
    [Documentation]    The same, plus every itemChanges entry the SECOND round answered — the
    ...                round in which a capped item has to be refused.
    FOR    ${attempt}    IN RANGE    6
        ${token}    ${match}=    Fresh Quantities Match
        ${disrupted}=    Fill The Bag    ${token}    ${match}    ${NONE}
        ${before}=    Inventory Rows    ${token}    ${match}
        ${changes}=    Create List
        ${disrupted2}=    Fill The Bag    ${token}    ${match}    ${changes}
        ${after}=    Inventory Rows    ${token}    ${match}
        IF    not ${disrupted} and not ${disrupted2}
            BREAK
        END
    END
    RETURN    ${token}    ${match}    ${before}    ${after}    ${changes}

Fill The Bag
    [Documentation]    Triggers the available events of ${match_uuid} until none is left, and
    ...                stops the moment one of them disrupts the board.
    ...
    ...                The list is re-read after EVERY execution, never iterated as a
    ...                snapshot: the seeds contain events that end the time unit or teleport
    ...                the actor, and after one of those every other event of the old
    ...                location is refused. Returns True when it stopped on a disruption, so
    ...                the caller can retry on a fresh match with that event blacklisted.
    ...
    ...                ${sink}, when it is a list rather than None, collects the itemChanges
    ...                of every answer.
    [Arguments]    ${token}    ${match_uuid}    ${sink}
    ${tried}=    Create List
    FOR    ${attempt}    IN RANGE    30
        ${event_uuid}=    Next Untried Available Event    ${token}    ${match_uuid}    ${tried}
        IF    '${event_uuid}' == ''
            RETURN    ${False}
        END
        Append To List    ${tried}    ${event_uuid}
        ${response}=    Execute Event    ${token}    ${match_uuid}    ${event_uuid}
        IF    ${response.status_code} == 200 and ${sink} is not ${NONE}
            ${changes}=    Get From Dictionary    ${response.json()}    itemChanges    ${EMPTY}
            FOR    ${change}    IN    @{changes}
                Append To List    ${sink}    ${change}
            END
        END
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

First Usable Row With At Least Two
    [Documentation]    The first consumable row holding more than one unit, or None. A usage
    ...                can only be seen to spend PART of a row when the row has parts.
    [Arguments]    ${rows}
    FOR    ${row}    IN    @{rows}
        IF    ${row}[isConsumabile] == ${True} and ${row}[amount] > 1
            RETURN    ${row}
        END
    END
    RETURN    ${NONE}

Amount Of
    [Documentation]    The units of ${item_uuid} the rows hold, or 0 when none do.
    [Arguments]    ${rows}    ${item_uuid}
    ${amount}=    Evaluate    sum(r['amount'] for r in $rows if r['itemUuid'] == '${item_uuid}')
    RETURN    ${amount}

Inventory Rows
    [Arguments]    ${token}    ${match_uuid}
    ${response}=    Get Inventory    ${token}    ${match_uuid}    200
    RETURN    ${response.json()}[items]
