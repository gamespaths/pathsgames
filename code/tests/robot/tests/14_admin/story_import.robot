*** Settings ***
# ---------------------------------------------------------------------------
# story_import.robot — tests for Step 14 admin story management.
#
# Endpoints under test:
#   POST   /api/admin/stories/import     → 201 StoryImportResponse
#   GET    /api/admin/stories?lang=en    → 200 list (all visibility)
#   DELETE /api/admin/stories/{uuid}     → 200 {status:"DELETED", uuid} | 404
#
# Pre-requisite: ADMIN_TOKEN variable must be a valid admin JWT.
#
# JSON import files (dev migration folder, relative to this file):
#   ../../../backend/java/adapter-sqlite/src/main/resources/db/migration/dev/
#     story_demo_3.json   uuid: c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f
#     story_demo_4.json       uuid: d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a
#
# Tags: admin, step14
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    OperatingSystem
Library    Collections
Library    ../../resources/JwtHelper.py
Resource   ../../resources/common.resource
Resource   ../../resources/stories.resource

Suite Setup      Initialize Admin Suite

*** Keywords ***

Initialize Admin Suite
    [Documentation]    Create the public session (for guest creation) and a bare admin
    ...                session against ADMIN_BASE_URL (admin port 8044 / admin API), plus
    ...                a dynamic admin JWT. Admin requests pass the token per-request.
    Create Public Session
    Create Session    admin_session    ${ADMIN_BASE_URL}    verify=false
    ${token}=    Generate Admin Token
    Set Suite Variable    ${ADMIN_TOKEN}    ${token}

Post Story Import Payload
    [Documentation]    POST /api/admin/stories/import with raw JSON payload string.
    [Arguments]    ${payload}
    &{headers}=    Create Dictionary
    ...    Authorization=Bearer ${ADMIN_TOKEN}
    ...    Content-Type=application/json
    ${response}=    POST On Session    admin_session    /api/admin/stories/import
    ...    data=${payload}    headers=${headers}    expected_status=any
    RETURN    ${response}

Import Payload Should Return 201 And Cleanup
    [Documentation]    Imports payload, asserts 201, and deletes created story by UUID.
    [Arguments]    ${payload}    ${uuid}
    ${response}=    Post Story Import Payload    ${payload}
    Should Be Equal As Integers    ${response.status_code}    201
    Delete Admin Story    ${uuid}

Import With Explicit List Entity Id
    [Documentation]    Generic helper: import one list_* array with explicit id.
    [Arguments]    ${uuid}    ${entity_key}    ${entity_json}
    ${payload}=    Catenate    SEPARATOR=
    ...    {"uuid":"${uuid}","author":"robot-explicit-id","${entity_key}":[${entity_json}]}
    Import Payload Should Return 201 And Cleanup    ${payload}    ${uuid}

*** Variables ***
${MIGRATION_DIR}    ${CURDIR}/../../../../backend/java/adapter-sqlite/src/main/resources/db/migration/dev
${DEMO_3_FILE}   ${MIGRATION_DIR}/story_demo_3.json
${DEMO_4_FILE}       ${MIGRATION_DIR}/story_demo_4.json
${TUTORIAL_FILE}     ${MIGRATION_DIR}/tutorial_large.json
${TUTORIAL_DEV_FILE}    ${MIGRATION_DIR}/tutorial_story_dev.json


*** Test Cases ***

# ---- auth guard tests -------------------------------------------------------

Import Without Token Returns 401
    [Documentation]    POST /api/admin/stories/import without auth header returns 401.
    [Tags]    admin    step14
    ${response}=    POST On Session    admin_session    /api/admin/stories/import
    ...    data={}    expected_status=any
    Should Be Equal As Integers    ${response.status_code}    401

Admin Stories List Without Token Returns 401
    [Documentation]    GET /api/admin/stories without auth returns 401.
    [Tags]    admin    step14
    ${params}=    Create Dictionary    lang=en
    ${response}=    GET On Session    admin_session    /api/admin/stories
    ...    params=${params}    expected_status=any
    Should Be Equal As Integers    ${response.status_code}    401

Delete Story Without Token Returns 401
    [Documentation]    DELETE /api/admin/stories/{uuid} without auth returns 401.
    [Tags]    admin    step14
    ${response}=    DELETE On Session    admin_session    /api/admin/stories/${DEMO_1_UUID}
    ...    expected_status=any
    Should Be Equal As Integers    ${response.status_code}    401

Import With Empty Body Returns 400
    [Documentation]    POST /api/admin/stories/import with auth but empty body returns 400.
    [Tags]    admin    step14
    &{headers}=    Create Dictionary
    ...    Authorization=Bearer ${ADMIN_TOKEN}
    ...    Content-Type=application/json
    ${response}=    POST On Session    admin_session    /api/admin/stories/import
    ...    data=    headers=${headers}    expected_status=any
    Should Be Equal As Integers    ${response.status_code}    400

# ---- import tests -----------------------------------------------------------

Import Demo 3 Story Returns 201
    [Documentation]    POST /api/admin/stories/import with story_demo_3.json returns 201.
    [Tags]    admin    step14
    ${response}=    Import Story From File    ${DEMO_3_FILE}
    Status Should Be    ${response}    201

Demo 3 Import Response Has Required Fields
    [Documentation]    The StoryImportResponse body for Demo 3 has all documented fields.
    [Tags]    admin    step14
    ${response}=    Import Story From File    ${DEMO_3_FILE}
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    storyUuid
    Dictionary Should Contain Key    ${body}    status
    Dictionary Should Contain Key    ${body}    textsImported
    Dictionary Should Contain Key    ${body}    locationsImported
    Dictionary Should Contain Key    ${body}    eventsImported
    Dictionary Should Contain Key    ${body}    itemsImported
    Dictionary Should Contain Key    ${body}    difficultiesImported
    Dictionary Should Contain Key    ${body}    classesImported
    Dictionary Should Contain Key    ${body}    choicesImported

