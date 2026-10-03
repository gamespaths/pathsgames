*** Settings ***
# match_owner_move.robot — v0.41.6 admin User tab: the owner of a match, the user preview by uuid / email /
# username and the move to another user (MOVED, UNCHANGED, every refusal, snapshot restore keeps the new owner).
Resource   alpha_prep_common.resource

Suite Setup       Suite Setup Alpha Prep
Suite Teardown    Suite Teardown Owner Move


*** Variables ***
${USERS_PATH}      /api/admin/users
${AGE_DAYS}        200
${NO_SUCH_UUID}    00000000-0000-4000-8000-000000000000
@{CREATED_GUESTS}


*** Test Cases ***

The Owner Is The Creating Guest
    [Documentation]    GET .../owner answers the guest that created the match: uuid, username, a guest
    ...                with one match, eligible.
    [Tags]    step41    alpha-prep    owner-move
    ${a}=    New Owner Guest
    ${match}=    Started Match Of    ${a}
    ${owner}=    Get Owner    ${match}    200
    Should Be Equal    ${owner.json()}[uuid]        ${a}[userUuid]
    Should Be Equal    ${owner.json()}[username]    ${a}[username]
    Should Be True     ${owner.json()}[guest]
    Should Be Equal As Integers    ${owner.json()}[matchCount]    1
    Should Be True     ${owner.json()}[eligible]

The Preview Finds A User By Uuid And By Username
    [Documentation]    GET /api/admin/users/{identifier}: the same user by uuid and by username; an
    ...                unknown one is 404 USER_NOT_FOUND; a PUT without user is 400 INVALID_INPUT.
    [Tags]    step41    alpha-prep    owner-move
    ${b}=    New Owner Guest
    ${by_uuid}=    Get Admin User    ${b}[userUuid]    200
    ${by_name}=    Get Admin User    ${b}[username]    200
    Should Be Equal    ${by_uuid.json()}[uuid]    ${by_name.json()}[uuid]
    Should Be Equal    ${by_name.json()}[uuid]    ${b}[userUuid]
    ${unknown}=    Get Admin User    robottest_nobody_${b}[userUuid]    404
    Should Be Equal    ${unknown.json()}[error]    USER_NOT_FOUND
    ${a}=    New Owner Guest
    ${match}=    Started Match Of    ${a}
    ${blank}=    Move Owner    ${match}    ${EMPTY}    400
    Should Be Equal    ${blank.json()}[error]    INVALID_INPUT
    ${missing}=    Move Owner    ${NO_SUCH_UUID}    ${b}[username]    404
    Should Be Equal    ${missing.json()}[error]    MATCH_NOT_FOUND

A Move Hands The Match And Its Character To The Target
    [Documentation]    Guest A's match moves to guest B by username: 200 MOVED with one character; the
    ...                owner is B, B lists the match and A does not, A's /info is 404, B's /info shows
    ...                B's character, and the timeline has one ADMIN_ACTION OWNER_CHANGED. The same
    ...                move again is 200 UNCHANGED and writes no new row.
    [Tags]    step41    alpha-prep    owner-move
    ${a}=    New Owner Guest
    ${b}=    New Owner Guest
    ${match}=    Started Match Of    ${a}
    ${moved}=    Move Owner    ${match}    ${b}[username]    200
    Should Be Equal    ${moved.json()}[status]    MOVED
    Should Be Equal As Integers    ${moved.json()}[charactersMoved]    1
    Should Be Equal    ${moved.json()}[previousOwner][uuid]    ${a}[userUuid]
    Should Be Equal    ${moved.json()}[owner][uuid]    ${b}[userUuid]
    ${owner}=    Get Owner    ${match}    200
    Should Be Equal    ${owner.json()}[uuid]    ${b}[userUuid]
    Wait Until Keyword Succeeds    5x    1s    Match Should Be Listed    ${b}[accessToken]    ${match}
    Wait Until Keyword Succeeds    5x    1s    Match Should Not Be Listed    ${a}[accessToken]    ${match}
    Get Match Info    ${a}[accessToken]    ${match}    404
    ${info}=    Get Match Info    ${b}[accessToken]    ${match}    200
    Should Be Equal    ${info.json()}[players][0][userUuid]    ${b}[userUuid]
    ${rows}=    Owner Changed Rows    ${match}
    Length Should Be    ${rows}    1
    Should Be Equal    ${rows}[0]
    ...    OWNER_CHANGED from=${a}[username]/${a}[userUuid] to=${b}[username]/${b}[userUuid]
    ${again}=    Move Owner    ${match}    ${b}[userUuid]    200
    Should Be Equal    ${again.json()}[status]    UNCHANGED
    ${rows}=    Owner Changed Rows    ${match}
    Length Should Be    ${rows}    1

A Target With An Active Match On The Story Is Refused
    [Documentation]    B already plays the story: moving A's match to B is 409 ACTIVE_MATCH_ALREADY_EXISTS.
    [Tags]    step41    alpha-prep    owner-move
    ${a}=    New Owner Guest
    ${b}=    New Owner Guest
    ${match}=    Started Match Of    ${a}
    Started Match Of    ${b}
    ${resp}=    Move Owner    ${match}    ${b}[username]    409
    Should Be Equal    ${resp.json()}[error]    ACTIVE_MATCH_ALREADY_EXISTS

