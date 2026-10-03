*** Settings ***
# match_export_import.robot — v0.41.4 Step 41 H: the neutral match export (pause, file, restore, restart), the
# dry-run and the import (copy, replace, cross-family fixture, story modes, refusals, KPI), the golden matrix.
Resource   alpha_prep_common.resource
Library    ../../resources/MatchExportHelper.py

Suite Setup       Suite Setup Match Export
Suite Teardown    Suite Teardown Match Export


*** Variables ***
${NO_SUCH_UUID}     00000000-0000-4000-8000-000000000000
${FIXTURE}          ${CURDIR}/fixtures/match_export_aws_v1.json
${GOLDEN_DIR}       ${CURDIR}/fixtures/golden
${WRITE_GOLDEN}     ${EMPTY}
@{IMPORTED_STORIES}


*** Test Cases ***

Export Of A Running Match Restores It And Restarts It
    [Documentation]    Quest then sleep: the snapshot of clock 0, the match at clock 1. The ONCE event
    ...                runs after it. The export answers a valid file (schema, checksum, fingerprint) of
    ...                clock 0; the source is RUNNING at clock 1 again, its timeline has SNAPSHOT_RESTORED
    ...                and EXPORTED, and the ONCE row is gone (the event runs again).
    [Tags]    step41    alpha-prep    match-export
    ${token}    ${match}=    Played Match With A Snapshot
    Run Prep Event    ${token}    ${match}    13
    ${resp}=    Export Match Response    ${match}    200
    Should Contain    ${resp.headers}[Content-Disposition]    match-
    ${doc}=    Set Variable    ${resp.json()}
    Validate Match Export    ${doc}
    Should Be Equal As Integers    ${doc}[source][snapshotClock]    0
    Should Be Equal    ${doc}[match][uuid]    ${match}
    ${info}=    Admin Get Match Info    ${ADMIN_TOKEN}    ${match}    200
    Should Be Equal    ${info.json()}[match][status]    RUNNING
    Should Be Equal As Integers    ${info.json()}[match][currentClock]    1
    ${admin}=    Messages Of Type    ${match}    ADMIN_ACTION
    Should Contain    ${admin}    SNAPSHOT_RESTORED clock=0
    Should Contain    ${admin}    EXPORTED clock=0
    ${once}=    Event Rows Of    ${match}    13
    Should Be Empty    ${once}    msg=the ONCE event row done after the snapshot survived the export
    Run Prep Event    ${token}    ${match}    13

No Snapshot, Unknown Match And A Paused Source
    [Documentation]    A started match without a time-end answers 409 NO_SNAPSHOT; an unknown uuid 404;
    ...                a PAUSED source is exported, restored and stays PAUSED (decision 58).
    [Tags]    step41    alpha-prep    match-export
    ${token}    ${match}=    Fresh Prep Match
    ${none}=    Export Match Response    ${match}    409
    Should Be Equal    ${none.json()}[error]    NO_SNAPSHOT
    ${missing}=    Export Match Response    ${NO_SUCH_UUID}    404
    Should Be Equal    ${missing.json()}[error]    MATCH_NOT_FOUND
    ${token}    ${paused}=    Played Match With A Snapshot
    Admin Pause Match    ${ADMIN_TOKEN}    ${paused}    200
    Export Match Response    ${paused}    200
    ${info}=    Admin Get Match Info    ${ADMIN_TOKEN}    ${paused}    200
    Should Be Equal    ${info.json()}[match][status]    PAUSED

A Dry Run On The Same Server Finds The Match, The Story And The Users
    [Documentation]    The file re-checked where it came from: MATCH_EXISTS only, story SAME, every user
    ...                EXISTING; nothing written.
    [Tags]    step41    alpha-prep    match-export
    ${token}    ${match}=    Played Match With A Snapshot
    ${doc}=    Exported Document    ${match}
    ${request}=    Import Request    ${doc}    dry_run=${True}
    ${check}=    Import Match Response    ${request}    200
    Should Not Be True    ${check.json()}[valid]
    ${codes}=    Codes Of    ${check.json()}[errors]
    Should Be Equal    ${codes}    ${{ ['MATCH_EXISTS'] }}
    Should Be True    ${check.json()}[matchExists]
    Should Be Equal    ${check.json()}[story][status]    SAME
    Should Be Equal    ${check.json()}[story][action]    USE_EXISTING
    ${statuses}=    Evaluate    sorted({u['status'] for u in $check.json()['users']})
    Should Be Equal    ${statuses}    ${{ ['EXISTING'] }}