Demo 3 Import Response Status Is IMPORTED
    [Documentation]    The status field must be 'IMPORTED'.
    [Tags]    admin    step14
    ${response}=    Import Story From File    ${DEMO_3_FILE}
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Strings    ${body}[status]    IMPORTED

Demo 3 Import UUID Matches
    [Documentation]    The storyUuid in the response matches the UUID in the JSON file.
    [Tags]    admin    step14
    ${response}=    Import Story From File    ${DEMO_3_FILE}
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Strings    ${body}[storyUuid]    ${DEMO_3_UUID}

Import Demo 3 Again Is Idempotent
    [Documentation]    Re-importing the same UUID returns 201 again (upsert / replace behaviour).
    [Tags]    admin    step14
    Import Story From File    ${DEMO_3_FILE}
    ${response}=    Import Story From File    ${DEMO_3_FILE}
    Status Should Be    ${response}    201

Import Demo 4 Story Returns 201
    [Documentation]    POST /api/admin/stories/import with story_demo_4.json returns 201.
    [Tags]    admin    step14
    ${response}=    Import Story From File    ${DEMO_4_FILE}
    Status Should Be    ${response}    201

Demo 4 Import UUID Matches
    [Documentation]    The Demo 4 import response storyUuid matches the expected UUID.
    [Tags]    admin    step14
    ${response}=    Import Story From File    ${DEMO_4_FILE}
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Strings    ${body}[storyUuid]    ${DEMO_4_UUID}

Import With Duplicate Explicit Story Id Returns 400
    [Documentation]    If request has explicit story id already present, import fails with INVALID_IMPORT_DATA.
    [Tags]    admin    step14
    &{headers}=    Create Dictionary
    ...    Authorization=Bearer ${ADMIN_TOKEN}
    ...    Content-Type=application/json

    ${payload1}=    Catenate    SEPARATOR=
    ...    {"uuid":"11111111-1111-4111-8111-111111111111","id":990001,"author":"dup-id-a"}
    ${r1}=    POST On Session    admin_session    /api/admin/stories/import
    ...    data=${payload1}    headers=${headers}    expected_status=any
    Should Be Equal As Integers    ${r1.status_code}    201

    ${payload2}=    Catenate    SEPARATOR=
    ...    {"uuid":"22222222-2222-4222-8222-222222222222","id":990001,"author":"dup-id-b"}
    ${r2}=    POST On Session    admin_session    /api/admin/stories/import
    ...    data=${payload2}    headers=${headers}    expected_status=any
    Should Be Equal As Integers    ${r2.status_code}    400
    ${body}=    Set Variable    ${r2.json()}
    Should Be Equal As Strings    ${body}[error]    INVALID_IMPORT_DATA
    Should Contain    ${body}[message]    story/list_stories id=990001 already present

    Delete Admin Story    11111111-1111-4111-8111-111111111111

Import Same Event Id In Different Stories Returns 201
    [Documentation]    Same event id is allowed in different stories (scope by id_story).
    [Tags]    admin    step14
    &{headers}=    Create Dictionary
    ...    Authorization=Bearer ${ADMIN_TOKEN}
    ...    Content-Type=application/json

    ${payload1}=    Catenate    SEPARATOR=
    ...    {"uuid":"33333333-3333-4333-8333-333333333333","author":"scope-a","events":[{"id":1,"type":"NORMAL"}]}
    ${r1}=    POST On Session    admin_session    /api/admin/stories/import
    ...    data=${payload1}    headers=${headers}    expected_status=any
    Should Be Equal As Integers    ${r1.status_code}    201

    ${payload2}=    Catenate    SEPARATOR=
    ...    {"uuid":"44444444-4444-4444-8444-444444444444","author":"scope-b","events":[{"id":1,"type":"NORMAL"}]}
    ${r2}=    POST On Session    admin_session    /api/admin/stories/import
    ...    data=${payload2}    headers=${headers}    expected_status=any
    Should Be Equal As Integers    ${r2.status_code}    201

    Delete Admin Story    33333333-3333-4333-8333-333333333333
    Delete Admin Story    44444444-4444-4444-8444-444444444444

