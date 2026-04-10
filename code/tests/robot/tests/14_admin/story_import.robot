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
#     story_star_trek.json   uuid: c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f
#     story_ranma.json       uuid: d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a
#
# Tags: admin, step14
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    OperatingSystem
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/stories.resource

Suite Setup      Create Public Session

*** Variables ***
${MIGRATION_DIR}    ${CURDIR}/../../../../backend/java/adapter-sqlite/src/main/resources/db/migration/dev
${STAR_TREK_FILE}   ${MIGRATION_DIR}/story_star_trek.json
${RANMA_FILE}       ${MIGRATION_DIR}/story_ranma.json


*** Test Cases ***

# ---- auth guard tests -------------------------------------------------------

Import Without Token Returns 401
    [Documentation]    POST /api/admin/stories/import without auth header returns 401.
    [Tags]    admin    step14
    ${response}=    POST On Session    public_session    /api/admin/stories/import
    ...    data={}    expected_status=any
    Should Be Equal As Integers    ${response.status_code}    401

Admin Stories List Without Token Returns 401
    [Documentation]    GET /api/admin/stories without auth returns 401.
    [Tags]    admin    step14
    ${params}=    Create Dictionary    lang=en
    ${response}=    GET On Session    public_session    /api/admin/stories
    ...    params=${params}    expected_status=any
    Should Be Equal As Integers    ${response.status_code}    401

Delete Story Without Token Returns 401
    [Documentation]    DELETE /api/admin/stories/{uuid} without auth returns 401.
    [Tags]    admin    step14
    ${response}=    DELETE On Session    public_session    /api/admin/stories/${WITCHER_UUID}
    ...    expected_status=any
    Should Be Equal As Integers    ${response.status_code}    401

Import With Empty Body Returns 400
    [Documentation]    POST /api/admin/stories/import with auth but empty body returns 400.
    [Tags]    admin    step14
    &{headers}=    Create Dictionary
    ...    Authorization=Bearer ${ADMIN_TOKEN}
    ...    Content-Type=application/json
    ${response}=    POST On Session    public_session    /api/admin/stories/import
    ...    data=    headers=${headers}    expected_status=any
    Should Be Equal As Integers    ${response.status_code}    400

# ---- import tests -----------------------------------------------------------

Import Star Trek Story Returns 201
    [Documentation]    POST /api/admin/stories/import with story_star_trek.json returns 201.
    [Tags]    admin    step14
    ${response}=    Import Story From File    ${STAR_TREK_FILE}
    Status Should Be    ${response}    201

Star Trek Import Response Has Required Fields
    [Documentation]    The StoryImportResponse body for Star Trek has all documented fields.
    [Tags]    admin    step14
    ${response}=    Import Story From File    ${STAR_TREK_FILE}
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

Star Trek Import Response Status Is IMPORTED
    [Documentation]    The status field must be 'IMPORTED'.
    [Tags]    admin    step14
    ${response}=    Import Story From File    ${STAR_TREK_FILE}
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Strings    ${body}[status]    IMPORTED

Star Trek Import UUID Matches
    [Documentation]    The storyUuid in the response matches the UUID in the JSON file.
    [Tags]    admin    step14
    ${response}=    Import Story From File    ${STAR_TREK_FILE}
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Strings    ${body}[storyUuid]    ${STAR_TREK_UUID}

Import Star Trek Again Is Idempotent
    [Documentation]    Re-importing the same UUID returns 201 again (upsert / replace behaviour).
    [Tags]    admin    step14
    Import Story From File    ${STAR_TREK_FILE}
    ${response}=    Import Story From File    ${STAR_TREK_FILE}
    Status Should Be    ${response}    201

Import Ranma Story Returns 201
    [Documentation]    POST /api/admin/stories/import with story_ranma.json returns 201.
    [Tags]    admin    step14
    ${response}=    Import Story From File    ${RANMA_FILE}
    Status Should Be    ${response}    201