A Copy Is Imported Running At The Next Clock With The Same State
    [Documentation]    The file with new match and character uuids: 201 RUNNING at clock 1, snapshot
    ...                "Imported at clock 0", timeline rows up to the mark plus IMPORTED; location, stats,
    ...                registry, missions and weather equal to the source after its export (same family).
    ...                The source, RUNNING on the same story for the same guest, is paused (decision 60).
    [Tags]    step41    alpha-prep    match-export
    ${token}    ${match}=    Played Match With A Snapshot
    ${doc}=    Exported Document    ${match}
    ${source}=    Match State    ${token}    ${match}
    ${copy}=    Rewrite Export Uuids    ${doc}
    ${new}=    Set Variable    ${copy}[match][uuid]
    Append To List    ${CREATED_MATCHES}    ${new}
    ${request}=    Import Request    ${copy}
    ${resp}=    Import Match Response    ${request}    201
    ${body}=    Set Variable    ${resp.json()}
    Should Be Equal    ${body}[status]    IMPORTED
    Should Be Equal    ${body}[uuidMatch]    ${new}
    Should Be Equal    ${body}[matchStatus]    RUNNING
    Should Be Equal As Integers    ${body}[snapshotClock]    0
    Should Be Equal As Integers    ${body}[clock]    1
    ${warnings}=    Codes Of    ${body}[warnings]
    Should Contain    ${warnings}    USER_HAS_ACTIVE_MATCH
    ${paused}=    Admin Get Match Info    ${ADMIN_TOKEN}    ${match}    200
    Should Be Equal    ${paused.json()}[match][status]    PAUSED
    ${descriptions}=    Snapshot Descriptions    ${new}
    Should Contain    ${descriptions}    Imported at clock 0
    ${admin}=    Messages Of Type    ${new}    ADMIN_ACTION
    ${imported}=    Evaluate    [m for m in $admin if str(m).startswith('IMPORTED ') and str(m).endswith(' clock=0')]
    Length Should Be    ${imported}    1
    ${quest}=    Event Rows Of    ${new}    14
    Length Should Be    ${quest}    1
    ${state}=    Match State    ${token}    ${new}
    Should Be Equal As Integers    ${state}[clock]    ${source}[clock]
    Should Be Equal As Integers    ${state}[location]    ${source}[location]
    Should Be Equal    ${state}[stats]    ${source}[stats]
    Should Be Equal    ${state}[registry]    ${source}[registry]
    ${source_missions}=    Mission Statuses    ${token}    ${match}
    ${copy_missions}=    Mission Statuses    ${token}    ${new}
    Should Be Equal    ${copy_missions}    ${source_missions}
    ${source_weather}=    Current Weather    ${match}
    ${copy_weather}=    Current Weather    ${new}
    Should Be Equal    ${copy_weather}    ${source_weather}

An Item Obtained Before The Export Travels With The Copy, An Unobtained One Does Not
    [Documentation]    v0.41.6: event 20 hands item 1 (Lantern) over before the sleep; item 2 (Rope) is
    ...                defined but never obtained. The file carries itemId 1 only on the character; the
    ...                source after its restore and the imported copy both hold the Lantern alone.
    [Tags]    step41    alpha-prep    match-export    inventory
    ${token}    ${match}=    Fresh Prep Match
    Run Prep Event    ${token}    ${match}    20
    Run Prep Event    ${token}    ${match}    14
    Sleep Action    ${token}    ${match}    200
    ${doc}=    Exported Document    ${match}
    ${exported}=    Evaluate    sorted(int(i['itemId']) for i in $doc['characters'][0].get('items') or [])
    Should Be Equal    ${exported}    ${{ [1] }}    msg=the export does not carry the Lantern alone
    ${amount}=    Evaluate    int($doc['characters'][0]['items'][0].get('amount') or 0)
    Should Be Equal As Integers    ${amount}    1
    ${source}=    Inventory Item Uuids    ${token}    ${match}
    Should Be Equal    ${source}    ${{ [$ITEMS['1']] }}
    ${copy}=    Rewrite Export Uuids    ${doc}
    ${new}=    Set Variable    ${copy}[match][uuid]
    Append To List    ${CREATED_MATCHES}    ${new}
    ${request}=    Import Request    ${copy}
    Import Match Response    ${request}    201
    ${held}=    Inventory Item Uuids    ${token}    ${new}
    Should Be Equal    ${held}    ${{ [$ITEMS['1']] }}    msg=the imported inventory is not the Lantern alone
    Should Not Contain    ${held}    ${ITEMS}[2]

