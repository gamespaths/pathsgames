*** Settings ***
# ---------------------------------------------------------------------------
# events.robot — Step 29 normal (player-triggered) events.
#
# The contract under test, end-to-end and backend-agnostic:
#
#   1. GET /api/match/{uuid}/info reports, for every event of the player's location,
#      an `available` flag and — when false — the `reason`.
#   2. POST /api/gameplay/{uuid}/action/execute-event runs an event, and it refuses
#      exactly the events `/info` marked unavailable, with exactly that reason.
#
# Both go through the SAME check procedure, so this suite asserts they agree: an
# action the board offers can never be refused, and a blocked one already knows why.
#
# The seeded story (9001) carries one event per branch of that procedure, all bound
# to the start location, plus the "unlocker" that makes each blocked one available:
#
#   90010 plain          90011 ONCE            90012 no energy      90013 no coins
#   90014 registry gate  90015 item gate       90016 class gate     90017 weather gate
#   90018 elsewhere      90019 chain head      90020 opens 90014    90021 grants the item
#   90022 sets the weather   90023 chain tail (no location)         90024 flag_end_time
#   90025 traits + characteristics             90026 food/magic/coin
#   90027 AUTOMATIC (not player-executable)
#
# Tags: events, step29, gameplay
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource

Suite Setup    Suite Setup Events


*** Test Cases ***

Match Info Reports Availability For Every Event Of The Location
    [Documentation]    Every event at the player's location carries `available`; a blocked one
    ...                carries the reason `execute-event` would return.
    [Tags]    events    step29    match-info
    ${events}=    Location Events
    Should Not Be Empty    ${events}    msg=the seeded story binds Step 29 events to the start location
    FOR    ${e}    IN    @{events}
        Dictionary Should Contain Key    ${e}    available
        ${available}=    Set Variable    ${e}[available]
        IF    ${available} == ${False}
            Should Not Be Equal    ${e}[reason]    ${None}
            ...    msg=an unavailable event must say why (event ${e}[uuid])
        ELSE
            Should Be Equal    ${e}[reason]    ${None}
            ...    msg=an available event has no reason (event ${e}[uuid])
        END
    END

A Plain Normal Event Is Available And Executes
    [Documentation]    90010: costs 1 energy, grants +5 exp to the actor and -2 life to everyone
    ...                in the location (INV-27). The effect's OWN card is the narrative.
    [Tags]    events    step29
    ${uuid}=    Event Uuid By Cost    1
    Should Be Available    ${uuid}

    ${resp}=    Execute Event    ${TOKEN}    ${MATCH_UUID}    ${uuid}    200
    ${body}=    Set Variable    ${resp.json()}

    Should Be Equal    ${body}[eventUuid]        ${uuid}
    Should Be Equal    ${body}[eventType]        NORMAL
    Should Be Equal As Integers    ${body}[energySpent]    1
    Should Be Equal    ${body}[turnConsumed]     ${False}
    ...    msg=v0.29.0 — execute-event never touches the turn queue
    Should Be True     ${body}[refreshRecommended]
    Should Be Empty    ${body}[pendingChoices]
    ...    msg=Step 30 fills pendingChoices, not Step 29

    Should Not Be Empty    ${body}[statChanges]
    Should Not Be Empty    ${body}[effects]
    FOR    ${eff}    IN    @{body}[effects]
        Should Not Be Equal    ${eff}[card]    ${None}
        ...    msg=each applied effect carries its OWN card — that is the narrative
    END

