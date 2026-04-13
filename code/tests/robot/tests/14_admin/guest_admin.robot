*** Settings ***
# ---------------------------------------------------------------------------
# guest_admin.robot — tests for admin guest management API.
#
# Endpoints under test:
#   GET    /api/admin/guests           → 200, list of guests
#   GET    /api/admin/guests/stats     → 200, stats object
#   GET    /api/admin/guests/{uuid}    → 200 | 404
#   DELETE /api/admin/guests/{uuid}    → 200 | 404
#   DELETE /api/admin/guests/expired   → 200
#
# Pre-requisite: ADMIN_TOKEN must be a valid admin JWT.
#
# Tags: admin, guests, step12
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Library    ../../resources/JwtHelper.py
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource

Suite Setup    Initialize Admin Suite

*** Variables ***
${GUESTS_PATH}          /api/admin/guests
${GUESTS_STATS_PATH}    /api/admin/guests/stats
${GUESTS_EXPIRED_PATH}  /api/admin/guests/expired


*** Keywords ***

Initialize Admin Suite
    [Documentation]    Create public session and generate a dynamic admin JWT.
    Create Public Session
    ${token}=    Generate Admin Token
    Set Suite Variable    ${ADMIN_TOKEN}    ${token}

Get Admin Headers
    [Documentation]    Returns a headers dict with the admin Bearer token.
    ${headers}=    Create Dictionary    Authorization=Bearer ${ADMIN_TOKEN}
    RETURN    ${headers}

Admin GET
    [Documentation]    Convenience wrapper for an authenticated GET request.
    [Arguments]    ${path}
    ${headers}=    Get Admin Headers
    ${response}=    GET On Session    public_session    ${path}
    ...    headers=${headers}    expected_status=any
    RETURN    ${response}

Admin DELETE
    [Documentation]    Convenience wrapper for an authenticated DELETE request.
    [Arguments]    ${path}
    ${headers}=    Get Admin Headers
    ${response}=    DELETE On Session    public_session    ${path}
    ...    headers=${headers}    expected_status=any
    RETURN    ${response}


*** Test Cases ***

# ---- auth guard tests -------------------------------------------------------

Guest List Without Token Returns 401
    [Documentation]    GET /api/admin/guests without auth returns 401.
    [Tags]    admin    guests    step12
    ${response}=    GET On Session    public_session    ${GUESTS_PATH}
    ...    expected_status=any
    Should Be Equal As Integers    ${response.status_code}    401

Guest Stats Without Token Returns 401
    [Documentation]    GET /api/admin/guests/stats without auth returns 401.
    [Tags]    admin    guests    step12
    ${response}=    GET On Session    public_session    ${GUESTS_STATS_PATH}
    ...    expected_status=any
    Should Be Equal As Integers    ${response.status_code}    401

# ---- list tests -------------------------------------------------------------

Admin Guest List Returns 200
    [Documentation]    GET /api/admin/guests with admin token returns 200.
    [Tags]    admin    guests    step12
    ${response}=    Admin GET    ${GUESTS_PATH}
    Status Should Be    ${response}    200

Admin Guest List Is A List
    [Documentation]    The response body is a JSON array.
    [Tags]    admin    guests    step12
    ${response}=    Admin GET    ${GUESTS_PATH}
    ${body}=    Set Variable    ${response.json()}
    ${type}=    Evaluate    type(${body}).__name__
    Should Be Equal    ${type}    list

Admin Guest List Not Empty After Login
    [Documentation]    After a guest login, the guest list has at least one entry.
    [Tags]    admin    guests    step12
    # Ensure at least one guest exists
    Create Guest Session And Get Token
    ${response}=    Admin GET    ${GUESTS_PATH}
    List Response Should Not Be Empty    ${response}

Guest List Items Have userUuid Field
    [Documentation]    Each guest in the list has a userUuid field.
    [Tags]    admin    guests    step12
    Create Guest Session And Get Token
    ${response}=    Admin GET    ${GUESTS_PATH}
    List Item Should Contain Field    ${response}    userUuid

# ---- stats tests ------------------------------------------------------------

Admin Guest Stats Returns 200
    [Documentation]    GET /api/admin/guests/stats returns 200.
    [Tags]    admin    guests    step12
    ${response}=    Admin GET    ${GUESTS_STATS_PATH}
    Status Should Be    ${response}    200

Admin Guest Stats Has totalGuests Field
    [Documentation]    The stats response body contains 'totalGuests', 'activeGuests', 'expiredGuests' fields.
    [Tags]    admin    guests    step12
    ${response}=    Admin GET    ${GUESTS_STATS_PATH}
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    totalGuests
    Dictionary Should Contain Key    ${body}    activeGuests
    Dictionary Should Contain Key    ${body}    expiredGuests

# ---- single guest tests -----------------------------------------------------

Get Unknown Guest Returns 404
    [Documentation]    GET /api/admin/guests/00000000-... returns 404.
    [Tags]    admin    guests    step12
    ${response}=    Admin GET    ${GUESTS_PATH}/${UNKNOWN_UUID}
    Status Should Be    ${response}    404

Get Existing Guest Returns 200
    [Documentation]    Create a guest, then retrieve it via the admin endpoint.
    [Tags]    admin    guests    step12
    ${token}=    Create Guest Session And Get Token
    ${body}=    Set Variable    ${GUEST_RESPONSE.json()}
    ${uuid}=    Set Variable    ${body}[userUuid]
    ${response}=    Admin GET    ${GUESTS_PATH}/${uuid}
    Status Should Be    ${response}    200

Existing Guest Detail Has userUuid Field
    [Documentation]    The single-guest response body contains the userUuid field.
    [Tags]    admin    guests    step12
    ${token}=    Create Guest Session And Get Token
    ${body}=    Set Variable    ${GUEST_RESPONSE.json()}
    ${uuid}=    Set Variable    ${body}[userUuid]
    ${response}=    Admin GET    ${GUESTS_PATH}/${uuid}
    ${detail}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${detail}    userUuid
    Should Be Equal As Strings    ${detail}[userUuid]    ${uuid}

# ---- delete tests -----------------------------------------------------------

Delete Unknown Guest Returns 404
    [Documentation]    DELETE /api/admin/guests/00000000-... returns 404.
    [Tags]    admin    guests    step12
    ${response}=    Admin DELETE    ${GUESTS_PATH}/${UNKNOWN_UUID}
    Status Should Be    ${response}    404

Delete Existing Guest Returns 200
    [Documentation]    Create a guest, then delete it via admin endpoint — returns 200.
    [Tags]    admin    guests    step12
    ${token}=    Create Guest Session And Get Token
    ${body}=    Set Variable    ${GUEST_RESPONSE.json()}
    ${uuid}=    Set Variable    ${body}[userUuid]
    ${response}=    Admin DELETE    ${GUESTS_PATH}/${uuid}
    Status Should Be    ${response}    200

# ---- expired tests ----------------------------------------------------------

Delete Expired Guests Returns 200
    [Documentation]    DELETE /api/admin/guests/expired always returns 200 (even if 0 expired).
    [Tags]    admin    guests    step12
    ${response}=    Admin DELETE    ${GUESTS_EXPIRED_PATH}
    Status Should Be    ${response}    200
