*** Settings ***
# snapshots.robot — v0.41.1 Step 41 B: one LIGHT snapshot at every time-end, the admin list, check and
# restore (rows back, later log rows gone, time-start at once, PAUSED), a deleted story entity, unknown uuids.
Resource   alpha_prep_common.resource

Suite Setup       Suite Setup Alpha Prep
Suite Teardown    Suite Teardown Alpha Prep


*** Variables ***
${NO_SUCH_UUID}    00000000-0000-4000-8000-000000000000


*** Test Cases ***

A Sleep Writes One Snapshot Of The Clock That Just Ended
    [Documentation]    A started match has none; the sleep that ends clock 0 writes the snapshot of
    ...                clock 0, the next one that of clock 1, and the list answers newest first.
    [Tags]    step41    alpha-prep    snapshots
    ${token}    ${match}=    Fresh Prep Match
    ${none}=    List Snapshots    ${match}
    Should Be Empty    ${none}
    ${sleep}=    Sleep Action    ${token}    ${match}    200
    Should Be True    ${sleep.json()}[timeEndTriggered]
    ${rows}=    List Snapshots    ${match}
    Length Should Be    ${rows}    1
    Should Be Equal As Integers    ${rows}[0][clock]    0
    Should Be Equal    ${rows}[0][type]    LIGHT
    Should Be True    ${rows}[0][sizeBytes] > 0
    Sleep Action    ${token}    ${match}    200
    ${clocks}=    Snapshot Clocks    ${match}
    Should Be Equal    ${clocks}    ${{ [1, 0] }}

A Time-Ending Event Writes The Snapshot Too
    [Documentation]    Event 16 carries flag_end_time: the forced time-end snapshots clock 0 as the
    ...                last sleep does, and the snapshot passes its check.
    [Tags]    step41    alpha-prep    snapshots
    ${token}    ${match}=    Fresh Prep Match
    Run Prep Event    ${token}    ${match}    16
    ${clocks}=    Snapshot Clocks    ${match}
    Should Be Equal    ${clocks}    ${{ [0] }}
    ${snapshot}=    Newest Snapshot    ${match}
    ${check}=    Check Snapshot    ${match}    ${snapshot}    200
    Should Be True    ${check.json()}[valid]
    Should Be Empty    ${check.json()}[errors]

Restore Rolls The Match Back Then Runs The Time-Start And Pauses It
    [Documentation]    Quest (registry + mission reward), sleep = snapshot of clock 0; then the ONCE
    ...                event, a move to the Road and a second sleep. The restore puts location, stats
    ...                and registry back as the first time-start left them, the clock at 1 (snapshot
    ...                + the time-start run again), deletes the later rows and the newer snapshot,
    ...                writes ADMIN_ACTION SNAPSHOT_RESTORED and pauses; after resume the ONCE runs.
    [Tags]    step41    alpha-prep    snapshots
    ${token}    ${match}=    Fresh Prep Match
    Run Prep Event    ${token}    ${match}    14
    Sleep Action    ${token}    ${match}    200
    ${snapshot}=    Newest Snapshot    ${match}
    ${expected}=    Match State    ${token}    ${match}
    Should Be Equal As Integers    ${expected}[clock]    1
    Run Prep Event    ${token}    ${match}    13
    ${again}=    Execute Event    ${token}    ${match}    ${EVENTS}[13]
    Should Not Be Equal As Integers    ${again.status_code}    200    msg=the ONCE event ran twice
    Start Movement    ${token}    ${match}    ${LOCATIONS}[2]    200
    Sleep Action    ${token}    ${match}    200
    ${moved}=    Match State    ${token}    ${match}
    Should Be Equal As Integers    ${moved}[clock]    2
    ${once}=    Event Rows Of    ${match}    13
    Should Not Be Empty    ${once}
    ${restore}=    Restore Snapshot    ${match}    ${snapshot}    200
    Should Be Equal    ${restore.json()}[status]    RESTORED
    Should Be Equal    ${restore.json()}[uuidSnapshot]    ${snapshot}
    Should Be Equal As Integers    ${restore.json()}[clock]    0
    Should Be Equal    ${restore.json()}[matchStatus]    PAUSED
    Should Be True    ${restore.json()}[logsRemoved] > 0
    ${after}=    Match State    ${token}    ${match}
    Should Be Equal As Integers    ${after}[clock]    1
    Should Be Equal    ${after}[status]    PAUSED
    Should Be Equal As Integers    ${after}[location]    ${expected}[location]
    Should Be Equal    ${after}[stats]    ${expected}[stats]
    Should Be Equal    ${after}[registry]    ${expected}[registry]
    ${movements}=    Rows Of Type    ${match}    MOVEMENT
    Should Be Empty    ${movements}    msg=the move to the Road survived the restore
    ${once}=    Event Rows Of    ${match}    13
    Should Be Empty    ${once}    msg=the ONCE event row survived the restore
    ${admin}=    Rows Of Type    ${match}    ADMIN_ACTION
    ${restored}=    Evaluate    [r for r in $admin if r.get('message') == 'SNAPSHOT_RESTORED clock=0']
    Length Should Be    ${restored}    1
    ${clocks}=    Snapshot Clocks    ${match}
    Should Be Equal    ${clocks}    ${{ [0] }}
    Admin Resume Match    ${ADMIN_TOKEN}    ${match}    200
    Run Prep Event    ${token}    ${match}    13

