*** Settings ***
# ---------------------------------------------------------------------------
# content_creator.robot — tests for GET /api/content/{uuidStory}/creators/{uuidCreator}
#
# Creator UUIDs are auto-generated at insert time, so success-path tests
# are limited. The primary focus is on error handling and 404 validation.
#
# Tags: content, step16, creator
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/stories.resource

Suite Setup    Create Public Session


*** Test Cases ***

Creator Detail Returns 404 For Unknown Story
    [Documentation]    GET /api/content/{unknown_uuid}/creators/{uuid} returns 404.
    [Tags]    content    step16    creator
    ${response}=    Get Creator Detail    ${UNKNOWN_UUID}    some-creator-uuid
    Status Should Be    ${response}    404

Creator Detail Returns 404 For Unknown Creator
    [Documentation]    GET /api/content/{known_uuid}/creators/{unknown} returns 404.
    [Tags]    content    step16    creator
    ${response}=    Get Creator Detail    ${DEMO_1_UUID}    ${UNKNOWN_UUID}
    Status Should Be    ${response}    404

Creator Detail 404 Has Error Fields
    [Documentation]    The 404 response contains error and message fields.
    [Tags]    content    step16    creator
    ${response}=    Get Creator Detail    ${DEMO_1_UUID}    ${UNKNOWN_UUID}
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    error
    Dictionary Should Contain Key    ${body}    message
    Should Be Equal As Strings    ${body}[error]    CREATOR_NOT_FOUND

Creator Detail 404 Message Contains UUID
    [Documentation]    The error message includes the requested creator UUID.
    [Tags]    content    step16    creator
    ${response}=    Get Creator Detail    ${DEMO_1_UUID}    ${UNKNOWN_UUID}
    ${body}=    Set Variable    ${response.json()}
    Should Contain    ${body}[message]    ${UNKNOWN_UUID}

Creator Detail Accepts Lang Parameter
    [Documentation]    The endpoint accepts a lang query parameter without error.
    [Tags]    content    step16    creator
    ${response}=    Get Creator Detail    ${DEMO_1_UUID}    ${UNKNOWN_UUID}    lang=it
    Status Should Be    ${response}    404

Creator Detail Accessible Without Auth
    [Documentation]    The creator detail endpoint is public — no Bearer token required.
    [Tags]    content    step16    creator
    ${response}=    Get Creator Detail    ${DEMO_1_UUID}    ${UNKNOWN_UUID}
    Status Should Be    ${response}    404