Ranma Import UUID Matches
    [Documentation]    The Ranma import response storyUuid matches the expected UUID.
    [Tags]    admin    step14
    ${response}=    Import Story From File    ${RANMA_FILE}
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Strings    ${body}[storyUuid]    ${RANMA_UUID}

# ---- admin list tests -------------------------------------------------------

Admin Stories List Returns 200
    [Documentation]    GET /api/admin/stories returns 200.
    [Tags]    admin    step14
    ${response}=    Get Admin Stories
    Status Should Be    ${response}    200

Admin Stories List Is Not Empty
    [Documentation]    The admin list includes at least the seed Witcher and One Piece stories.
    [Tags]    admin    step14
    ${response}=    Get Admin Stories
    List Response Should Not Be Empty    ${response}

Admin Stories List Contains Seed Stories
    [Documentation]    Witcher and One Piece UUIDs are present in the admin story list.
    [Tags]    admin    step14
    ${response}=    Get Admin Stories
    ${body}=    Set Variable    ${response.json()}
    ${uuids}=    Evaluate    [s['uuid'] for s in ${body}]
    Should Contain    ${uuids}    ${WITCHER_UUID}
    Should Contain    ${uuids}    ${ONE_PIECE_UUID}

Admin List Contains Star Trek After Import
    [Documentation]    After import, the Star Trek UUID appears in the admin list.
    [Tags]    admin    step14
    Import Story From File    ${STAR_TREK_FILE}
    ${response}=    Get Admin Stories
    ${body}=    Set Variable    ${response.json()}
    ${uuids}=    Evaluate    [s['uuid'] for s in ${body}]
    Should Contain    ${uuids}    ${STAR_TREK_UUID}

# ---- delete tests -----------------------------------------------------------

Delete Imported Star Trek Story Returns 200
    [Documentation]    DELETE /api/admin/stories/{star_trek_uuid} returns 200 after import.
    [Tags]    admin    step14
    Import Story From File    ${STAR_TREK_FILE}
    ${response}=    Delete Admin Story    ${STAR_TREK_UUID}
    Status Should Be    ${response}    200

Delete Response Has Status DELETED
    [Documentation]    The delete response body contains {status:"DELETED", uuid:...}.
    [Tags]    admin    step14
    Import Story From File    ${STAR_TREK_FILE}
    ${response}=    Delete Admin Story    ${STAR_TREK_UUID}
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    status
    Should Be Equal As Strings    ${body}[status]    DELETED
    Dictionary Should Contain Key    ${body}    uuid

Delete Response UUID Matches
    [Documentation]    The uuid in the delete response matches what was deleted.
    [Tags]    admin    step14
    Import Story From File    ${STAR_TREK_FILE}
    ${response}=    Delete Admin Story    ${STAR_TREK_UUID}
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Strings    ${body}[uuid]    ${STAR_TREK_UUID}

Delete Unknown UUID Returns 404
    [Documentation]    DELETE /api/admin/stories/00000000-... returns 404.
    [Tags]    admin    step14
    ${response}=    Delete Admin Story    ${UNKNOWN_UUID}
    Status Should Be    ${response}    404

Delete Ranma Story Returns 200
    [Documentation]    Import and then delete the Ranma story.
    [Tags]    admin    step14
    Import Story From File    ${RANMA_FILE}
    ${response}=    Delete Admin Story    ${RANMA_UUID}
    Status Should Be    ${response}    200

Deleted Story No Longer In Admin List
    [Documentation]    After deleting, the UUID is no longer in GET /api/admin/stories.
    [Tags]    admin    step14
    Import Story From File    ${STAR_TREK_FILE}
    Delete Admin Story    ${STAR_TREK_UUID}
    ${response}=    Get Admin Stories
    ${body}=    Set Variable    ${response.json()}
    ${uuids}=    Evaluate    [s['uuid'] for s in ${body}]
    Should Not Contain    ${uuids}    ${STAR_TREK_UUID}
