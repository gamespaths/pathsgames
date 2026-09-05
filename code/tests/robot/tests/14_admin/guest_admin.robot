*** Settings ***
# ---------------------------------------------------------------------------
# guest_admin.robot — tests for admin guest management API.
#
# Endpoints under test:
#   GET    /api/admin/guests           → 200, { items, nextCursor, limit } (v0.36.2)
#   GET    /api/admin/guests/stale     → 200, { guests, matches } dry run (v0.36.2)
#   DELETE /api/admin/guests/stale     → 200, purge, matches included (v0.36.2)
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
${GUESTS_STALE_PATH}    /api/admin/guests/stale


*** Keywords ***

Initialize Admin Suite
    [Documentation]    Create the public session (for guest creation) and a bare admin
    ...                session against ADMIN_BASE_URL (admin port 8044 / admin API), plus
    ...                a dynamic admin JWT. Admin requests pass the token per-request.
    Create Public Session
    Create Session    admin_session    ${ADMIN_BASE_URL}    verify=false
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
    ${response}=    GET On Session    admin_session    ${path}
    ...    headers=${headers}    expected_status=any
    RETURN    ${response}

Admin DELETE
    [Documentation]    Convenience wrapper for an authenticated DELETE request.
    [Arguments]    ${path}
    ${headers}=    Get Admin Headers
    ${response}=    DELETE On Session    admin_session    ${path}
    ...    headers=${headers}    expected_status=any
    RETURN    ${response}


*** Test Cases ***

# ---- auth guard tests -------------------------------------------------------

Guest List Without Token Returns 401
    [Documentation]    GET /api/admin/guests without auth returns 401.
    [Tags]    admin    guests    step12
    ${response}=    GET On Session    admin_session    ${GUESTS_PATH}
    ...    expected_status=any
    Should Be Equal As Integers    ${response.status_code}    401

Guest Stats Without Token Returns 401
    [Documentation]    GET /api/admin/guests/stats without auth returns 401.
    [Tags]    admin    guests    step12
    ${response}=    GET On Session    admin_session    ${GUESTS_STATS_PATH}
    ...    expected_status=any
    Should Be Equal As Integers    ${response.status_code}    401

# ---- list tests -------------------------------------------------------------

Admin Guest List Returns 200
    [Documentation]    GET /api/admin/guests with admin token returns 200.
    [Tags]    admin    guests    step12
    ${response}=    Admin GET    ${GUESTS_PATH}
    Status Should Be    ${response}    200

Admin Guest List Is A Paged Envelope
    [Documentation]    v0.36.2 — the body is { items, nextCursor, limit }, not a bare array.
    ...                Asking for every guest at once is what timed out against AWS.
    [Tags]    admin    guests    step12    step36-2
    ${response}=    Admin GET    ${GUESTS_PATH}
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    items
    Dictionary Should Contain Key    ${body}    nextCursor
    Dictionary Should Contain Key    ${body}    limit
    ${type}=    Evaluate    type($body['items']).__name__
    Should Be Equal    ${type}    list

Admin Guest List Not Empty After Login
    [Documentation]    After a guest login, the guest list has at least one entry.
    [Tags]    admin    guests    step12
    # Ensure at least one guest exists
    Create Guest Session And Get Token
    ${response}=    Admin GET    ${GUESTS_PATH}
    Should Not Be Empty    ${response.json()}[items]

Guest List Items Have userUuid Field
    [Documentation]    Each guest in the list has a userUuid field.
    [Tags]    admin    guests    step12
    Create Guest Session And Get Token
    ${response}=    Admin GET    ${GUESTS_PATH}
    FOR    ${item}    IN    @{response.json()}[items]
        Dictionary Should Contain Key    ${item}    userUuid
    END

Admin Guest List Honours The Page Limit
    [Documentation]    v0.36.2 — ?limit=1 returns at most one guest and reports the limit
    ...                that produced the page.
    [Tags]    admin    guests    step36-2
    Create Guest Session And Get Token
    ${response}=    Admin GET    ${GUESTS_PATH}?limit=1
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Integers    ${body}[limit]    1
    ${count}=    Get Length    ${body}[items]
    Should Be True    ${count} <= 1

The Stale Preview Counts Guests And Their Matches Without Deleting Anything
    [Documentation]    v0.36.2 — the dry run the console shows before it asks. A bound far in
    ...                the future covers every guest, so both counts are answerable.
    [Tags]    admin    guests    step36-2
    Create Guest Session And Get Token
    ${before}=    Admin GET    ${GUESTS_PATH}
    ${response}=    Admin GET    ${GUESTS_STALE_PATH}?olderThanDays=0
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    guests
    Dictionary Should Contain Key    ${body}    matches
    Should Be True    ${body}[guests] >= 0
    # A preview deletes nothing: the guest just created is still there.
    ${after}=    Admin GET    ${GUESTS_PATH}
    Should Not Be Empty    ${after.json()}[items]

The Stale Purge Refuses Without A Bound
    [Documentation]    v0.36.2 — without olderThanDays the purge would take EVERY guest and
    ...                every match they own. It refuses rather than guessing.
    [Tags]    admin    guests    step36-2
    ${response}=    Admin DELETE    ${GUESTS_STALE_PATH}
    Status Should Be    ${response}    400
    Should Be Equal    ${response.json()}[error]    INVALID_INPUT

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
