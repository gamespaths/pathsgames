*** Settings ***
# logging_gaps.robot — v0.41.1 Step 41 A: PASS, EDGE_STATE, TRAIT_CHANGE, MATCH_LIFECYCLE and ADMIN_ACTION
# on the match timeline, the RECOVERY rows of a time-start on every backend, and the admin info logCount.
Resource   alpha_prep_common.resource

Suite Setup       Suite Setup Alpha Prep
Suite Teardown    Suite Teardown Alpha Prep


*** Test Cases ***

Creating And Starting A Match Writes The Two Lifecycle Rows
    [Documentation]    The creation is the first row of every timeline and the start the second
    ...                lifecycle row, both at clock 0 and both on the match, not on a character.
    [Tags]    step41    alpha-prep    logs
    ${token}    ${match}=    Created Prep Match
    ${created}=    Messages Of Type    ${match}    MATCH_LIFECYCLE
    Should Be Equal    ${created}    ${{ ['CREATED'] }}
    Start Match    ${token}    ${match}    200
    ${rows}=    Rows Of Type    ${match}    MATCH_LIFECYCLE
    ${messages}=    Evaluate    [r.get('message') for r in $rows]
    Should Be Equal    ${messages}    ${{ ['CREATED', 'STARTED'] }}
    FOR    ${row}    IN    @{rows}
        Should Be Equal As Integers    ${row}[clock]    0
        Should Be Equal    ${{ $row.get('characterUuid') }}    ${None}
    END
    ${body}=    Timeline    ${match}
    Should Be Equal    ${body}[logs][0][type]    MATCH_LIFECYCLE

Passing The Turn Writes A PASS Row
    [Documentation]    One pass, one PASS row naming the character that passed, at the clock.
    [Tags]    step41    alpha-prep    logs
    ${token}    ${match}=    Fresh Prep Match
    ${player}=    The Prep Player    ${token}    ${match}
    Pass Turn    ${token}    ${match}    200
    ${rows}=    Rows Of Type    ${match}    PASS
    Length Should Be    ${rows}    1
    Should Be Equal    ${rows}[0][characterUuid]    ${player}
    Should Be Equal As Integers    ${rows}[0][clock]    0

A Lethal Event Writes The COMA And ALL_PLAYER_COMA Edge Rows
    [Documentation]    Life to zero: the character's COMA and, alone in the match, the party's
    ...                ALL_PLAYER_COMA — the kind only in the message, never an EVENT row.
    [Tags]    step41    alpha-prep    logs    edge-states
    ${token}    ${match}=    Fresh Prep Match
    ${player}=    The Prep Player    ${token}    ${match}
    Run Prep Event    ${token}    ${match}    12
    ${rows}=    Rows Of Type    ${match}    EDGE_STATE
    ${messages}=    Evaluate    [r.get('message') for r in $rows]
    Should Contain    ${messages}    COMA
    Should Contain    ${messages}    ALL_PLAYER_COMA
    ${coma}=    Evaluate    [r for r in $rows if r.get('message') == 'COMA']
    Should Be Equal    ${coma}[0][characterUuid]    ${player}
    ${events}=    Messages Of Type    ${match}    EVENT
    ${leaked}=    Evaluate    [m for m in $events if 'COMA' in (m or '')]
    Should Be Empty    ${leaked}    msg=an edge state surfaced as an EVENT row

Resting In A Safe Place Wakes From The Coma With A COMA_RECOVERED Row
    [Documentation]    The comatose character sleeps in the Camp: the time-start lifts its life
    ...                and the timeline says it woke — COMA_RECOVERED is not a COMA row.
    [Tags]    step41    alpha-prep    logs    edge-states
    ${token}    ${match}=    Fresh Prep Match
    ${player}=    The Prep Player    ${token}    ${match}
    Run Prep Event    ${token}    ${match}    12
    Sleep Action    ${token}    ${match}    200
    ${rows}=    Rows Of Type    ${match}    EDGE_STATE
    ${woke}=    Evaluate    [r for r in $rows if r.get('message') == 'COMA_RECOVERED']
    Length Should Be    ${woke}    1
    Should Be Equal    ${woke}[0][characterUuid]    ${player}
    ${comas}=    Evaluate    [r for r in $rows if r.get('message') == 'COMA']
    Length Should Be    ${comas}    1

Sadness Over Its Cap Writes A SADNESS_OVERFLOW Row
    [Documentation]    Sadness +99 over a cap of 5: one SADNESS_OVERFLOW row, and no coma.
    [Tags]    step41    alpha-prep    logs    edge-states
    ${token}    ${match}=    Fresh Prep Match
    Run Prep Event    ${token}    ${match}    17
    ${messages}=    Messages Of Type    ${match}    EDGE_STATE
    Should Be Equal    ${messages}    ${{ ['SADNESS_OVERFLOW'] }}