Import Multiple Stories With All Internal IDs Shared
    [Documentation]    Verifies that all sub-entities can share the same IDs if they belong to different stories.
    [Tags]    admin    step14
    &{headers}=    Create Dictionary
    ...    Authorization=Bearer ${ADMIN_TOKEN}
    ...    Content-Type=application/json

    ${p1}=    Catenate    SEPARATOR=
    ...    {"uuid":"eeeeeeee-1111-4444-8888-111111111111","author":"scope-test",
    ...    "idTextTitle":1,"idTextDescription":2,
    ...    "texts":[{"id":1,"idText":1,"lang":"en","shortText":"Title"},{"id":2,"idText":2,"lang":"en","shortText":"Desc"}],
    ...    "difficulties":[{"id":1,"expCost":1}],"classes":[{"id":1,"weightMax":10}],"traits":[{"id":1,"costPositive":0}],
    ...    "characterTemplates":[{"id":1,"lifeMax":10}],"locations":[{"id":1,"isSafe":1}],"events":[{"id":1,"type":"NORMAL"}],
    ...    "items":[{"id":1,"weight":1}],"keys":[{"id":1,"name":"K"}],"choices":[{"id":1,"idEvent":1,"otherwiseFlag":1}],
    ...    "weatherRules":[{"id":1,"probability":0.5}],"missions":[{"id":1,"name":"M"}]}

    ${r1}=    POST On Session    admin_session    /api/admin/stories/import
    ...    data=${p1}    headers=${headers}    expected_status=any
    Should Be Equal As Integers    ${r1.status_code}    201

    ${p2}=    Catenate    SEPARATOR=
    ...    {"uuid":"eeeeeeee-2222-4444-8888-222222222222","author":"scope-test",
    ...    "idTextTitle":1,"idTextDescription":2,
    ...    "texts":[{"id":1,"idText":1,"lang":"en","shortText":"Title"},{"id":2,"idText":2,"lang":"en","shortText":"Desc"}],
    ...    "difficulties":[{"id":1,"expCost":1}],"classes":[{"id":1,"weightMax":10}],"traits":[{"id":1,"costPositive":0}],
    ...    "characterTemplates":[{"id":1,"lifeMax":10}],"locations":[{"id":1,"isSafe":1}],"events":[{"id":1,"type":"NORMAL"}],
    ...    "items":[{"id":1,"weight":1}],"keys":[{"id":1,"name":"K"}],"choices":[{"id":1,"idEvent":1,"otherwiseFlag":1}],
    ...    "weatherRules":[{"id":1,"probability":0.5}],"missions":[{"id":1,"name":"M"}]}

    ${r2}=    POST On Session    admin_session    /api/admin/stories/import
    ...    data=${p2}    headers=${headers}    expected_status=any
    Should Be Equal As Integers    ${r2.status_code}    201

    Delete Admin Story    eeeeeeee-1111-4444-8888-111111111111
    Delete Admin Story    eeeeeeee-2222-4444-8888-222222222222


Import Explicit ID For list_stories Returns 201
    [Documentation]    Import accepts explicit story id when provided and free.
    [Tags]    admin    step14
    ${payload}=    Catenate    SEPARATOR=
    ...    {"uuid":"55555555-5555-4555-8555-555555555555","id":970001,"author":"robot-story-id"}
    Import Payload Should Return 201 And Cleanup    ${payload}    55555555-5555-4555-8555-555555555555

Import Explicit ID For list_texts Returns 201
    [Documentation]    Import accepts explicit id for list_texts rows.
    [Tags]    admin    step14
    Import With Explicit List Entity Id
    ...    61111111-1111-4111-8111-111111111111
    ...    texts
    ...    {"id":971001,"idText":1,"lang":"en","shortText":"T1"}

Import Explicit ID For list_stories_difficulty Returns 201
    [Documentation]    Import accepts explicit id for list_stories_difficulty rows.
    [Tags]    admin    step14
    Import With Explicit List Entity Id
    ...    62222222-2222-4222-8222-222222222222
    ...    difficulties
    ...    {"id":971002,"expCost":5,"maxWeight":10,"minCharacter":1,"maxCharacter":4,"costHelpComa":3,"costMaxCharacteristics":3,"numberMaxFreeAction":1}

Import Explicit ID For list_creator Returns 201
    [Documentation]    Import accepts explicit id for list_creator rows.
    [Tags]    admin    step14
    Import With Explicit List Entity Id
    ...    63333333-3333-4333-8333-333333333333
    ...    creators
    ...    {"id":971003,"link":"c"}

Import Explicit ID For list_cards Returns 201
    [Documentation]    Import accepts explicit id for list_cards rows.
    [Tags]    admin    step14
    Import With Explicit List Entity Id
    ...    64444444-4444-4444-8444-444444444444
    ...    cards
    ...    {"id":971004,"urlImage":"img"}

Import Card With Style Fields Returns 201
    [Documentation]    Import a card with alternativeImage, styleMain and styleDetail set.
    [Tags]    admin    step14
    Import With Explicit List Entity Id
    ...    64444444-4444-4444-8444-444444444445
    ...    cards
    ...    {"id":971006,"urlImage":"img2.png","alternativeImage":"alt.png","awesomeIcon":"fa-book","styleMain":"dark-main","styleDetail":"dark-detail"}

Import Explicit ID For list_keys Returns 201
    [Documentation]    Import accepts explicit id for list_keys rows.
    [Tags]    admin    step14
    Import With Explicit List Entity Id
    ...    65555555-5555-4555-8555-555555555555
    ...    keys
    ...    {"id":971005,"name":"k1"}

Import Explicit ID For list_classes Returns 201
    [Documentation]    Import accepts explicit id for list_classes rows.
    [Tags]    admin    step14
    Import With Explicit List Entity Id
    ...    66666666-6666-4666-8666-666666666666
    ...    classes
    ...    {"id":971006,"weightMax":10,"dexterityBase":1,"intelligenceBase":1,"constitutionBase":1}

Import Explicit ID For list_traits Returns 201
    [Documentation]    Import accepts explicit id for list_traits rows.
    [Tags]    admin    step14
    Import With Explicit List Entity Id
    ...    67777777-7777-4777-8777-777777777777
    ...    traits
    ...    {"id":971007,"costPositive":0,"costNegative":0}

Import Explicit ID For list_character_templates Returns 201
    [Documentation]    Import accepts explicit id for list_character_templates rows.
    ...                Includes idTextName and idTextDescription to verify they are accepted by the import.
    ...                idCard is exercised by the round-trip test below (it needs a matching list_cards row to
    ...                satisfy the Postgres FK constraint fk_char_templates_card).
    [Tags]    admin    step14
    Import With Explicit List Entity Id
    ...    68888888-8888-4888-8888-888888888888
    ...    characterTemplates
    ...    {"id":971008,"idTextName":100,"idTextDescription":101,"lifeMax":1,"energyMax":1,"sadMax":0,"dexterityStart":1,"intelligenceStart":1,"constitutionStart":1}

