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
    ${entity}=    Set Variable    ${get_resp.json()}
    Dictionary Should Contain Key    ${entity}    id

    # Delete
    ${del_resp}=    DELETE On Session    admin_session    /api/admin/stories/${DEMO_1_UUID}/locations/${entity_uuid}
    Status Should Be    ${del_resp}    200
    Response Field Should Equal    ${del_resp}    status    DELETED

Delete Non Existent Entity Returns 404
    [Documentation]    DELETE /api/admin/stories/{uuid}/locations/{bad-uuid} returns 404.
    [Tags]    admin    crud    step17
    ${response}=    DELETE On Session    admin_session    /api/admin/stories/${DEMO_1_UUID}/locations/non-existent    expected_status=404
    Status Should Be    ${response}    404

# === 12 new entity-type listing ===

List Location Neighbors Returns 200
    [Tags]    admin    crud    step17
    ${response}=    GET On Session    admin_session    /api/admin/stories/${DEMO_1_UUID}/location-neighbors
    Status Should Be    ${response}    200

List Keys Returns 200
    [Tags]    admin    crud    step17
    ${response}=    GET On Session    admin_session    /api/admin/stories/${DEMO_1_UUID}/keys
    Status Should Be    ${response}    200

List Event Effects Returns 200
    [Tags]    admin    crud    step17
    ${response}=    GET On Session    admin_session    /api/admin/stories/${DEMO_1_UUID}/event-effects
    Status Should Be    ${response}    200

List Choices Returns 200
    [Tags]    admin    crud    step17
    ${response}=    GET On Session    admin_session    /api/admin/stories/${DEMO_1_UUID}/choices
    Status Should Be    ${response}    200

List Choice Conditions Returns 200
    [Tags]    admin    crud    step17
    ${response}=    GET On Session    admin_session    /api/admin/stories/${DEMO_1_UUID}/choice-conditions
    Status Should Be    ${response}    200

List Choice Effects Returns 200
    [Tags]    admin    crud    step17
    ${response}=    GET On Session    admin_session    /api/admin/stories/${DEMO_1_UUID}/choice-effects
    Status Should Be    ${response}    200

List Item Effects Returns 200
    [Tags]    admin    crud    step17
    ${response}=    GET On Session    admin_session    /api/admin/stories/${DEMO_1_UUID}/item-effects
    Status Should Be    ${response}    200

List Weather Rules Returns 200
    [Tags]    admin    crud    step17
    ${response}=    GET On Session    admin_session    /api/admin/stories/${DEMO_1_UUID}/weather-rules
    Status Should Be    ${response}    200

List Global Random Events Returns 200
    [Tags]    admin    crud    step17
    ${response}=    GET On Session    admin_session    /api/admin/stories/${DEMO_1_UUID}/global-random-events
    Status Should Be    ${response}    200

List Class Bonuses Returns 200
    [Tags]    admin    crud    step17
    ${response}=    GET On Session    admin_session    /api/admin/stories/${DEMO_1_UUID}/class-bonuses
    Status Should Be    ${response}    200

List Missions Returns 200
    [Tags]    admin    crud    step17
    ${response}=    GET On Session    admin_session    /api/admin/stories/${DEMO_1_UUID}/missions
    Status Should Be    ${response}    200

List Mission Steps Returns 200
    [Tags]    admin    crud    step17
    ${response}=    GET On Session    admin_session    /api/admin/stories/${DEMO_1_UUID}/mission-steps
    Status Should Be    ${response}    200

# === CRUD cycles for new entity types ===

Create And Delete Key
    [Documentation]    Full CRUD cycle for keys entity type.
    [Tags]    admin    crud    step17
    &{data}=    Create Dictionary    name=robot_key    value=42
    ${create_resp}=    POST On Session    admin_session    /api/admin/stories/${DEMO_1_UUID}/keys    json=${data}
    Status Should Be    ${create_resp}    201
    ${entity_uuid}=    Set Variable    ${create_resp.json()}[uuid]
    ${del_resp}=    DELETE On Session    admin_session    /api/admin/stories/${DEMO_1_UUID}/keys/${entity_uuid}
    Status Should Be    ${del_resp}    200
    Response Field Should Equal    ${del_resp}    status    DELETED

