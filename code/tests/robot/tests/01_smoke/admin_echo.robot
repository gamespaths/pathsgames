*** Settings ***
# ---------------------------------------------------------------------------
# admin_echo.robot — the /api/echo/status health check is ALSO served on the
# dedicated admin endpoint (ADMIN_BASE_URL: admin port 8044 / admin API), backed by
# the SAME EchoService as the public endpoint. This lets the admin endpoint be
# monitored independently of the public/player API.
#
# Tags: smoke, admin, echo, step20
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource

Suite Setup    Initialize Echo Sessions


*** Keywords ***

Initialize Echo Sessions
    [Documentation]    Open a public session (BASE_URL) and an admin session (ADMIN_BASE_URL).
    Create Public Session
    Create Session    admin_session    ${ADMIN_BASE_URL}    verify=false


*** Test Cases ***

Admin Echo Status Returns 200
    [Documentation]    GET /api/echo/status on the admin endpoint returns 200 (no auth).
    [Tags]    smoke    admin    echo    step20
    ${response}=    GET On Session    admin_session    /api/echo/status    expected_status=any
    Status Should Be    ${response}    200

Admin Echo Has Status And Properties
    [Documentation]    The admin echo body has the same shape as the public echo:
    ...                a 'status' value and a 'properties' object with a 'version'.
    [Tags]    smoke    admin    echo    step20
    ${response}=    GET On Session    admin_session    /api/echo/status
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    status
    Dictionary Should Contain Key    ${body}    properties
    Dictionary Should Contain Key    ${body}[properties]    version

Admin Echo Matches Public Echo
    [Documentation]    The admin endpoint and the public endpoint are backed by the same
    ...                EchoService — the 'status' value is identical on both.
    [Tags]    smoke    admin    echo    step20
    ${admin_resp}=     GET On Session    admin_session     /api/echo/status
    ${public_resp}=    GET On Session    public_session    /api/echo/status
    ${admin_status}=     Set Variable    ${admin_resp.json()}[status]
    ${public_status}=    Set Variable    ${public_resp.json()}[status]
    Should Be Equal As Strings    ${admin_status}    ${public_status}