Import list_character_templates Round-Trips idTextName And idTextDescription
    [Documentation]    Imports a story with a character template having idCard, idTextName, idTextDescription
    ...                set, then reads back the character-templates collection and asserts the three FK
    ...                fields are persisted (consistent across Java, Python and AWS backends).
    [Tags]    admin    step14
    ${uuid}=    Set Variable    68888888-8888-4888-8888-888888888889
    &{headers}=    Create Dictionary
    ...    Authorization=Bearer ${ADMIN_TOKEN}
    ...    Content-Type=application/json
    DELETE On Session    admin_session    /api/admin/stories/${uuid}    headers=${headers}    expected_status=any

    ${payload}=    Catenate    SEPARATOR=
    ...    {"uuid":"${uuid}","author":"robot-ct-fk",
    ...    "texts":[{"id":1,"idText":100,"lang":"en","shortText":"Name"},{"id":2,"idText":101,"lang":"en","shortText":"Desc"}],
    ...    "cards":[{"id":1,"urlImage":"ct.png"}],
    ...    "characterTemplates":[{"id":1,"idCard":1,"idTextName":100,"idTextDescription":101,
    ...    "lifeMax":12,"energyMax":8,"sadMax":4,"dexterityStart":2,"intelligenceStart":3,"constitutionStart":1}]}
    ${resp_imp}=    Post Story Import Payload    ${payload}
    Should Be Equal As Integers    ${resp_imp.status_code}    201

    ${ct_resp}=    GET On Session    admin_session    /api/admin/stories/${uuid}/character-templates
    ...    headers=${headers}
    Should Be Equal As Integers    ${ct_resp.status_code}    200
    ${cts}=    Set Variable    ${ct_resp.json()}
    Length Should Be    ${cts}    1
    ${ct}=    Set Variable    ${cts}[0]
    Should Be Equal As Integers    ${ct}[idCard]               1
    Should Be Equal As Integers    ${ct}[idTextName]           100
    Should Be Equal As Integers    ${ct}[idTextDescription]    101
    Should Be Equal As Integers    ${ct}[lifeMax]              12

    Delete Admin Story    ${uuid}

Import list_character_templates Round-Trips idClassPermitted And idClassProhibited
    [Documentation]    Imports a story whose character template sets idClassPermitted and idClassProhibited,
    ...                then reads back the character-templates collection and asserts both class FK fields
    ...                are persisted (regression guard: the AWS import path previously dropped them).
    ...                The two referenced classes are included so the Postgres composite FK
    ...                (id_class_*, id_story) -> list_classes(id, id_story) is satisfied.
    [Tags]    admin    step14
    ${uuid}=    Set Variable    68888888-8888-4888-8888-88888888888a
    &{headers}=    Create Dictionary
    ...    Authorization=Bearer ${ADMIN_TOKEN}
    ...    Content-Type=application/json
    DELETE On Session    admin_session    /api/admin/stories/${uuid}    headers=${headers}    expected_status=any

    ${payload}=    Catenate    SEPARATOR=
    ...    {"uuid":"${uuid}","author":"robot-ct-class",
    ...    "classes":[{"id":1,"weightMax":10,"dexterityBase":1,"intelligenceBase":1,"constitutionBase":1},
    ...    {"id":2,"weightMax":10,"dexterityBase":1,"intelligenceBase":1,"constitutionBase":1}],
    ...    "characterTemplates":[{"id":1,"idClassPermitted":1,"idClassProhibited":2,
    ...    "lifeMax":10,"energyMax":5,"sadMax":3,"dexterityStart":1,"intelligenceStart":1,"constitutionStart":1}]}
    ${resp_imp}=    Post Story Import Payload    ${payload}
    Should Be Equal As Integers    ${resp_imp.status_code}    201

    ${ct_resp}=    GET On Session    admin_session    /api/admin/stories/${uuid}/character-templates
    ...    headers=${headers}
    Should Be Equal As Integers    ${ct_resp.status_code}    200
    ${cts}=    Set Variable    ${ct_resp.json()}
    Length Should Be    ${cts}    1
    ${ct}=    Set Variable    ${cts}[0]
    Dictionary Should Contain Key    ${ct}    idClassPermitted
    Dictionary Should Contain Key    ${ct}    idClassProhibited
    Should Be Equal As Integers    ${ct}[idClassPermitted]     1
    Should Be Equal As Integers    ${ct}[idClassProhibited]    2

    Delete Admin Story    ${uuid}

Import Explicit ID For list_locations Returns 201
    [Documentation]    Import accepts explicit id for list_locations rows.
    [Tags]    admin    step14
    Import With Explicit List Entity Id
    ...    69999999-9999-4999-8999-999999999999
    ...    locations
    ...    {"id":971009,"isSafe":0,"costEnergyEnter":1}

Import Explicit ID For list_events Returns 201
    [Documentation]    Import accepts explicit id for list_events rows.
    [Tags]    admin    step14
    Import With Explicit List Entity Id
    ...    6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
    ...    events
    ...    {"id":971010,"type":"NORMAL","flagEndTime":0}

Import Explicit ID For list_items Returns 201
    [Documentation]    Import accepts explicit id for list_items rows.
    [Tags]    admin    step14
    Import With Explicit List Entity Id
    ...    6bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb
    ...    items
    ...    {"id":971011,"weight":1,"isConsumabile":1}

