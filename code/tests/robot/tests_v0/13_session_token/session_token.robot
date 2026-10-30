*** Settings ***
# ---------------------------------------------------------------------------
# session_token.robot — Step 13 session token management.
#
# Endpoints under test:
#   POST /api/auth/refresh   → 200 (refreshToken cookie) | 401 (no/invalid cookie)
#   POST /api/auth/logout    → 200/204 (refreshToken cookie) ; revokes the session
#   GET  /api/auth/me        → 401 INVALID_TOKEN / EMPTY_TOKEN on bad Bearer header
#
# Token rotation: POST /api/auth/refresh issues a new pair and revokes the old
# session; POST /api/auth/logout revokes the refresh token so a subsequent
# refresh on the same (now cookie-cleared) session fails with 401.
#
# The HttpOnly pathsgames.refreshToken cookie is scoped to Path=/api/auth and is
# carried automatically by the RequestsLibrary session cookie jar, so login +
# refresh + logout share one public_session.
#
# Backend-agnostic: runs against any backend implementing the shared contract.
#
# Tags: auth, session, step13
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource


*** Test Cases ***

Refresh Returns A New Access Token
    [Documentation]    POST /api/auth/refresh with a valid refresh cookie returns 200 and a
    ...                fresh access token. The HttpOnly refresh cookie is Secure (SameSite=None)
    ...                so it is replayed explicitly as a Cookie header rather than via the jar.
    [Tags]    auth    session    step13
    ${login}=    Login Fresh Guest
    ${cookie}=    Get Refresh Cookie    ${login}
    ${response}=    Refresh With Cookie    ${cookie}
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    accessToken
    Should Not Be Empty    ${body}[accessToken]
    Dictionary Should Contain Key    ${body}    accessTokenExpiresAt
    Dictionary Should Contain Key    ${body}    refreshTokenExpiresAt

Refresh Without Cookie Is Rejected
    [Documentation]    POST /api/auth/refresh with no refresh cookie is rejected. Backends
    ...                differ on the exact status (Java 400 missing-cookie, Python/AWS 401
    ...                unauthorized) — both are accepted.
    [Tags]    auth    session    step13
    Create Http Session    cookieless_refresh    ${BASE_URL}    verify=false
    ${response}=    POST On Session    cookieless_refresh    /api/auth/refresh    expected_status=any    timeout=${HTTP_POST_TIMEOUT}
    Should Be True    ${response.status_code} == 400 or ${response.status_code} == 401

Refresh Rotation Keeps The Old Cookie Only For The Grace Window
    [Documentation]    v1.2.0 — a successful refresh rotates (revokes) only the used token; a
    ...                second tab replaying it within 30 seconds still gets a new pair (grace).
    [Tags]    auth    session    step13    v1_step03
    ${login}=    Login Fresh Guest
    ${old_cookie}=    Get Refresh Cookie    ${login}
    ${first}=    Refresh With Cookie    ${old_cookie}
    Status Should Be    ${first}    200
    ${replay}=    Refresh With Cookie    ${old_cookie}
    Status Should Be    ${replay}    200

Logout Revokes The Session
    [Documentation]    POST /api/auth/logout (with the refresh cookie) succeeds (200/204) and
    ...                revokes the refresh token, so replaying that cookie on refresh → 401.
    [Tags]    auth    session    step13
    ${login}=    Login Fresh Guest
    ${token}=    Set Variable    ${login.json()}[accessToken]
    ${cookie}=    Get Refresh Cookie    ${login}
    ${headers}=    Get Auth Headers    ${token}
    Set To Dictionary    ${headers}    Cookie=${cookie}
    ${logout}=    POST On Session    public_session    /api/auth/logout
    ...    headers=${headers}    expected_status=any    timeout=${HTTP_POST_TIMEOUT}
    Should Be True    ${logout.status_code} == 200 or ${logout.status_code} == 204
    ${after}=    Refresh With Cookie    ${cookie}
    Status Should Be    ${after}    401
    # v1.2.0 — a revoked session has its own code (the frontend says "closed from another device")
    Should Be Equal    ${after.json()}[error]    SESSION_REVOKED

Me With Malformed Bearer Returns 401
    [Documentation]    GET /api/auth/me with a non-JWT Bearer token → 401. The error-code
    ...                string is backend-specific (Java INVALID_TOKEN, AWS UNAUTHORIZED), so
    ...                only the 401 status is asserted.
    [Tags]    auth    session    step13
    Create Public Session
    ${headers}=    Get Auth Headers    not-a-real-jwt-token
    ${response}=    GET On Session    public_session    /api/auth/me
    ...    headers=${headers}    expected_status=any
    Status Should Be    ${response}    401

Me With Empty Bearer Returns 401
    [Documentation]    GET /api/auth/me with an empty Bearer token → 401 (error-code string is
    ...                backend-specific, only the status is asserted).
    [Tags]    auth    session    step13
    Create Public Session
    ${headers}=    Create Dictionary    Authorization=Bearer ${SPACE}
    ${response}=    GET On Session    public_session    /api/auth/me
    ...    headers=${headers}    expected_status=any
    Status Should Be    ${response}    401


*** Keywords ***

Login Fresh Guest
    [Documentation]    Opens a fresh public_session and logs in a new guest. Returns the
    ...                full 201 response (its .cookies carry the Set-Cookie refresh token).
    Create Public Session
    ${response}=    POST On Session    public_session    /api/auth/guest    timeout=${HTTP_POST_TIMEOUT}
    Status Should Be    ${response}    201
    RETURN    ${response}

Get Refresh Cookie
    [Documentation]    Extracts the "name=value" refresh cookie pair from a login/refresh
    ...                response (the cookie whose name contains "refresh"). The cookie is
    ...                Secure, so it is replayed manually rather than via the session jar.
    [Arguments]    ${response}
    ${pair}=    Evaluate    next((f"{k}={v}" for k, v in $response.cookies.items() if 'refresh' in k.lower()), '')
    Should Not Be Empty    ${pair}
    RETURN    ${pair}

Refresh With Cookie
    [Documentation]    POST /api/auth/refresh sending the given "name=value" cookie pair as an
    ...                explicit Cookie header. Returns the response (any status).
    [Arguments]    ${cookie_pair}
    ${headers}=    Create Dictionary    Cookie=${cookie_pair}
    ${response}=    POST On Session    public_session    /api/auth/refresh
    ...    headers=${headers}    expected_status=any    timeout=${HTTP_POST_TIMEOUT}
    RETURN    ${response}
