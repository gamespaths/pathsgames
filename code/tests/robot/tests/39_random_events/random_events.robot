*** Settings ***
# ---------------------------------------------------------------------------
# random_events.robot — Step 39, the engine: at every time-start, after the weather, at most
# one global random event fires, party-wide and with no actor. probability is an absolute
# percentage, so a row at 100 always fires and a row at 0 never does, on every backend.
#
# Tags: random-events, step39
# ---------------------------------------------------------------------------
Resource   random_events_common.resource

Suite Setup       Suite Setup Random Events
Suite Teardown    Suite Teardown Random Events


*** Test Cases ***

The Story Validates With One Scaling Warning
    [Documentation]    Four rows summing to 300: valid, but the author is told the
    ...                percentages will be scaled. The warning never counts as an error.
    [Tags]    random-events    step39    validation
    ${resp}=    Validate Admin Story    ${STORY_UUID}
    Status Should Be    ${resp}    200
    Should Be True    ${resp.json()}[valid]
    Should Be Equal As Integers    ${resp.json()}[count]    0
    ${rules}=    Evaluate    [w['rule'] for w in $resp.json().get('warnings') or []]
    Should Be Equal    ${rules}    ${{ ['R11_RANDOM_EVENT'] }}

Nothing Fires When No Row Is Eligible
    [Documentation]    No scenario set: every conditioned row is off and row 2 sits at 0%.
    [Tags]    random-events    step39
    ${token}    ${match}=    Fresh Random Match
    ${random}=    Sleep And Get Random Events    ${token}    ${match}
    Should Be Empty    ${random}
    ${rows}=    Rows Of Type    ${token}    ${match}    RANDOM_EVENT
    Should Be Empty    ${rows}    msg=no row fired, so the timeline must not say one did
    ${exp}=    The Player Exp    ${token}    ${match}
    Should Be Equal As Integers    ${exp}    0

A Row At 100 Percent Always Fires And Reaches The Party
    [Documentation]    scenario=always leaves row 1 the only eligible one: it fires on the
    ...                time-start, with no actor, and its ALL effect reaches the character.
    [Tags]    random-events    step39
    ${token}    ${match}=    Fresh Random Match
    Set Scenario    ${match}    scenario    always
    ${random}=    Sleep And Get Random Events    ${token}    ${match}
    Length Should Be    ${random}    1
    Should Be Equal    ${random}[0][eventUuid]    ${EVENTS}[20]
    Should Be Equal    ${random}[0][visibility]    FULL
    Should Be Equal    ${random}[0][idLocation]    ${None}
    ${exp}=    The Player Exp    ${token}    ${match}
    Should Be Equal As Integers    ${exp}    1

The Random Event Leaves One RANDOM_EVENT Row In The Timeline
    [Tags]    random-events    step39    logs
    ${token}    ${match}=    Fresh Random Match
    Set Scenario    ${match}    scenario    always
    Sleep And Get Random Events    ${token}    ${match}
    ${rows}=    Rows Of Type    ${token}    ${match}    RANDOM_EVENT
    Length Should Be    ${rows}    1
    Should Be Equal As Integers    ${rows}[0][idEvent]    20
    Should Be Equal As Integers    ${rows}[0][clock]    1

A ONCE Event Fires Once In Two Days
    [Documentation]    Row 3 names a ONCE event: the second time-start finds it spent.
    [Tags]    random-events    step39
    ${token}    ${match}=    Fresh Random Match
    Set Scenario    ${match}    scenario    once
    ${first}=    Sleep And Get Random Events    ${token}    ${match}
    Length Should Be    ${first}    1
    Should Be Equal    ${first}[0][eventUuid]    ${EVENTS}[22]
    ${second}=    Sleep And Get Random Events    ${token}    ${match}
    Should Be Empty    ${second}
    ${exp}=    The Player Exp    ${token}    ${match}
    Should Be Equal As Integers    ${exp}    10

The Registry Operator Decides The Condition
    [Documentation]    Row 4 fires on level > 2: level 2 leaves nothing eligible, level 3 fires.
    [Tags]    random-events    step39    registry
    ${token}    ${match}=    Fresh Random Match
    Set Scenario    ${match}    level    2
    ${none}=    Sleep And Get Random Events    ${token}    ${match}
    Should Be Empty    ${none}
    Set Scenario    ${match}    level    3
    ${fired}=    Sleep And Get Random Events    ${token}    ${match}
    Length Should Be    ${fired}    1
    Should Be Equal    ${fired}[0][eventUuid]    ${EVENTS}[23]