Import Explicit ID For list_choices Returns 201
    [Documentation]    Import accepts explicit id for list_choices rows. Step 31: a choice must
    ...                belong to an event (R8), so the payload carries the owning event too.
    [Tags]    admin    step14
    ${payload}=    Catenate    SEPARATOR=
    ...    {"uuid":"6ccccccc-cccc-4ccc-8ccc-cccccccccccc","author":"robot-explicit-id",
    ...    "events":[{"id":1,"type":"NORMAL"}],
    ...    "choices":[{"id":971012,"idEvent":1,"priority":0,"otherwiseFlag":1,"isProgress":0}]}
    Import Payload Should Return 201 And Cleanup
    ...    ${payload}    6ccccccc-cccc-4ccc-8ccc-cccccccccccc

Import Explicit ID For list_weather_rules Returns 201
    [Documentation]    Import accepts explicit id for list_weather_rules rows.
    [Tags]    admin    step14
    Import With Explicit List Entity Id
    ...    6ddddddd-dddd-4ddd-8ddd-dddddddddddd
    ...    weatherRules
    ...    {"id":971013,"probability":1,"active":1}

Import Explicit ID For list_global_random_events Returns 201
    [Documentation]    Import accepts explicit id for list_global_random_events rows.
    [Tags]    admin    step14
    Import With Explicit List Entity Id
    ...    6eeeeeee-eeee-4eee-8eee-eeeeeeeeeeee
    ...    globalRandomEvents
    ...    {"id":971014,"probability":1}

Import Explicit ID For list_missions Returns 201
    [Documentation]    Import accepts explicit id for list_missions rows.
    [Tags]    admin    step14
    Import With Explicit List Entity Id
    ...    6fffffff-ffff-4fff-8fff-ffffffffffff
    ...    missions
    ...    {"id":971015,"conditionKey":"k"}

Import Three Stories With Text Ids And Multi-Lang Returns 201
    [Documentation]    3 stories with explicit story ids and text idText 1..4 in multiple languages.
    [Tags]    admin    step14
    ${payload1}=    Catenate    SEPARATOR=
    ...    {"uuid":"71111111-1111-4111-8111-111111111111","id":980001,"author":"multi-1","texts":[
    ...    {"id":980101,"idText":1,"lang":"en","shortText":"s1-t1-en"},{"id":980102,"idText":1,"lang":"it","shortText":"s1-t1-it"},
    ...    {"id":980103,"idText":2,"lang":"en","shortText":"s1-t2-en"},{"id":980104,"idText":2,"lang":"it","shortText":"s1-t2-it"},
    ...    {"id":980105,"idText":3,"lang":"en","shortText":"s1-t3-en"},{"id":980106,"idText":3,"lang":"it","shortText":"s1-t3-it"},
    ...    {"id":980107,"idText":4,"lang":"en","shortText":"s1-t4-en"},{"id":980108,"idText":4,"lang":"it","shortText":"s1-t4-it"}]}
    ${r1}=    Post Story Import Payload    ${payload1}
    Should Be Equal As Integers    ${r1.status_code}    201

    ${payload2}=    Catenate    SEPARATOR=
    ...    {"uuid":"72222222-2222-4222-8222-222222222222","id":980002,"author":"multi-2","texts":[
    ...    {"id":980201,"idText":1,"lang":"en","shortText":"s2-t1-en"},{"id":980202,"idText":1,"lang":"it","shortText":"s2-t1-it"},
    ...    {"id":980203,"idText":2,"lang":"en","shortText":"s2-t2-en"},{"id":980204,"idText":2,"lang":"it","shortText":"s2-t2-it"},
    ...    {"id":980205,"idText":3,"lang":"en","shortText":"s2-t3-en"},{"id":980206,"idText":3,"lang":"it","shortText":"s2-t3-it"},
    ...    {"id":980207,"idText":4,"lang":"en","shortText":"s2-t4-en"},{"id":980208,"idText":4,"lang":"it","shortText":"s2-t4-it"}]}
    ${r2}=    Post Story Import Payload    ${payload2}
    Should Be Equal As Integers    ${r2.status_code}    201

    ${payload3}=    Catenate    SEPARATOR=
    ...    {"uuid":"73333333-3333-4333-8333-333333333333","id":980003,"author":"multi-3","texts":[
    ...    {"id":980301,"idText":1,"lang":"en","shortText":"s3-t1-en"},{"id":980302,"idText":1,"lang":"it","shortText":"s3-t1-it"},
    ...    {"id":980303,"idText":2,"lang":"en","shortText":"s3-t2-en"},{"id":980304,"idText":2,"lang":"it","shortText":"s3-t2-it"},
    ...    {"id":980305,"idText":3,"lang":"en","shortText":"s3-t3-en"},{"id":980306,"idText":3,"lang":"it","shortText":"s3-t3-it"},
    ...    {"id":980307,"idText":4,"lang":"en","shortText":"s3-t4-en"},{"id":980308,"idText":4,"lang":"it","shortText":"s3-t4-it"}]}
    ${r3}=    Post Story Import Payload    ${payload3}
    Should Be Equal As Integers    ${r3.status_code}    201

    Delete Admin Story    71111111-1111-4111-8111-111111111111
    Delete Admin Story    72222222-2222-4222-8222-222222222222
    Delete Admin Story    73333333-3333-4333-8333-333333333333

# ---- regression: import data that previously crashed the import (500) -------
# These two cases reproduce real failures seen importing the Paths Alpha tutorial
# story against the PostgreSQL backend. They must return 201 on every backend
# (Java is the reference; Python/AWS track it).

