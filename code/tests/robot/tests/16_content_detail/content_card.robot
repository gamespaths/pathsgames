*** Settings ***
# ---------------------------------------------------------------------------
# content_card.robot — tests for GET /api/content/{uuidStory}/cards/{uuidCard}
#
# Success-path tests create a card via the admin API, capture its UUID,
# verify the public content API returns expected fields, then clean up.
#
# Tags: content, step16, card
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/stories.resource

Suite Setup    Create Both Sessions


*** Keywords ***

Create Both Sessions
    Create Public Session
    Create Admin Session


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

Card Info Returns 200 With All Required Fields
    [Documentation]    Creates a card with styleMain/styleDetail via admin, verifies the public
    ...                content API returns a 200 with all required fields and correct values,
    ...                then deletes the card via admin.
    [Tags]    content    step16    card
    # Create card via admin
    &{card_data}=    Create Dictionary
    ...    urlImmage=https://example.com/test-card.png
    ...    alternativeImage=alt-test.png
    ...    awesomeIcon=fa-book
    ...    styleMain=test-style-main
    ...    styleDetail=test-style-detail
    ${create_resp}=    POST On Session    admin_session
    ...    /api/admin/stories/${DEMO_1_UUID}/cards    json=${card_data}
    Status Should Be    ${create_resp}    201
    ${card_uuid}=    Set Variable    ${create_resp.json()}[uuid]
    # Query via public content API
    ${response}=    Get Card Info    ${DEMO_1_UUID}    ${card_uuid}
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    Card Info Should Have Required Fields    ${body}
    Should Be Equal As Strings    ${body}[styleMain]         test-style-main
    Should Be Equal As Strings    ${body}[styleDetail]       test-style-detail
    Should Be Equal As Strings    ${body}[alternativeImage]  alt-test.png
    # Cleanup
    ${del_resp}=    DELETE On Session    admin_session
    ...    /api/admin/stories/${DEMO_1_UUID}/cards/${card_uuid}
    Status Should Be    ${del_resp}    200
