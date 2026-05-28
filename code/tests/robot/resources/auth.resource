*** Settings ***
# ---------------------------------------------------------------------------
# auth.resource — keywords for authentication flows.
#
# POST /api/auth/guest           → 201, body: {userUuid, username, accessToken, ...}
#                                   HttpOnly cookies: pathsgames.refreshToken,
#                                                     pathsgames.guestToken
# POST /api/auth/guest/resume    → 201, reads pathsgames.guestToken cookie
# POST /api/auth/refresh         → 200, reads pathsgames.refreshToken cookie
# POST /api/auth/logout          → 204
# POST /api/auth/logout/all      → 204
# GET  /api/auth/me              → 200, current user info (Bearer required)
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   common.resource


*** Keywords ***

Create Guest Session And Get Token
    [Documentation]    Calls POST /api/auth/guest (no body, no auth) and returns the
    ...                accessToken from the 201 response body.
    ...                Also stores the full response object in the test variable
    ...                \${GUEST_RESPONSE} for further assertions.
    Create Public Session
    ${response}=    POST On Session    public_session    /api/auth/guest
    Status Should Be    ${response}    201
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    accessToken
    ${token}=    Set Variable    ${body}[accessToken]
    Set Test Variable    ${GUEST_RESPONSE}    ${response}
    Set Test Variable    ${GUEST_TOKEN}    ${token}
    RETURN    ${token}

Guest Login Response Should Be Valid
    [Documentation]    Validates the shape of the GuestLoginResponse body.
    [Arguments]    ${response}
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    userUuid
    Dictionary Should Contain Key    ${body}    username
    Dictionary Should Contain Key    ${body}    accessToken
    Dictionary Should Contain Key    ${body}    accessTokenExpiresAt
    Dictionary Should Contain Key    ${body}    refreshTokenExpiresAt

Get Auth Headers
    [Documentation]    Returns a headers dict with Authorization: Bearer \${token}.
    [Arguments]    ${token}
    ${headers}=    Create Dictionary    Authorization=Bearer ${token}
    RETURN    ${headers}

Call Me Endpoint
    [Documentation]    Calls GET /api/auth/me with the given token; returns the response.
    [Arguments]    ${token}
    ${headers}=    Get Auth Headers    ${token}
    ${response}=    GET On Session    public_session    /api/auth/me    headers=${headers}
    RETURN    ${response}

Call Logout
    [Documentation]    Calls POST /api/auth/logout with the given token.
    [Arguments]    ${token}
    ${headers}=    Get Auth Headers    ${token}
    ${response}=    POST On Session    public_session    /api/auth/logout
    ...    headers=${headers}
    ...    expected_status=any
    RETURN    ${response}
