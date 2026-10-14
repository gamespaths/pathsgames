*** Settings ***
# ---------------------------------------------------------------------------
# content_text.robot — tests for GET /api/content/{uuidStory}/texts/{idText}/lang/{lang}
#
# Uses known id_text values from the seed data:
#   - id_text=1 → story title (en + it)
#   - id_text=2 → story description (en + it)
#   - id_text=100 → location text (en + it)
#
# Tags: content, step16, text
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/stories.resource

Suite Setup    Create Public Session


*** Test Cases ***

Text Detail Returns 200 For Known Text
    [Documentation]    GET /api/content/{uuid}/texts/1/lang/en returns HTTP 200 for the story title text.
    [Tags]    content    step16    text
    ${response}=    Get Text Detail    ${DEMO_1_UUID}    1    en
    Status Should Be    ${response}    200

Text Detail Response Has Required Fields
    [Documentation]    The response body contains all TextInfoResponse fields.
    [Tags]    content    step16    text
    ${response}=    Get Text Detail    ${DEMO_1_UUID}    1    en
    ${body}=    Set Variable    ${response.json()}
    Text Detail Should Have Required Fields    ${body}

Text Detail IdText Matches Request
    [Documentation]    The response idText matches the requested id_text.
    [Tags]    content    step16    text
    ${response}=    Get Text Detail    ${DEMO_1_UUID}    1    en
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Integers    ${body}[idText]    1

Text Detail Returns English Text
    [Documentation]    Requesting lang=en returns TUTORIAL as the shortText for id_text=1.
    [Tags]    content    step16    text
    ${response}=    Get Text Detail    ${DEMO_1_UUID}    1    en
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Strings    ${body}[shortText]    TUTORIAL
    Should Be Equal As Strings    ${body}[lang]    en
    Should Be Equal As Strings    ${body}[resolvedLang]    en

Text Detail Returns Italian Text
    [Documentation]    Requesting lang=it returns TUTORIAL as the shortText for id_text=1.
    [Tags]    content    step16    text
    ${response}=    Get Text Detail    ${DEMO_1_UUID}    1    it
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Strings    ${body}[shortText]    TUTORIAL
    Should Be Equal As Strings    ${body}[lang]    it
    Should Be Equal As Strings    ${body}[resolvedLang]    it

Text Detail Language Fallback To English
    [Documentation]    Requesting a non-existing language falls back to English.
    [Tags]    content    step16    text
    ${response}=    Get Text Detail    ${DEMO_1_UUID}    1    fr
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Strings    ${body}[lang]    fr
    Should Be Equal As Strings    ${body}[resolvedLang]    en

Text Detail Returns 404 For Unknown Story
    [Documentation]    GET /api/content/{unknown_uuid}/texts/1/lang/en returns 404.
    [Tags]    content    step16    text
    ${response}=    Get Text Detail    ${UNKNOWN_UUID}    1    en
    Status Should Be    ${response}    404

Text Detail Returns 404 For Unknown IdText
    [Documentation]    GET /api/content/{uuid}/texts/99999/lang/en returns 404.
    [Tags]    content    step16    text
    ${response}=    Get Text Detail    ${DEMO_1_UUID}    99999    en
    Status Should Be    ${response}    404

Text Detail 404 Has Error Fields
    [Documentation]    The 404 response contains error and message fields.
    [Tags]    content    step16    text
    ${response}=    Get Text Detail    ${UNKNOWN_UUID}    1    en
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    error
    Dictionary Should Contain Key    ${body}    message
    Should Be Equal As Strings    ${body}[error]    TEXT_NOT_FOUND

Text Detail Location Text Returns 200
    [Documentation]    id_text=100 (location text) returns 200 with the expected content.
    [Tags]    content    step16    text
    ${response}=    Get Text Detail    ${DEMO_1_UUID}    100    en
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Strings    ${body}[shortText]    Welcome Hall
    Should Be Equal As Integers    ${body}[idText]    100

Text Detail Accessible Without Auth
    [Documentation]    The text detail endpoint is public — no Bearer token required.
    [Tags]    content    step16    text
    ${response}=    Get Text Detail    ${DEMO_1_UUID}    1    en
    Status Should Be    ${response}    200
