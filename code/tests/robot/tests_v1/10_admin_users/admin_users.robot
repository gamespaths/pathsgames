*** Settings ***
# admin_users.robot — v1.7.0 V1 step 10: admin user management on the admin port: list and search (no email,
# guests refused), ban (both hashes refuse a new account with the same email), unblock, suspend with until,
# IDENTITY_MISMATCH re-link and deletion, an ADMIN can never be banned. Log rows: unit tests only (step 14 lists).
Resource   ../../resources/google_sso.resource
Resource   ../../resources/matches.resource
Library    DateTime

Suite Setup       Admin Users Suite Setup
Force Tags        v1_step10    admin-users


*** Test Cases ***

A New Google User Is Found By Nickname Prefix, Email And State
    [Documentation]    GET /api/admin/users: cursor envelope, no email in the rows; the nickname prefix, the
    ...                exact email and the state filter find the user right after its first login.
    ${resp}    ${email}    ${sub}=    Login As New Google User
    ${uuid}=    Set Variable    ${resp.json()}[userUuid]
    ${nickname}=    Set Variable    ${resp.json()}[nickname]
    ${prefix}=    Get Substring    ${nickname}    0    18
    # AWS reads a GSI (eventually consistent): the first lookups retry for a few seconds
    ${row}=    Wait Until Keyword Succeeds    15s    1s    Listed Row    ${uuid}    nickname=${prefix}
    Should Be Equal    ${row}[nickname]    ${nickname}
    Should Be Equal As Integers    ${row}[state]    2
    Dictionary Should Not Contain Key    ${row}    email
    ${by_email}=    List Admin Users    email=${email}
    Length Should Be    ${by_email.json()}[items]    1
    Should Be Equal    ${by_email.json()}[items][0][uuid]    ${uuid}
    Wait Until Keyword Succeeds    15s    1s    Listed Row    ${uuid}    nickname=${prefix}    state=2
    ${none}=    List Admin Users    nickname=${prefix}    state=3
    Should Be Empty    ${none.json()}[items]

The Users List Pages With A Cursor And Refuses Guests
    [Documentation]    limit=1 answers a nextCursor and a different second page; state 6 is 400 INVALID_INPUT.
    Login As New Google User
    Login As New Google User
    ${first}=    List Admin Users    limit=1
    Length Should Be    ${first.json()}[items]    1
    Should Not Be Equal    ${first.json()}[nextCursor]    ${None}
    ${second}=    List Admin Users    limit=1    cursor=${first.json()}[nextCursor]
    Should Not Be Equal    ${second.json()}[items][0][uuid]    ${first.json()}[items][0][uuid]
    ${guests}=    List Admin Users    expected_status=400    state=6
    Should Be Equal    ${guests.json()}[error]    INVALID_INPUT

The User Detail Carries Identities, Stats And Sessions
    ${resp}    ${email}    ${sub}=    Login As New Google User
    ${detail}=    GET On Session    admin_session    /api/admin/users/${resp.json()}[userUuid]    expected_status=200
    Should Be Equal    ${detail.json()}[email]    ${email}
    Should Be Equal    ${detail.json()}[accountType]    GOOGLE
    Should Be Equal    ${detail.json()}[identities][0][subject]    ${sub}
    Should Be True    ${detail.json()}[sessions] >= 1
    Dictionary Should Contain Key    ${detail.json()}[stats]    matchesPlayed

A Banned User Cannot Sign In, Not Even With A New Account On The Same Email
    [Documentation]    Ban: state 4, sessions revoked, the active match becomes BANNED; the same sub and the
    ...                same email with another sub both answer 403 ACCOUNT_DISABLED. Unblock lets the user in
    ...                again and the match stays BANNED.
    ${resp}    ${email}    ${sub}=    Login As New Google User
    ${uuid}=    Set Variable    ${resp.json()}[userUuid]
    ${match}=    Create Match    ${resp.json()}[accessToken]    ${STORY_UUID}    ${DIFFICULTY_UUID}
    ...    name=robottest_admin_ban
    Status Should Be    ${match}    201
    ${ban}=    User Action    ${uuid}    ban    reason=Robot test: cheating
    Status Should Be    ${ban}    200
    Should Be Equal As Integers    ${ban.json()}[state]    4
    List Should Contain Value    ${ban.json()}[bannedMatchUuids]    ${match.json()}[uuid]
    Admin Match Status Should Be    ${uuid}    ${match.json()}[uuid]    BANNED
    ${me}=    Call Me Endpoint With Any Status    ${resp.json()}[accessToken]
    Should Be True    ${me.status_code} in (401, 403)
    ${again}=    Fake Google Token    sub=${sub}    email=${email}    nonce=robot-nonce
    ${same_sub}=    Google Login    ${again}
    Google Error Should Be    ${same_sub}    403    ACCOUNT_DISABLED
    ${other}=    Fake Google Token    sub=${sub}-new-account    email=${email}    nonce=robot-nonce
    ${same_email}=    Google Login    ${other}
    Google Error Should Be    ${same_email}    403    ACCOUNT_DISABLED
    ${twice}=    User Action    ${uuid}    ban    reason=Robot test: again
    Status Should Be    ${twice}    409
    ${unblock}=    User Action    ${uuid}    unblock    reason=Robot test: appeal accepted
    Status Should Be    ${unblock}    200
    ${back}=    Fake Google Token    sub=${sub}    email=${email}    nonce=robot-nonce
    ${login}=    Google Login    ${back}
    Status Should Be    ${login}    200
    Should Be Equal    ${login.json()}[userUuid]    ${uuid}
    Admin Match Status Should Be    ${uuid}    ${match.json()}[uuid]    BANNED