Replace Re-Imports The Copy And Its Imported Snapshot Restores
    [Documentation]    The same copy again: 409 MATCH_EXISTS, then 201 with replace=true; the
    ...                "Imported at clock 0" snapshot of the copy restores (200, PAUSED).
    [Tags]    step41    alpha-prep    match-export
    ${token}    ${match}=    Played Match With A Snapshot
    ${doc}=    Exported Document    ${match}
    ${copy}=    Rewrite Export Uuids    ${doc}
    Append To List    ${CREATED_MATCHES}    ${copy}[match][uuid]
    ${request}=    Import Request    ${copy}
    Import Match Response    ${request}    201
    ${again}=    Import Match Response    ${request}    409
    Should Be Equal    ${again.json()}[error]    MATCH_EXISTS
    ${replace}=    Import Request    ${copy}    replace=${True}
    ${resp}=    Import Match Response    ${replace}    201
    Should Be Equal    ${resp.json()}[matchStatus]    RUNNING
    ${headers}=    Get Auth Headers    ${ADMIN_TOKEN}
    ${restore}=    POST On Session    admin_session
    ...    /api/admin/matches/${copy}[match][uuid]/snapshots/${resp.json()}[uuidSnapshot]/restore
    ...    headers=${headers}    expected_status=200
    Should Be Equal    ${restore.json()}[matchStatus]    PAUSED

A New User Keeps Its E-Mail And A Later File Is Mapped Onto It By E-Mail
    [Documentation]    Decisions 54/56: a copy whose creator is a new uuid with a fresh e-mail creates that
    ...                user with the e-mail; a second copy whose creator is another new uuid with the same
    ...                e-mail (other case) is MAPPED_BY_EMAIL onto the first one (USER_MAPPED_BY_EMAIL,
    ...                no user created, the new uuid never written).
    [Tags]    step41    alpha-prep    match-export
    ${token}    ${match}=    Played Match With A Snapshot
    ${doc}=    Exported Document    ${match}
    ${source_user}=    Creator Uuid    ${doc}
    ${first_user}=    New Uuid
    ${second_user}=    New Uuid
    ${email}=    Evaluate    "robottest_" + $first_user[:8] + "@example.org"
    ${first}=    Rewrite Export Uuids    ${doc}    user_map=${{ {$source_user: $first_user} }}
    ${first}=    With User Email    ${first}    ${first_user}    ${email}
    Append To List    ${CREATED_MATCHES}    ${first}[match][uuid]
    ${request}=    Import Request    ${first}
    ${created}=    Import Match Response    ${request}    201
    Should Be Equal As Integers    ${created.json()}[usersCreated]    1
    ${second}=    Rewrite Export Uuids    ${doc}    user_map=${{ {$source_user: $second_user} }}
    ${second}=    With User Email    ${second}    ${second_user}    ${{ $email.upper() }}
    ${dry}=    Import Request    ${second}    dry_run=${True}
    ${check}=    Import Match Response    ${dry}    200
    Should Be True    ${check.json()}[valid]    msg=${check.text}
    ${mapped}=    Find Dicts    ${check.json()}[users]    uuid    ${second_user}
    Should Be Equal    ${mapped}[0][status]    MAPPED_BY_EMAIL
    Should Be Equal    ${mapped}[0][targetUuid]    ${first_user}
    ${warnings}=    Codes Of    ${check.json()}[warnings]
    Should Contain    ${warnings}    USER_MAPPED_BY_EMAIL
    Append To List    ${CREATED_MATCHES}    ${second}[match][uuid]
    ${request}=    Import Request    ${second}
    ${resp}=    Import Match Response    ${request}    201
    Should Be Equal As Integers    ${resp.json()}[usersCreated]    0
    ${headers}=    Get Auth Headers    ${ADMIN_TOKEN}
    ${ghost}=    GET On Session    admin_session    /api/admin/guests/${second_user}
    ...    headers=${headers}    expected_status=any
    Should Not Be Equal As Integers    ${ghost.status_code}    200    msg=the mapped uuid was created as a user

