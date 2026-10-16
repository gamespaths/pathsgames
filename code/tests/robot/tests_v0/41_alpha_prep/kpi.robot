*** Settings ***
# kpi.robot — v0.41.2 Step 41 F: the daily KPI counters read through GET /api/admin/reports/kpi before and
# after a played match (start, choice, move, mission, end, coma), day/month/total agreement, bad input 400.
Resource   alpha_prep_common.resource

Suite Setup       Suite Setup Kpi
Suite Teardown    Suite Teardown Alpha Prep


*** Test Cases ***

A Played Match Moves Every Counter Of Its Story
    [Documentation]    start → choice (event 18, option 1) → Road and back (first visit; the Camp is the
    ...                start and never counts, not even when re-entered) → quest (event 14 completes
    ...                mission 1 at once) → END:
    ...                one start, one completion with its durations, the choice, the Road and the
    ...                mission, read as deltas of the same window before and after.
    [Tags]    step41    alpha-prep    kpi
    ${before}=    Kpi Window    total
    ${token}    ${match}=    Fresh Prep Match
    Run Prep Event    ${token}    ${match}    18
    Select Choice    ${token}    ${match}    ${CHOICE}    200
    Start Movement    ${token}    ${match}    ${LOCATIONS}[2]    200
    Start Movement    ${token}    ${match}    ${LOCATIONS}[1]    200
    Run Prep Event    ${token}    ${match}    14
    End Match    ${token}    ${match}    ${EVENTS}[40]    200
    ${after}=    Kpi Window    total
    Row Delta Should Be    ${before}    ${after}    matchesStarted      1
    Row Delta Should Be    ${before}    ${after}    matchesCompleted    1
    Row Delta Should Be    ${before}    ${after}    comaCount           0
    Should Not Be Equal    ${after}[rows][0][avgDurationMinutes]    ${None}
    Should Not Be Equal    ${after}[rows][0][avgDurationClocks]     ${None}
    Should Not Be Equal    ${after}[rows][0][completionRate]        ${None}
    Uuid Delta Should Be    ${before}    ${after}    choices      ${CHOICE}          count        1
    Uuid Delta Should Be    ${before}    ${after}    locations    ${LOCATIONS}[2]    count        1
    Uuid Delta Should Be    ${before}    ${after}    locations    ${LOCATIONS}[1]    count        0
    Uuid Delta Should Be    ${before}    ${after}    missions     ${MISSION}         completed    1
    Uuid Delta Should Be    ${before}    ${after}    missions     ${MISSION}         activated    0

A Coma Is Counted Once Per Character
    [Documentation]    The poisoned well (event 12) drops life to zero: one COMA, nothing else started twice.
    [Tags]    step41    alpha-prep    kpi    edge-states
    ${token}    ${match}=    Fresh Prep Match
    ${before}=    Kpi Window    total
    Run Prep Event    ${token}    ${match}    12
    ${after}=    Kpi Window    total
    Row Delta Should Be    ${before}    ${after}    comaCount         1
    Row Delta Should Be    ${before}    ${after}    matchesStarted    0

A Restored Match That Ends Again Counts Again
    [Documentation]    Decision 44: counters are never rolled back. Sleep (snapshot), END, restore,
    ...                resume, END again — two completions for one match. The admin stop is not one.
    [Tags]    step41    alpha-prep    kpi    snapshots
    ${token}    ${match}=    Fresh Prep Match
    Sleep Action    ${token}    ${match}    200
    ${snapshot}=    Newest Kpi Snapshot    ${match}
    ${before}=    Kpi Window    total
    End Match    ${token}    ${match}    ${EVENTS}[40]    200
    Restore Kpi Snapshot    ${match}    ${snapshot}
    Admin Resume Match    ${ADMIN_TOKEN}    ${match}    200
    End Match    ${token}    ${match}    ${EVENTS}[40]    200
    ${ended}=    Kpi Window    total
    Row Delta Should Be    ${before}    ${ended}    matchesCompleted    2
    ${token2}    ${match2}=    Fresh Prep Match
    Admin Stop Match    ${ADMIN_TOKEN}    ${match2}    200
    ${stopped}=    Kpi Window    total
    Should Be Equal As Integers    ${stopped}[rows][0][matchesCompleted]    ${ended}[rows][0][matchesCompleted]

Month And Total Agree With The Days
    [Documentation]    The same three-day window read by day, by month and as a total sums to the same
    ...                counters; rows cover every period of the range, zeros included.
    [Tags]    step41    alpha-prep    kpi
    ${day}=      Kpi Window    day
    ${month}=    Kpi Window    month
    ${total}=    Kpi Window    total
    Length Should Be    ${day}[rows]    3
    Length Should Be    ${total}[rows]    1
    Should Be Equal    ${total}[rows][0][period]    total
    FOR    ${field}    IN    matchesStarted    matchesCompleted    comaCount
        ${by_day}=      Evaluate    sum(int(r['${field}']) for r in $day['rows'])
        ${by_month}=    Evaluate    sum(int(r['${field}']) for r in $month['rows'])
        Should Be Equal As Integers    ${by_day}    ${total}[rows][0][${field}]
        Should Be Equal As Integers    ${by_month}    ${total}[rows][0][${field}]
    END
    Should Be Equal    ${day}[storyUuid]    ${STORY_UUID}
    Should Be Equal    ${day}[groupBy]    day