A Suspended User Is Refused Until The Date
    [Documentation]    until is mandatory, in the future and at most 90 days away; a suspended login answers
    ...                403 ACCOUNT_DISABLED with suspendedUntil; unblock lets the user in again.
    ${resp}    ${email}    ${sub}=    Login As New Google User
    ${uuid}=    Set Variable    ${resp.json()}[userUuid]
    ${missing}=    User Action    ${uuid}    suspend    reason=Robot test: no date
    Should Be Equal    ${missing.json()}[error]    SUSPEND_UNTIL_INVALID
    ${far}=    Get Current Date    UTC    increment=120 days    result_format=%Y-%m-%d
    ${too_far}=    User Action    ${uuid}    suspend    reason=Robot test: far    until=${far}
    Should Be Equal    ${too_far.json()}[error]    SUSPEND_UNTIL_INVALID
    ${until}=    Get Current Date    UTC    increment=7 days    result_format=%Y-%m-%d
    ${done}=    User Action    ${uuid}    suspend    reason=Robot test: rude words    until=${until}
    Status Should Be    ${done}    200
    Should Be Equal As Integers    ${done.json()}[state]    3
    ${token}=    Fake Google Token    sub=${sub}    email=${email}    nonce=robot-nonce
    ${refused}=    Google Login    ${token}
    Google Error Should Be    ${refused}    403    ACCOUNT_DISABLED
    Should Start With    ${refused.json()}[suspendedUntil]    ${until}
    ${listed}=    Wait Until Keyword Succeeds    15s    1s    Listed Row    ${uuid}    state=3
    ...    nickname=${resp.json()}[nickname]
    Should Start With    ${listed}[suspendedUntil]    ${until}
    User Action    ${uuid}    unblock    reason=Robot test: lifted
    ${again}=    Fake Google Token    sub=${sub}    email=${email}    nonce=robot-nonce
    ${back}=    Google Login    ${again}
    Status Should Be    ${back}    200

An Identity Mismatch Is Resolved By A One-Time Re-Link
    [Documentation]    Another subject on the same email is 409 IDENTITY_MISMATCH; after relink-subject the next
    ...                login with the new subject is the same user, and the old subject is now the mismatch.
    ${resp}    ${email}    ${sub}=    Login As New Google User
    ${uuid}=    Set Variable    ${resp.json()}[userUuid]
    ${new_sub}=    Set Variable    ${sub}-relinked
    ${token}=    Fake Google Token    sub=${new_sub}    email=${email}    nonce=robot-nonce
    ${mismatch}=    Google Login    ${token}
    Google Error Should Be    ${mismatch}    409    IDENTITY_MISMATCH
    ${armed}=    User Action    ${uuid}    relink-subject    reason=Robot test: new Google account
    Should Be True    ${armed.json()}[relinkPending]
    ${relinked_token}=    Fake Google Token    sub=${new_sub}    email=${email}    nonce=robot-nonce
    ${relinked}=    Google Login    ${relinked_token}
    Status Should Be    ${relinked}    200
    Should Be Equal    ${relinked.json()}[userUuid]    ${uuid}
    ${old_token}=    Fake Google Token    sub=${sub}    email=${email}    nonce=robot-nonce
    ${old}=    Google Login    ${old_token}
    Google Error Should Be    ${old}    409    IDENTITY_MISMATCH

