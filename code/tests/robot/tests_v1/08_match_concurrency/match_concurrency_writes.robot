*** Settings ***
# match_concurrency_writes.robot — v1.10.0 V1 step 8: If-Match / 409 STALE_MATCH on the gameplay writes the first
# suite does not cover (execute-event, select-choice, movement, use-item, drop-item, use-exp, end). Each case:
# device A moves the version (and prepares the state), device B writes with the old version → 409 with the
# current one and nothing written, then with the current version → success and a new version.
# Own story story_concurrency.json (from the 41_alpha_prep fixture: event 13 NORMAL +5 exp, Lantern consumable).
Resource   ../../resources/stories.resource
Resource   concurrency_common.resource

Suite Setup       Concurrency Writes Suite Setup
Suite Teardown    Concurrency Writes Suite Teardown
Force Tags        v1_step08    match-concurrency    v1_10


*** Variables ***
${STORY_FILE}    ${CURDIR}/story_concurrency.json
${STORY_UUID}    f0108001-0000-4000-8000-000000000108
@{CREATED_MATCHES}


*** Test Cases ***

Execute Event With An Old Version Is Stale
    ${a}    ${b}    ${match}    ${old}=    Started Match On Two Devices
    ${moved}=    Versioned Write    ${a}    /api/gameplay/${match}/action/pass    ${old}
    Status Should Be    ${moved}    200
    &{body}=    Create Dictionary    eventUuid=${EVENTS}[10]
    Write Is Stale Then Succeeds    POST    ${b}    ${match}    /api/gameplay/${match}/action/execute-event
    ...    ${old}    ${moved.json()}[matchVersion]    ${body}

Select Choice With An Old Version Is Stale
    ${a}    ${b}    ${match}    ${old}=    Started Match On Two Devices
    &{open}=    Create Dictionary    eventUuid=${EVENTS}[18]
    ${opened}=    Versioned Request    POST    ${a}    /api/gameplay/${match}/action/execute-event    ${old}    ${open}
    Status Should Be    ${opened}    200
    &{body}=    Create Dictionary    choiceUuid=${CHOICES}[1]
    Write Is Stale Then Succeeds    POST    ${b}    ${match}    /api/gameplay/${match}/action/select-choice
    ...    ${old}    ${opened.json()}[matchVersion]    ${body}

Movement With An Old Version Is Stale
    ${a}    ${b}    ${match}    ${old}=    Started Match On Two Devices
    ${moved}=    Versioned Write    ${a}    /api/gameplay/${match}/action/pass    ${old}
    Status Should Be    ${moved}    200
    &{body}=    Create Dictionary    targetLocationUuid=${LOCATIONS}[2]
    Write Is Stale Then Succeeds    POST    ${b}    ${match}    /api/gameplay/${match}/movements/start
    ...    ${old}    ${moved.json()}[matchVersion]    ${body}

Use Item With An Old Version Is Stale
    ${a}    ${b}    ${match}    ${old}=    Started Match On Two Devices
    ${found}    ${row}=    Lantern Found By Device A    ${a}    ${match}    ${old}
    &{body}=    Create Dictionary    itemInstanceUuid=${row}
    Write Is Stale Then Succeeds    POST    ${b}    ${match}    /api/gameplay/${match}/inventory/use-item
    ...    ${old}    ${found}    ${body}

Drop Item With An Old Version Is Stale
    ${a}    ${b}    ${match}    ${old}=    Started Match On Two Devices
    ${found}    ${row}=    Lantern Found By Device A    ${a}    ${match}    ${old}
    &{body}=    Create Dictionary    itemInstanceUuid=${row}
    Write Is Stale Then Succeeds    POST    ${b}    ${match}    /api/gameplay/${match}/inventory/drop-item
    ...    ${old}    ${found}    ${body}

Use Exp With An Old Version Is Stale
    ${a}    ${b}    ${match}    ${old}=    Started Match On Two Devices
    &{gain}=    Create Dictionary    eventUuid=${EVENTS}[13]
    ${gained}=    Versioned Request    POST    ${a}    /api/gameplay/${match}/action/execute-event    ${old}    ${gain}
    Status Should Be    ${gained}    200
    &{body}=    Create Dictionary    stat=dex
    Write Is Stale Then Succeeds    POST    ${b}    ${match}    /api/gameplay/${match}/action/use-exp
    ...    ${old}    ${gained.json()}[matchVersion]    ${body}

End With An Old Version Is Stale
    ${a}    ${b}    ${match}    ${old}=    Started Match On Two Devices
    ${moved}=    Versioned Write    ${a}    /api/gameplay/${match}/action/pass    ${old}
    Status Should Be    ${moved}    200
    Write Is Stale Then Succeeds    PATCH    ${b}    ${match}    /api/match/${match}/end/${EVENTS}[40]
    ...    ${old}    ${moved.json()}[matchVersion]
    ${info}=    Get Match Info    ${b}    ${match}    expected_status=200
    Should Be Equal    ${info.json()}[match][status]    ENDED


*** Keywords ***

