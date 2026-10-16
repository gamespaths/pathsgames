*** Settings ***
# ---------------------------------------------------------------------------
# experience_missions.robot — the "special missions" scenario of Step 38: three single-step
# missions, each of which fires an event granting 1 exp when it completes; in the safe Hall
# that experience buys a DEX point.
# v0.38.3 — the other way round too: use-exp writes the declared keys use-exp (call count)
# and use-exp-<STAT> (value reached), so a mission can wait for experience to be spent.
#
# Tags: experience, step38, missions
# ---------------------------------------------------------------------------
Resource   experience_common.resource

Suite Setup       Suite Setup Experience
Suite Teardown    Suite Teardown Experience


*** Test Cases ***

Three Completed Missions Pay For One Point Of Speed
    [Documentation]    quests=open makes the three missions AVAILABLE; qa/qb/qc=done complete
    ...                them one by one, and each completion fires its reward (+1 exp). Two
    ...                rewards already pay the first DEX point (cost 2); the third is change.
    [Tags]    experience    step38    missions
    ${token}    ${match}=    Fresh Experience Match
    ${player}=    The Player    ${token}    ${match}
    Should Be Equal As Integers    ${player}[exp]    0

    Run Event    ${token}    ${match}    18
    ${missions}=    Get Missions    ${token}    ${match}    200
    Length Should Be    ${missions.json()}[missions]    3
    FOR    ${m}    IN    @{missions.json()}[missions]
        Should Be Equal    ${m}[status]    AVAILABLE
    END

    Run Event    ${token}    ${match}    12
    ${player}=    The Player    ${token}    ${match}
    Should Be Equal As Integers    ${player}[exp]    1
    ...    msg=completing quest A did not fire its reward
    Run Event    ${token}    ${match}    13
    Run Event    ${token}    ${match}    14
    ${player}=    The Player    ${token}    ${match}
    Should Be Equal As Integers    ${player}[exp]    3
    ${missions}=    Get Missions    ${token}    ${match}    200
    FOR    ${m}    IN    @{missions.json()}[missions]
        Should Be Equal    ${m}[status]    COMPLETED
    END

    ${resp}=    Use Exp    ${token}    ${match}    dex    200
    Should Be Equal As Integers    ${resp.json()}[statAfter]    3
    ${player}=    The Player    ${token}    ${match}
    Should Be Equal As Integers    ${player}[dexterity]    3
    Should Be Equal As Integers    ${player}[exp]    1

    ${rows}=    Rows Of Type    ${token}    ${match}    EXP_USE
    Length Should Be    ${rows}    1


Spending Experience Writes The Declared Keys And Moves The Missions Waiting On Them
    [Documentation]    v0.38.3 — the first DEX point writes use-exp=1 and use-exp-DEX=3: First
    ...                lesson completes at once (no steps) and Nimble opens. The second point
    ...                writes use-exp=2 and use-exp-DEX=4, which closes Nimble's only step and
    ...                fires its reward (+1 exp). A point of INT counts a third call but leaves
    ...                no use-exp-INT row: the story does not declare that key.
    [Tags]    experience    step38    missions    registry
    ${token}    ${match}=    Fresh Experience Match
    Give Exp    ${token}    ${match}    10
    ${missions}=    Get Missions    ${token}    ${match}    200
    Length Should Be    ${missions.json()}[missions]    0
    ...    msg=no mission may be reached before experience is spent
    ${values}=    Registry Values Of    ${token}    ${match}    use-exp
    Should Be Equal    ${values}    ${{ [] }}    msg=a declared key starts empty, not absent

    # ── first call: use-exp=1, use-exp-DEX=3 ──
    ${resp}=    Use Exp    ${token}    ${match}    dex    200
    Should Be Equal As Integers    ${resp.json()}[statAfter]    3
    ${values}=    Registry Values Of    ${token}    ${match}    use-exp
    Should Be Equal    ${values}    ${{ ['1'] }}
    ${values}=    Registry Values Of    ${token}    ${match}    use-exp-DEX
    Should Be Equal    ${values}    ${{ ['3'] }}
    ${first}=    Mission Named    ${token}    ${match}    First lesson
    Should Not Be Equal    ${first}    ${None}    msg=First lesson was not reached by use-exp=1
    Should Be Equal    ${first}[status]    COMPLETED
    ${nimble}=    Mission Named    ${token}    ${match}    Nimble
    Should Not Be Equal    ${nimble}    ${None}    msg=Nimble was not opened by use-exp=1
    Should Be Equal    ${nimble}[status]    AVAILABLE
    Should Be Equal As Integers    ${nimble}[stepsTotal]    1
    Should Not Be True    ${nimble}[steps][0][done]
    ${player}=    The Player    ${token}    ${match}
    Should Be Equal As Integers    ${player}[exp]    8    msg=the first point costs 2, no reward yet

    # ── second call: use-exp=2, use-exp-DEX=4 closes Nimble and pays 1 exp back ──
    ${resp}=    Use Exp    ${token}    ${match}    dex    200
    Should Be Equal As Integers    ${resp.json()}[statAfter]    4
    Should Be Equal As Integers    ${resp.json()}[expCost]    3
    ${values}=    Registry Values Of    ${token}    ${match}    use-exp
    Should Be Equal    ${values}    ${{ ['2'] }}
    ${values}=    Registry Values Of    ${token}    ${match}    use-exp-DEX
    Should Be Equal    ${values}    ${{ ['4'] }}
    ${nimble}=    Mission Named    ${token}    ${match}    Nimble
    Should Be Equal    ${nimble}[status]    COMPLETED
    Should Be True    ${nimble}[steps][0][done]
    ${completed}=    Get Missions    ${token}    ${match}    200    status=COMPLETED
    Length Should Be    ${completed.json()}[missions]    2
    ${player}=    The Player    ${token}    ${match}
    Should Be Equal As Integers    ${player}[dexterity]    4
    Should Be Equal As Integers    ${player}[exp]    6
    ...    msg=8 - 3 for the point + 1 from the Nimble reward

    # ── third call: a stat whose key the story does not declare counts but writes no row ──
    ${resp}=    Use Exp    ${token}    ${match}    int    200
    Should Be Equal As Integers    ${resp.json()}[statAfter]    3
    ${values}=    Registry Values Of    ${token}    ${match}    use-exp
    Should Be Equal    ${values}    ${{ ['3'] }}
    ${values}=    Registry Values Of    ${token}    ${match}    use-exp-INT
    Should Be Equal    ${values}    ${None}    msg=an undeclared key must leave no row
    ${first}=    Mission Named    ${token}    ${match}    First lesson
    Should Be Equal    ${first}[status]    COMPLETED    msg=a status never moves backwards

    # ── the timeline: one EXP_USE per call, one REGISTRY_CHANGE per key written ──
    ${rows}=    Rows Of Type    ${token}    ${match}    EXP_USE
    Length Should Be    ${rows}    3
    ${rows}=    Rows Of Type    ${token}    ${match}    REGISTRY_CHANGE
    Length Should Be    ${rows}    5
    ${messages}=    Evaluate    [r['message'] for r in $rows]
    Should Contain    ${messages}[0]    use-exp
    Should Contain    ${messages}[1]    use-exp-DEX
    ${rows}=    Rows Of Type    ${token}    ${match}    MISSION_CHANGE
    Length Should Be    ${rows}    4
    ...    msg=First lesson none->COMPLETED, Nimble none->AVAILABLE, its step, Nimble COMPLETED

