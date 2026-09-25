*** Settings ***
# ---------------------------------------------------------------------------
# time_end_news.robot — Step 40 point B: an action that ends the time early (execute-event,
# select-choice, an arrival) answers what the time-start set off — counterZero[] and the
# weather in force after it, with `changed` — in the same shape on every backend.
#
# Tags: alpha-ux, step40, time-end
# ---------------------------------------------------------------------------
Resource   alpha_ux_common.resource

Suite Setup       Suite Setup Alpha Ux
Suite Teardown    Suite Teardown Alpha Ux


*** Test Cases ***

Execute Event Ending The Time Tells The Wake-Up List And The Weather
    [Documentation]    FREE event 30 carries flagEndTime: the first time-start runs the Camp
    ...                counter (event 20), and the answer names it, told FULL, with its card.
    [Tags]    alpha-ux    step40    time-end
    ${token}    ${match}=    Fresh Alpha Match
    ${resp}=    Forced Time End By    ${token}    ${match}    event
    ${fuse}=    Evaluate    [c for c in $resp.json()['counterZero'] if c.get('eventUuid') == $EVENTS['20']]
    Length Should Be    ${fuse}    1
    Should Be Equal    ${fuse}[0][trigger]    COUNTER_ZERO
    Should Be Equal    ${fuse}[0][visibility]    FULL
    Should Not Be Equal    ${fuse}[0][card]    ${None}
    Should Not Be Equal    ${resp.json()}[weather]    ${None}
    Should Be Equal As Integers    ${resp.json()}[weather][idWeather]    1

Select Choice Ending The Time Tells The Same News
    [Documentation]    Option 1 of the Crossroads runs event 33, which ends the time.
    [Tags]    alpha-ux    step40    time-end    choices
    ${token}    ${match}=    Fresh Alpha Match
    ${resp}=    Forced Time End By    ${token}    ${match}    choice
    ${pairs}=    Triggers Of    ${resp}
    ${expected}=    Evaluate    ('COUNTER_ZERO', $EVENTS['20'])
    List Should Contain Value    ${pairs}    ${expected}
    Should Be Equal As Integers    ${resp.json()}[weather][idWeather]    1

A Move Whose Arrival Ends The Time Tells The News On The Movement Answer
    [Documentation]    The Tower's first-arrival event ends the time; the time-start that follows
    ...                fires the Tower's start-time event, where the player now stands.
    [Tags]    alpha-ux    step40    time-end    movement
    ${token}    ${match}=    Fresh Alpha Match
    ${resp}=    Forced Time End By    ${token}    ${match}    movement
    ${pairs}=    Triggers Of    ${resp}
    ${expected}=    Evaluate    ('CHARACTER_START_TIME', $EVENTS['25'])
    List Should Contain Value    ${pairs}    ${expected}
    Should Not Be Equal    ${resp.json()}[weather]    ${None}
    Should Be Equal As Integers    ${resp.json()}[currentClock]    1

The Same Scenario Answers An Unchanged Weather
    [Documentation]    A sleep sets Sun; the forced time-end rolls Sun again: changed is false.
    [Tags]    alpha-ux    step40    time-end    weather
    ${token}    ${match}=    Fresh Alpha Match
    Sleep Action    ${token}    ${match}    200
    ${resp}=    Forced Time End By    ${token}    ${match}    event
    Should Be Equal As Integers    ${resp.json()}[weather][idWeather]    1
    Should Not Be True    ${resp.json()}[weather][changed]

A Switched Scenario Answers A Changed Weather With Its Card
    [Tags]    alpha-ux    step40    time-end    weather
    ${token}    ${match}=    Fresh Alpha Match
    Sleep Action    ${token}    ${match}    200
    Set Scenario    ${match}    rain
    ${resp}=    Forced Time End By    ${token}    ${match}    event
    ${weather}=    Set Variable    ${resp.json()}[weather]
    Should Be True    ${weather}[changed]
    Should Be Equal As Integers    ${weather}[idWeather]    2
    Should Not Be Equal    ${weather}[card]    ${None}
    Should Be Equal As Integers    ${weather}[deltaEnergy]    -1

A Random Event Of The Forced Time-Start Sits In counterZero
    [Tags]    alpha-ux    step40    time-end    random-events
    ${token}    ${match}=    Fresh Alpha Match    random
    ${resp}=    Forced Time End By    ${token}    ${match}    event
    ${pairs}=    Triggers Of    ${resp}
    ${expected}=    Evaluate    ('RANDOM_EVENT', $EVENTS['23'])
    List Should Contain Value    ${pairs}    ${expected}

An Action That Does Not End The Time Answers Empty News
    [Documentation]    The new keys are always present: weather null, counterZero empty.
    [Tags]    alpha-ux    step40    time-end
    ${token}    ${match}=    Fresh Alpha Match
    ${resp}=    Run Event    ${token}    ${match}    35
    Should Not Be True    ${resp.json()}[timeEnded]
    Dictionary Should Contain Key    ${resp.json()}    weather
    Should Be Equal    ${resp.json()}[weather]    ${None}
    Should Be Empty    ${resp.json()}[counterZero]

The Sleep Answer Is Unchanged
    [Documentation]    Regression: counterZero[] as before, and no weather block on a sleep.
    [Tags]    alpha-ux    step40    time-end    regression
    ${token}    ${match}=    Fresh Alpha Match
    ${resp}=    Sleep Action    ${token}    ${match}    200
    Should Be True    ${resp.json()}[timeEndTriggered]
    ${pairs}=    Triggers Of    ${resp}
    ${expected}=    Evaluate    ('COUNTER_ZERO', $EVENTS['20'])
    List Should Contain Value    ${pairs}    ${expected}
    Dictionary Should Not Contain Key    ${resp.json()}    weather

The Weather Roll Overwrites The Counter-Zero Weather
    [Documentation]    Known behaviour (decision 2), pinned so a change is deliberate: event 20
    ...                sets Rain, then the roll runs after it and Sun (scenario=sun) wins.
    [Tags]    alpha-ux    step40    time-end    weather    known-behaviour
    ${token}    ${match}=    Fresh Alpha Match
    ${resp}=    Forced Time End By    ${token}    ${match}    event
    ${pairs}=    Triggers Of    ${resp}
    ${expected}=    Evaluate    ('COUNTER_ZERO', $EVENTS['20'])
    List Should Contain Value    ${pairs}    ${expected}
    Should Be Equal As Integers    ${resp.json()}[weather][idWeather]    1
    ${current}=    Get Match Weather    ${token}    ${match}    200
    Should Be Equal    ${current.json()}[uuid]    ${resp.json()}[weather][uuid]

A Time-End That Puts The Actor In A Coma Still Reports The Edge State
    [Documentation]    Regression: in the Swamp, the start-time event of the forced time-start
    ...                empties the life bar; the answer carries the coma.
    [Tags]    alpha-ux    step40    time-end    edge-states    regression
    ${token}    ${match}=    Fresh Alpha Match
    Start Movement    ${token}    ${match}    ${LOCATIONS}[3]    200
    ${resp}=    Run Event    ${token}    ${match}    30
    Should Be True    ${resp.json()}[timeEnded]
    Should Not Be Empty    ${resp.json()}[edgeState][comaUuids]
    ${pairs}=    Triggers Of    ${resp}
    ${expected}=    Evaluate    ('CHARACTER_START_TIME', $EVENTS['22'])
    List Should Contain Value    ${pairs}    ${expected}