Create And Delete Choice
    [Documentation]    Full CRUD cycle for choices entity type.
    [Tags]    admin    crud    step17
    &{data}=    Create Dictionary    priority=${1}
    ${create_resp}=    POST On Session    admin_session    /api/admin/stories/${DEMO_1_UUID}/choices    json=${data}
    Status Should Be    ${create_resp}    201
    ${entity_uuid}=    Set Variable    ${create_resp.json()}[uuid]
    ${del_resp}=    DELETE On Session    admin_session    /api/admin/stories/${DEMO_1_UUID}/choices/${entity_uuid}
    Status Should Be    ${del_resp}    200

Create And Delete Mission
    [Documentation]    Full CRUD cycle for missions entity type.
    [Tags]    admin    crud    step17
    &{data}=    Create Dictionary    idTextName=${201}
    ${create_resp}=    POST On Session    admin_session    /api/admin/stories/${DEMO_1_UUID}/missions    json=${data}
    Status Should Be    ${create_resp}    201
    ${entity_uuid}=    Set Variable    ${create_resp.json()}[uuid]
    ${del_resp}=    DELETE On Session    admin_session    /api/admin/stories/${DEMO_1_UUID}/missions/${entity_uuid}
    Status Should Be    ${del_resp}    200

# === Story update with new fields ===

Update Story With All New Fields Returns 200
    [Documentation]    PUT /api/admin/stories/{uuid} can set all new story-level fields.
    [Tags]    admin    crud    step17
    &{data}=    Create Dictionary    idImage=${2}    clockSingularDescription=hour    clockPluralDescription=hours
    ${response}=    PUT On Session    admin_session    /api/admin/stories/${DEMO_1_UUID}    json=${data}
    Status Should Be    ${response}    200

# === GET single admin story ===

Get Admin Story Returns 200
    [Documentation]    GET /api/admin/stories/{uuid} returns 200 with the story detail fields.
    [Tags]    admin    crud    step17
    ${response}=    GET On Session    admin_session    /api/admin/stories/${DEMO_1_UUID}
    Status Should Be    ${response}    200
    Response Should Contain Field    ${response}    uuid
    Response Should Contain Field    ${response}    author
    Response Should Contain Field    ${response}    visibility
    Response Should Contain Field    ${response}    idTextTitle
    Response Should Contain Field    ${response}    idTextDescription
    Response Should Contain Field    ${response}    idLocationStart
    Response Should Contain Field    ${response}    idImage
    Response Should Contain Field    ${response}    idCreator
    Response Should Contain Field    ${response}    clockSingularDescription
    Response Should Contain Field    ${response}    clockPluralDescription

Get Admin Story Not Found Returns 404
    [Documentation]    GET /api/admin/stories/{uuid} with unknown uuid returns 404.
    [Tags]    admin    crud    step17
    ${response}=    GET On Session    admin_session    /api/admin/stories/non-existent-uuid    expected_status=404
    Status Should Be    ${response}    404

Update Story ID Fields Are Persisted And Returned
    [Documentation]    PUT idTextTitle on a story and verify GET returns the updated value.
    [Tags]    admin    crud    step17
    &{data}=    Create Dictionary    idTextTitle=${999}
    ${put_resp}=    PUT On Session    admin_session    /api/admin/stories/${DEMO_1_UUID}    json=${data}
    Status Should Be    ${put_resp}    200
    ${get_resp}=    GET On Session    admin_session    /api/admin/stories/${DEMO_1_UUID}
    Status Should Be    ${get_resp}    200
    Response Field Should Equal    ${get_resp}    idTextTitle    999


*** Keywords ***

Response Should Contain Field
    [Arguments]    ${response}    ${field}
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    ${field}

Response Field Should Equal
    [Arguments]    ${response}    ${field}    ${expected}
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Strings    ${body}[${field}]    ${expected}