Import Texts Reusing Same Surrogate Id Across Languages Returns 201
    [Documentation]    Language variants of the same logical text reuse the same surrogate
    ...                "id" in the import JSON (id_text + lang is the real identity). The PK
    ...                is (id, id_story), so the backend must de-collide the reused id instead
    ...                of failing with a duplicate-key violation. Regression guard.
    [Tags]    admin    step14
    ${uuid}=    Set Variable    7a111111-1111-4111-8111-aaaaaaaaaaaa
    &{headers}=    Create Dictionary
    ...    Authorization=Bearer ${ADMIN_TOKEN}
    ...    Content-Type=application/json
    DELETE On Session    admin_session    /api/admin/stories/${uuid}    headers=${headers}    expected_status=any

    ${payload}=    Catenate    SEPARATOR=
    ...    {"uuid":"${uuid}","author":"robot-dup-textid","texts":[
    ...    {"id":25,"idText":25,"lang":"en","shortText":"DUPTEXTMARKEREN"},
    ...    {"id":25,"idText":25,"lang":"it","shortText":"DUPTEXTMARKERIT"},
    ...    {"id":26,"idText":26,"lang":"en","shortText":"OTHERTEXTMARKER"}]}
    ${resp}=    Post Story Import Payload    ${payload}
    Should Be Equal As Integers    ${resp.status_code}    201

    # All three rows persisted; both language variants of id 25 survived de-collision.
    ${t_resp}=    GET On Session    admin_session    /api/admin/stories/${uuid}/texts    headers=${headers}
    Should Be Equal As Integers    ${t_resp.status_code}    200
    Length Should Be    ${t_resp.json()}    3
    Should Contain    ${t_resp.text}    DUPTEXTMARKEREN
    Should Contain    ${t_resp.text}    DUPTEXTMARKERIT

    Delete Admin Story    ${uuid}

Import Card With Long Base64 Image And Link Returns 201
    [Documentation]    Cards may carry a base64 SVG data URI in urlImage (and a long
    ...                linkCopyright) far exceeding 500 chars. These columns are TEXT, so the
    ...                import must not fail with a string-truncation error. The full values
    ...                must round-trip un-truncated. Regression guard.
    [Tags]    admin    step14
    ${uuid}=    Set Variable    7b222222-2222-4222-8222-bbbbbbbbbbbb
    &{headers}=    Create Dictionary
    ...    Authorization=Bearer ${ADMIN_TOKEN}
    ...    Content-Type=application/json
    DELETE On Session    admin_session    /api/admin/stories/${uuid}    headers=${headers}    expected_status=any

    # ~2400-char data URI and a ~1200-char copyright link (both > varchar(500)).
    ${image}=    Evaluate    "data:image/svg+xml;base64,IMGMARKER" + ("PHN2Zz48L3N2Zz4=" * 150)
    ${link}=     Evaluate    "https://example.com/credit?LINKMARKER=" + ("abcdef0123456789" * 75)
    ${payload}=    Catenate    SEPARATOR=
    ...    {"uuid":"${uuid}","author":"robot-long-img","cards":[
    ...    {"id":1,"urlImage":"${image}","linkCopyright":"${link}"}]}
    ${resp}=    Post Story Import Payload    ${payload}
    Should Be Equal As Integers    ${resp.status_code}    201

    # Card persisted and the long values were stored without truncation.
    ${c_resp}=    GET On Session    admin_session    /api/admin/stories/${uuid}/cards    headers=${headers}
    Should Be Equal As Integers    ${c_resp.status_code}    200
    Length Should Be    ${c_resp.json()}    1
    Should Contain    ${c_resp.text}    ${image}
    Should Contain    ${c_resp.text}    ${link}

    Delete Admin Story    ${uuid}

Import Traits With Empty String In Numeric Fields Returns 201
    [Documentation]    The import JSON carries "" in numeric fields (weight, costPositive,
    ...                idClassPermitted). PostgreSQL rejects '' for integer columns, so the
    ...                backend must coerce empty/non-numeric strings to NULL (like Java's
    ...                getInteger) instead of crashing. Regression guard.
    [Tags]    admin    step14
    ${uuid}=    Set Variable    7c333333-3333-4333-8333-cccccccccccc
    &{headers}=    Create Dictionary
    ...    Authorization=Bearer ${ADMIN_TOKEN}
    ...    Content-Type=application/json
    DELETE On Session    admin_session    /api/admin/stories/${uuid}    headers=${headers}    expected_status=any

    # No idCard here on purpose: list_traits.id_card has a composite FK to
    # list_cards on PostgreSQL, and this test is about empty-string numeric
    # coercion, not FK resolution. Empty strings must be coerced to NULL.
    ${payload}=    Catenate    SEPARATOR=
    ...    {"uuid":"${uuid}","author":"robot-empty-num","traits":[
    ...    {"id":1,"weight":"","costPositive":0,"dexterity":1},
    ...    {"id":3,"costPositive":"","idClassPermitted":"","energy":1}]}
    ${resp}=    Post Story Import Payload    ${payload}
    Should Be Equal As Integers    ${resp.status_code}    201

    ${t_resp}=    GET On Session    admin_session    /api/admin/stories/${uuid}/traits    headers=${headers}
    Should Be Equal As Integers    ${t_resp.status_code}    200
    Length Should Be    ${t_resp.json()}    2

    Delete Admin Story    ${uuid}

# ---- admin list tests -------------------------------------------------------

Admin Stories List Returns 200
    [Documentation]    GET /api/admin/stories returns 200.
    [Tags]    admin    step14
    ${response}=    Get Admin Stories
    Status Should Be    ${response}    200

