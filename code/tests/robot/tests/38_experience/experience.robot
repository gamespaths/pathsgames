*** Settings ***
# ---------------------------------------------------------------------------
# experience.robot — Step 38, the use-exp action end to end: the price list on /info, the
# purchase, its log row, and every refusal the engine answers.
#
# Fixture and match: experience_common.resource. Every case runs on its own guest and its
# own match, because experience and stats latch.
#
# Tags: experience, step38
# ---------------------------------------------------------------------------
Resource   experience_common.resource

Suite Setup       Suite Setup Experience
Suite Teardown    Suite Teardown Experience


*** Test Cases ***

The Experience Story Imports And Validates Clean
    [Documentation]    The fixture itself must pass the validator: rewards with no location,
    ...                single-step missions and a capped difficulty are all legal.
    [Tags]    experience    step38
    ${report}=    Validate Admin Story    ${STORY_UUID}
    Status Should Be    ${report}    200
    Should Be True    ${report.json()}[valid]
    ...    msg=the experience story does not validate: ${report.json()}

A Fresh Character Reads Its Experience And The Price Of Every Next Point
    [Documentation]    /info players[] carries `exp` (0 at the start) and `expCosts`: with
    ...                expCost 1, expCostBase 0 and every stat at 2, each next point costs 2.
    [Tags]    experience    step38    info
    ${token}    ${match}=    Fresh Experience Match
    ${player}=    The Player    ${token}    ${match}
    Should Be Equal As Integers    ${player}[exp]    0
    Should Be Equal As Integers    ${player}[expCosts][dex]    2
    Should Be Equal As Integers    ${player}[expCosts][int]    2
    Should Be Equal As Integers    ${player}[expCosts][cos]    2

An Event Grants Experience And The Board Reports It
    [Documentation]    The Step 29 exp effect was always written; since Step 38 it is read.
    [Tags]    experience    step38    info
    ${token}    ${match}=    Fresh Experience Match
    Run Event    ${token}    ${match}    10
    ${player}=    The Player    ${token}    ${match}
    Should Be Equal As Integers    ${player}[exp]    1

Buying A Point Raises The Stat, Deducts The Cost And Reprices The Next Point
    [Documentation]    DEX 2 → 3 for 2 exp; the next DEX point then costs 3 (1 × 3 + 0), the
    ...                other two stats still 2. The answer carries the purchase in the
    ...                execute-event shape: +1 dex, -2 exp.
    [Tags]    experience    step38    purchase
    ${token}    ${match}=    Fresh Experience Match
    Run Event    ${token}    ${match}    11
    ${before}=    The Player    ${token}    ${match}
    Should Be Equal As Integers    ${before}[exp]    50

    ${resp}=    Use Exp    ${token}    ${match}    dex    200
    ${body}=    Set Variable    ${resp.json()}
    Should Be Equal    ${body}[stat]    dex
    Should Be Equal As Integers    ${body}[statBefore]    2
    Should Be Equal As Integers    ${body}[statAfter]     3
    Should Be Equal As Integers    ${body}[expBefore]     50
    Should Be Equal As Integers    ${body}[expAfter]      48
    Should Be Equal As Integers    ${body}[expCost]       2
    Should Be Equal As Integers    ${body}[expCosts][dex]    3
    Should Be Equal As Integers    ${body}[expCosts][int]    2
    ${changes}=    Evaluate    [(c['statistic'], c['delta']) for c in $body['statChanges']]
    Should Be Equal    ${changes}    ${{ [('dex', 1), ('exp', -2)] }}
    Should Be Equal    ${body}[characterUuid]    ${before}[uuid]

    ${after}=    The Player    ${token}    ${match}
    Should Be Equal As Integers    ${after}[dexterity]    3
    Should Be Equal As Integers    ${after}[exp]          48
    Should Be Equal As Integers    ${after}[expCosts][dex]    3

The Stat Token Is Trimmed And Case-Folded, Like Every Effect Code
    [Tags]    experience    step38    purchase
    ${token}    ${match}=    Fresh Experience Match
    Run Event    ${token}    ${match}    11
    ${resp}=    Use Exp    ${token}    ${match}    ${SPACE}COS${SPACE}    200
    Should Be Equal    ${resp.json()}[stat]    cos
    Should Be Equal As Integers    ${resp.json()}[statAfter]    3

A Purchase Writes One EXP_USE Row With The Character Attached
    [Tags]    experience    step38    log
    ${token}    ${match}=    Fresh Experience Match
    Run Event    ${token}    ${match}    11
    Use Exp    ${token}    ${match}    int    200
    ${rows}=    Rows Of Type    ${token}    ${match}    EXP_USE
    Length Should Be    ${rows}    1
    Should Contain    ${rows}[0][message]    EXP_USE int 2->3
    ${player}=    The Player    ${token}    ${match}
    Should Be Equal    ${rows}[0][characterUuid]    ${player}[uuid]

Buying Does Not Cost Energy Nor Pass The Turn
    [Tags]    experience    step38    purchase
    ${token}    ${match}=    Fresh Experience Match
    Run Event    ${token}    ${match}    11
    ${before}=    The Player    ${token}    ${match}
    Use Exp    ${token}    ${match}    dex    200
    ${after}=    The Player    ${token}    ${match}
    Should Be Equal As Integers    ${after}[energy]    ${before}[energy]
    # still my turn: a second purchase goes through
    Use Exp    ${token}    ${match}    dex    200

