*** Settings ***
# ---------------------------------------------------------------------------
# admin_match_control.robot — Step 20 admin match control endpoints.
#
# Endpoints under test (admin Bearer token, admin port 8044):
#   GET    /api/admin/matches/{uuidMatch}/info    → 200 | 404
#   POST   /api/admin/matches/{uuidMatch}/stop    → 200 | 404
#   POST   /api/admin/matches/{uuidMatch}/pause   → 200 | 404
#   POST   /api/admin/matches/{uuidMatch}/resume  → 200 | 404
#   DELETE /api/admin/matches/{uuidMatch}         → 200 | 404 | 409
#
# The tests exercise the full match lifecycle in order:
#   (CREATED) → pause → (PAUSED) → resume → (RUNNING) → stop → (ENDED) → delete
#
# Tags: admin, matches, step20
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource

Suite Setup    Suite Setup Admin Match Control


*** Keywords ***

Suite Setup Admin Match Control
    [Documentation]    Creates public + admin sessions, guest-logs in, resolves a story
    ...                loadout, and creates a fresh match for the lifecycle tests.
    Create Public Session
    Create Session    admin_session    ${ADMIN_BASE_URL}    verify=false
    ${token}=    Generate Admin Token
    Set Suite Variable    ${ADMIN_TOKEN}    ${token}
    # Guest login — inline POST instead of Create Guest Session And Get Token,
    # because that keyword uses Set Test Variable, which is illegal in Suite Setup
    # ("Cannot set test variable when no test is started").
    ${guest_response}=    POST On Session    public_session    /api/auth/guest
    Status Should Be    ${guest_response}    201
    ${guest_token}=    Set Variable    ${guest_response.json()}[accessToken]
    Set Suite Variable    ${GUEST_TOKEN}    ${guest_token}
    # Resolve story loadout dynamically
    ${story_uuid}    ${difficulty_uuid}    ${char_uuid}    ${class_uuid}    ${trait_uuid}=
    ...    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}       ${story_uuid}
    Set Suite Variable    ${DIFFICULTY_UUID}  ${difficulty_uuid}
    Set Suite Variable    ${CHAR_UUID}        ${char_uuid}
    Set Suite Variable    ${CLASS_UUID}       ${class_uuid}
    Set Suite Variable    ${TRAIT_UUID}       ${trait_uuid}
    # Create the match that lifecycle tests will share
    ${trait_list}=    Create List
    IF    '${TRAIT_UUID}' != ''
        Append To List    ${trait_list}    ${TRAIT_UUID}
    END
    ${response}=    Create Match With Loadout    ${GUEST_TOKEN}
    ...    ${STORY_UUID}    ${DIFFICULTY_UUID}
    ...    ${CHAR_UUID}    ${CLASS_UUID}    ${trait_list}    ${1}
    Status Should Be    ${response}    201
    ${match_uuid}=    Set Variable    ${response.json()}[uuid]
    Set Suite Variable    ${MATCH_UUID}    ${match_uuid}
    # Join the match so admin info shows a player
    ${join_response}=    Join Match    ${GUEST_TOKEN}    ${MATCH_UUID}
    ...    ${CHAR_UUID}    ${CLASS_UUID}    ${trait_list}
    Status Should Be    ${join_response}    201


*** Test Cases ***

# ── GET info ────────────────────────────────────────────────────────────────

Admin Get Match Info Returns 200
    [Documentation]    GET /api/admin/matches/{uuid}/info with admin token returns 200
    ...                and a body that contains uuid and status fields.
    [Tags]    admin    matches    step20
    ${response}=    Admin Get Match Info    ${ADMIN_TOKEN}    ${MATCH_UUID}
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    match
    ${match}=    Set Variable    ${body}[match]
    Dictionary Should Contain Key    ${match}    uuid
    Dictionary Should Contain Key    ${match}    status
    Should Be Equal As Strings    ${match}[uuid]    ${MATCH_UUID}