The Old User Of A Mismatch Is Deleted By The Deletion Job
    ${resp}    ${email}    ${sub}=    Login As New Google User
    ${uuid}=    Set Variable    ${resp.json()}[userUuid]
    ${done}=    User Action    ${uuid}    deletion    reason=Robot test: old user of a mismatch
    Should Be Equal As Integers    ${done.json()}[state]    7
    Run Account Deletion Job
    GET On Session    admin_session    /api/admin/users/${uuid}    expected_status=404

An Admin Can Never Be Banned Or Suspended
    ${me}=    Call Me Endpoint    ${ADMIN_TOKEN}
    ${admin_uuid}=    Set Variable    ${me.json()}[userUuid]
    ${ban}=    User Action    ${admin_uuid}    ban    reason=Robot test: never
    Status Should Be    ${ban}    400
    Should Be Equal    ${ban.json()}[error]    ADMIN_NOT_BANNABLE
    ${until}=    Get Current Date    UTC    increment=7 days    result_format=%Y-%m-%d
    ${suspend}=    User Action    ${admin_uuid}    suspend    reason=Robot test: never    until=${until}
    Should Be Equal    ${suspend.json()}[error]    ADMIN_NOT_BANNABLE

A Reason Is Mandatory And An Unknown User Is 404
    ${resp}    ${email}    ${sub}=    Login As New Google User
    ${empty}=    User Action    ${resp.json()}[userUuid]    ban
    Status Should Be    ${empty}    400
    Should Be Equal    ${empty.json()}[error]    INVALID_INPUT
    ${ghost}=    User Action    00000000-0000-4000-8000-000000000000    ban    reason=Robot test: nobody
    Status Should Be    ${ghost}    404
    Should Be Equal    ${ghost.json()}[error]    USER_NOT_FOUND


*** Keywords ***

Admin Users Suite Setup
    Create Public Session
    Create Admin Session
    Create Dev Session
    ${story}    ${difficulty}=    Pick First Public Story With Difficulty
    Set Suite Variable    ${STORY_UUID}    ${story}
    Set Suite Variable    ${DIFFICULTY_UUID}    ${difficulty}

List Admin Users
    [Documentation]    GET /api/admin/users with the given query parameters (admin port).
    [Arguments]    ${expected_status}=200    &{params}
    ${resp}=    GET On Session    admin_session    /api/admin/users    params=${params}    expected_status=${expected_status}
    RETURN    ${resp}

Call Me Endpoint With Any Status
    [Documentation]    GET /api/auth/me with the token; any status (a revoked or banned user is refused).
    [Arguments]    ${token}
    ${headers}=    Get Auth Headers    ${token}
    ${resp}=    GET On Session    public_session    /api/auth/me    headers=${headers}    expected_status=any
    RETURN    ${resp}

Listed Row
    [Documentation]    The row of the user in GET /api/admin/users with these filters (envelope limit 50).
    [Arguments]    ${uuid}    &{params}
    ${resp}=    List Admin Users    &{params}
    Should Be Equal As Integers    ${resp.json()}[limit]    50
    ${row}=    Row Of User    ${resp}    ${uuid}
    RETURN    ${row}

Row Of User
    [Documentation]    The list row of the user; fails when the page does not hold it.
    [Arguments]    ${resp}    ${uuid}
    FOR    ${row}    IN    @{resp.json()}[items]
        IF    '${row}[uuid]' == '${uuid}'    RETURN    ${row}
    END
    Fail    User ${uuid} not in the page

User Action
    [Documentation]    POST /api/admin/users/{uuid}/{action} with {reason, until}; any status.
    [Arguments]    ${uuid}    ${action}    ${reason}=${EMPTY}    ${until}=${EMPTY}
    &{body}=    Create Dictionary
    IF    '${reason}' != ''    Set To Dictionary    ${body}    reason=${reason}
    IF    '${until}' != ''    Set To Dictionary    ${body}    until=${until}
    ${resp}=    POST On Session    admin_session    /api/admin/users/${uuid}/${action}    json=${body}
    ...    expected_status=any    timeout=${HTTP_POST_TIMEOUT}
    RETURN    ${resp}

Admin Match Status Should Be
    [Documentation]    The status of the user's match in GET /api/admin/matches?userUuid=.
    [Arguments]    ${user_uuid}    ${match_uuid}    ${status}
    &{params}=    Create Dictionary    userUuid=${user_uuid}
    ${resp}=    GET On Session    admin_session    /api/admin/matches    params=${params}    expected_status=200
    FOR    ${row}    IN    @{resp.json()}[items]
        IF    '${row}[uuid]' == '${match_uuid}'
            Should Be Equal    ${row}[status]    ${status}
            RETURN
        END
    END
    Fail    Match ${match_uuid} not in the admin list