A Cross-Family File Keeps ONCE, The Open Choice, Registry, Mission And Visited Locations
    [Documentation]    fixtures/match_export_aws_v1.json, hand-built on the alpha-prep story as AWS writes
    ...                it, its creator mapped to a fresh robot guest and a second, tokenless guest copied:
    ...                event 13 (ONCE) is not offered, event 18's open choice is served again without
    ...                charge, quest=done, mission 1 COMPLETED, both locations visited, the copied guest
    ...                exists without token; CROSS_FAMILY on every target but AWS. Inventory (v0.41.6):
    ...                the character carries item 1 (Lantern) only, item 2 (Rope) is defined but never held.
    [Tags]    step41    alpha-prep    match-export    cross-family
    ${token}=    New Guest Token
    ${creator}=    Guest Uuid    ${token}
    ${doc}=    Load Fixture    ${FIXTURE}    ${STORY_FILE}    ${creator}
    Validate Match Export    ${doc}
    ${new}=    Set Variable    ${doc}[match][uuid]
    Append To List    ${CREATED_MATCHES}    ${new}
    ${dry}=    Import Request    ${doc}    dry_run=${True}    story_mode=KEEP
    ${check}=    Import Match Response    ${dry}    200
    Should Be True    ${check.json()}[valid]    msg=${check.text}
    ${warnings}=    Codes Of    ${check.json()}[warnings]
    IF    '${THIS_BACKEND}' == 'aws'
        Should Not Contain    ${warnings}    CROSS_FAMILY
    ELSE
        Should Contain    ${warnings}    CROSS_FAMILY
    END
    ${request}=    Import Request    ${doc}    story_mode=KEEP
    ${resp}=    Import Match Response    ${request}    201
    Should Be Equal As Integers    ${resp.json()}[clock]    2
    ${once}=    Execute Event    ${token}    ${new}    ${EVENTS}[13]
    Should Not Be Equal As Integers    ${once.status_code}    200    msg=the ONCE event ran again after the import
    ${choice}=    Execute Event    ${token}    ${new}    ${EVENTS}[18]    200
    Should Be Equal    ${choice.json()}[status]    CHOICES_PENDING
    Should Be Equal As Integers    ${choice.json()}[energySpent]    0
    ${registry}=    Get Registry    ${token}    ${new}    200    include_hidden=true
    ${quest}=    Registry Values    ${registry.json()}    quest
    Should Contain    ${quest}    done
    ${missions}=    Mission Statuses    ${token}    ${new}
    Should Be Equal    ${missions}[${MISSION}]    COMPLETED
    ${visited}=    Admin Get Locations    ${ADMIN_TOKEN}    ${new}    200
    Should Contain    ${visited.text}    ${LOCATIONS}[1]
    Should Contain    ${visited.text}    ${LOCATIONS}[2]
    ${held}=    Inventory Item Uuids    ${token}    ${new}
    Should Be Equal    ${held}    ${{ [$ITEMS['1']] }}    msg=the imported inventory is not the Lantern alone
    ${guest_uuid}=    Guest Of Fixture    ${doc}
    ${guest}=    GET On Session    admin_session    /api/admin/guests/${guest_uuid}
    ...    headers=${{ {'Authorization': 'Bearer ' + $ADMIN_TOKEN} }}    expected_status=200
    ${body}=    Set Variable    ${guest.json()}
    ${tokenless}=    Evaluate    not any(map($body.get, ('guestCookieToken', 'guestToken', 'guest_token', 'guest_cookie_token')))
    Should Be True    ${tokenless}    msg=the copied guest carries a token: ${guest.text}