Admin Get Match Info Without Token Returns 401
    [Documentation]    GET /api/admin/matches/{uuid}/info without auth returns 401.
    [Tags]    admin    matches    step20
    ${response}=    GET On Session    admin_session
    ...    /api/admin/matches/${MATCH_UUID}/info
    ...    expected_status=any
    Should Be Equal As Integers    ${response.status_code}    401

Admin Get Match Info For Unknown Match Returns 404
    [Documentation]    GET /api/admin/matches/{unknown}/info returns 404.
    [Tags]    admin    matches    step20
    ${response}=    Admin Get Match Info    ${ADMIN_TOKEN}    ${UNKNOWN_UUID}
    Status Should Be    ${response}    404

Admin Get Match Info Shows Players List
    [Documentation]    The info response includes a players array (character joined in setup).
    [Tags]    admin    matches    step20
    ${response}=    Admin Get Match Info    ${ADMIN_TOKEN}    ${MATCH_UUID}
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    players
    ${players}=    Set Variable    ${body}[players]
    ${type}=    Evaluate    type(${players}).__name__
    Should Be Equal    ${type}    list
    Length Should Be    ${players}    1

# ── pause ────────────────────────────────────────────────────────────────────

Admin Pause Match Without Token Returns 401
    [Documentation]    POST /api/admin/matches/{uuid}/pause without auth returns 401.
    [Tags]    admin    matches    step20
    ${response}=    POST On Session    admin_session
    ...    /api/admin/matches/${MATCH_UUID}/pause
    ...    expected_status=any
    Should Be Equal As Integers    ${response.status_code}    401

Admin Pause Unknown Match Returns 404
    [Documentation]    POST /api/admin/matches/{unknown}/pause returns 404.
    [Tags]    admin    matches    step20
    ${response}=    Admin Pause Match    ${ADMIN_TOKEN}    ${UNKNOWN_UUID}
    Status Should Be    ${response}    404

Admin Pause Match Returns 200
    [Documentation]    POST /api/admin/matches/{uuid}/pause transitions the match to PAUSED.
    ...                Run after creation (CREATED status); sets MATCH status to PAUSED.
    [Tags]    admin    matches    step20
    ${response}=    Admin Pause Match    ${ADMIN_TOKEN}    ${MATCH_UUID}
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    status
    Should Be Equal As Strings    ${body}[status]    UPDATED

Admin Match Status Is PAUSED After Pause
    [Documentation]    GET /api/admin/matches/{uuid}/info confirms status = PAUSED.
    [Tags]    admin    matches    step20
    ${response}=    Admin Get Match Info    ${ADMIN_TOKEN}    ${MATCH_UUID}
    Status Should Be    ${response}    200
    ${match}=    Set Variable    ${response.json()}[match]
    Should Be Equal As Strings    ${match}[status]    PAUSED

# ── resume ───────────────────────────────────────────────────────────────────

Admin Resume Unknown Match Returns 404
    [Documentation]    POST /api/admin/matches/{unknown}/resume returns 404.
    [Tags]    admin    matches    step20
    ${response}=    Admin Resume Match    ${ADMIN_TOKEN}    ${UNKNOWN_UUID}
    Status Should Be    ${response}    404

Admin Resume Match Returns 200
    [Documentation]    POST /api/admin/matches/{uuid}/resume transitions from PAUSED to RUNNING.
    [Tags]    admin    matches    step20
    ${response}=    Admin Resume Match    ${ADMIN_TOKEN}    ${MATCH_UUID}
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Strings    ${body}[status]    UPDATED

Admin Match Status Is RUNNING After Resume
    [Documentation]    GET /api/admin/matches/{uuid}/info confirms status = RUNNING.
    [Tags]    admin    matches    step20
    ${response}=    Admin Get Match Info    ${ADMIN_TOKEN}    ${MATCH_UUID}
    Status Should Be    ${response}    200
    ${match}=    Set Variable    ${response.json()}[match]
    Should Be Equal As Strings    ${match}[status]    RUNNING

