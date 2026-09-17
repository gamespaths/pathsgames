*** Settings ***
# ---------------------------------------------------------------------------
# experience_missions.robot — the "special missions" scenario of Step 38: three single-step
# missions, each of which fires an event granting 1 exp when it completes; in the safe Hall
# that experience buys a DEX point.
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