The Cap Prices The Next Point Null And Refuses The Purchase
    [Documentation]    maxStatValue 4: two points take DEX from 2 to 4, then expCosts.dex is
    ...                null and a third point answers 409 MAX_STAT_VALUE.
    [Tags]    experience    step38    refusal
    ${token}    ${match}=    Fresh Experience Match
    Run Event    ${token}    ${match}    11
    Use Exp    ${token}    ${match}    dex    200
    Use Exp    ${token}    ${match}    dex    200
    ${player}=    The Player    ${token}    ${match}
    Should Be Equal As Integers    ${player}[dexterity]    4
    Should Be Equal    ${player}[expCosts][dex]    ${None}
    Should Be Equal As Integers    ${player}[expCosts][int]    2
    ${resp}=    Use Exp    ${token}    ${match}    dex    409
    Should Be Equal    ${resp.json()}[error]    MAX_STAT_VALUE

Not Enough Experience Is Refused Without Touching The Stat
    [Tags]    experience    step38    refusal
    ${token}    ${match}=    Fresh Experience Match
    Run Event    ${token}    ${match}    10
    ${resp}=    Use Exp    ${token}    ${match}    dex    409
    Should Be Equal    ${resp.json()}[error]    NOT_ENOUGH_EXP
    ${player}=    The Player    ${token}    ${match}
    Should Be Equal As Integers    ${player}[dexterity]    2
    Should Be Equal As Integers    ${player}[exp]    1
    ${rows}=    Rows Of Type    ${token}    ${match}    EXP_USE
    Should Be Empty    ${rows}

An Unknown Stat Is A Bad Request
    [Tags]    experience    step38    refusal
    ${token}    ${match}=    Fresh Experience Match
    Run Event    ${token}    ${match}    11
    ${resp}=    Use Exp    ${token}    ${match}    life    400
    Should Be Equal    ${resp.json()}[error]    INVALID_STAT
    ${headers}=    Get Auth Headers    ${token}
    ${empty}=    POST On Session    public_session    /api/gameplay/${match}/action/use-exp
    ...    headers=${headers}    json=${{ {} }}    expected_status=400
    Should Be Equal    ${empty.json()}[error]    INVALID_STAT

The Wilds Are No Place To Train
    [Documentation]    A location with secureParam 0 refuses 409 LOCATION_NOT_SAFE; back in
    ...                the Hall the very same point can be bought.
    [Tags]    experience    step38    refusal
    ${token}    ${match}=    Fresh Experience Match
    Run Event    ${token}    ${match}    11
    Start Movement    ${token}    ${match}    ${LOCATIONS}[2]    200
    ${resp}=    Use Exp    ${token}    ${match}    dex    409
    Should Be Equal    ${resp.json()}[error]    LOCATION_NOT_SAFE
    Start Movement    ${token}    ${match}    ${LOCATIONS}[1]    200
    Use Exp    ${token}    ${match}    dex    200

A Sleeping Or Comatose Character Cannot Train
    [Documentation]    Single player wakes the moment it sleeps, so both states are forced
    ...                through the admin override; the engine refuses them in that order.
    [Tags]    experience    step38    refusal
    ${token}    ${match}=    Fresh Experience Match
    Run Event    ${token}    ${match}    11
    ${player}=    The Player    ${token}    ${match}
    Admin Change Statistics    ${ADMIN_TOKEN}    ${match}    ${player}[uuid]    200    sleeping=${True}
    ${resp}=    Use Exp    ${token}    ${match}    dex    409
    Should Be Equal    ${resp.json()}[error]    SLEEPING
    Admin Change Statistics    ${ADMIN_TOKEN}    ${match}    ${player}[uuid]    200    coma=${True}
    ${resp}=    Use Exp    ${token}    ${match}    dex    409
    Should Be Equal    ${resp.json()}[error]    COMA
    Admin Change Statistics    ${ADMIN_TOKEN}    ${match}    ${player}[uuid]    200    coma=${False}
    Use Exp    ${token}    ${match}    dex    200

A Stopped Match Refuses And A Stranger Is Not Found
    [Tags]    experience    step38    refusal
    ${token}    ${match}=    Fresh Experience Match
    Run Event    ${token}    ${match}    11
    ${stranger}=    New Guest Token
    ${resp}=    Use Exp    ${stranger}    ${match}    dex    404
    Should Be Equal    ${resp.json()}[error]    MATCH_NOT_FOUND
    Use Exp    ${token}    ${UNKNOWN_UUID}    dex    404
    Admin Stop Match    ${ADMIN_TOKEN}    ${match}    200
    ${resp}=    Use Exp    ${token}    ${match}    dex    409
    Should Be Equal    ${resp.json()}[error]    MATCH_NOT_RUNNING

The Admin Override Writes Experience Too
    [Tags]    experience    step38    admin
    ${token}    ${match}=    Fresh Experience Match
    Give Exp    ${token}    ${match}    7
    ${resp}=    Use Exp    ${token}    ${match}    cos    200
    Should Be Equal As Integers    ${resp.json()}[expAfter]    5