An Executed Event Appears On The Match Log Timeline With Its Own Card
    [Documentation]    log_events derives its type from the message prefix and drops what it does
    ...                not recognise, so an executed event needs its own EVENT branch.
    ...                v0.30.3 — that EVENT entry must also carry the event's own `idEvent`
    ...                and `card` (previously always null/missing on all three backends: the
    ...                enrichment step only ever resolved WEATHER's and MOVEMENT's card). The
    ...                card is cross-checked against the one `/info` already reports for the
    ...                same event, so the assertion holds on any backend/seed without
    ...                hard-coding a numeric event id.
    [Tags]    events    step29    logs
    ${uuid}=    Event Uuid By Cost    1
    ${events}=    Location Events
    ${info_card}=    Set Variable    ${None}
    FOR    ${e}    IN    @{events}
        IF    $e['uuid'] == '${uuid}'
            ${info_card}=    Set Variable    ${e}[card]
            BREAK
        END
    END
    Should Not Be Equal    ${info_card}    ${None}
    ...    msg=the seeded event must carry its own card for this test to be meaningful

    Execute Event    ${TOKEN}    ${MATCH_UUID}    ${uuid}    200

    ${logs}=    Get Match Logs    ${TOKEN}    ${MATCH_UUID}    200
    ${types}=    Create List
    ${event_entry}=    Set Variable    ${None}
    FOR    ${entry}    IN    @{logs.json()}[logs]
        Append To List    ${types}    ${entry}[type]
        IF    '${entry}[type]' == 'EVENT' and $event_entry is None
            ${event_entry}=    Set Variable    ${entry}
        END
    END
    List Should Contain Value    ${types}    EVENT
    ...    msg=the event executed above must surface as an EVENT entry

    Should Not Be Equal    ${event_entry}[idEvent]    ${None}
    ...    msg=the EVENT entry must name the event it triggered
    Should Not Be Equal    ${event_entry}[card]    ${None}
    ...    msg=the EVENT entry must carry the triggered event's own card
    Should Be Equal    ${event_entry}[card][title]    ${info_card}[title]
    ...    msg=the log's card must be the SAME card /info reports for this event

A ONCE Event Can Only Be Executed Once Per Match
    [Documentation]    90011. The second call is refused, and `/info` flips it to unavailable
    ...                with the same reason.
    [Tags]    events    step29    once
    ${uuid}=    Event Uuid By Type    ONCE
    Should Be Available    ${uuid}

    Execute Event    ${TOKEN}    ${MATCH_UUID}    ${uuid}    200

    ${resp}=    Execute Event    ${TOKEN}    ${MATCH_UUID}    ${uuid}    409
    Should Be Equal    ${resp.json()}[error]    ONCE_ALREADY_CONSUMED
    Should Be Blocked    ${uuid}    ONCE_ALREADY_CONSUMED