Admin Stories List Is Not Empty
    [Documentation]    The admin list includes at least the seed Tutorial and Demo 1 stories.
    [Tags]    admin    step14
    ${response}=    Get Admin Stories
    List Response Should Not Be Empty    ${response}

Admin Stories List Contains Seed Stories
    [Documentation]    Tutorial and Demo 1 UUIDs are present in the admin story list.
    [Tags]    admin    step14
    ${response}=    Get Admin Stories
    ${body}=    Set Variable    ${response.json()}
    ${uuids}=    Evaluate    [s['uuid'] for s in ${body}]
    Should Contain    ${uuids}    ${DEMO_1_UUID}
    Should Contain    ${uuids}    ${DEMO_2_UUID}

Admin List Contains Demo 3 After Import
    [Documentation]    After import, the Demo 3 UUID appears in the admin list.
    [Tags]    admin    step14
    Import Story From File    ${DEMO_3_FILE}
    ${response}=    Get Admin Stories
    ${body}=    Set Variable    ${response.json()}
    ${uuids}=    Evaluate    [s['uuid'] for s in ${body}]
    Should Contain    ${uuids}    ${DEMO_3_UUID}

# ---- delete tests -----------------------------------------------------------

Delete Imported Demo 3 Story Returns 200
    [Documentation]    DELETE /api/admin/stories/{demo_3} returns 200 after import.
    [Tags]    admin    step14
    Import Story From File    ${DEMO_3_FILE}
    ${response}=    Delete Admin Story    ${DEMO_3_UUID}
    Status Should Be    ${response}    200

Delete Response Has Status DELETED
    [Documentation]    The delete response body contains {status:"DELETED", uuid:...}.
    [Tags]    admin    step14
    Import Story From File    ${DEMO_3_FILE}
    ${response}=    Delete Admin Story    ${DEMO_3_UUID}
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    status
    Should Be Equal As Strings    ${body}[status]    DELETED
    Dictionary Should Contain Key    ${body}    uuid

Delete Response UUID Matches
    [Documentation]    The uuid in the delete response matches what was deleted.
    [Tags]    admin    step14
    Import Story From File    ${DEMO_3_FILE}
    ${response}=    Delete Admin Story    ${DEMO_3_UUID}
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Strings    ${body}[uuid]    ${DEMO_3_UUID}

Delete Unknown UUID Returns 404
    [Documentation]    DELETE /api/admin/stories/00000000-... returns 404.
    [Tags]    admin    step14
    ${response}=    Delete Admin Story    ${UNKNOWN_UUID}
    Status Should Be    ${response}    404

Delete Demo 4 Story Returns 200
    [Documentation]    Import and then delete the Demo 4 story.
    [Tags]    admin    step14
    Import Story From File    ${DEMO_4_FILE}
    ${response}=    Delete Admin Story    ${DEMO_4_UUID}
    Status Should Be    ${response}    200

Deleted Story No Longer In Admin List
    [Documentation]    After deleting, the UUID is no longer in GET /api/admin/stories.
    [Tags]    admin    step14
    Import Story From File    ${DEMO_3_FILE}
    Delete Admin Story    ${DEMO_3_UUID}
    ${response}=    Get Admin Stories
    ${body}=    Set Variable    ${response.json()}
    ${uuids}=    Evaluate    [s['uuid'] for s in ${body}]
    Should Not Contain    ${uuids}    ${DEMO_3_UUID}

Import Story and Verify All Header Fields
    [Documentation]    Imports a story and verifies all header fields are persisted.
    [Tags]    admin    step14
    ${payload}=    Get File    ${TUTORIAL_FILE}
    ${uuid}=       Set Variable    tutorial-uuid-001
    
    # Clean up before import
    ${headers}=    Create Dictionary    Authorization=Bearer ${ADMIN_TOKEN}
    ${resp_del}=   DELETE On Session    admin_session    /api/admin/stories/${uuid}    headers=${headers}    expected_status=any
    
    # Import
    ${resp_imp}=   Post Story Import Payload    ${payload}
    Should Be Equal As Integers    ${resp_imp.status_code}    201
    
    # Get and Verify
    ${story_resp}=      Get Admin Story By UUID    ${uuid}
    ${story}=           Set Variable    ${story_resp.json()}
    Should Be Equal As Integers    ${story}[id]    1001
    Should Be Equal As Strings     ${story}[author]    Antigravity
    Should Be Equal As Strings     ${story}[category]    tutorial
    Should Be Equal As Integers    ${story}[priority]    100
    Should Be Equal As Integers    ${story}[idTextTitle]    1
    Should Be Equal As Integers    ${story}[idTextDescription]    2
    ${id_location_start}=          Get From Dictionary    ${story}    idLocationStart
    ${id_image}=                   Get From Dictionary    ${story}    idImage
    ${id_card}=                    Get From Dictionary    ${story}    idCard
    ${id_location_all_player_coma}=    Get From Dictionary    ${story}    idLocationAllPlayerComa
    ${id_event_all_player_coma}=       Get From Dictionary    ${story}    idEventAllPlayerComa
    ${id_event_end_game}=              Get From Dictionary    ${story}    idEventEndGame
    ${id_text_copyright}=              Get From Dictionary    ${story}    idTextCopyright
    ${id_creator}=                     Get From Dictionary    ${story}    idCreator
    Should Be Equal As Integers    ${id_location_start}              1
    Should Be Equal As Integers    ${id_image}                       514
    Should Be Equal As Integers    ${id_card}                        2
    Should Be Equal As Integers    ${id_location_all_player_coma}    1
    Should Be Equal As Integers    ${id_event_all_player_coma}       1
    Should Be Equal As Integers    ${id_event_end_game}              10
    Should Be Equal As Integers    ${id_text_copyright}              513
    Should Be Equal As Integers    ${id_creator}                     1
    ${clock_singular}=    Get From Dictionary    ${story}    idTextClockSingular
    ${clock_plural}=      Get From Dictionary    ${story}    idTextClockPlural
    Should Be Equal As Integers    ${clock_singular}    10
    Should Be Equal As Integers    ${clock_plural}      11
    
    # Cleanup after
    Delete Admin Story    ${uuid}