An Expired Guest Is Refused
    [Documentation]    A guest aged ${AGE_DAYS} days (X-Test-Guest-Age-Days, test endpoints only) is
    ...                409 USER_EXPIRED; the preview answers it with eligible false. SKIPs when the
    ...                server does not honour the age header.
    [Tags]    step41    alpha-prep    owner-move
    ${a}=    New Owner Guest
    ${match}=    Started Match Of    ${a}
    ${old}=    New Aged Owner Guest
    ${preview}=    Get Admin User    ${old}[userUuid]    200
    Skip If    ${preview.json()}[expired] != True    X-Test-Guest-Age-Days is not honoured by this server
    Should Not Be True    ${preview.json()}[eligible]
    Should Be Equal    ${preview.json()}[reason]    USER_EXPIRED
    ${resp}=    Move Owner    ${match}    ${old}[userUuid]    409
    Should Be Equal    ${resp.json()}[error]    USER_EXPIRED

A Stopped Match Cannot Be Moved
    [Documentation]    After the admin stop (ENDED) the move is 409 MATCH_TERMINATED.
    [Tags]    step41    alpha-prep    owner-move
    ${a}=    New Owner Guest
    ${b}=    New Owner Guest
    ${match}=    Started Match Of    ${a}
    Admin Stop Match    ${ADMIN_TOKEN}    ${match}    200
    ${resp}=    Move Owner    ${match}    ${b}[username]    409
    Should Be Equal    ${resp.json()}[error]    MATCH_TERMINATED

A Restored Snapshot Keeps The New Owner
    [Documentation]    Snapshot at the time-end of clock 0 (owner A), move to B, restore that snapshot:
    ...                the owner is still B, the check is valid and B resumes and plays the match.
    [Tags]    step41    alpha-prep    owner-move    snapshots
    ${a}=    New Owner Guest
    ${b}=    New Owner Guest
    ${match}=    Started Match Of    ${a}
    Sleep Action    ${a}[accessToken]    ${match}    200
    ${snapshot}=    Newest Owner Snapshot    ${match}
    Move Owner    ${match}    ${b}[username]    200
    ${check}=    Owner Snapshot Request    GET    ${match}    ${snapshot}    check
    Should Be True    ${check.json()}[valid]    msg=${check.text}
    ${restore}=    Owner Snapshot Request    POST    ${match}    ${snapshot}    restore
    Should Be Equal    ${restore.json()}[status]    RESTORED
    ${owner}=    Get Owner    ${match}    200
    Should Be Equal    ${owner.json()}[uuid]    ${b}[userUuid]
    ${info}=    Get Match Info    ${b}[accessToken]    ${match}    200
    Should Be Equal    ${info.json()}[players][0][userUuid]    ${b}[userUuid]
    Admin Resume Match    ${ADMIN_TOKEN}    ${match}    200
    Sleep Action    ${b}[accessToken]    ${match}    200
    Get Match Info    ${a}[accessToken]    ${match}    404

An Admin Is No Valid Target And A Seed Player Is Found By Email
    [Documentation]    Java seed users only (test_admin, player1@test.local): the move to test_admin
    ...                is 409 USER_NOT_ALLOWED, the preview by email answers 200. SKIPs elsewhere.
    [Tags]    step41    alpha-prep    owner-move
    ${admin}=    Get Admin User    test_admin
    Skip If    ${admin.status_code} != 200    the seed user test_admin exists only on Java
    Should Not Be True    ${admin.json()}[eligible]
    Should Be Equal    ${admin.json()}[reason]    USER_NOT_ALLOWED
    ${a}=    New Owner Guest
    ${match}=    Started Match Of    ${a}
    ${resp}=    Move Owner    ${match}    test_admin    409
    Should Be Equal    ${resp.json()}[error]    USER_NOT_ALLOWED
    ${player}=    Get Admin User    player1@test.local    200
    Should Be Equal    ${player.json()}[email]    player1@test.local


*** Keywords ***

Suite Teardown Owner Move
    [Documentation]    The matches and the story (alpha prep teardown), then the guests of the suite.
    Suite Teardown Alpha Prep
    FOR    ${uuid}    IN    @{CREATED_GUESTS}
        Run Keyword And Ignore Error    Owner Admin Request    DELETE    /api/admin/guests/${uuid}
    END

New Owner Guest
    [Documentation]    A new guest: {accessToken, userUuid, username}, remembered for the teardown.
    ${resp}=    POST On Session    public_session    /api/auth/guest
    Status Should Be    ${resp}    201
    Append To List    ${CREATED_GUESTS}    ${resp.json()}[userUuid]
    RETURN    ${resp.json()}

