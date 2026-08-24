*** Settings ***
# ---------------------------------------------------------------------------
# edge_states.robot — Step 30, the two edge rules and the party epilogue.
#
# The contract under test, end-to-end and backend-agnostic:
#
#   1. Every successful execute-event answers with an `edgeState` object. A quiet event
#      leaves it empty — the frontend shows a card only when something actually fired.
#   2. Sadness never rests at its cap: reaching `sadMax` costs the character COS life
#      points, resets sadness to zero and forces sleep.
#   3. Life at zero opens a coma, and — the gap Step 29 left — stamps `clockInComa` with
#      the clock of the collapse.
#   4. In single player that one coma IS the whole party going down, and it is reported as
#      such. The seeded story authors no `id_event_all_player_coma`, so what runs here is
#      the "no epilogue" branch — legal, and still logged. The authored-epilogue path needs
#      a story that has one, so it is covered by the unit tests of all three backends
#      instead of here.
#   5. The match stays RUNNING. Moving it to GAMEOVER is step 59, together with the
#      rescue endpoints.
#
# The admin changeStatistics endpoint is used to set up each scenario. It is deliberately
# NOT subject to the edge rules — it is a god-mode tool whose purpose is to force a state —
# and test 6 pins that down, because it is the one place where the engine looks inconsistent
# on purpose.
#
# The seeded event 90010 is what drives every trigger: it costs 1 energy and applies
# +5 exp to the actor and -2 life to everyone in the location, so it always touches the
# character and its arithmetic is known.
#
# Tags: events, step30, edge, coma, sadness
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource

Suite Setup    Suite Setup Edge States


*** Test Cases ***

A Quiet Event Answers With An Empty Edge State
    [Documentation]    The object is always present; empty means nothing fired.
    [Tags]    events    step30    edge
    Reset Character    life=40    sad=0

    ${uuid}=    Plain Event Uuid
    ${resp}=    Execute Event    ${TOKEN}    ${MATCH_UUID}    ${uuid}    200
    ${edge}=    Set Variable    ${resp.json()}[edgeState]

    Should Be Empty      ${edge}[sadnessOverflowUuids]
    Should Be Empty      ${edge}[comaUuids]
    Should Not Be True   ${edge}[allPlayersInComa]
    Should Be Equal      ${edge}[comaEventUuid]    ${None}

Sadness At Its Cap Discharges And Costs COS Life
    [Documentation]    Reaching sadMax is not a resting state: it always discharges.
    [Tags]    events    step30    edge    sadness
    ${before}=    Reset Character    life=40    sad=${SAD_MAX}
    ${cos}=       Set Variable    ${before}[constitution]

    ${uuid}=    Plain Event Uuid
    ${resp}=    Execute Event    ${TOKEN}    ${MATCH_UUID}    ${uuid}    200
    ${edge}=    Set Variable    ${resp.json()}[edgeState]

    List Should Contain Value    ${edge}[sadnessOverflowUuids]    ${CHARACTER_MATCH_UUID}
    Should Be True    ${resp.json()}[forcedSleep]

    # The event itself takes 2 life (its -2 ALL effect), the overflow takes COS more.
    ${after}=    Get Character State
    Should Be Equal As Integers    ${after}[sad]     0
    ${expected}=    Evaluate    40 - 2 - ${cos}
    Should Be Equal As Integers    ${after}[life]    ${expected}

Life At Zero Opens A Coma And Stamps The Clock
    [Documentation]    The clock_in_coma stamp is precisely the gap Step 29 left open.
    [Tags]    events    step30    edge    coma
    Reset Character    life=1    sad=0
    ${clock}=    Current Clock

    ${uuid}=    Plain Event Uuid
    ${resp}=    Execute Event    ${TOKEN}    ${MATCH_UUID}    ${uuid}    200
    ${edge}=    Set Variable    ${resp.json()}[edgeState]

    List Should Contain Value    ${edge}[comaUuids]    ${CHARACTER_MATCH_UUID}
    Should Be True    ${resp.json()}[comaTriggered]

    ${after}=    Get Character State
    Should Be True    ${after}[isComa]
    Should Be True    ${after}[isSleeping]
    Should Be Equal As Integers    ${after}[clockInComa]    ${clock}

