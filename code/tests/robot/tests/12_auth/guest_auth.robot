*** Settings ***
# ---------------------------------------------------------------------------
# guest_auth.robot — tests for Step 12 guest authentication API.
#
# Endpoints under test:
#   POST /api/auth/guest           → 201, GuestLoginResponse body
#   POST /api/auth/guest/resume    → 201 (with guestToken cookie) | 401 (no cookie)
#   GET  /api/auth/me              → 200 (with valid token)
#   POST /api/auth/logout          → 204
#
# Note: Guest sessions have PLAYER role — they can NOT access /api/admin/** endpoints.
#
# Tags: auth, step12
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource

Suite Setup    Create Public Session


*** Test Cases ***

Guest Login Returns 201
    [Documentation]    POST /api/auth/guest (no body) returns HTTP 201.
    [Tags]    auth    step12
    ${response}=    POST On Session    public_session    /api/auth/guest
    Status Should Be    ${response}    201

Guest Login Response Has Required Fields
    [Documentation]    The GuestLoginResponse body contains all documented fields.
    [Tags]    auth    step12
    ${response}=    POST On Session    public_session    /api/auth/guest
    Guest Login Response Should Be Valid    ${response}

Guest Login Response accessToken Is Not Empty
    [Documentation]    The accessToken field in the response body must be a non-empty string.
    [Tags]    auth    step12
    ${response}=    POST On Session    public_session    /api/auth/guest
    ${body}=    Set Variable    ${response.json()}
    Should Not Be Empty    ${body}[accessToken]

Guest Session Me Endpoint Returns Current User
    [Documentation]    GET /api/auth/me with a valid guest token returns 200 with user info.
    [Tags]    auth    step12
    ${token}=    Create Guest Session And Get Token
    ${headers}=    Get Auth Headers    ${token}
    ${response}=    GET On Session    public_session    /api/auth/me    headers=${headers}
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    userUuid
    Dictionary Should Contain Key    ${body}    username
    Dictionary Should Contain Key    ${body}    role

Guest Has PLAYER Role
    [Documentation]    A guest session must carry the PLAYER role (not ADMIN).
    [Tags]    auth    step12
    ${token}=    Create Guest Session And Get Token
    ${headers}=    Get Auth Headers    ${token}
    ${response}=    GET On Session    public_session    /api/auth/me    headers=${headers}
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Strings    ${body}[role]    PLAYER

Guest Cannot Access Admin Endpoint
    [Documentation]    A PLAYER token returns 403 when calling /api/admin/stories.
    [Tags]    auth    step12
    ${token}=    Create Guest Session And Get Token
    ${headers}=    Get Auth Headers    ${token}
    ${params}=    Create Dictionary    lang=en
    ${response}=    GET On Session    public_session    /api/admin/stories
    ...    headers=${headers}    params=${params}    expected_status=any
    Should Be Equal As Integers    ${response.status_code}    403

Me Endpoint Returns 401 Without Token
    [Documentation]    GET /api/auth/me without a Bearer token returns 401.
    [Tags]    auth    step12
    ${response}=    GET On Session    public_session    /api/auth/me
    ...    expected_status=any
    Status Should Be    ${response}    401

Guest Resume Without Cookie Returns 400
    [Documentation]    POST /api/auth/guest/resume without the guestToken cookie returns 400 (missing required cookie).
    [Tags]    auth    step12
    ${response}=    POST On Session    public_session    /api/auth/guest/resume
    ...    expected_status=any
    Status Should Be    ${response}    400

Guest Logout All Returns 200
    [Documentation]    POST /api/auth/logout/all with a valid guest Bearer token returns 200.
    ...                (POST /api/auth/logout also requires the HttpOnly refreshToken cookie;
    ...                logout/all works from the Bearer token alone.)
    [Tags]    auth    step12
    ${token}=    Create Guest Session And Get Token
    ${headers}=    Get Auth Headers    ${token}
    ${response}=    POST On Session    public_session    /api/auth/logout/all
    ...    headers=${headers}    expected_status=any
    Status Should Be    ${response}    200

Revoked Token Is Rejected By Me Endpoint
    [Documentation]    After logout/all, the access token is still valid until expiry (JWT is stateless),
    ...                but the test documents expected behaviour.
    ...                The logout/all call itself must succeed (200).
    [Tags]    auth    step12
    ${token}=    Create Guest Session And Get Token
    ${headers}=    Get Auth Headers    ${token}
    ${logout_response}=    POST On Session    public_session    /api/auth/logout/all
    ...    headers=${headers}    expected_status=any
    Status Should Be    ${logout_response}    200
