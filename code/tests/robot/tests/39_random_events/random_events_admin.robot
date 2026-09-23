*** Settings ***
# ---------------------------------------------------------------------------
# random_events_admin.robot — Step 39 through the admin API: the R11_RANDOM_EVENT import
# refusals, the CRUD round trip of the new registryValueOperatorCondition column, and a
# legacy payload without it still importing (the operator then reads as =).
#
# Tags: random-events, step39, admin
# ---------------------------------------------------------------------------
Resource   random_events_common.resource

Suite Setup       Suite Setup Random Events
Suite Teardown    Suite Teardown Random Events

*** Variables ***
${BAD_UUID}       f0390002-0000-4000-8000-000000000391
${LEGACY_UUID}    f0390003-0000-4000-8000-000000000392
# Event 1 owns a choice, event 2 sets the weather, event 3 is clean.
${BASE}           "events":[{"id":1,"type":"AUTOMATIC"},{"id":2,"type":"AUTOMATIC"},{"id":3,"type":"AUTOMATIC"}],"choices":[{"id":1,"idEvent":1,"otherwiseFlag":1}],"weatherRules":[{"id":1,"active":1,"probability":100}],"eventEffects":[{"id":1,"idEvent":2,"idWeather":1}]


*** Test Cases ***

Import Refuses A Probability Above 100
    [Tags]    random-events    step39    admin    validation
    Random Row Should Fail On    {"id":1,"idEvent":3,"probability":101}    probability

Import Refuses A Row Without An Event
    [Tags]    random-events    step39    admin    validation
    Random Row Should Fail On    {"id":1,"probability":10}    idEvent

Import Refuses An Event That Owns Choices
    [Tags]    random-events    step39    admin    validation
    Random Row Should Fail On    {"id":1,"idEvent":1,"probability":10}    idEvent

Import Refuses An Event That Changes The Weather
    [Tags]    random-events    step39    admin    validation
    Random Row Should Fail On    {"id":1,"idEvent":2,"probability":10}    idEvent

Import Refuses A Condition Key Without A Value
    [Tags]    random-events    step39    admin    validation
    Random Row Should Fail On    {"id":1,"idEvent":3,"probability":10,"conditionKey":"storm"}    conditionValue

Import Refuses A Condition Value Without A Key
    [Tags]    random-events    step39    admin    validation
    Random Row Should Fail On    {"id":1,"idEvent":3,"probability":10,"conditionValue":"yes"}    conditionKey

The Imported Rows Read Back With Their Operator
    [Tags]    random-events    step39    admin    import
    ${rows}=    List Admin Entities    ${STORY_UUID}    global-random-events
    Status Should Be    ${rows}    200
    ${row}=    Evaluate    next(r for r in $rows.json() if str(r.get('id')) == '4')
    Should Be Equal    ${row}[registryValueOperatorCondition]    >
    Should Be Equal As Integers    ${row}[idEvent]    23

A Random Event Created And Updated Through The CRUD Keeps Its Operator
    [Tags]    random-events    step39    admin    crud
    &{body}=    Create Dictionary    idEvent=${20}    probability=${10}    conditionKey=level
    ...    conditionValue=1    registryValueOperatorCondition=<
    ${created}=    Create Admin Entity    ${STORY_UUID}    global-random-events    ${body}
    Should Be Equal As Integers    ${created.status_code}    201
    ${uuid}=    Set Variable    ${created.json()}[uuid]
    ${stored}=    Random Row With Uuid    ${uuid}
    Should Be Equal    ${stored}[registryValueOperatorCondition]    <
    &{patch}=    Create Dictionary    registryValueOperatorCondition=!=
    ${updated}=    Update Admin Entity    ${STORY_UUID}    global-random-events    ${uuid}    ${patch}
    Should Be Equal As Integers    ${updated.status_code}    200
    ${stored}=    Random Row With Uuid    ${uuid}
    Should Be Equal    ${stored}[registryValueOperatorCondition]    !=
    [Teardown]    Delete Admin Entity    ${STORY_UUID}    global-random-events    ${uuid}

A Legacy Payload Without The Operator Still Imports
    [Documentation]    A story exported before v0.39.0 has no operator: it imports, and the
    ...                row reads null or = (both mean =).
    [Tags]    random-events    step39    admin    import    legacy
    Run Keyword And Ignore Error    Delete Admin Story    ${LEGACY_UUID}
    ${payload}=    Catenate    SEPARATOR=
    ...    {"uuid":"${LEGACY_UUID}","author":"robottest_random_events","category":"robottest",
    ...    "visibility":"PRIVATE","events":[{"id":1,"type":"AUTOMATIC"}],
    ...    "globalRandomEvents":[{"id":1,"idEvent":1,"probability":20,"conditionKey":"k","conditionValue":"v"}]}
    ${import}=    Post Admin Story Import    ${payload}
    Should Be Equal As Integers    ${import.status_code}    201    msg=${import.text}
    ${rows}=    List Admin Entities    ${LEGACY_UUID}    global-random-events
    Status Should Be    ${rows}    200
    ${operator}=    Evaluate    $rows.json()[0].get('registryValueOperatorCondition')
    Should Be True    $operator in (None, '', '=')    msg=a legacy row must read as = (got ${operator})
    [Teardown]    Run Keyword And Ignore Error    Delete Admin Story    ${LEGACY_UUID}


*** Keywords ***

Random Row Should Fail On
    [Documentation]    Import a minimal story with one random event row and insist the
    ...                refusal is R11_RANDOM_EVENT on the given field.
    [Arguments]    ${row}    ${field}
    ${payload}=    Catenate    SEPARATOR=
    ...    {"uuid":"${BAD_UUID}","author":"robottest_random_events",${BASE},
    ...    "globalRandomEvents":[${row}]}
    ${body}=    Import Payload Should Fail Validation    ${payload}
    ${fields}=    Evaluate    [e['field'] for e in $body['errors'] if e.get('rule') == 'R11_RANDOM_EVENT']
    Should Contain    ${fields}    ${field}
    [Teardown]    Run Keyword And Ignore Error    Delete Admin Story    ${BAD_UUID}

Random Row With Uuid
    [Arguments]    ${uuid}
    ${rows}=    List Admin Entities    ${STORY_UUID}    global-random-events
    Status Should Be    ${rows}    200
    # A list comprehension, not a generator: Robot's $vars are not visible inside a generator.
    ${found}=    Evaluate    [r for r in $rows.json() if r.get('uuid') == $uuid]
    Should Not Be Empty    ${found}    msg=no global-random-events row with uuid ${uuid}
    RETURN    ${found}[0]
