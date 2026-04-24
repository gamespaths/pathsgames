*** Settings ***
# ---------------------------------------------------------------------------
# admin_crud.robot — tests for Step 17 Admin CRUD endpoints.
#
# Tests the generic CRUD pattern:
#   POST   /api/admin/stories                           (create story)
#   PUT    /api/admin/stories/{uuid}                    (update story)
#   GET    /api/admin/stories/{uuid}/{entityType}       (list entities)
#   POST   /api/admin/stories/{uuid}/{entityType}       (create entity)
#   GET    /api/admin/stories/{uuid}/{type}/{euuid}     (get entity)
#   PUT    /api/admin/stories/{uuid}/{type}/{euuid}     (update entity)
#   DELETE /api/admin/stories/{uuid}/{type}/{euuid}     (delete entity)
#
# Tags: admin, crud, step17
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Library    String
Resource   ../../resources/common.resource

Suite Setup    Create Admin Session


*** Variables ***
${DEMO_1_UUID}    a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d


*** Test Cases ***

# === Story-level CRUD ===

Update Story Returns 200
    [Documentation]    PUT /api/admin/stories/{uuid} with valid data returns 200.
    [Tags]    admin    crud    step17
    &{data}=    Create Dictionary    author=RobotUpdated
    ${response}=    PUT On Session    admin_session    /api/admin/stories/${DEMO_1_UUID}    json=${data}
    Status Should Be    ${response}    200
    Response Should Contain Field    ${response}    uuid

Update Story Not Found Returns 404
    [Documentation]    PUT /api/admin/stories/{bad-uuid} returns 404.
    [Tags]    admin    crud    step17
    &{data}=    Create Dictionary    author=Test
    ${response}=    PUT On Session    admin_session    /api/admin/stories/non-existent-uuid    json=${data}    expected_status=404
    Status Should Be    ${response}    404

# === Sub-entity listing ===

List Locations Returns 200
    [Documentation]    GET /api/admin/stories/{uuid}/locations returns 200 with array.
    [Tags]    admin    crud    step17
    ${response}=    GET On Session    admin_session    /api/admin/stories/${DEMO_1_UUID}/locations
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    ${type}=    Evaluate    type(${body}).__name__
    Should Be Equal    ${type}    list

List Entities For Missing Story Returns 404
    [Documentation]    GET /api/admin/stories/{bad-uuid}/locations returns 404.
    [Tags]    admin    crud    step17
    ${response}=    GET On Session    admin_session    /api/admin/stories/non-existent-uuid/locations    expected_status=404
    Status Should Be    ${response}    404

List Difficulties Returns 200
    [Documentation]    GET /api/admin/stories/{uuid}/difficulties returns 200.
    [Tags]    admin    crud    step17
    ${response}=    GET On Session    admin_session    /api/admin/stories/${DEMO_1_UUID}/difficulties
    Status Should Be    ${response}    200

List Events Returns 200
    [Documentation]    GET /api/admin/stories/{uuid}/events returns 200.
    [Tags]    admin    crud    step17
    ${response}=    GET On Session    admin_session    /api/admin/stories/${DEMO_1_UUID}/events
    Status Should Be    ${response}    200

List Unknown Type Returns Empty
    [Documentation]    GET /api/admin/stories/{uuid}/unknown-type returns 200 with empty array.
    [Tags]    admin    crud    step17
    ${response}=    GET On Session    admin_session    /api/admin/stories/${DEMO_1_UUID}/unknown-type
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    Should Be Empty    ${body}

# === Entity CRUD cycle ===

Create And Delete Location
    [Documentation]    Full CRUD cycle: create a location, verify, then delete it.
    [Tags]    admin    crud    step17
    # Create
    &{data}=    Create Dictionary    idTextName=${101}    isSafe=${1}
    ${create_resp}=    POST On Session    admin_session    /api/admin/stories/${DEMO_1_UUID}/locations    json=${data}
    Status Should Be    ${create_resp}    201
    ${created}=    Set Variable    ${create_resp.json()}
    Dictionary Should Contain Key    ${created}    uuid
    ${entity_uuid}=    Set Variable    ${created}[uuid]

    # Get
    ${get_resp}=    GET On Session    admin_session    /api/admin/stories/${DEMO_1_UUID}/locations/${entity_uuid}
    Status Should Be    ${get_resp}    200

    # Delete
    ${del_resp}=    DELETE On Session    admin_session    /api/admin/stories/${DEMO_1_UUID}/locations/${entity_uuid}
    Status Should Be    ${del_resp}    200
    Response Field Should Equal    ${del_resp}    status    DELETED

Delete Non Existent Entity Returns 404
    [Documentation]    DELETE /api/admin/stories/{uuid}/locations/{bad-uuid} returns 404.
    [Tags]    admin    crud    step17
    ${response}=    DELETE On Session    admin_session    /api/admin/stories/${DEMO_1_UUID}/locations/non-existent    expected_status=404
    Status Should Be    ${response}    404