New Aged Owner Guest
    [Documentation]    A guest registered ${AGE_DAYS} days ago (its cookie has expired).
    ${headers}=    Create Dictionary    X-Test-Guest-Age-Days=${AGE_DAYS}
    ${resp}=    POST On Session    public_session    /api/auth/guest    headers=${headers}
    Status Should Be    ${resp}    201
    Append To List    ${CREATED_GUESTS}    ${resp.json()}[userUuid]
    RETURN    ${resp.json()}

Started Match Of
    [Documentation]    A RUNNING fixture match of the guest with one character, remembered for the teardown.
    [Arguments]    ${guest}
    ${token}=    Set Variable    ${guest}[accessToken]
    Remember Csrf Token    ${token}    ${guest.get('csrfToken', '')}
    ${match}=    Create Match With Rng Seed    ${token}    ${STORY_UUID}    ${DIFFICULTY}
    ...    rng_seed=42    name=robottest_owner_move
    Status Should Be    ${match}    201
    ${uuid}=    Set Variable    ${match.json()}[uuid]
    Append To List    ${CREATED_MATCHES}    ${uuid}
    ${no_traits}=    Create List
    ${join}=    Join Match    ${token}    ${uuid}    ${CHARACTER}    ${CLASS}    ${no_traits}
    Status Should Be    ${join}    201
    Start Match    ${token}    ${uuid}    200
    RETURN    ${uuid}

Owner Admin Request
    [Documentation]    Any admin call with the admin bearer; returns the response (any status).
    [Arguments]    ${method}    ${path}    ${json}=${None}
    ${headers}=    Get Auth Headers    ${ADMIN_TOKEN}
    IF    $json is None
        ${resp}=    Run Keyword    ${method} On Session    admin_session    ${path}
        ...    headers=${headers}    expected_status=any
    ELSE
        ${resp}=    Run Keyword    ${method} On Session    admin_session    ${path}
        ...    headers=${headers}    json=${json}    expected_status=any
    END
    RETURN    ${resp}

Get Owner
    [Documentation]    GET /api/admin/matches/{uuid}/owner.
    [Arguments]    ${match}    ${expected_status}=any
    ${resp}=    Owner Admin Request    GET    /api/admin/matches/${match}/owner
    IF    '${expected_status}' != 'any'    Status Should Be    ${resp}    ${expected_status}
    RETURN    ${resp}

Get Admin User
    [Documentation]    GET /api/admin/users/{identifier}, the identifier URL-encoded.
    [Arguments]    ${identifier}    ${expected_status}=any
    ${encoded}=    Evaluate    urllib.parse.quote($identifier, safe='')    modules=urllib.parse
    ${resp}=    Owner Admin Request    GET    ${USERS_PATH}/${encoded}
    IF    '${expected_status}' != 'any'    Status Should Be    ${resp}    ${expected_status}
    RETURN    ${resp}

Move Owner
    [Documentation]    PUT /api/admin/matches/{uuid}/owner {"user": identifier}.
    [Arguments]    ${match}    ${identifier}    ${expected_status}=any
    ${body}=    Create Dictionary    user=${identifier}
    ${resp}=    Owner Admin Request    PUT    /api/admin/matches/${match}/owner    ${body}
    IF    '${expected_status}' != 'any'    Status Should Be    ${resp}    ${expected_status}
    RETURN    ${resp}

Match Should Be Listed
    [Arguments]    ${token}    ${match}
    ${resp}=    List Matches    ${token}    200
    ${uuids}=    Evaluate    [m.get('uuid') for m in ($resp.json() if isinstance($resp.json(), list) else $resp.json().get('items', []))]
    Should Contain    ${uuids}    ${match}

Match Should Not Be Listed
    [Arguments]    ${token}    ${match}
    ${resp}=    List Matches    ${token}    200
    ${uuids}=    Evaluate    [m.get('uuid') for m in ($resp.json() if isinstance($resp.json(), list) else $resp.json().get('items', []))]
    Should Not Contain    ${uuids}    ${match}

Owner Changed Rows
    [Documentation]    The messages of the ADMIN_ACTION OWNER_CHANGED rows of the admin timeline.
    [Arguments]    ${match}
    ${messages}=    Messages Of Type    ${match}    ADMIN_ACTION
    ${rows}=    Evaluate    [m for m in $messages if str(m or '').startswith('OWNER_CHANGED')]
    RETURN    ${rows}

Newest Owner Snapshot
    [Documentation]    The uuid of the newest snapshot of a match.
    [Arguments]    ${match}
    ${resp}=    Owner Admin Request    GET    /api/admin/matches/${match}/snapshots
    Status Should Be    ${resp}    200
    Should Not Be Empty    ${resp.json()}    msg=no snapshot was written
    RETURN    ${resp.json()}[0][uuid]

Owner Snapshot Request
    [Documentation]    GET .../check or POST .../restore of one snapshot, expecting 200.
    [Arguments]    ${method}    ${match}    ${snapshot}    ${action}
    ${resp}=    Owner Admin Request    ${method}    /api/admin/matches/${match}/snapshots/${snapshot}/${action}
    Status Should Be    ${resp}    200
    RETURN    ${resp}
