# =============================================================================
# Step 35 — Resources: food, magic, coin, and the weight that finally means something.
#
# Two halves:
#   * GET /api/gameplay/{uuid}/resources answers plain numbers — no card, because a
#     resource is not a story entity — and /info players[] reports the same ones;
#   * the carried weight is fed into the movement gate, so a character loaded past its
#     capacity is refused with OVERWEIGHT. Until this step that check was dead code:
#     the store adapter passed a hardcoded 0.
#
# Backend-agnostic: the resources are moved by whatever event of the seed moves them, and
# the overweight case is reached by picking up whatever the story hands out, never by
# naming a seeded id.
# =============================================================================

*** Settings ***
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource

Suite Setup       Suite Setup Resources


*** Test Cases ***

Resources Are Plain Numbers With No Card
    [Documentation]    A resource has no id_card and never will: it is not a story entity.
    [Tags]    resources    step35
    ${token}    ${match}=    Fresh Resources Match

    ${response}=    Get Resources    ${token}    ${match}    200

    ${body}=    Set Variable    ${response.json()}
    Response Should Contain Field    ${response}    food
    Response Should Contain Field    ${response}    magic
    Response Should Contain Field    ${response}    coin
    Response Should Contain Field    ${response}    weight
    Response Should Contain Field    ${response}    weightMax
    Dictionary Should Not Contain Key    ${body}    card
    Should Be True    ${body}[weightMax] > 0

Match Info Reports The Same Resources
    [Documentation]    Step 35 promoted food/magic/coin onto the shared character block, so
    ...                /info players[] finally carries them. The two must agree.
    [Tags]    resources    step35
    ${token}    ${match}=    Fresh Resources Match
    Spend Every Available Event    ${token}    ${match}

    ${resources}=    Get Resources    ${token}    ${match}    200
    ${info}=         Get Match Info   ${token}    ${match}    200

    ${player}=    Set Variable    ${info.json()}[players][0]
    Should Be Equal As Integers    ${player}[food]    ${resources.json()}[food]
    Should Be Equal As Integers    ${player}[magic]   ${resources.json()}[magic]
    Should Be Equal As Integers    ${player}[coin]    ${resources.json()}[coin]
    Should Be Equal As Integers    ${player}[weight]  ${resources.json()}[weight]

An Event That Grants Resources Moves The Numbers
    [Documentation]    Events have written the backpack since step 29; what is new is that the
    ...                endpoint can be asked about it.
    [Tags]    resources    step35
    ${token}    ${match}=    Fresh Resources Match
    ${before}=    Get Resources    ${token}    ${match}    200

    Spend Every Available Event    ${token}    ${match}

    ${after}=    Get Resources    ${token}    ${match}    200
    ${moved}=    Evaluate
    ...    ${after.json()}[food] != ${before.json()}[food] or ${after.json()}[magic] != ${before.json()}[magic] or ${after.json()}[coin] != ${before.json()}[coin]
    Should Be True    ${moved}
    ...    msg=no event of the active location moved food/magic/coin — the seed cannot exercise step 35

Food Magic And Coins Weigh Nothing
    [Documentation]    Only items have weight. A backpack full of coins is still a light one.
    [Tags]    resources    step35
    ${token}    ${match}=    Fresh Resources Match
    ${before}=    Get Resources    ${token}    ${match}    200
    Spend Every Resource Only Event    ${token}    ${match}

    ${after}=    Get Resources    ${token}    ${match}    200

    Should Be Equal As Integers    ${after.json()}[weight]    ${before.json()}[weight]

The Carried Weight Matches The Inventory
    [Documentation]    One formula, two endpoints: SUM(item.weight x amount). If they ever
    ...                disagreed, the board would show a weight the movement gate ignores.
    [Tags]    resources    step35
    ${token}    ${match}=    Fresh Resources Match
    Spend Every Available Event    ${token}    ${match}

    ${resources}=    Get Resources    ${token}    ${match}    200
    ${inventory}=    Get Inventory    ${token}    ${match}    200

    Should Be Equal As Integers    ${resources.json()}[weight]      ${inventory.json()}[weight]
    Should Be Equal As Integers    ${resources.json()}[weightMax]   ${inventory.json()}[weightMax]

