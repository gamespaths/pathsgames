*** Settings ***
# ---------------------------------------------------------------------------
# story_detail.robot — tests for GET /api/stories/{uuid} (public story detail).
#
# Uses seed story UUIDs:
#   - WITCHER_UUID   a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d
#   - ONE_PIECE_UUID b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e
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

Get Witcher Story Returns 200
    [Documentation]    GET /api/stories/{witcher_uuid} returns HTTP 200.
    [Tags]    stories    step14
    ${response}=    Get Story By UUID    ${WITCHER_UUID}
    Status Should Be    ${response}    200

Witcher Story Detail Has All Required Fields
    [Documentation]    The StoryDetailResponse for the Witcher story contains all documented fields.
    [Tags]    stories    step14
    ${response}=    Get Story By UUID    ${WITCHER_UUID}
    ${body}=    Set Variable    ${response.json()}
    Story Detail Should Have Required Fields    ${body}

Witcher Story UUID Matches Request
    [Documentation]    The uuid field in the body matches the requested UUID.
    [Tags]    stories    step14
    ${response}=    Get Story By UUID    ${WITCHER_UUID}
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Strings    ${body}[uuid]    ${WITCHER_UUID}

Witcher Story Difficulties Is A List
    [Documentation]    The 'difficulties' field is a JSON array (may be empty if none defined).
    [Tags]    stories    step14
    ${response}=    Get Story By UUID    ${WITCHER_UUID}
    ${body}=    Set Variable    ${response.json()}
    ${type}=    Evaluate    type($body['difficulties']).__name__
    Should Be Equal    ${type}    list

Witcher Story Location Count Is Integer
    [Documentation]    The locationCount field is a non-negative integer.
    [Tags]    stories    step14
    ${response}=    Get Story By UUID    ${WITCHER_UUID}
    ${body}=    Set Variable    ${response.json()}
    Should Be True    isinstance($body['locationCount'], int) and $body['locationCount'] >= 0

Witcher Story Event Count Is Integer
    [Documentation]    The eventCount field is a non-negative integer.
    [Tags]    stories    step14
    ${response}=    Get Story By UUID    ${WITCHER_UUID}
    ${body}=    Set Variable    ${response.json()}
    Should Be True    isinstance($body['eventCount'], int) and $body['eventCount'] >= 0

Witcher Story Item Count Is Integer
    [Documentation]    The itemCount field is a non-negative integer.
    [Tags]    stories    step14
    ${response}=    Get Story By UUID    ${WITCHER_UUID}
    ${body}=    Set Variable    ${response.json()}
    Should Be True    isinstance($body['itemCount'], int) and $body['itemCount'] >= 0

Get One Piece Story Returns 200
    [Documentation]    GET /api/stories/{one_piece_uuid} returns HTTP 200.
    [Tags]    stories    step14
    ${response}=    Get Story By UUID    ${ONE_PIECE_UUID}
    Status Should Be    ${response}    200

One Piece Story Detail Has All Required Fields
    [Documentation]    The StoryDetailResponse for the One Piece story contains all documented fields.
    [Tags]    stories    step14
    ${response}=    Get Story By UUID    ${ONE_PIECE_UUID}
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
    ${response}=    Get Story By UUID    ${WITCHER_UUID}
    Status Should Be    ${response}    200

Story Detail Lang Param Works
    [Documentation]    Requesting lang=it returns 200 for a known story UUID.
    [Tags]    stories    step14
    ${response}=    Get Story By UUID    ${WITCHER_UUID}    lang=it
    Status Should Be    ${response}    200
