*** Settings ***
# ---------------------------------------------------------------------------
# missions_progression.robot — Step 37, the status machine.
#
# The contract under test:
#
#   1. The mission's own condition satisfied → AVAILABLE.
#   2. The FIRST step condition satisfied → ACTIVE.
#   3. The LAST step condition satisfied → COMPLETED.
#   4. An INTERMEDIATE step closing does NOT move the status: a three-step mission stays
#      ACTIVE when its second step closes. Only stepReached moves.
#   5. Steps may be satisfied out of order: the engine re-evaluates forward from the step
#      reached and stops at the first that is not met, so a later step alone changes nothing
#      until the ones before it close.
#   6. Nothing is reversible: a status reached is never lost.
#
# Every case runs on its own guest and its own match, because a mission latches: the 409
# ACTIVE_MATCH_ALREADY_EXISTS guard makes sharing one impossible anyway.
#
# Tags: missions, step37
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource
Resource   ../../resources/missions.resource

Suite Setup    Suite Setup Missions


*** Test Cases ***

The Mission Condition Alone Opens It At AVAILABLE
    [Documentation]    Its own key written, no step touched: the mission is reached but has
    ...                not started, and no step reports done.
    [Tags]    missions    step37
    ${mission}    ${steps}    ${writers}=    Mission With Steps    2
    ${token}    ${match}=    Fresh Mission Match

    Satisfy    ${token}    ${match}    ${writers}    ${mission}[conditionKey]

    ${payload}=    Mission Payload    ${token}    ${match}    ${mission}
    Should Be Equal    ${payload}[status]    AVAILABLE
    Should Be Equal    ${payload}[stepReached]    ${NONE}
    ${ns}=      Create Dictionary    _s=${payload}[steps]
    ${done}=    Evaluate    [s['done'] for s in _s]    namespace=${ns}
    Should Not Contain    ${done}    ${TRUE}    msg=no step has closed yet

The First Step Moves It To ACTIVE
    [Documentation]    One step closed out of several: the mission has started.
    [Tags]    missions    step37
    ${mission}    ${steps}    ${writers}=    Mission With Steps    2
    ${token}    ${match}=    Fresh Mission Match

    Satisfy    ${token}    ${match}    ${writers}    ${mission}[conditionKey]
    Satisfy    ${token}    ${match}    ${writers}    ${steps}[0][conditionKey]

    ${payload}=    Mission Payload    ${token}    ${match}    ${mission}
    Should Be Equal    ${payload}[status]    ACTIVE
    Should Be Equal As Integers    ${payload}[stepReached]    ${steps}[0][step]
    Should Be True    $payload['steps'][0]['done']
    Should Not Be True    $payload['steps'][1]['done']

An Intermediate Step Moves The Step And Not The Status
    [Documentation]    A three-step mission stays ACTIVE when its second step closes; only
    ...                stepReached moves, which is why the persisted state is status + step.
    [Tags]    missions    step37
    ${mission}    ${steps}    ${writers}=    Mission With Steps    3
    ${token}    ${match}=    Fresh Mission Match

    Satisfy    ${token}    ${match}    ${writers}    ${mission}[conditionKey]
    Satisfy    ${token}    ${match}    ${writers}    ${steps}[0][conditionKey]
    Satisfy    ${token}    ${match}    ${writers}    ${steps}[1][conditionKey]

    ${payload}=    Mission Payload    ${token}    ${match}    ${mission}
    Should Be Equal    ${payload}[status]    ACTIVE
    Should Be Equal As Integers    ${payload}[stepReached]    ${steps}[1][step]

The Last Step Completes It
    [Documentation]    Every step closed: COMPLETED, every step done, and the step reached is
    ...                the last one the story declares.
    [Tags]    missions    step37
    ${mission}    ${steps}    ${writers}=    Mission With Steps    2
    ${token}    ${match}=    Fresh Mission Match

    Satisfy    ${token}    ${match}    ${writers}    ${mission}[conditionKey]
    FOR    ${step}    IN    @{steps}
        Satisfy    ${token}    ${match}    ${writers}    ${step}[conditionKey]
    END

    ${payload}=    Mission Payload    ${token}    ${match}    ${mission}
    Should Be Equal    ${payload}[status]    COMPLETED
    ${ns}=      Create Dictionary    _s=${payload}[steps]
    ${done}=    Evaluate    [s['done'] for s in _s]    namespace=${ns}
    Should Not Contain    ${done}    ${FALSE}    msg=a completed mission closes every step
    Should Be Equal As Integers    ${payload}[stepReached]    ${{ $steps[-1]['step'] }}

A Later Step Alone Closes Nothing Until The Ones Before It Do
    [Documentation]    Steps are strictly sequential. Satisfying the LAST condition first
    ...                leaves the mission where it was; closing the first one then closes
    ...                both in one pass, because the second was already met.
    [Tags]    missions    step37
    ${mission}    ${steps}    ${writers}=    Mission With Steps    2
    ${token}    ${match}=    Fresh Mission Match

    Satisfy    ${token}    ${match}    ${writers}    ${mission}[conditionKey]
    Satisfy    ${token}    ${match}    ${writers}    ${steps}[1][conditionKey]

    ${before}=    Mission Payload    ${token}    ${match}    ${mission}
    Should Be Equal    ${before}[status]    AVAILABLE
    ...    msg=an out-of-order step must not open the walk

    Satisfy    ${token}    ${match}    ${writers}    ${steps}[0][conditionKey]

    ${after}=    Mission Payload    ${token}    ${match}    ${mission}
    Should Be Equal As Integers    ${after}[stepReached]    ${steps}[1][step]
    ...    msg=one write must close every step already satisfied

The Status Is Never Lost When The Registry Moves On
    [Documentation]    The admin console empties the very key that opened the mission. The
    ...                registry forgets; the mission does not.
    [Tags]    missions    step37
    ${mission}    ${steps}    ${writers}=    Mission With Steps    2
    ${token}    ${match}=    Fresh Mission Match

    Satisfy    ${token}    ${match}    ${writers}    ${mission}[conditionKey]
    ${before}=    Status Of    ${token}    ${match}    ${mission}

    Admin Delete Registry    ${ADMIN_TOKEN}    ${match}    ${mission}[conditionKey]    200

    ${after}=    Status Of    ${token}    ${match}    ${mission}
    Should Be Equal    ${after}    ${before}
    ...    msg=a mission state is append-and-correct, never rolled back

Reaching The Same State Twice Changes Nothing
    [Documentation]    Idempotence: running the opening event again leaves the mission where
    ...                it is, and does not duplicate it in the payload.
    [Tags]    missions    step37
    ${mission}    ${steps}    ${writers}=    Mission With Steps    2
    ${token}    ${match}=    Fresh Mission Match

    Satisfy    ${token}    ${match}    ${writers}    ${mission}[conditionKey]
    Satisfy    ${token}    ${match}    ${writers}    ${mission}[conditionKey]

    ${missions}=    Missions Of    ${token}    ${match}
    ${ns}=      Create Dictionary    _l=${missions}    _u=${mission}[uuid]
    ${mine}=    Evaluate    [m for m in _l if m['uuid'] == _u]    namespace=${ns}
    Length Should Be    ${mine}    1
    Should Be Equal    ${mine}[0][status]    AVAILABLE