Movement Is Refused When The Character Is Overloaded
    [Documentation]    The step-35 payoff: MovementAvailabilityChecker has always refused an
    ...                overloaded mover, but the adapter fed it a hardcoded 0, so the branch
    ...                was dead. Loading the character past its capacity must now reach it.
    ...
    ...                Skipped, not failed, when the seed cannot pile on enough weight: the
    ...                rule is proved by unit tests on every backend, and a story that hands
    ...                out only light things is a legitimate story.
    [Tags]    resources    step35    movement
    ${token}    ${match}=    Fresh Resources Match
    ${overloaded}=    Load Past Capacity    ${token}    ${match}
    IF    not ${overloaded}
        Skip    the seed cannot load a character past its capacity — OVERWEIGHT unreachable here
    END

    ${neighbor}=    Any Neighbor Uuid    ${token}    ${match}
    Should Not Be Equal    ${neighbor}    ${EMPTY}    msg=the start location has no neighbor

    ${response}=    Start Movement    ${token}    ${match}    ${neighbor}    409

    Response Field Should Equal    ${response}    error    OVERWEIGHT

An Anonymous Caller Gets Nothing
    [Tags]    resources    step35    security
    ${token}    ${match}=    Fresh Resources Match

    ${response}=    Get Resources    ${EMPTY}    ${match}    401

    # The JWT filter answers MISSING_TOKEN before the controller is ever reached; the
    # controller's own UNAUTHENTICATED is for a request that carries a token it cannot
    # resolve. Either way the caller learns nothing about the match.
    Response Should Contain Field    ${response}    error

An Unknown Match Is A Not-Found
    [Tags]    resources    step35    security
    ${token}=    New Guest Token

    ${response}=    Get Resources    ${token}    00000000-0000-4000-8000-000000000000    404

    Response Field Should Equal    ${response}    error    MATCH_NOT_FOUND


*** Keywords ***

Suite Setup Resources
    Create Admin Session
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}    ${story}
    Set Suite Variable    ${DIFFICULTY}    ${difficulty}
    Set Suite Variable    ${CHARACTER}    ${character}
    Set Suite Variable    ${CLASS}    ${class}
    Set Suite Variable    ${TRAIT}    ${trait}

Fresh Resources Match
    ${token}=    New Guest Token
    ${match}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY}    robottest_step35
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

Spend Every Available Event
    [Documentation]    Triggers the available events until none is left untried.
    ...
    ...                The list is re-read after EVERY execution, and never iterated as a
    ...                snapshot: the seeds contain events that teleport the actor elsewhere or
    ...                end the time unit, and after one of those every other event of the old
    ...                list is refused.
    [Arguments]    ${token}    ${match_uuid}
    ${tried}=    Create List
    FOR    ${attempt}    IN RANGE    30
        ${event_uuid}=    Next Untried Available Event    ${token}    ${match_uuid}    ${tried}
        IF    '${event_uuid}' == ''
            BREAK
        END
        Append To List    ${tried}    ${event_uuid}
        Execute Event    ${token}    ${match_uuid}    ${event_uuid}
    END

Next Untried Available Event
    [Documentation]    The first currently-available event whose uuid is not in ${tried}, or
    ...                the empty string when there is none left.
    ...
    ...                ${excluded} leaves a set of events out of the walk entirely — the ones
    ...                that end the time unit, for a caller that must not be interrupted.
    [Arguments]    ${token}    ${match_uuid}    ${tried}    ${excluded}=${{ [] }}
    ${info}=    Get Match Info    ${token}    ${match_uuid}    200
    FOR    ${location}    IN    @{info.json()}[locationsActive]
        ${events}=    Get From Dictionary    ${location}    events    ${EMPTY}
        FOR    ${event}    IN    @{events}
            IF    ${event}[available] == ${True} and '${event}[uuid]' not in ${tried} and '${event}[uuid]' not in ${excluded}
                RETURN    ${event}[uuid]
            END
        END
    END
    RETURN    ${EMPTY}

Spend Every Resource Only Event
    [Documentation]    Triggers available events one at a time, keeping only those that left
    ...                the inventory untouched — so the weight assertion is about resources.
    [Arguments]    ${token}    ${match_uuid}
    ${info}=    Get Match Info    ${token}    ${match_uuid}    200
    FOR    ${location}    IN    @{info.json()}[locationsActive]
        ${events}=    Get From Dictionary    ${location}    events    ${EMPTY}
        FOR    ${event}    IN    @{events}
            IF    ${event}[available] == ${True}
                ${response}=    Execute Event    ${token}    ${match_uuid}    ${event}[uuid]
                ${granted}=    Run Keyword And Return Status
                ...    Should Be True    ${response.json()}[itemAdded]
                IF    ${granted}
                    Drop Everything    ${token}    ${match_uuid}
                END
            END
        END
    END

Drop Everything
    [Documentation]    Empties the bag, so the carried weight is back where it started.
    [Arguments]    ${token}    ${match_uuid}
    ${response}=    Get Inventory    ${token}    ${match_uuid}    200
    FOR    ${row}    IN    @{response.json()}[items]
        Drop Item    ${token}    ${match_uuid}    ${row}[uuid]
    END

