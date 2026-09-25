*** Settings ***
# ---------------------------------------------------------------------------
# resource_logs.robot — Step 40 point D: every gain of energy, food, magic and coin reaches
# the match timeline — a CHOICE row per picked option, the party sum on the row of an event
# with no actor (random event, mission reward) and the automatic events on AWS too.
#
# Tags: alpha-ux, step40, logs
# ---------------------------------------------------------------------------
Resource   alpha_ux_common.resource

Suite Setup       Suite Setup Alpha Ux
Suite Teardown    Suite Teardown Alpha Ux


*** Test Cases ***

A Picked Option Writes One CHOICE Row With Its Gains And Card
    [Tags]    alpha-ux    step40    logs    choices
    ${token}    ${match}=    Fresh Alpha Match
    Pick Option    ${token}    ${match}    32    2
    ${rows}=    Rows Of Type    ${token}    ${match}    CHOICE
    Length Should Be    ${rows}    1
    ${gains}=    Gains Of    ${rows}[0]
    Should Be Equal As Integers    ${gains}[foodGain]    2
    Should Be Equal As Integers    ${gains}[coinGain]    1
    Should Be Equal As Integers    ${rows}[0][idEvent]    32
    Should Not Be Equal    ${rows}[0][card]    ${None}

An Option With No Resource Effect Writes A CHOICE Row Of Zeros
    [Tags]    alpha-ux    step40    logs    choices
    ${token}    ${match}=    Fresh Alpha Match
    Pick Option    ${token}    ${match}    32    3
    ${rows}=    Rows Of Type    ${token}    ${match}    CHOICE
    Length Should Be    ${rows}    1
    ${gains}=    Gains Of    ${rows}[0]
    ${zeros}=    Evaluate    {'energyGain': 0, 'foodGain': 0, 'magicGain': 0, 'coinGain': 0}
    Should Be Equal    ${gains}    ${zeros}

Two Picks In Two Cycles Write Two CHOICE Rows
    [Tags]    alpha-ux    step40    logs    choices
    ${token}    ${match}=    Fresh Alpha Match
    Pick Option    ${token}    ${match}    32    2
    Pick Option    ${token}    ${match}    32    3
    ${rows}=    Rows Of Type    ${token}    ${match}    CHOICE
    Length Should Be    ${rows}    2

A ONCE Choice-Event Stays Consumed After Its CHOICE Row
    [Documentation]    Regression: the new row must not upset the ONCE / open-cycle accounting.
    [Tags]    alpha-ux    step40    logs    choices    regression
    ${token}    ${match}=    Fresh Alpha Match
    Pick Option    ${token}    ${match}    34    4
    ${again}=    Execute Event    ${token}    ${match}    ${EVENTS}[34]    409
    Should Be Equal    ${again.json()}[error]    ONCE_ALREADY_CONSUMED
    ${resolve}=    Select Choice    ${token}    ${match}    ${CHOICES}[4]    409
    Should Be Equal    ${resolve.json()}[error]    CHOICE_NOT_OPEN
    ${rows}=    Rows Of Type    ${token}    ${match}    CHOICE
    Length Should Be    ${rows}    1

A Random Event Logs The Party's Coins On Its Row
    [Documentation]    No actor: the gains of every recipient are summed (one player here).
    ...                The sum rides on the event's own EVENT row, beside its RANDOM_EVENT row.
    [Tags]    alpha-ux    step40    logs    random-events
    ${token}    ${match}=    Fresh Alpha Match    random
    Sleep Action    ${token}    ${match}    200
    ${random}=    Rows Of Type    ${token}    ${match}    RANDOM_EVENT
    Length Should Be    ${random}    1
    ${rows}=    Event Rows Of    ${token}    ${match}    23
    Length Should Be    ${rows}    1
    ${gains}=    Gains Of    ${rows}[0]
    Should Be Equal As Integers    ${gains}[coinGain]    1

A Mission Reward Logs Its Magic
    [Tags]    alpha-ux    step40    logs    missions
    ${token}    ${match}=    Fresh Alpha Match
    Run Event    ${token}    ${match}    36
    ${rows}=    Event Rows Of    ${token}    ${match}    24
    Length Should Be    ${rows}    1
    ${gains}=    Gains Of    ${rows}[0]
    Should Be Equal As Integers    ${gains}[magicGain]    1

A Counter-Zero Event Logs Its Food On Every Backend
    [Tags]    alpha-ux    step40    logs    location-events
    ${token}    ${match}=    Fresh Alpha Match
    Sleep Action    ${token}    ${match}    200
    ${rows}=    Event Rows Of    ${token}    ${match}    20
    Length Should Be    ${rows}    1
    ${gains}=    Gains Of    ${rows}[0]
    Should Be Equal As Integers    ${gains}[foodGain]    1

Execute-Event Rows And Item Rows Are Unchanged
    [Documentation]    Regression: the EVENT row of a player's event keeps its gains and an
    ...                item handed over still writes its ITEM_ADD row.
    [Tags]    alpha-ux    step40    logs    regression
    ${token}    ${match}=    Fresh Alpha Match
    Run Event    ${token}    ${match}    30
    ${rows}=    Event Rows Of    ${token}    ${match}    30
    Length Should Be    ${rows}    1
    ${gains}=    Gains Of    ${rows}[0]
    Should Be Equal As Integers    ${gains}[coinGain]    1
    Run Event    ${token}    ${match}    37
    ${items}=    Rows Of Type    ${token}    ${match}    ITEM_ADD
    Length Should Be    ${items}    1

The Admin Logs Answer The Same CHOICE Row
    [Tags]    alpha-ux    step40    logs    admin
    ${token}    ${match}=    Fresh Alpha Match
    Pick Option    ${token}    ${match}    32    2
    ${logs}=    Get Admin Match Logs    ${ADMIN_TOKEN}    ${match}    200    limit=200
    ${rows}=    Evaluate    [e for e in $logs.json()['logs'] if e.get('type') == 'CHOICE']
    Length Should Be    ${rows}    1
    ${gains}=    Gains Of    ${rows}[0]
    Should Be Equal As Integers    ${gains}[foodGain]    2
    Should Be Equal As Integers    ${gains}[coinGain]    1