The Bundled Story Is Imported, Or Refused When It Differs, Or Kept
    [Documentation]    The fixture with a new story uuid: story ABSENT → IMPORT, 201. The bundled story
    ...                changed (one text) on a server that has it: 409 STORY_DIFFERS; storyMode=KEEP: 201.
    [Tags]    step41    alpha-prep    match-export
    ${token}=    New Guest Token
    ${creator}=    Guest Uuid    ${token}
    ${doc}=    Load Fixture    ${FIXTURE}    ${STORY_FILE}    ${creator}
    ${story_uuid}=    New Uuid
    Append To List    ${IMPORTED_STORIES}    ${story_uuid}
    ${moved}=    Rewrite Export Uuids    ${doc}    story_uuid=${story_uuid}
    Append To List    ${CREATED_MATCHES}    ${moved}[match][uuid]
    ${dry}=    Import Request    ${moved}    dry_run=${True}
    ${check}=    Import Match Response    ${dry}    200
    Should Be Equal    ${check.json()}[story][status]    ABSENT
    Should Be Equal    ${check.json()}[story][action]    IMPORT
    ${request}=    Import Request    ${moved}
    ${created}=    Import Match Response    ${request}    201
    Should Be Equal    ${created.json()}[storyAction]    IMPORT
    ${token2}=    New Guest Token
    ${creator2}=    Guest Uuid    ${token2}
    ${other}=    Load Fixture    ${FIXTURE}    ${STORY_FILE}    ${creator2}
    ${changed}=    Edit Story Text    ${other}
    Append To List    ${CREATED_MATCHES}    ${changed}[match][uuid]
    ${auto}=    Import Request    ${changed}
    ${refused}=    Import Match Response    ${auto}    409
    Should Be Equal    ${refused.json()}[error]    STORY_DIFFERS
    ${keep}=    Import Request    ${changed}    story_mode=KEEP
    ${kept}=    Import Match Response    ${keep}    201
    Should Be Equal    ${kept.json()}[storyAction]    KEEP

A Tampered File Or An Unknown Version Is Refused
    [Documentation]    422 IMPORT_INVALID with CHECKSUM_MISMATCH for a changed checksum, with
    ...                FORMAT_UNKNOWN for formatVersion 2.
    [Tags]    step41    alpha-prep    match-export
    ${token}=    New Guest Token
    ${creator}=    Guest Uuid    ${token}
    ${doc}=    Load Fixture    ${FIXTURE}    ${STORY_FILE}    ${creator}
    ${tampered}=    Tamper Checksum    ${doc}
    ${request}=    Import Request    ${tampered}    story_mode=KEEP
    ${resp}=    Import Match Response    ${request}    422
    Should Be Equal    ${resp.json()}[error]    IMPORT_INVALID
    ${codes}=    Codes Of    ${resp.json()}[errors]
    Should Contain    ${codes}    CHECKSUM_MISMATCH
    ${v2}=    With Format Version    ${doc}    2
    ${request}=    Import Request    ${v2}    story_mode=KEEP
    ${resp}=    Import Match Response    ${request}    422
    ${codes}=    Codes Of    ${resp.json()}[errors]
    Should Contain    ${codes}    FORMAT_UNKNOWN

Export And Import Leave The KPI Report Unchanged
    [Documentation]    No KPI on export or import: matches started and completed of the story stay as
    ...                they were (decision 44 covers the restore inside the export).
    [Tags]    step41    alpha-prep    match-export    kpi
    ${token}    ${match}=    Played Match With A Snapshot
    ${before}=    Kpi Totals
    ${doc}=    Exported Document    ${match}
    ${copy}=    Rewrite Export Uuids    ${doc}
    Append To List    ${CREATED_MATCHES}    ${copy}[match][uuid]
    ${request}=    Import Request    ${copy}
    Import Match Response    ${request}    201
    ${after}=    Kpi Totals
    Should Be Equal    ${after}    ${before}

Write Golden Export
    [Documentation]    Owner only (decision 66): with -v WRITE_GOLDEN:1 saves fixtures/golden/export_<backend>.json
    ...                from a scripted match (item, quest, ONCE, move, open choice, sleep). Skipped otherwise.
    [Tags]    step41    alpha-prep    match-export    golden
    Skip If    '${WRITE_GOLDEN}' == '${EMPTY}'    WRITE_GOLDEN is not set
    ${token}    ${match}=    Fresh Prep Match
    Run Prep Event    ${token}    ${match}    20
    Run Prep Event    ${token}    ${match}    14
    Run Prep Event    ${token}    ${match}    13
    Start Movement    ${token}    ${match}    ${LOCATIONS}[2]    200
    Execute Event    ${token}    ${match}    ${EVENTS}[18]    200
    Sleep Action    ${token}    ${match}    200
    ${doc}=    Exported Document    ${match}
    ${path}=    Write Golden    ${doc}    ${GOLDEN_DIR}
    Log    golden export written to ${path}