Import Two Stories With Colliding Entity IDs
    [Documentation]    Import two stories that use the same internal IDs for their sub-entities.
    ...               Verifies that scoped ID generation prevents primary key violations.
    [Tags]    admin    step14
    ${p3}=    Get File    ${DEMO_3_FILE}
    ${p4}=    Get File    ${DEMO_4_FILE}
    ${u3}=    Set Variable    c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f
    ${u4}=    Set Variable    d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a

    # Delete existing if any
    ${headers}=    Create Dictionary    Authorization=Bearer ${ADMIN_TOKEN}
    DELETE On Session    admin_session    /api/admin/stories/${u3}    headers=${headers}    expected_status=any
    DELETE On Session    admin_session    /api/admin/stories/${u4}    headers=${headers}    expected_status=any

    # Import both
    ${r3}=    Post Story Import Payload    ${p3}
    Should Be Equal As Integers    ${r3.status_code}    201
    ${r4}=    Post Story Import Payload    ${p4}
    Should Be Equal As Integers    ${r4.status_code}    201

    # Cleanup
    Delete Admin Story    ${u3}
    Delete Admin Story    ${u4}

Import Story And Verify Sub Entity Collections
    [Documentation]    After import, difficulties / events / locations collections are populated.
    [Tags]    admin    step14
    [Teardown]    Run Keyword And Ignore Error    Delete Admin Story    tutorial-uuid-001
    ${uuid}=    Set Variable    tutorial-uuid-001
    ${headers}=    Create Dictionary    Authorization=Bearer ${ADMIN_TOKEN}

    # Clean up before
    DELETE On Session    admin_session    /api/admin/stories/${uuid}    headers=${headers}    expected_status=any

    # Import tutorial_story_dev.json (has idCard on sub-entities)
    ${payload}=    Get File    ${TUTORIAL_DEV_FILE}
    ${resp_imp}=    Post Story Import Payload    ${payload}
    Should Be Equal As Integers    ${resp_imp.status_code}    201

    # Verify difficulties collection
    ${d_resp}=    GET On Session    admin_session    /api/admin/stories/${uuid}/difficulties
    ...    headers=${headers}
    ${diffs}=    Set Variable    ${d_resp.json()}
    Length Should Be    ${diffs}    3

    # Verify events collection
    ${e_resp}=    GET On Session    admin_session    /api/admin/stories/${uuid}/events
    ...    headers=${headers}
    ${events}=    Set Variable    ${e_resp.json()}
    Length Should Be    ${events}    10

    # Verify locations collection
    ${l_resp}=    GET On Session    admin_session    /api/admin/stories/${uuid}/locations
    ...    headers=${headers}
    ${locs}=    Set Variable    ${l_resp.json()}
    Length Should Be    ${locs}    4

    # Cleanup
    Delete Admin Story    ${uuid}

Import Preserves Sub Entity UUIDs
    [Documentation]    Import with explicit UUIDs in events/locations/items → UUIDs preserved.
    [Tags]    admin    step14
    &{headers}=    Create Dictionary
    ...    Authorization=Bearer ${ADMIN_TOKEN}
    ...    Content-Type=application/json

    ${uuid}=    Set Variable    55555555-5555-4555-8555-555555555555
    ${event_uuid}=    Set Variable    event-uuid-12345678-1234-1234-1234
    ${location_uuid}=    Set Variable    location-uuid-87654321-4321-4321
    ${item_uuid}=    Set Variable    item-uuid-abcdef01-2345-6789-abcd

    ${payload}=    Catenate    SEPARATOR=
    ...    {"uuid":"${uuid}","author":"uuid-test",
    ...    "events":[{"id":1,"type":"NORMAL","uuid":"${event_uuid}"}],
    ...    "locations":[{"id":1,"uuid":"${location_uuid}"}],
    ...    "items":[{"id":1,"uuid":"${item_uuid}"}]}

    # Import
    ${r}=    POST On Session    admin_session    /api/admin/stories/import
    ...    data=${payload}    headers=${headers}    expected_status=any
    Should Be Equal As Integers    ${r.status_code}    201

    # Fetch events and verify UUID preserved
    ${e_resp}=    GET On Session    admin_session    /api/admin/stories/${uuid}/events
    ...    headers=${headers}
    ${events}=    Set Variable    ${e_resp.json()}
    Length Should Be    ${events}    1
    Should Be Equal As Strings    ${events}[0][uuid]    ${event_uuid}

    # Fetch locations and verify UUID preserved
    ${l_resp}=    GET On Session    admin_session    /api/admin/stories/${uuid}/locations
    ...    headers=${headers}
    ${locations}=    Set Variable    ${l_resp.json()}
    Length Should Be    ${locations}    1
    Should Be Equal As Strings    ${locations}[0][uuid]    ${location_uuid}

    # Fetch items and verify UUID preserved
    ${i_resp}=    GET On Session    admin_session    /api/admin/stories/${uuid}/items
    ...    headers=${headers}
    ${items}=    Set Variable    ${i_resp.json()}
    Length Should Be    ${items}    1
    Should Be Equal As Strings    ${items}[0][uuid]    ${item_uuid}

    # Cleanup
    Delete Admin Story    ${uuid}