Everyone Down Is Reported As A Party Collapse
    [Documentation]    Single player: one coma IS the party going down.
    ...
    ...                The seeded story authors no `id_event_all_player_coma`, which is a
    ...                legal story — so what is pinned here is the "no epilogue" branch:
    ...                the collapse is still reported, and no epilogue is invented. The
    ...                authored-epilogue path is covered by the unit tests of all three
    ...                backends, which can seed a story that has one.
    [Tags]    events    step30    edge    coma
    Reset Character    life=1    sad=0

    ${uuid}=    Plain Event Uuid
    ${resp}=    Execute Event    ${TOKEN}    ${MATCH_UUID}    ${uuid}    200
    ${body}=    Set Variable    ${resp.json()}
    ${edge}=    Set Variable    ${body}[edgeState]

    Should Be True    ${edge}[allPlayersInComa]
    Should Be Equal    ${edge}[comaEventUuid]    ${None}
    Should Be Empty    ${edge}[comaExecutedEventUuids]
    # The event the player triggered stays where it belongs, in the main chain.
    List Should Contain Value    ${body}[executedEventUuids]    ${uuid}

The Match Stays RUNNING After A Party Collapse
    [Documentation]    GAMEOVER is step 59; this step only reports the collapse.
    [Tags]    events    step30    edge    coma
    Reset Character    life=1    sad=0

    ${uuid}=    Plain Event Uuid
    ${resp}=    Execute Event    ${TOKEN}    ${MATCH_UUID}    ${uuid}    200
    Should Be True    ${resp.json()}[edgeState][allPlayersInComa]
    Should Not Be True    ${resp.json()}[gameOver]

    ${info}=    Get Match Info    ${TOKEN}    ${MATCH_UUID}    200    lang=en
    Should Be Equal    ${info.json()}[match][status]    RUNNING

Sleeping In A Safe Location Wakes A Comatose Character
    [Documentation]    v0.30.1 — the in-game way out of a coma: rest where it is safe.
    ...                The character is forced into a coma via the admin endpoint at the
    ...                start location (which the seeded story authors as safe), then sleeps.
    ...                Sleeping advances the clock, the time-start recovery lifts life above
    ...                zero, and the coma flag is cleared.
    [Tags]    events    step30    edge    coma
    ${before}=    Reset Character    life=1    sad=0
    # Drive life to zero and set the coma flag directly, leaving the character asleep so the
    # next sleep/time-start actually fires the recovery.
    ${body}=    Create Dictionary    life=${0}    coma=${True}    sleeping=${True}
    ${resp}=    POST On Session    admin_session
    ...    /api/admin/matches/${MATCH_UUID}/player/${CHARACTER_MATCH_UUID}/changeStatistics
    ...    json=${body}    expected_status=200

    ${down}=    Get Character State
    Should Be True    ${down}[isComa]    msg=setup failed: the character is not comatose

    Sleep Action    ${TOKEN}    ${MATCH_UUID}    200

    ${after}=    Get Character State
    Should Not Be True    ${after}[isComa]    msg=resting in a safe location must clear the coma
    Should Be True    ${after}[life] > 0    msg=a woken character must have life to act with

The Admin Endpoint Is Deliberately Not Subject To The Rules
    [Documentation]    A god-mode tool must set exactly what it was asked to set. A forced
    ...                state self-corrects at the next event or time-start instead.
    [Tags]    events    step30    edge    admin
    Reset Character    life=40    sad=${SAD_MAX}

    ${after}=    Get Character State
    Should Be Equal As Integers    ${after}[sad]     ${SAD_MAX}
    ...    msg=the admin endpoint must not discharge the sadness it was told to set
    Should Be Equal As Integers    ${after}[life]    40
    Should Not Be True    ${after}[isComa]


*** Keywords ***

Suite Setup Edge States
    [Documentation]    A running single-player match whose character stands at the start
    ...                location, where the seeded Step 29/30 events live.
    Create Admin Session
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}    ${story}
    ${guest}=    POST On Session    public_session    /api/auth/guest
    Status Should Be    ${guest}    201
    Set Suite Variable    ${TOKEN}    ${guest.json()}[accessToken]

    ${match}=    Create Match    ${TOKEN}    ${story}    ${difficulty}    robottest_step30_edge
    Status Should Be    ${match}    201
    Set Suite Variable    ${MATCH_UUID}    ${match.json()}[uuid]

    ${trait_list}=    Create List
    IF    '${trait}' != ''
        Append To List    ${trait_list}    ${trait}
    END
    ${join}=    Join Match    ${TOKEN}    ${MATCH_UUID}    ${character}    ${class}    ${trait_list}
    Status Should Be    ${join}    201
    Set Suite Variable    ${CHARACTER_MATCH_UUID}    ${join.json()}[uuid]
    Start Match    ${TOKEN}    ${MATCH_UUID}    200

    ${state}=    Get Character State
    Set Suite Variable    ${SAD_MAX}    ${state}[sadMax]