Golden Exports Import On This Target
    [Documentation]    Every committed fixtures/golden/export_<backend>.json imports here (copy uuids, the
    ...                creator mapped to a fresh guest, storyMode KEEP) with the observable state of the
    ...                cross-family case: ONCE spent, open choice served without charge, quest=done,
    ...                mission 1 COMPLETED, the inventory equal to the golden character's items.
    ...                Java SQLite golden on Java + PostgreSQL proves decision 51.
    ...                Skipped while no golden file is committed.
    [Tags]    step41    alpha-prep    match-export    golden
    ${files}=    Golden Files    ${GOLDEN_DIR}
    Skip If    not $files    no golden export committed yet (decision 66)
    FOR    ${file}    IN    @{files}
        ${token}=    New Guest Token
        ${creator}=    Guest Uuid    ${token}
        ${golden}=    Load Export    ${file}
        ${old}=    Creator Uuid    ${golden}
        ${user_map}=    Create Dictionary    ${old}=${creator}
        ${copy}=    Rewrite Export Uuids    ${golden}    user_map=${user_map}
        Append To List    ${CREATED_MATCHES}    ${copy}[match][uuid]
        ${request}=    Import Request    ${copy}    story_mode=KEEP
        ${resp}=    Import Match Response    ${request}    201
        ${new}=    Set Variable    ${copy}[match][uuid]
        ${once}=    Execute Event    ${token}    ${new}    ${EVENTS}[13]
        Should Not Be Equal As Integers    ${once.status_code}    200    msg=${file}: the ONCE event ran again
        ${choice}=    Execute Event    ${token}    ${new}    ${EVENTS}[18]    200
        Should Be Equal    ${choice.json()}[status]    CHOICES_PENDING    msg=${file}
        Should Be Equal As Integers    ${choice.json()}[energySpent]    0    msg=${file}
        ${registry}=    Get Registry    ${token}    ${new}    200    include_hidden=true
        ${quest}=    Registry Values    ${registry.json()}    quest
        Should Contain    ${quest}    done    msg=${file}
        ${missions}=    Mission Statuses    ${token}    ${new}
        Should Be Equal    ${missions}[${MISSION}]    COMPLETED    msg=${file}
        ${expected}=    Evaluate    sorted($ITEMS[str(i['itemId'])] for i in $golden['characters'][0].get('items') or [])
        ${held}=    Inventory Item Uuids    ${token}    ${new}
        Should Be Equal    ${held}    ${expected}    msg=${file}: the inventory differs from the golden items
    END


*** Keywords ***

Suite Setup Match Export
    [Documentation]    The alpha-prep fixture, its mission, and the backend this server is (read off the
    ...                file of a probe export), for the CROSS_FAMILY expectation.
    Suite Setup Alpha Prep
    ${missions}=    Prep Rows    missions
    Set Suite Variable    ${MISSION}    ${missions}[1]
    ${items}=    Prep Rows    items
    Set Suite Variable    ${ITEMS}    ${items}
    ${token}    ${probe}=    Played Match With A Snapshot
    ${doc}=    Exported Document    ${probe}
    Set Suite Variable    ${THIS_BACKEND}    ${doc}[source][backend]

Suite Teardown Match Export
    [Documentation]    The matches (common teardown, story included), then the stories the import created.
    Suite Teardown Alpha Prep
    FOR    ${story}    IN    @{IMPORTED_STORIES}
        Run Keyword And Ignore Error    Delete Admin Story    ${story}
    END

Played Match With A Snapshot
    [Documentation]    A started prep match, quest done (event 14), then a sleep: the snapshot of clock 0
    ...                is written and the match is RUNNING at clock 1.
    ${token}    ${match}=    Fresh Prep Match
    Run Prep Event    ${token}    ${match}    14
    Sleep Action    ${token}    ${match}    200
    RETURN    ${token}    ${match}

