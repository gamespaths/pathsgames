*** Settings ***
# ---------------------------------------------------------------------------
# smoke.robot — quick health-check for the Paths Games API.
#
# These tests must ALL pass before any other test suite runs.
# They verify basic connectivity and that the expected server version responds.
#
# Tags: smoke
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource

Suite Setup       Create Public Session


*** Test Cases ***

Server Is Up
    [Documentation]    GET /api/echo/status returns 200.
    [Tags]    smoke
    ${response}=    GET On Session    public_session    /api/echo/status
    Status Should Be    ${response}    200

Echo Response Contains Version
    [Documentation]    The status response body has a 'properties' object with a 'version' key.
    [Tags]    smoke
    ${response}=    GET On Session    public_session    /api/echo/status
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    properties
    Dictionary Should Contain Key    ${body}[properties]    version

Public Stories Endpoint Is Reachable
    [Documentation]    GET /api/stories returns 200 without any auth token.
    [Tags]    smoke
    ${params}=    Create Dictionary    lang=en
    ${response}=    GET On Session    public_session    /api/stories    params=${params}
    Status Should Be    ${response}    200

Admin Endpoint Requires Auth
    [Documentation]    GET /api/admin/stories returns 401/403 (not 200) without a token.
    [Tags]    smoke
    ${params}=    Create Dictionary    lang=en
    ${response}=    GET On Session    public_session    /api/admin/stories
    ...    params=${params}    expected_status=any
    Should Be True    ${response.status_code} >= 400
    ...    msg=Expected 4xx on admin endpoint without auth, got ${response.status_code}