Get Character State
    [Documentation]    The character instance as the admin sees it: stats, caps and flags.
    ${resp}=    Get Character Detail    ${TOKEN}    ${MATCH_UUID}    ${CHARACTER_MATCH_UUID}    200
    RETURN    ${resp.json()}

Reset Character
    [Documentation]    Put the character in a known state, coma and sleep explicitly cleared
    ...                so each test starts from a character that can act. Energy is topped up
    ...                too: the driving event costs 1 each time, and a test must not fail with
    ...                NOT_ENOUGH_ENERGY because of the tests that ran before it.
    [Arguments]    ${life}    ${sad}
    ${body}=    Create Dictionary    life=${life}    sad=${sad}    energy=${20}
    ...    coma=${False}    sleeping=${False}
    ${resp}=    POST On Session    admin_session
    ...    /api/admin/matches/${MATCH_UUID}/player/${CHARACTER_MATCH_UUID}/changeStatistics
    ...    json=${body}    expected_status=200
    Should Be Equal    ${resp.json()}[status]    UPDATED
    ${state}=    Get Character State
    RETURN    ${state}

Current Clock
    [Documentation]    The match clock the next coma would be stamped with.
    ${info}=    Get Match Info    ${TOKEN}    ${MATCH_UUID}    200    lang=en
    RETURN    ${info.json()}[match][currentClock]

Location Events
    [Documentation]    The events of the location the character currently stands in.
    ${info}=    Get Match Info    ${TOKEN}    ${MATCH_UUID}    200    lang=en
    ${body}=    Set Variable    ${info.json()}
    ${current}=    Set Variable    ${body}[currentLocationId]
    FOR    ${entry}    IN    @{body}[locationsActive]
        IF    $entry['idLocation'] == $current    RETURN    ${entry}[events]
    END
    Fail    the character's location ${current} is not among locationsActive

Admin Events
    [Documentation]    The story's event rows. match-info publishes only uuid/available/reason,
    ...                so the shape of an event (its cost, type and conditions) has to come
    ...                from here — same approach as the Step 29 suite.
    ${resp}=    GET On Session    admin_session    /api/admin/stories/${STORY_UUID}/events
    Status Should Be    ${resp}    200
    RETURN    ${resp.json()}

Plain Event Uuid
    [Documentation]    The seeded plain NORMAL event (90010): 1 energy, +5 exp to the actor
    ...                and -2 life to everyone in the location. It always touches the
    ...                character, which is what makes the edge rules run at all.
    ...
    ...                Addressed by BEHAVIOUR, not by a hard-coded uuid: the uuids are
    ...                generated per database.
    ${events}=    Admin Events
    FOR    ${e}    IN    @{events}
        ${hit}=    Evaluate
        ...    e.get('type') == 'NORMAL' and e.get('costEnery') == 1 and e.get('costCoin') == 0 and not e.get('costFood') and not e.get('costMagic') and e.get('idSpecificLocation') and not e.get('idEventNext') and not e.get('idWeather') and not e.get('registryKeyCondition') and not e.get('idItemCondition') and not e.get('idClassCondition') and e.get('flagEndTime') == 0
        ...    namespace=${{ {'e': $e} }}
        # `$hit`, not `${hit}`: the latter interpolates the VALUE into the condition.
        IF    $hit
            Should Be Available    ${e}[uuid]
            RETURN    ${e}[uuid]
        END
    END
    Fail    no seeded plain 1-energy NORMAL event was found on story ${STORY_UUID}

Should Be Available
    [Documentation]    match-info must currently offer this event — otherwise the test would
    ...                be measuring a 409 rather than the edge rules.
    [Arguments]    ${uuid}
    ${events}=    Location Events
    FOR    ${e}    IN    @{events}
        IF    $e['uuid'] == $uuid
            Should Be True    ${e}[available]
            ...    msg=event ${uuid} is blocked (${e}[reason]) — the setup left the character unable to act
            RETURN
        END
    END
    Fail    event ${uuid} is not listed at the character's location