Restoring An Ended Match Leaves It Paused
    [Documentation]    Decision 4: a match that reached its END is restored too — PAUSED, and the
    ...                ENDED lifecycle row is gone with the rest of what came after the snapshot.
    [Tags]    step41    alpha-prep    snapshots
    ${token}    ${match}=    Fresh Prep Match
    Sleep Action    ${token}    ${match}    200
    ${snapshot}=    Newest Snapshot    ${match}
    End Match    ${token}    ${match}    ${EVENTS}[40]    200
    ${ended}=    Admin Get Match Info    ${ADMIN_TOKEN}    ${match}    200
    Should Contain    ${{ ['ENDED', 'GAMEOVER'] }}    ${ended.json()}[match][status]
    Restore Snapshot    ${match}    ${snapshot}    200
    ${info}=    Admin Get Match Info    ${ADMIN_TOKEN}    ${match}    200
    Should Be Equal    ${info.json()}[match][status]    PAUSED
    ${lifecycle}=    Messages Of Type    ${match}    MATCH_LIFECYCLE
    Should Be Equal    ${lifecycle}    ${{ ['CREATED', 'STARTED'] }}

Unknown Snapshots And Matches Answer 404
    [Documentation]    SNAPSHOT_NOT_FOUND on check and restore of an unknown snapshot,
    ...                MATCH_NOT_FOUND on the list of an unknown match.
    [Tags]    step41    alpha-prep    snapshots
    ${token}    ${match}=    Fresh Prep Match
    ${check}=    Check Snapshot    ${match}    ${NO_SUCH_UUID}    404
    Should Be Equal    ${check.json()}[error]    SNAPSHOT_NOT_FOUND
    ${restore}=    Restore Snapshot    ${match}    ${NO_SUCH_UUID}    404
    Should Be Equal    ${restore.json()}[error]    SNAPSHOT_NOT_FOUND
    ${list}=    Snapshots Response    ${NO_SUCH_UUID}    404
    Should Be Equal    ${list.json()}[error]    MATCH_NOT_FOUND

A Story Entity Deleted After The Snapshot Fails The Check And The Restore
    [Documentation]    Runs LAST: it deletes the fixture trait. The charm is granted (event 10), the
    ...                sleep snapshots it, event 11 takes it back so nothing live points at it, then
    ...                the admin CRUD deletes the trait: check answers STORY_ENTITY_MISSING and the
    ...                restore 409 SNAPSHOT_INTEGRITY_FAILED with the same errors, writing nothing.
    [Tags]    step41    alpha-prep    snapshots
    ${token}    ${match}=    Fresh Prep Match
    Run Prep Event    ${token}    ${match}    10
    Sleep Action    ${token}    ${match}    200
    ${snapshot}=    Newest Snapshot    ${match}
    Run Prep Event    ${token}    ${match}    11
    ${deleted}=    Delete Admin Entity    ${STORY_UUID}    traits    ${TRAIT}
    Should Be True    ${deleted.status_code} < 300    msg=the trait delete failed: ${deleted.text}
    ${check}=    Check Snapshot    ${match}    ${snapshot}    200
    Should Not Be True    ${check.json()}[valid]
    ${codes}=    Evaluate    [e['code'] for e in $check.json()['errors']]
    Should Contain    ${codes}    STORY_ENTITY_MISSING
    ${restore}=    Restore Snapshot    ${match}    ${snapshot}    409
    Should Be Equal    ${restore.json()}[error]    SNAPSHOT_INTEGRITY_FAILED
    ${codes}=    Evaluate    [e['code'] for e in $restore.json()['errors']]
    Should Contain    ${codes}    STORY_ENTITY_MISSING
    ${state}=    Match State    ${token}    ${match}
    Should Be Equal    ${state}[status]    RUNNING
    Should Be Equal As Integers    ${state}[clock]    1