A Trait Effect Writes TRAIT_CHANGE ADD Then REMOVE
    [Documentation]    Event 10 grants the charm and event 11 takes it back: two rows naming the
    ...                trait uuid, each carrying the event that moved it and the character.
    [Tags]    step41    alpha-prep    logs    traits
    ${token}    ${match}=    Fresh Prep Match
    ${player}=    The Prep Player    ${token}    ${match}
    Run Prep Event    ${token}    ${match}    10
    Run Prep Event    ${token}    ${match}    11
    ${rows}=    Rows Of Type    ${match}    TRAIT_CHANGE
    ${messages}=    Evaluate    [r.get('message') for r in $rows]
    Should Be Equal    ${messages}    ${{ ['ADD ' + $TRAIT, 'REMOVE ' + $TRAIT] }}
    Should Be Equal As Integers    ${rows}[0][idEvent]    10
    Should Be Equal As Integers    ${rows}[1][idEvent]    11
    Should Be Equal    ${rows}[0][characterUuid]    ${player}

The Story End Writes The ENDED Lifecycle Row
    [Documentation]    Reaching the END event closes the timeline with MATCH_LIFECYCLE ENDED.
    [Tags]    step41    alpha-prep    logs
    ${token}    ${match}=    Fresh Prep Match
    End Match    ${token}    ${match}    ${EVENTS}[40]    200
    ${messages}=    Messages Of Type    ${match}    MATCH_LIFECYCLE
    Should Be Equal    ${messages}    ${{ ['CREATED', 'STARTED', 'ENDED'] }}

Admin Pause And Resume Write ADMIN_ACTION Rows
    [Documentation]    The console's pause and resume are on the timeline — the player endpoint
    ...                answers them too (react-game hides them, decision 1).
    [Tags]    step41    alpha-prep    logs    admin
    ${token}    ${match}=    Fresh Prep Match
    Admin Pause Match     ${ADMIN_TOKEN}    ${match}    200
    Admin Resume Match    ${ADMIN_TOKEN}    ${match}    200
    ${messages}=    Messages Of Type    ${match}    ADMIN_ACTION
    Should Be Equal    ${messages}    ${{ ['PAUSE', 'RESUME'] }}
    ${player_logs}=    Get Match Logs    ${token}    ${match}    200    limit=200
    ${types}=    Evaluate    [e.get('type') for e in $player_logs.json()['logs']]
    Should Contain    ${types}    ADMIN_ACTION

Admin Stats, Status And Stop Write Their ADMIN_ACTION Rows
    [Documentation]    changeStatistics names the applied fields on the character; a PUT with a
    ...                status writes STATUS, a rename alone writes nothing; stop writes STOP.
    [Tags]    step41    alpha-prep    logs    admin
    ${token}    ${match}=    Fresh Prep Match
    ${player}=    The Prep Player    ${token}    ${match}
    Admin Change Statistics    ${ADMIN_TOKEN}    ${match}    ${player}    200    energy=${7}
    ${headers}=    Get Auth Headers    ${ADMIN_TOKEN}
    ${status}=    Create Dictionary    status=PAUSED
    PUT On Session    admin_session    /api/admin/matches/${match}    json=${status}
    ...    headers=${headers}    expected_status=200
    ${rename}=    Create Dictionary    name=robottest_alpha_prep_renamed
    PUT On Session    admin_session    /api/admin/matches/${match}    json=${rename}
    ...    headers=${headers}    expected_status=200
    Admin Stop Match    ${ADMIN_TOKEN}    ${match}    200
    ${rows}=    Rows Of Type    ${match}    ADMIN_ACTION
    ${messages}=    Evaluate    [r.get('message') for r in $rows]
    Should Be Equal    ${messages}    ${{ ['STATS energy=7', 'STATUS PAUSED', 'STOP'] }}
    Should Be Equal    ${rows}[0][characterUuid]    ${player}

A Sleep Writes One RECOVERY Row Per Character On Every Backend
    [Documentation]    The time-start recovery row java and python always wrote, now on AWS too.
    [Tags]    step41    alpha-prep    logs    recovery
    ${token}    ${match}=    Fresh Prep Match
    ${player}=    The Prep Player    ${token}    ${match}
    ${sleep}=    Sleep Action    ${token}    ${match}    200
    Should Be True    ${sleep.json()}[timeEndTriggered]
    ${rows}=    Rows Of Type    ${match}    RECOVERY
    Length Should Be    ${rows}    1
    Should Be Equal    ${rows}[0][characterUuid]    ${player}
    Should Start With    ${rows}[0][message]    recovery safe=

Admin Info Reports The Log Count
    [Documentation]    logCount counts the stored rows (every log row on java/python, the LOG#
    ...                rows on AWS): never below the timeline total, one more after a pass.
    [Tags]    step41    alpha-prep    logs    admin
    ${token}    ${match}=    Fresh Prep Match
    ${before}=    Admin Get Match Info    ${ADMIN_TOKEN}    ${match}    200
    ${count}=    Set Variable    ${before.json()}[logCount]
    ${body}=    Timeline    ${match}
    Should Be True    ${count} >= ${body}[total] > 0
    Pass Turn    ${token}    ${match}    200
    ${after}=    Admin Get Match Info    ${ADMIN_TOKEN}    ${match}    200
    Should Be Equal As Integers    ${after.json()}[logCount]    ${{ int($count) + 1 }}