Load Past Capacity
    [Documentation]    True once the carried weight exceeds the capacity.
    ...
    ...                Walks the granting events of the location one at a time: each is
    ...                repeated while it keeps stacking rows — a granter can be triggered
    ...                again and again — and when it stops (an item capped per character) the
    ...                walk moves to the NEXT granter instead of giving up.
    ...
    ...                Events that END THE TIME UNIT are left out from the start, read off the
    ...                admin API rather than guessed. Meeting one used to abandon the walk,
    ...                and which event carries the flag differs per seed: on the AWS seed the
    ...                ender is declared before every granter, so this case skipped there and
    ...                only there — a fact about the order of a seed, not about the rule.
    ...
    ...                False when the story has no granter at all, or hands out only things
    ...                too light to ever overload the character.
    [Arguments]    ${token}    ${match_uuid}
    ${enders}=    Time Ending Event Uuids
    ${tried}=     Create List
    FOR    ${candidate}    IN RANGE    12
        ${overloaded}=    Is Overloaded    ${token}    ${match_uuid}
        IF    ${overloaded}    RETURN    ${True}
        ${event_uuid}=    Next Untried Available Event
        ...    ${token}    ${match_uuid}    ${tried}    ${enders}
        IF    '${event_uuid}' == ''    BREAK
        Append To List    ${tried}    ${event_uuid}
        ${disrupted}=    Stack One Granter    ${token}    ${match_uuid}    ${event_uuid}
        IF    ${disrupted}    BREAK
    END
    ${overloaded}=    Is Overloaded    ${token}    ${match_uuid}
    RETURN    ${overloaded}

Stack One Granter
    [Documentation]    Repeats ONE event while it keeps adding rows, until the bag is over
    ...                capacity. True when the answer disrupted the board — a forced move, a
    ...                coma, a forced sleep — which ends the whole walk: after one of those
    ...                every other event of the old location refuses.
    [Arguments]    ${token}    ${match_uuid}    ${event_uuid}
    FOR    ${repeat}    IN RANGE    40
        ${response}=    Execute Event    ${token}    ${match_uuid}    ${event_uuid}
        ${ok}=    Run Keyword And Return Status
        ...    Should Be Equal As Integers    ${response.status_code}    200
        IF    not ${ok}    RETURN    ${False}
        ${body}=    Set Variable    ${response.json()}
        ${disrupted}=    Evaluate
        ...    bool($body.get('timeEnded') or $body.get('movementApplied') or $body.get('comaTriggered') or $body.get('forcedSleep'))
        IF    ${disrupted}    RETURN    ${True}
        IF    not ${body}[itemAdded]    RETURN    ${False}
        ${overloaded}=    Is Overloaded    ${token}    ${match_uuid}
        IF    ${overloaded}    RETURN    ${False}
    END
    RETURN    ${False}

Is Overloaded
    [Documentation]    Whether the carried weight is past the character's capacity, as the
    ...                engine itself reads it on /resources.
    [Arguments]    ${token}    ${match_uuid}
    ${resources}=    Get Resources    ${token}    ${match_uuid}    200
    ${over}=    Evaluate    ${resources.json()}[weight] > ${resources.json()}[weightMax]
    RETURN    ${over}

Time Ending Event Uuids
    [Documentation]    The uuids of the events that close the time unit, from the admin API:
    ...                match-info does not publish flagEndTime, so a walk that must not be
    ...                interrupted cannot recognise one until it has already run it.
    ${response}=    GET On Session    admin_session    /api/admin/stories/${STORY_UUID}/events
    Status Should Be    ${response}    200
    ${rows}=     Set Variable    ${response.json()}
    ${uuids}=    Evaluate    [e['uuid'] for e in $rows if e.get('flagEndTime')]
    RETURN    ${uuids}

Any Neighbor Uuid
    [Documentation]    A neighbour of the active location, or the empty string.
    [Arguments]    ${token}    ${match_uuid}
    ${info}=    Get Match Info    ${token}    ${match_uuid}    200
    FOR    ${location}    IN    @{info.json()}[locationsActive]
        ${neighbors}=    Get From Dictionary    ${location}    neighbors    ${EMPTY}
        FOR    ${neighbor}    IN    @{neighbors}
            ${uuid}=    Get From Dictionary    ${neighbor}    uuid    ${EMPTY}
            IF    '${uuid}' != ''
                RETURN    ${uuid}
            END
        END
    END
    RETURN    ${EMPTY}
