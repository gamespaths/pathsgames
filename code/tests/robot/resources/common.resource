*** Settings ***
# ---------------------------------------------------------------------------
# common.resource — shared keywords used across all test suites.
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Library    String


*** Keywords ***

Create Public Session
    [Documentation]    Opens a RequestsLibrary HTTP session with no auth headers.
    Create Session    public_session    ${BASE_URL}    verify=false

Create Admin Session
    [Documentation]    Opens a RequestsLibrary HTTP session with the admin Bearer token.
    &{headers}=    Create Dictionary    Authorization=Bearer ${ADMIN_TOKEN}    Content-Type=application/json
    Create Session    admin_session    ${BASE_URL}    headers=${headers}    verify=false

Create Auth Session
    [Documentation]    Opens a RequestsLibrary HTTP session with the given Bearer token.
    [Arguments]    ${token}
    &{headers}=    Create Dictionary    Authorization=Bearer ${token}    Content-Type=application/json
    Create Session    auth_session    ${BASE_URL}    headers=${headers}    verify=false

Status Should Be
    [Documentation]    Asserts that a response has the expected HTTP status code.
    [Arguments]    ${response}    ${expected_status}
    Should Be Equal As Integers    ${response.status_code}    ${expected_status}

Response Should Contain Field
    [Documentation]    Asserts that a JSON response body contains a given key.
    [Arguments]    ${response}    ${field}
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    ${field}

Response Field Should Equal
    [Documentation]    Asserts that a JSON response body field equals an expected value.
    [Arguments]    ${response}    ${field}    ${expected}
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Strings    ${body}[${field}]    ${expected}

List Response Should Not Be Empty
    [Documentation]    Asserts that a JSON response body is a non-empty list.
    [Arguments]    ${response}
    ${body}=    Set Variable    ${response.json()}
    Should Not Be Empty    ${body}

List Item Should Contain Field
    [Documentation]    Asserts all items in a JSON list response contain a given key.
    [Arguments]    ${response}    ${field}
    ${body}=    Set Variable    ${response.json()}
    FOR    ${item}    IN    @{body}
        Dictionary Should Contain Key    ${item}    ${field}
    END