Every Story Together Is At Least This Story
    [Documentation]    Without storyUuid the counters of every story are summed.
    [Tags]    step41    alpha-prep    kpi
    ${one}=    Kpi Window    total
    ${all}=    Kpi Report    200    groupBy=total    from=${WINDOW_FROM}    to=${WINDOW_TO}
    Should Be Equal    ${all.json()}[storyUuid]    ${None}
    Should Be True    ${all.json()}[rows][0][matchesStarted] >= ${one}[rows][0][matchesStarted]

Bad Dates, Ranges And Grouping Answer 400
    [Documentation]    A date not YYYY-MM-DD, from after to, more than 366 days, an unknown groupBy.
    [Tags]    step41    alpha-prep    kpi
    ${bad_from}=    Kpi Report    400    storyUuid=${STORY_UUID}    from=2026/09/01
    Should Be Equal    ${bad_from.json()}[error]    INVALID_INPUT
    ${reversed}=    Kpi Report    400    from=2026-09-10    to=2026-09-01
    Should Be Equal    ${reversed.json()}[error]    INVALID_INPUT
    ${too_long}=    Kpi Report    400    from=2025-01-01    to=2026-09-01
    Should Be Equal    ${too_long.json()}[error]    INVALID_INPUT
    ${bad_group}=    Kpi Report    400    groupBy=week
    Should Be Equal    ${bad_group.json()}[error]    INVALID_INPUT


*** Keywords ***

Suite Setup Kpi
    [Documentation]    The shared fixture plus the choice of event 18, the mission, and a window of
    ...                yesterday..tomorrow (UTC) so a run across midnight still reads one window.
    Suite Setup Alpha Prep
    ${choices}=    Prep Rows    choices
    ${missions}=   Prep Rows    missions
    Set Suite Variable    ${CHOICE}     ${choices}[1]
    Set Suite Variable    ${MISSION}    ${missions}[1]
    ${from}=    Evaluate    (datetime.datetime.now(datetime.timezone.utc).date() - datetime.timedelta(days=1)).isoformat()    modules=datetime
    ${to}=      Evaluate    (datetime.datetime.now(datetime.timezone.utc).date() + datetime.timedelta(days=1)).isoformat()    modules=datetime
    Set Suite Variable    ${WINDOW_FROM}    ${from}
    Set Suite Variable    ${WINDOW_TO}      ${to}

Kpi Report
    [Documentation]    GET /api/admin/reports/kpi on the admin session with the given query parameters.
    [Arguments]    ${expected_status}=any    &{params}
    ${headers}=    Get Auth Headers    ${ADMIN_TOKEN}
    ${resp}=    GET On Session    admin_session    /api/admin/reports/kpi    params=${params}
    ...    headers=${headers}    expected_status=${expected_status}
    RETURN    ${resp}

Kpi Window
    [Documentation]    The fixture story's report over the suite window, grouped as asked.
    [Arguments]    ${group_by}
    ${resp}=    Kpi Report    200    storyUuid=${STORY_UUID}    from=${WINDOW_FROM}    to=${WINDOW_TO}
    ...    groupBy=${group_by}
    RETURN    ${resp.json()}

Row Delta Should Be
    [Documentation]    after - before of one counter of the single (total) row.
    [Arguments]    ${before}    ${after}    ${field}    ${expected}
    ${delta}=    Evaluate    int($after['rows'][0][$field]) - int($before['rows'][0][$field])
    Should Be Equal As Integers    ${delta}    ${expected}    msg=${field} moved by ${delta}

Uuid Delta Should Be
    [Documentation]    after - before of one uuid row of choices / locations / missions (absent = 0).
    [Arguments]    ${before}    ${after}    ${table}    ${uuid}    ${field}    ${expected}
    ${old}=    Evaluate    (lambda rows, f, u: int(next((r[f] for r in rows if r['uuid'] == u), 0)))($before[$table], $field, $uuid)
    ${new}=    Evaluate    (lambda rows, f, u: int(next((r[f] for r in rows if r['uuid'] == u), 0)))($after[$table], $field, $uuid)
    Should Be Equal As Integers    ${{ $new - $old }}    ${expected}    msg=${table} ${uuid} ${field} moved by ${{ $new - $old }}

Newest Kpi Snapshot
    [Documentation]    The uuid of the newest snapshot of a match.
    [Arguments]    ${match}
    ${headers}=    Get Auth Headers    ${ADMIN_TOKEN}
    ${resp}=    GET On Session    admin_session    /api/admin/matches/${match}/snapshots
    ...    headers=${headers}    expected_status=200
    Should Not Be Empty    ${resp.json()}    msg=no snapshot was written
    RETURN    ${resp.json()}[0][uuid]

Restore Kpi Snapshot
    [Documentation]    POST .../snapshots/{uuid}/restore, expected to succeed.
    [Arguments]    ${match}    ${snapshot}
    ${headers}=    Get Auth Headers    ${ADMIN_TOKEN}
    POST On Session    admin_session    /api/admin/matches/${match}/snapshots/${snapshot}/restore
    ...    headers=${headers}    expected_status=200