# ── delete guard (non-terminal) ───────────────────────────────────────────────

Admin Delete Running Match Returns 409
    [Documentation]    DELETE /api/admin/matches/{uuid} while the match is RUNNING returns
    ...                409 (MATCH_NOT_STOPPED). Only terminal matches may be deleted.
    [Tags]    admin    matches    step20
    ${response}=    Admin Delete Match    ${ADMIN_TOKEN}    ${MATCH_UUID}
    Status Should Be    ${response}    409
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Strings    ${body}[error]    MATCH_NOT_STOPPED

# ── stop ─────────────────────────────────────────────────────────────────────

Admin Stop Match Without Token Returns 401
    [Documentation]    POST /api/admin/matches/{uuid}/stop without auth returns 401.
    [Tags]    admin    matches    step20
    ${response}=    POST On Session    admin_session
    ...    /api/admin/matches/${MATCH_UUID}/stop
    ...    expected_status=any
    Should Be Equal As Integers    ${response.status_code}    401

Admin Stop Unknown Match Returns 404
    [Documentation]    POST /api/admin/matches/{unknown}/stop returns 404.
    [Tags]    admin    matches    step20
    ${response}=    Admin Stop Match    ${ADMIN_TOKEN}    ${UNKNOWN_UUID}
    Status Should Be    ${response}    404

Admin Stop Match Returns 200
    [Documentation]    POST /api/admin/matches/{uuid}/stop transitions RUNNING → ENDED.
    [Tags]    admin    matches    step20
    ${response}=    Admin Stop Match    ${ADMIN_TOKEN}    ${MATCH_UUID}
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Strings    ${body}[status]    UPDATED

Admin Match Status Is ENDED After Stop
    [Documentation]    GET /api/admin/matches/{uuid}/info confirms status = ENDED.
    [Tags]    admin    matches    step20
    ${response}=    Admin Get Match Info    ${ADMIN_TOKEN}    ${MATCH_UUID}
    Status Should Be    ${response}    200
    ${match}=    Set Variable    ${response.json()}[match]
    Should Be Equal As Strings    ${match}[status]    ENDED

# ── delete terminal ──────────────────────────────────────────────────────────

Admin Delete Match Without Token Returns 401
    [Documentation]    DELETE /api/admin/matches/{uuid} without auth returns 401.
    [Tags]    admin    matches    step20
    ${response}=    DELETE On Session    admin_session
    ...    /api/admin/matches/${MATCH_UUID}
    ...    expected_status=any
    Should Be Equal As Integers    ${response.status_code}    401

Admin Delete Unknown Match Returns 404
    [Documentation]    DELETE /api/admin/matches/{unknown} returns 404.
    [Tags]    admin    matches    step20
    ${response}=    Admin Delete Match    ${ADMIN_TOKEN}    ${UNKNOWN_UUID}
    Status Should Be    ${response}    404

Admin Delete Terminal Match Returns 200
    [Documentation]    DELETE /api/admin/matches/{uuid} after ENDED removes the match and
    ...                returns 200 with status=DELETED. Must run after Admin Stop Match.
    [Tags]    admin    matches    step20
    ${response}=    Admin Delete Match    ${ADMIN_TOKEN}    ${MATCH_UUID}
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Strings    ${body}[status]    DELETED
    Should Be Equal As Strings    ${body}[uuid]      ${MATCH_UUID}

Admin Get Deleted Match Returns 404
    [Documentation]    After deletion, GET /api/admin/matches/{uuid}/info returns 404.
    [Tags]    admin    matches    step20
    ${response}=    Admin Get Match Info    ${ADMIN_TOKEN}    ${MATCH_UUID}
    Status Should Be    ${response}    404