Export Match Response
    [Documentation]    POST /api/admin/matches/{uuid}/export on the admin session.
    [Arguments]    ${match}    ${expected_status}=any
    ${headers}=    Get Auth Headers    ${ADMIN_TOKEN}
    ${resp}=    POST On Session    admin_session    /api/admin/matches/${match}/export
    ...    headers=${headers}    expected_status=${expected_status}
    RETURN    ${resp}

Exported Document
    [Documentation]    The file of a 200 export, as a dict.
    [Arguments]    ${match}
    ${resp}=    Export Match Response    ${match}    200
    RETURN    ${resp.json()}

Import Match Response
    [Documentation]    POST /api/admin/matches/import with a MatchImportRequest body.
    [Arguments]    ${body}    ${expected_status}=any
    ${headers}=    Get Auth Headers    ${ADMIN_TOKEN}
    ${resp}=    POST On Session    admin_session    /api/admin/matches/import
    ...    headers=${headers}    json=${body}    expected_status=${expected_status}
    RETURN    ${resp}

Guest Uuid
    [Documentation]    The user uuid behind a guest token (GET /api/auth/me).
    [Arguments]    ${token}
    ${me}=    Call Me Endpoint    ${token}
    Status Should Be    ${me}    200
    RETURN    ${me.json()}[userUuid]

Snapshot Descriptions
    [Documentation]    The descriptions of the snapshots of a match, newest first.
    [Arguments]    ${match}
    ${headers}=    Get Auth Headers    ${ADMIN_TOKEN}
    ${resp}=    GET On Session    admin_session    /api/admin/matches/${match}/snapshots
    ...    headers=${headers}    expected_status=200
    ${descriptions}=    Evaluate    [r.get('description') for r in $resp.json()]
    RETURN    ${descriptions}

Event Rows Of
    [Documentation]    The EVENT timeline rows of one fixture event, by story-local id.
    [Arguments]    ${match}    ${id}
    ${rows}=    Rows Of Type    ${match}    EVENT
    ${mine}=    Evaluate    [r for r in $rows if int(r.get('idEvent') or 0) == int($id)]
    RETURN    ${mine}

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

Mission Statuses
    [Documentation]    {mission uuid: status} of the missions the match has reached.
    [Arguments]    ${token}    ${match}
    ${resp}=    Get Missions    ${token}    ${match}    200
    ${all}=    Evaluate    {str(m.get('uuid')): m.get('status') for m in ($resp.json() if isinstance($resp.json(), list) else ($resp.json().get('missions') or [])) if isinstance(m, dict)}
    RETURN    ${all}

Inventory Item Uuids
    [Documentation]    The story item uuids the caller's character holds in a match, sorted.
    [Arguments]    ${token}    ${match}
    ${resp}=    Get Inventory    ${token}    ${match}    200
    ${uuids}=    Evaluate    sorted(str(r.get('itemUuid')) for r in $resp.json().get('items') or [])
    RETURN    ${uuids}

Current Weather
    [Documentation]    The uuid (else the id) of the current weather, off the admin weather view.
    [Arguments]    ${match}
    ${resp}=    Get Admin Match Weather    ${ADMIN_TOKEN}    ${match}    200
    ${current}=    Evaluate    ($resp.json().get('current') or {}).get('uuid') or ($resp.json().get('current') or {}).get('id')
    RETURN    ${current}

Kpi Totals
    [Documentation]    Matches started and completed of the fixture story, all days summed.
    ${from}=    Evaluate    (datetime.datetime.now(datetime.timezone.utc).date() - datetime.timedelta(days=1)).isoformat()    modules=datetime
    ${to}=      Evaluate    (datetime.datetime.now(datetime.timezone.utc).date() + datetime.timedelta(days=1)).isoformat()    modules=datetime
    ${headers}=    Get Auth Headers    ${ADMIN_TOKEN}
    ${params}=    Create Dictionary    storyUuid=${STORY_UUID}    groupBy=total    from=${from}    to=${to}
    ${resp}=    GET On Session    admin_session    /api/admin/reports/kpi
    ...    params=${params}    headers=${headers}    expected_status=200
    ${totals}=    Evaluate    [(int(r.get('matchesStarted') or 0), int(r.get('matchesCompleted') or 0)) for r in $resp.json().get('rows') or []]
    RETURN    ${totals}
