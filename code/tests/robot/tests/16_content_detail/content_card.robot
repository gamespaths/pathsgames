*** Settings ***
# ---------------------------------------------------------------------------
# content_card.robot — tests for GET /api/content/{uuidStory}/cards/{uuidCard}
#
# Card UUIDs are auto-generated at insert time, so success-path tests
# are limited. The primary focus is on error handling and 404 validation.
#
# Tags: content, step16, card
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/stories.resource

Suite Setup    Create Public Session


*** Test Cases ***

Card Info Returns 404 For Unknown Story
    [Documentation]    GET /api/content/{unknown_uuid}/cards/{uuid} returns 404.
    [Tags]    content    step16    card
    ${response}=    Get Card Info    ${UNKNOWN_UUID}    some-card-uuid
    Status Should Be    ${response}    404

Card Info Returns 404 For Unknown Card
    [Documentation]    GET /api/content/{known_uuid}/cards/{unknown} returns 404.
    [Tags]    content    step16    card
    ${response}=    Get Card Info    ${DEMO_1_UUID}    ${UNKNOWN_UUID}
    Status Should Be    ${response}    404

Card Info 404 Has Error Fields
    [Documentation]    The 404 response contains error and message fields.
    [Tags]    content    step16    card
    ${response}=    Get Card Info    ${DEMO_1_UUID}    ${UNKNOWN_UUID}
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    error
    Dictionary Should Contain Key    ${body}    message
    Should Be Equal As Strings    ${body}[error]    CARD_NOT_FOUND

Card Info 404 Message Contains UUID
    [Documentation]    The error message includes the requested card UUID.
    [Tags]    content    step16    card
    ${response}=    Get Card Info    ${DEMO_1_UUID}    ${UNKNOWN_UUID}
    ${body}=    Set Variable    ${response.json()}
    Should Contain    ${body}[message]    ${UNKNOWN_UUID}

Card Info Accepts Lang Parameter
    [Documentation]    The endpoint accepts a lang query parameter without error.
    [Tags]    content    step16    card
    ${response}=    Get Card Info    ${DEMO_1_UUID}    ${UNKNOWN_UUID}    lang=it
    Status Should Be    ${response}    404

Card Info Accessible Without Auth
    [Documentation]    The card info endpoint is public — no Bearer token required.
    [Tags]    content    step16    card
    ${response}=    Get Card Info    ${DEMO_1_UUID}    ${UNKNOWN_UUID}
    Status Should Be    ${response}    404