An Automatic Event Is Never Player-Executable
    [Documentation]    90027 (and the story's end-game event): listed, but not something the
    ...                player can trigger through this endpoint.
    [Tags]    events    step29
    ${uuid}=    Event Uuid By Reason    EVENT_NOT_EXECUTABLE_TYPE
    ${resp}=    Execute Event    ${TOKEN}    ${MATCH_UUID}    ${uuid}    409
    Should Be Equal    ${resp.json()}[error]    EVENT_NOT_EXECUTABLE_TYPE

Not Enough Energy Is Refused
    [Documentation]    90012 costs 999 energy.
    [Tags]    events    step29
    ${uuid}=    Event Uuid By Reason    NOT_ENOUGH_ENERGY
    ${resp}=    Execute Event    ${TOKEN}    ${MATCH_UUID}    ${uuid}    409
    Should Be Equal    ${resp.json()}[error]    NOT_ENOUGH_ENERGY

Not Enough Coins Is Refused
    [Documentation]    90013 costs 999 coins.
    [Tags]    events    step29
    ${uuid}=    Event Uuid By Reason    NOT_ENOUGH_COINS
    ${resp}=    Execute Event    ${TOKEN}    ${MATCH_UUID}    ${uuid}    409
    Should Be Equal    ${resp.json()}[error]    NOT_ENOUGH_COINS

An Event Bound To Another Location Is Not Listed And Is Refused
    [Documentation]    90018 lives in the Choice Arena. It never appears under the start
    ...                location, and executing it from here is WRONG_LOCATION.
    [Tags]    events    step29
    ${uuid}=    Event Uuid Elsewhere
    ${listed}=    Location Event Uuids
    List Should Not Contain Value    ${listed}    ${uuid}
    ...    msg=an event of another location must not be listed under this one

    ${resp}=    Execute Event    ${TOKEN}    ${MATCH_UUID}    ${uuid}    409
    Should Be Equal    ${resp.json()}[error]    WRONG_LOCATION

A Registry Condition Blocks The Event Until Another Event Writes The Key
    [Documentation]    90014 needs STEP29_GATE=OPEN; 90020 writes it. The gate opens on `/info`
    ...                without the client knowing anything about registry keys.
    [Tags]    events    step29    registry
    ${gated}=    Event Uuid By Reason    REGISTRY_CONDITION_NOT_MET
    ${resp}=    Execute Event    ${TOKEN}    ${MATCH_UUID}    ${gated}    409
    Should Be Equal    ${resp.json()}[error]    REGISTRY_CONDITION_NOT_MET

    ${opener}=    Event Uuid Writing Registry
    ${open}=      Execute Event    ${TOKEN}    ${MATCH_UUID}    ${opener}    200
    Should Not Be Empty    ${open.json()}[registryChanges]
    Should Be Equal    ${open.json()}[registryChanges][0][newValue]    OPEN

    Should Be Available    ${gated}
    Execute Event    ${TOKEN}    ${MATCH_UUID}    ${gated}    200

An Item Condition Blocks The Event Until Another Event Grants The Item
    [Documentation]    90015 needs item 90002; 90021 grants it.
    [Tags]    events    step29    items
    ${gated}=    Event Uuid By Reason    ITEM_CONDITION_NOT_MET
    ${resp}=    Execute Event    ${TOKEN}    ${MATCH_UUID}    ${gated}    409
    Should Be Equal    ${resp.json()}[error]    ITEM_CONDITION_NOT_MET

    ${granter}=    Event Uuid Granting Item
    ${grant}=      Execute Event    ${TOKEN}    ${MATCH_UUID}    ${granter}    200
    Should Be True    ${grant.json()}[itemAdded]
    Should Not Be Empty    ${grant.json()}[itemChanges]
    Should Be Equal    ${grant.json()}[itemChanges][0][action]    ADD

    Should Be Available    ${gated}
    Execute Event    ${TOKEN}    ${MATCH_UUID}    ${gated}    200

A Weather Condition Blocks The Event Until An Effect Sets That Weather
    [Documentation]    90017 needs weather 90003; the effect of 90022 SETS it. Same column name
    ...                on the two tables, opposite direction: condition vs effect.
    [Tags]    events    step29    weather
    ${gated}=    Event Uuid By Reason    WEATHER_CONDITION_NOT_MET
    ${resp}=     Execute Event    ${TOKEN}    ${MATCH_UUID}    ${gated}    409
    Should Be Equal    ${resp.json()}[error]    WEATHER_CONDITION_NOT_MET

    ${setter}=    Event Uuid Setting Weather
    ${set}=       Execute Event    ${TOKEN}    ${MATCH_UUID}    ${setter}    200
    Should Be True    ${set.json()}[weatherApplied]

    Should Be Available    ${gated}
    Execute Event    ${TOKEN}    ${MATCH_UUID}    ${gated}    200

The Event Chain Runs Every Link And Charges Only The First
    [Documentation]    90019 -> 90023. The tail has no location, so it is never listed on
    ...                `/info`, yet the chain reaches it. Chained events are consequences,
    ...                not choices: not re-checked, not charged.
    [Tags]    events    step29    chain
    ${head}=    Event Uuid With Chain
    ${resp}=    Execute Event    ${TOKEN}    ${MATCH_UUID}    ${head}    200
    ${body}=    Set Variable    ${resp.json()}

    Length Should Be    ${body}[executedEventUuids]    2
    ...    msg=the chain must run both links
    Should Be Equal    ${body}[executedEventUuids][0]    ${head}
    ...    msg=index 0 is always the event the player asked for
    Should Be Equal As Integers    ${body}[energySpent]    0

    ${gained}=    Total Exp Gained    ${body}
    Should Be Equal As Integers    ${gained}    3
    ...    msg=exp accumulates across the chain (1 from the head + 2 from the tail)

Traits And Characteristics Are Applied
    [Documentation]    90025 adds trait 90001, removes trait 90004 and adds the BRAVE characteristic.
    [Tags]    events    step29    traits
    ${uuid}=    Event Uuid Changing Traits
    ${resp}=    Execute Event    ${TOKEN}    ${MATCH_UUID}    ${uuid}    200
    ${body}=    Set Variable    ${resp.json()}

    Should Not Be Empty    ${body}[characteristicChanges]
    Should Be Equal    ${body}[characteristicChanges][0][characteristic]    BRAVE
    Should Be Equal    ${body}[characteristicChanges][0][action]            ADD
    Should Be True     ${body}[refreshRecommended]

Backpack Resources Are Applied
    [Documentation]    90026 grants food +3, magic +2, coin +9 — and must not zero the ones it
    ...                does not mention.
    [Tags]    events    step29    resources
    ${uuid}=    Event Uuid Changing Resources
    ${resp}=    Execute Event    ${TOKEN}    ${MATCH_UUID}    ${uuid}    200
    ${body}=    Set Variable    ${resp.json()}

    ${stats}=    Create List
    FOR    ${c}    IN    @{body}[statChanges]
        Append To List    ${stats}    ${c}[statistic]
    END
    List Should Contain Value    ${stats}    food
    List Should Contain Value    ${stats}    magic
    List Should Contain Value    ${stats}    coin
    Should Be True    ${body}[newCoin] > 0

An Event With flag_end_time Advances The Clock
    [Documentation]    90024. Everyone sleeps, the clock moves, and the recovery runs — so this
    ...                is checked LAST: it changes the match state for good.
    [Tags]    events    step29    time
    ${before}=    Get Clock    ${TOKEN}    ${MATCH_UUID}    200
    ${clock_before}=    Set Variable    ${before.json()}[currentClock]

    ${uuid}=    Event Uuid Ending Time
    ${resp}=    Execute Event    ${TOKEN}    ${MATCH_UUID}    ${uuid}    200
    ${body}=    Set Variable    ${resp.json()}

    Should Be True    ${body}[timeEnded]
    Should Be True    ${body}[forcedSleep]
    Should Be True    ${body}[currentClock] > ${clock_before}
    ...    msg=the response must carry the NEW clock

    ${after}=    Get Clock    ${TOKEN}    ${MATCH_UUID}    200
    Should Be Equal As Integers    ${after.json()}[currentClock]    ${body}[currentClock]

Errors And Auth
    [Documentation]    The error contract: 404 for what does not exist, 400 for a bodiless call,
    ...                401 without a token.
    [Tags]    events    step29    errors
    ${uuid}=    Event Uuid By Type    NORMAL

    ${r404}=    Execute Event    ${TOKEN}    ${MATCH_UUID}    00000000-0000-4000-8000-000000000000    404
    Should Be Equal    ${r404.json()}[error]    EVENT_NOT_FOUND

    ${r404m}=    Execute Event    ${TOKEN}    00000000-0000-4000-8000-000000000000    ${uuid}    404
    Should Be Equal    ${r404m.json()}[error]    MATCH_NOT_FOUND

    ${headers}=    Get Auth Headers    ${TOKEN}
    &{empty}=      Create Dictionary
    ${r400}=    POST On Session    public_session    /api/gameplay/${MATCH_UUID}/action/execute-event
    ...    headers=${headers}    json=${empty}    expected_status=400
    Should Be Equal    ${r400.json()}[error]    MISSING_EVENT

    ${r401}=    POST On Session    public_session    /api/gameplay/${MATCH_UUID}/action/execute-event
    ...    json=${empty}    expected_status=401

Cards Are Localized By The Lang Parameter
    [Documentation]    ?lang= must reach the card resolution of the event and of every effect.
    ...                The event is taken from what `/info` currently offers, which is the whole
    ...                point of the flag: an available event is one this endpoint will accept.
    [Tags]    events    step29    i18n
    ${uuid}=    Any Available Event Uuid
    ${resp}=    Execute Event    ${TOKEN}    ${MATCH_UUID}    ${uuid}    200    lang=it
    Should Not Be Equal    ${resp.json()}[card]    ${None}

A Location Effect Teleports The Character Without Any Movement Check
    [Documentation]    v0.29.3 — an effect's idLocation moves the actor even though the target
    ...                is NOT a neighbor of where they stand: no Step 28 check runs and no
    ...                movement energy is charged (only the event's own cost). The move lands
    ...                on the timeline as a cost-0 MOVEMENT entry. Runs on its own match: the
    ...                teleport would strand the suite's shared character away from the seeded
    ...                events.
    [Tags]    events    step29    movement
    ${event}    ${target}=    Teleport Seed
    ${match}=    New Teleport Match

    ${info}=    Get Match Info    ${TELEPORT_TOKEN}    ${match}    200    lang=en
    ${before}=    Set Variable    ${info.json()}[currentLocationId]
    Should Not Be Equal As Integers    ${target}    ${before}
    ${neighbors}=    Neighbor Location Ids Of    ${before}
    List Should Not Contain Value    ${neighbors}    ${target}
    ...    msg=the seeded teleport target must NOT be a neighbor — that is what proves no check ran

    ${resp}=    Execute Event    ${TELEPORT_TOKEN}    ${match}    ${event}    200
    ${body}=    Set Variable    ${resp.json()}
    Should Be True    ${body}[movementApplied]
    Should Be True    ${body}[refreshRecommended]
    Should Not Be Empty    ${body}[locationChanges]
    Should Be Equal As Integers    ${body}[energySpent]    2
    ...    msg=only the event's own cost — the forced movement itself is free

    ${info}=    Get Match Info    ${TELEPORT_TOKEN}    ${match}    200    lang=en
    Should Be Equal As Integers    ${info.json()}[currentLocationId]    ${target}

    ${logs}=    Get Match Logs    ${TELEPORT_TOKEN}    ${match}    200
    ${entry}=    First Movement Log Entry    ${logs.json()}[logs]
    Should Be Equal As Integers    ${entry}[idLocationTo]    ${target}
    Should Be Equal As Integers    ${entry}[energyCost]    0
    ...    msg=a forced move is logged, at cost 0


*** Keywords ***

Suite Setup Events
    [Documentation]    A running single-player match whose character stands at the start location,
    ...                where the seeded Step 29 events live.
    Create Admin Session
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}        ${story}
    ${guest}=    POST On Session    public_session    /api/auth/guest
    Status Should Be    ${guest}    201
    Set Suite Variable    ${TOKEN}    ${guest.json()}[accessToken]

    ${match}=    Create Match    ${TOKEN}    ${story}    ${difficulty}    robottest_step29
    Status Should Be    ${match}    201
    Set Suite Variable    ${MATCH_UUID}    ${match.json()}[uuid]

    ${trait_list}=    Create List
    IF    '${trait}' != ''
        Append To List    ${trait_list}    ${trait}
    END
    ${join}=    Join Match    ${TOKEN}    ${MATCH_UUID}    ${character}    ${class}    ${trait_list}
    Status Should Be    ${join}    201
    Start Match    ${TOKEN}    ${MATCH_UUID}    200

# ── reading match-info ───────────────────────────────────────────────────────

Location Events
    [Documentation]    The events of the location the character currently stands in.
    ${info}=    Get Match Info    ${TOKEN}    ${MATCH_UUID}    200    lang=en
    ${body}=    Set Variable    ${info.json()}
    Should Not Be Empty    ${body}[locationsActive]
    ${current}=    Set Variable    ${body}[currentLocationId]
    FOR    ${entry}    IN    @{body}[locationsActive]
        IF    $entry['idLocation'] == $current    RETURN    ${entry}[events]
    END
    Fail    the character's location ${current} is not among locationsActive

Location Event Uuids
    ${events}=    Location Events
    ${uuids}=     Create List
    FOR    ${e}    IN    @{events}
        Append To List    ${uuids}    ${e}[uuid]
    END
    RETURN    ${uuids}

Should Be Available
    [Documentation]    match-info must currently offer this event.
    [Arguments]    ${uuid}
    ${events}=    Location Events
    FOR    ${e}    IN    @{events}
        IF    $e['uuid'] == $uuid
            Should Be True    ${e}[available]    msg=event ${uuid} should be available but is not
            RETURN
        END
    END
    Fail    event ${uuid} is not listed at the character's location

Should Be Blocked
    [Documentation]    match-info must currently block this event, for exactly this reason.
    [Arguments]    ${uuid}    ${reason}
    ${events}=    Location Events
    FOR    ${e}    IN    @{events}
        IF    $e['uuid'] == $uuid
            Should Not Be True    ${e}[available]
            Should Be Equal    ${e}[reason]    ${reason}
            RETURN
        END
    END
    Fail    event ${uuid} is not listed at the character's location

# ── picking a seeded event through the admin API ─────────────────────────────
#
# The tests address events by BEHAVIOUR, not by hard-coded uuid: the admin story
# rows tell us which seeded event is which, and the uuids are generated per database.

Admin Events
    ${resp}=    GET On Session    admin_session    /api/admin/stories/${STORY_UUID}/events
    Status Should Be    ${resp}    200
    RETURN    ${resp.json()}

Admin Event Effects
    ${resp}=    GET On Session    admin_session    /api/admin/stories/${STORY_UUID}/event-effects
    Status Should Be    ${resp}    200
    RETURN    ${resp.json()}

Find Event
    [Documentation]    The first admin event row satisfying a python expression over `e`.
    [Arguments]    ${expression}
    ${events}=    Admin Events
    FOR    ${e}    IN    @{events}
        ${hit}=    Evaluate    ${expression}    namespace=${{ {'e': $e} }}
        # `$hit`, not `${hit}`: the latter interpolates the VALUE into the condition, so a
        # truthy string like 'STEP29_GATE' would be evaluated as a python name.
        IF    $hit    RETURN    ${e}[uuid]
    END
    Fail    no seeded event matches: ${expression}

Event Uuid By Type
    [Arguments]    ${type}
    ${uuid}=    Find Event
    ...    e.get('type') == '${type}' and e.get('idSpecificLocation') and e.get('costEnery') == 0 and e.get('coinCost') == 0 and not e.get('idEventNext') and not e.get('idWeather') and not e.get('registryKeyCondition') and not e.get('idItemCondition') and not e.get('idClassCondition') and e.get('flagEndTime') == 0
    RETURN    ${uuid}

Event Uuid By Cost
    [Documentation]    A plain NORMAL event with the given energy cost and no condition.
    [Arguments]    ${energy}
    ${uuid}=    Find Event
    ...    e.get('type') == 'NORMAL' and e.get('costEnery') == ${energy} and e.get('coinCost') == 0 and e.get('idSpecificLocation') and not e.get('idEventNext') and not e.get('idWeather') and not e.get('registryKeyCondition') and not e.get('idItemCondition') and not e.get('idClassCondition') and e.get('flagEndTime') == 0
    RETURN    ${uuid}

Event Uuid By Reason
    [Documentation]    The event `/info` currently blocks for exactly this reason.
    [Arguments]    ${reason}
    ${events}=    Location Events
    FOR    ${e}    IN    @{events}
        IF    $e['reason'] == $reason    RETURN    ${e}[uuid]
    END
    Fail    no event at the location is blocked with reason ${reason}

Any Available Event Uuid
    [Documentation]    Any event `/info` currently offers. Trusting the flag is the contract:
    ...                what the board offers, the endpoint accepts.
    ${events}=    Location Events
    FOR    ${e}    IN    @{events}
        IF    $e['available']    RETURN    ${e}[uuid]
    END
    Fail    no event at the character's location is currently available

Event Uuid Elsewhere
    [Documentation]    A NORMAL event bound to a location other than the character's.
    ${info}=    Get Match Info    ${TOKEN}    ${MATCH_UUID}    200    lang=en
    ${current}=    Set Variable    ${info.json()}[currentLocationId]
    ${uuid}=    Find Event
    ...    e.get('type') == 'NORMAL' and e.get('idSpecificLocation') and e.get('idSpecificLocation') != ${current}
    RETURN    ${uuid}

Event Uuid With Chain
    ${uuid}=    Find Event    e.get('idEventNext') is not None and e.get('idEventNext') > 0
    RETURN    ${uuid}

Event Uuid Ending Time
    ${uuid}=    Find Event    e.get('flagEndTime') == 1 and e.get('type') == 'NORMAL'
    RETURN    ${uuid}

Event Uuid Writing Registry
    ${uuid}=    Event Uuid By Effect    e.get('keyToAdd')
    RETURN    ${uuid}

Event Uuid Granting Item
    ${uuid}=    Event Uuid By Effect    e.get('itemAction') == 'ADD'
    RETURN    ${uuid}

Event Uuid Setting Weather
    ${uuid}=    Event Uuid By Effect    e.get('idWeather')
    RETURN    ${uuid}

Event Uuid Changing Traits
    ${uuid}=    Event Uuid By Effect    e.get('traitsToAdd') or e.get('characteristicToAdd')
    RETURN    ${uuid}

Event Uuid Changing Resources
    ${uuid}=    Event Uuid By Effect    e.get('statistics') in ('food', 'magic', 'coin')
    RETURN    ${uuid}

Event Uuid By Effect
    [Documentation]    The uuid of the EVENT owning the first effect row matching the expression.
    [Arguments]    ${expression}
    ${effects}=    Admin Event Effects
    ${events}=     Admin Events
    FOR    ${e}    IN    @{effects}
        ${hit}=    Evaluate    ${expression}    namespace=${{ {'e': $e} }}
        IF    $hit
            ${owner}=    Set Variable    ${e}[idEvent]
            FOR    ${ev}    IN    @{events}
                IF    $ev['id'] == $owner    RETURN    ${ev}[uuid]
            END
        END
    END
    Fail    no seeded effect matches: ${expression}

Teleport Seed
    [Documentation]    (event uuid, target location id) of the seeded forced-movement effect
    ...                (v0.29.3): the first effect row carrying idLocation, and its owner.
    ${effects}=    Admin Event Effects
    ${events}=     Admin Events
    FOR    ${e}    IN    @{effects}
        IF    $e.get('idLocation')
            ${owner}=    Set Variable    ${e}[idEvent]
            FOR    ${ev}    IN    @{events}
                IF    $ev['id'] == $owner    RETURN    ${ev}[uuid]    ${e}[idLocation]
            END
        END
    END
    Fail    no seeded effect carries idLocation (v0.29.3)

New Teleport Match
    [Documentation]    A fresh running single-player match on the suite's story: the teleport
    ...                strands its character, so it never runs on the shared match.
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Should Be Equal    ${story}    ${STORY_UUID}
    ...    msg=the loadout must resolve to the suite's story, whose seeds hold the teleporter
    ${guest}=    POST On Session    public_session    /api/auth/guest
    Status Should Be    ${guest}    201
    Set Suite Variable    ${TELEPORT_TOKEN}    ${guest.json()}[accessToken]
    ${match}=    Create Match    ${TELEPORT_TOKEN}    ${story}    ${difficulty}    robottest_step29_teleport
    Status Should Be    ${match}    201
    ${uuid}=    Set Variable    ${match.json()}[uuid]
    ${trait_list}=    Create List
    IF    '${trait}' != ''
        Append To List    ${trait_list}    ${trait}
    END
    ${join}=    Join Match    ${TELEPORT_TOKEN}    ${uuid}    ${character}    ${class}    ${trait_list}
    Status Should Be    ${join}    201
    Start Match    ${TELEPORT_TOKEN}    ${uuid}    200
    RETURN    ${uuid}

Neighbor Location Ids Of
    [Documentation]    Location ids reachable in ONE move from the given location, per the
    ...                admin story rows (both edge directions, the reverse one only with
    ...                flagBack).
    [Arguments]    ${id_location}
    ${resp}=    GET On Session    admin_session    /api/admin/stories/${STORY_UUID}/location-neighbors
    Status Should Be    ${resp}    200
    ${ids}=    Create List
    FOR    ${n}    IN    @{resp.json()}
        IF    $n.get('idLocationFrom') == $id_location
            Append To List    ${ids}    ${n}[idLocationTo]
        END
        IF    $n.get('idLocationTo') == $id_location and $n.get('flagBack')
            Append To List    ${ids}    ${n}[idLocationFrom]
        END
    END
    RETURN    ${ids}

First Movement Log Entry
    [Arguments]    ${logs}
    FOR    ${entry}    IN    @{logs}
        IF    $entry['type'] == 'MOVEMENT'    RETURN    ${entry}
    END
    Fail    no MOVEMENT entry on the timeline

Total Exp Gained
    [Arguments]    ${body}
    ${total}=    Set Variable    ${0}
    FOR    ${c}    IN    @{body}[statChanges]
        IF    $c['statistic'] == 'exp'
            ${total}=    Evaluate    ${total} + ${c}[delta]
        END
    END
    RETURN    ${total}