Concurrency Writes Suite Setup
    Create Public Session
    Create Admin Session
    Create Dev Session
    Run Keyword And Ignore Error    Delete Admin Story    ${STORY_UUID}
    ${import}=    Import Story From File    ${STORY_FILE}
    Should Be Equal As Integers    ${import.status_code}    201
    ...    msg=the concurrency story did not import: ${import.text}
    FOR    ${entity}    ${name}    IN    events    EVENTS    locations    LOCATIONS    choices    CHOICES
        ${rows}=    Story Rows    ${entity}
        Set Suite Variable    ${${name}}    ${rows}
    END
    # one row each, addressed by uuid: not every backend lists their story-local id
    FOR    ${entity}    ${name}    IN    difficulties    DIFFICULTY    character-templates    TEMPLATE    classes    CLASS
        ${uuid}=    First Story Uuid    ${entity}
        Set Suite Variable    ${${name}}    ${uuid}
    END

Concurrency Writes Suite Teardown
    FOR    ${match}    IN    @{CREATED_MATCHES}
        Run Keyword And Ignore Error    Admin Stop Match      ${ADMIN_TOKEN}    ${match}
        Run Keyword And Ignore Error    Admin Delete Match    ${ADMIN_TOKEN}    ${match}
    END
    Run Keyword And Ignore Error    Delete Admin Story    ${STORY_UUID}

Story Rows
    [Documentation]    {story-local id: uuid} for one entity type of the fixture.
    [Arguments]    ${entity_type}
    ${resp}=    List Admin Entities    ${STORY_UUID}    ${entity_type}
    Status Should Be    ${resp}    200
    ${rows}=    Evaluate    {str(r['id']): r['uuid'] for r in $resp.json() if r.get('id') is not None and r.get('uuid')}
    Should Not Be Empty    ${rows}    msg=the fixture has no ${entity_type} rows
    RETURN    ${rows}

First Story Uuid
    [Documentation]    The uuid of the fixture's only row of one entity type.
    [Arguments]    ${entity_type}
    ${resp}=    List Admin Entities    ${STORY_UUID}    ${entity_type}
    Status Should Be    ${resp}    200
    Should Not Be Empty    ${resp.json()}    msg=the fixture has no ${entity_type} rows
    RETURN    ${resp.json()}[0][uuid]

Started Match On Two Devices
    [Documentation]    A RUNNING match of one player seen by two devices: (token A, token B, uuid, version).
    ${a}    ${b}=    Two Devices Of One Player
    ${created}=    Create Match    ${a}    ${STORY_UUID}    ${DIFFICULTY}    name=robottest_concurrency
    Status Should Be    ${created}    201
    ${match}=    Set Variable    ${created.json()}[uuid]
    Append To List    ${CREATED_MATCHES}    ${match}
    ${no_traits}=    Create List
    &{join}=    Create Dictionary    characterTemplateUuid=${TEMPLATE}    classUuid=${CLASS}
    ...    traitUuids=${no_traits}
    ${joined}=    Versioned Request    POST    ${a}    /api/matches/${match}/join
    ...    ${created.json()}[matchVersion]    ${join}
    Status Should Be    ${joined}    201
    ${started}=    Versioned Write    ${a}    /api/matches/${match}/start    ${joined.json()}[matchVersion]
    Status Should Be    ${started}    200
    RETURN    ${a}    ${b}    ${match}    ${started.json()}[matchVersion]

Lantern Found By Device A
    [Documentation]    Device A runs event 20 (adds the Lantern): (the new version, the inventory row uuid).
    [Arguments]    ${a}    ${match}    ${version}
    &{find}=    Create Dictionary    eventUuid=${EVENTS}[20]
    ${found}=    Versioned Request    POST    ${a}    /api/gameplay/${match}/action/execute-event    ${version}    ${find}
    Status Should Be    ${found}    200
    ${inventory}=    Get Inventory    ${a}    ${match}    expected_status=200
    Should Not Be Empty    ${inventory.json()}[items]    msg=event 20 gave no Lantern
    RETURN    ${found.json()}[matchVersion]    ${inventory.json()}[items][0][uuid]

Write Is Stale Then Succeeds
    [Documentation]    Device B writes with the old version: 409 STALE_MATCH naming the current one, the
    ...                players and the inventory unchanged; then with the current version: success, a new one.
    [Arguments]    ${method}    ${b}    ${match}    ${path}    ${old}    ${current}    ${body}=${None}
    ${before}=    Match Snapshot    ${b}    ${match}
    ${stale}=    Versioned Request    ${method}    ${b}    ${path}    ${old}    ${body}
    Status Should Be    ${stale}    409
    Should Be Equal    ${stale.json()}[error]    STALE_MATCH
    Should Be Equal    ${stale.json()}[matchVersion]    ${current}
    ${after}=    Match Snapshot    ${b}    ${match}
    Should Be Equal    ${after}    ${before}    msg=a stale write changed the match
    ${fresh}=    Versioned Request    ${method}    ${b}    ${path}    ${current}    ${body}
    Should Be True    200 <= ${fresh.status_code} < 300    msg=${method} ${path} with the current version: ${fresh.text}
    Should Not Be Equal    ${fresh.json()}[matchVersion]    ${current}

Match Snapshot
    [Documentation]    What a refused write must leave untouched: version, status, players and inventory.
    [Arguments]    ${token}    ${match}
    ${info}=    Get Match Info    ${token}    ${match}    expected_status=200
    ${inventory}=    Get Inventory    ${token}    ${match}    expected_status=200
    ${snapshot}=    Create List    ${info.json()}[matchVersion]    ${info.json()}[match][status]
    ...    ${info.json()}[players]    ${inventory.json()}[items]
    RETURN    ${snapshot}
