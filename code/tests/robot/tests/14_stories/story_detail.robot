*** Settings ***
# ---------------------------------------------------------------------------
# story_detail.robot — tests for GET /api/stories/{uuid} (public story detail).
#
# Uses seed story UUIDs:
#   - DEMO_1_UUID   a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d
#   - DEMO_2_UUID b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e
#   - UNKNOWN_UUID   00000000-0000-0000-0000-000000000000
#
# Tags: stories, step14
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/stories.resource

Suite Setup    Create Public Session


*** Test Cases ***

Get Tutorial Story Returns 200
    [Documentation]    GET /api/stories/{tutorial_uuid} returns HTTP 200.
    [Tags]    stories    step14
    ${response}=    Get Story By UUID    ${DEMO_1_UUID}
    Status Should Be    ${response}    200

Tutorial Story Detail Has All Required Fields
    [Documentation]    The StoryDetailResponse for the Tutorial story contains all documented fields.
    [Tags]    stories    step14
    ${response}=    Get Story By UUID    ${DEMO_1_UUID}
    ${body}=    Set Variable    ${response.json()}
    Story Detail Should Have Required Fields    ${body}

Tutorial Story UUID Matches Request
    [Documentation]    The uuid field in the body matches the requested UUID.
    [Tags]    stories    step14
    ${response}=    Get Story By UUID    ${DEMO_1_UUID}
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Strings    ${body}[uuid]    ${DEMO_1_UUID}

Tutorial Story Difficulties Is A List
    [Documentation]    The 'difficulties' field is a JSON array (may be empty if none defined).
    [Tags]    stories    step14
    ${response}=    Get Story By UUID    ${DEMO_1_UUID}
    ${body}=    Set Variable    ${response.json()}
    ${type}=    Evaluate    type($body['difficulties']).__name__
    Should Be Equal    ${type}    list

Tutorial Story Location Count Is Integer
    [Documentation]    The locationCount field is a non-negative integer.
    [Tags]    stories    step14
    ${response}=    Get Story By UUID    ${DEMO_1_UUID}
    ${body}=    Set Variable    ${response.json()}
    Should Be True    isinstance($body['locationCount'], int) and $body['locationCount'] >= 0

Tutorial Story Event Count Is Integer
    [Documentation]    The eventCount field is a non-negative integer.
    [Tags]    stories    step14
    ${response}=    Get Story By UUID    ${DEMO_1_UUID}
    ${body}=    Set Variable    ${response.json()}
    Should Be True    isinstance($body['eventCount'], int) and $body['eventCount'] >= 0

Tutorial Story Item Count Is Integer
    [Documentation]    The itemCount field is a non-negative integer.
    [Tags]    stories    step14
    ${response}=    Get Story By UUID    ${DEMO_1_UUID}
    ${body}=    Set Variable    ${response.json()}
    Should Be True    isinstance($body['itemCount'], int) and $body['itemCount'] >= 0

Get Demo 1 Story Returns 200
    [Documentation]    GET /api/stories/{Demo_1_uuid} returns HTTP 200.
    [Tags]    stories    step14
    ${response}=    Get Story By UUID    ${DEMO_2_UUID}
    Status Should Be    ${response}    200

Demo 1 Story Detail Has All Required Fields
    [Documentation]    The StoryDetailResponse for the Demo 1 story contains all documented fields.
    [Tags]    stories    step14
    ${response}=    Get Story By UUID    ${DEMO_2_UUID}
    ${body}=    Set Variable    ${response.json()}
    Story Detail Should Have Required Fields    ${body}

Unknown UUID Returns 404
    [Documentation]    GET /api/stories/00000000-... returns HTTP 404.
    [Tags]    stories    step14
    ${response}=    Get Story By UUID    ${UNKNOWN_UUID}
    Status Should Be    ${response}    404

404 Response Contains Error Field
    [Documentation]    The 404 body contains an 'error' field describing the problem.
    [Tags]    stories    step14
    ${response}=    Get Story By UUID    ${UNKNOWN_UUID}
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    error

Story Detail Accessible Without Auth
    [Documentation]    The detail endpoint is public — no Bearer token required.
    [Tags]    stories    step14
    ${response}=    Get Story By UUID    ${DEMO_1_UUID}
    Status Should Be    ${response}    200

Story Detail Lang Param Works
    [Documentation]    Requesting lang=it returns 200 for a known story UUID.
    [Tags]    stories    step14
    ${response}=    Get Story By UUID    ${DEMO_1_UUID}    lang=it
    Status Should Be    ${response}    200