*** Keywords ***

Snapshots Response
    [Documentation]    GET /api/admin/matches/{uuid}/snapshots on the admin session.
    [Arguments]    ${match}    ${expected_status}=any
    ${headers}=    Get Auth Headers    ${ADMIN_TOKEN}
    ${resp}=    GET On Session    admin_session    /api/admin/matches/${match}/snapshots
    ...    headers=${headers}    expected_status=${expected_status}
    RETURN    ${resp}

List Snapshots
    [Documentation]    The snapshot summaries of a match, newest first.
    [Arguments]    ${match}
    ${resp}=    Snapshots Response    ${match}    200
    RETURN    ${resp.json()}

Snapshot Clocks
    [Documentation]    The clocks of the listed snapshots, in the answered order.
    [Arguments]    ${match}
    ${rows}=    List Snapshots    ${match}
    ${clocks}=    Evaluate    [int(r['clock']) for r in $rows]
    RETURN    ${clocks}

Newest Snapshot
    [Documentation]    The uuid of the newest snapshot of a match.
    [Arguments]    ${match}
    ${rows}=    List Snapshots    ${match}
    Should Not Be Empty    ${rows}    msg=no snapshot was written
    RETURN    ${rows}[0][uuid]

Check Snapshot
    [Documentation]    GET .../snapshots/{uuid}/check — writes nothing.
    [Arguments]    ${match}    ${snapshot}    ${expected_status}=any
    ${headers}=    Get Auth Headers    ${ADMIN_TOKEN}
    ${resp}=    GET On Session    admin_session    /api/admin/matches/${match}/snapshots/${snapshot}/check
    ...    headers=${headers}    expected_status=${expected_status}
    RETURN    ${resp}

Restore Snapshot
    [Documentation]    POST .../snapshots/{uuid}/restore.
    [Arguments]    ${match}    ${snapshot}    ${expected_status}=any
    ${headers}=    Get Auth Headers    ${ADMIN_TOKEN}
    ${resp}=    POST On Session    admin_session    /api/admin/matches/${match}/snapshots/${snapshot}/restore
    ...    headers=${headers}    expected_status=${expected_status}
    RETURN    ${resp}

Match State
    [Documentation]    Clock, status, the player's location and stats and the registry, off /info.
    [Arguments]    ${token}    ${match}
    ${info}=    Get Match Info    ${token}    ${match}    200
    ${body}=    Set Variable    ${info.json()}
    ${player}=    Set Variable    ${body}[players][0]
    ${stats}=    Evaluate    {k: $player.get(k) for k in ('energy', 'life', 'sad', 'exp', 'coin', 'food', 'magic', 'isSleeping', 'isComa')}
    ${registry}=    Evaluate    sorted((e.get('key'), tuple(e.get('values') or [])) for e in ($body.get('registry') or []))
    ${state}=    Create Dictionary    clock=${body}[match][currentClock]    status=${body}[match][status]
    ...    location=${player}[idLocation]    stats=${stats}    registry=${registry}
    RETURN    ${state}

Event Rows Of
    [Documentation]    The EVENT timeline rows of one fixture event, by story-local id.
    [Arguments]    ${match}    ${id}
    ${rows}=    Rows Of Type    ${match}    EVENT
    ${mine}=    Evaluate    [r for r in $rows if int(r.get('idEvent') or 0) == int($id)]
    RETURN    ${mine}
