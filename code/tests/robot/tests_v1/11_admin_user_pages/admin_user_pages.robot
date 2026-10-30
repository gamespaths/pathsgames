*** Settings ***
# admin_user_pages.robot — v1.7.0 V1 step 11: the exact admin API calls of the react-admin Users pages (search box
# routing, state filter, cursor, detail, match history, dialog reasons and dates, action errors). UI is in Vitest.
Resource   ../../resources/google_sso.resource
Resource   ../../resources/matches.resource
Library    DateTime
Library    String
Library    Collections

Suite Setup       Admin User Pages Suite Setup
Force Tags        v1_step11    admin-user-pages


*** Variables ***
${PAGE_LIMIT}       50
${MATCH_LIMIT}      20


*** Test Cases ***

The Default View Lists Only Active Users And Never The Email
    [Documentation]    UsersPage first load: GET /api/admin/users?limit=50 (no state: the backend default view).
    ${resp}=    List Users    limit=${PAGE_LIMIT}
    Should Be Equal As Integers    ${resp.json()}[limit]    ${PAGE_LIMIT}
    Dictionary Should Contain Key    ${resp.json()}    nextCursor
    FOR    ${row}    IN    @{resp.json()}[items]
        Should Be Equal As Integers    ${row}[state]    2
        Dictionary Should Not Contain Key    ${row}    email
        Dictionary Should Contain Key    ${row}    nickname
        Dictionary Should Contain Key    ${row}    accountType
    END

A Search With An At Sign Is An Exact Email Lookup
    [Documentation]    The search box sends the lowercase email alone (no state); an unknown email is an empty page.
    ${hit}=    List Users    limit=${PAGE_LIMIT}    email=${EMAIL_A}
    Length Should Be    ${hit.json()}[items]    1
    Should Be Equal    ${hit.json()}[items][0][uuid]    ${UUID_A}
    Dictionary Should Not Contain Key    ${hit.json()}[items][0]    email
    Should Be Equal    ${hit.json()}[nextCursor]    ${None}
    ${miss}=    List Users    limit=${PAGE_LIMIT}    email=robottest.nobody.${SHARED}@gmail.com
    Should Be Empty    ${miss.json()}[items]

A Nickname Prefix With The State Filter Pages Alphabetically With The Cursor
    [Documentation]    The search box without "@" sends nickname + state (2 by default); Load more sends the
    ...                nextCursor of the previous page. Three users sharing the prefix come back a, b, c.
    Wait Until Keyword Succeeds    20s    1s    Prefix Should List    ${PREFIX}    2    ${3}
    ${seen}=    Follow Cursor    nickname=${PREFIX}    state=2    limit=1
    ${expected}=    Create List    ${UUID_A}    ${UUID_B}    ${UUID_C}
    Lists Should Be Equal    ${seen}    ${expected}
    ${banned}=    List Users    limit=${PAGE_LIMIT}    nickname=${PREFIX}    state=4
    Should Be Empty    ${banned.json()}[items]

The Suspend Dialog Sends Tomorrow And Today Plus 90 Days But Never Today
    [Documentation]    The date picker allows tomorrow .. today + 90 days (UTC); today and day 91 are refused.
    ${today}=    Get Current Date    UTC    result_format=%Y-%m-%d
    ${refused}=    User Action    ${UUID_B}    suspend    reason=Abuse: robot test, today is refused    until=${today}
    Action Error Should Be    ${refused}    400    SUSPEND_UNTIL_INVALID
    ${day91}=    Get Current Date    UTC    increment=91 days    result_format=%Y-%m-%d
    ${far}=    User Action    ${UUID_B}    suspend    reason=Abuse: robot test, too far away    until=${day91}
    Action Error Should Be    ${far}    400    SUSPEND_UNTIL_INVALID
    ${day90}=    Get Current Date    UTC    increment=90 days    result_format=%Y-%m-%d
    ${max}=    User Action    ${UUID_B}    suspend    reason=Abuse: robot test, the last day    until=${day90}
    Status Should Be    ${max}    200
    ${tomorrow}=    Get Current Date    UTC    increment=1 day    result_format=%Y-%m-%d
    ${min}=    User Action    ${UUID_B}    suspend    reason=Abuse: robot test, the first day    until=${tomorrow}
    Status Should Be    ${min}    200
    Should Be Equal As Integers    ${min.json()}[state]    3
    Should Start With    ${min.json()}[suspendedUntil]    ${tomorrow}
    ${detail}=    User Detail    ${UUID_B}
    Should Be Equal As Integers    ${detail}[state]    3
    Should Start With    ${detail}[suspendedUntil]    ${tomorrow}
    [Teardown]    User Action    ${UUID_B}    unblock    reason=Other: robot test teardown

The Suspended Filter Finds The User And Unblock Twice Is A State Error
    [Documentation]    State filter "Suspended" with and without the search; the dialog error of a second unblock.
    ${until}=    Get Current Date    UTC    increment=7 days    result_format=%Y-%m-%d
    ${done}=    User Action    ${UUID_C}    suspend    reason=Security: robot test suspension    until=${until}
    Status Should Be    ${done}    200
    ${row}=    Wait Until Keyword Succeeds    20s    1s    Row In List    ${UUID_C}    nickname=${PREFIX}    state=3
    Should Start With    ${row}[suspendedUntil]    ${until}
    ${only_state}=    List Users    limit=${PAGE_LIMIT}    state=3
    FOR    ${item}    IN    @{only_state.json()}[items]
        Should Be Equal As Integers    ${item}[state]    3
    END
    ${unblock}=    User Action    ${UUID_C}    unblock    reason=Other: robot test appeal accepted
    Status Should Be    ${unblock}    200
    Should Be Equal As Integers    ${unblock.json()}[state]    2
    ${again}=    User Action    ${UUID_C}    unblock    reason=Other: robot test second unblock
    Action Error Should Be    ${again}    409    INVALID_STATE_TRANSITION

The Composed Reason Fits The 500 Character Limit
    [Documentation]    "Support request: " plus the longest free text the dialog allows is exactly 500 characters.
    ${free}=    Evaluate    'x' * (500 - len('Support request: '))
    ${long}=    User Action    ${UUID_A}    relink-subject    reason=Support request: ${free}x
    Action Error Should Be    ${long}    400    INVALID_INPUT
    ${armed}=    User Action    ${UUID_A}    relink-subject    reason=Support request: ${free}
    Status Should Be    ${armed}    200
    Should Be True    ${armed.json()}[relinkPending]
    ${detail}=    User Detail    ${UUID_A}
    Should Be True    ${detail}[relinkPending]

The Detail Page Reads Email, Identities, Statistics And Sessions
    ${detail}=    User Detail    ${UUID_A}
    Should Be Equal    ${detail}[email]    ${EMAIL_A}
    Should Be Equal    ${detail}[accountType]    GOOGLE
    Should Be Equal    ${detail}[role]    PLAYER
    Should Be Equal    ${detail}[identities][0][provider]    GOOGLE
    Dictionary Should Contain Key    ${detail}    banned
    Dictionary Should Contain Key    ${detail}    tsLastAccess
    Should Be True    ${detail}[sessions] >= 1
    FOR    ${key}    IN    matchesPlayed    matchesCompleted    matchesGameOver    playTimeMs    clocksPlayed
        Dictionary Should Contain Key    ${detail}[stats]    ${key}
    END

The Match History Shows The Banned Match And The Banned Filter Finds The User
    [Documentation]    Detail page match history: GET /api/admin/matches?userUuid=&limit=20; a ban turns the active
    ...                match into BANNED, the "Banned" filter lists the user, and the match stays BANNED after unblock.
    ${own}=    Generate Random String    8    [LOWER][NUMBERS]
    ${resp}    ${email}    ${sub}=    Login As Google User    ${own}
    ${uuid}=    Set Variable    ${resp.json()}[userUuid]
    ${match}=    Create Match    ${resp.json()}[accessToken]    ${STORY_UUID}    ${DIFFICULTY_UUID}
    ...    name=robottest_user_pages
    Status Should Be    ${match}    201
    ${history}=    Match History    ${uuid}
    Should Be Equal As Integers    ${history.json()}[limit]    ${MATCH_LIMIT}
    ${ban}=    User Action    ${uuid}    ban    reason=Cheating: robot test of the user pages
    Status Should Be    ${ban}    200
    List Should Contain Value    ${ban.json()}[bannedMatchUuids]    ${match.json()}[uuid]
    ${row}=    Match Row    ${uuid}    ${match.json()}[uuid]
    Should Be Equal    ${row}[status]    BANNED
    Dictionary Should Contain Key    ${row}    tsUpdate
    Dictionary Should Contain Key    ${row}    currentClock
    Wait Until Keyword Succeeds    20s    1s    Row In List    ${uuid}    nickname=robottest.${own}    state=4
    ${twice}=    User Action    ${uuid}    ban    reason=Cheating: robot test, already banned
    Action Error Should Be    ${twice}    409    INVALID_STATE_TRANSITION
    User Action    ${uuid}    unblock    reason=Other: robot test appeal accepted
    ${after}=    Match Row    ${uuid}    ${match.json()}[uuid]
    Should Be Equal    ${after}[status]    BANNED

Guests And Admins Get The Error Codes The Dialogs Show
    [Documentation]    GUEST_NOT_BANNABLE for a guest, ADMIN_NOT_BANNABLE for the deletion of an ADMIN, and a guest
    ...                detail is accountType GUEST (the page offers no action).
    ${guest}=    POST On Session    public_session    /api/auth/guest    timeout=${HTTP_POST_TIMEOUT}
    Status Should Be    ${guest}    201
    ${guest_uuid}=    Set Variable    ${guest.json()}[userUuid]
    ${ban}=    User Action    ${guest_uuid}    ban    reason=Spam: robot test guest ban
    Action Error Should Be    ${ban}    400    GUEST_NOT_BANNABLE
    ${detail}=    User Detail    ${guest_uuid}
    Should Be Equal    ${detail}[accountType]    GUEST
    Should Be True    ${detail}[guest]
    ${me}=    Call Me Endpoint    ${ADMIN_TOKEN}
    ${deletion}=    User Action    ${me.json()}[userUuid]    deletion    reason=Other: robot test, never an admin
    Action Error Should Be    ${deletion}    400    ADMIN_NOT_BANNABLE


*** Keywords ***

Admin User Pages Suite Setup
    Create Public Session
    Create Admin Session
    Create Dev Session
    ${story}    ${difficulty}=    Pick First Public Story With Difficulty
    Set Suite Variable    ${STORY_UUID}    ${story}
    Set Suite Variable    ${DIFFICULTY_UUID}    ${difficulty}
    ${shared}=    Generate Random String    8    [LOWER][NUMBERS]
    Set Suite Variable    ${SHARED}    ${shared}
    Set Suite Variable    ${PREFIX}    robottest.${shared}
    ${resp_a}    ${email_a}    ${sub_a}=    Login As Google User    ${shared}a
    ${resp_b}    ${email_b}    ${sub_b}=    Login As Google User    ${shared}b
    ${resp_c}    ${email_c}    ${sub_c}=    Login As Google User    ${shared}c
    Set Suite Variable    ${UUID_A}    ${resp_a.json()}[userUuid]
    Set Suite Variable    ${UUID_B}    ${resp_b.json()}[userUuid]
    Set Suite Variable    ${UUID_C}    ${resp_c.json()}[userUuid]
    Set Suite Variable    ${EMAIL_A}    ${email_a}

Login As Google User
    [Documentation]    A new Google user robottest.<suffix>@gmail.com: (login response, email, subject).
    [Arguments]    ${suffix}
    ${email}=    Set Variable    robottest.${suffix}@gmail.com
    ${sub}=    Set Variable    sub-robottest-${suffix}
    ${token}=    Fake Google Token    sub=${sub}    email=${email}    nonce=robot-nonce
    ${resp}=    Google Login    ${token}
    Status Should Be    ${resp}    200
    RETURN    ${resp}    ${email}    ${sub}

List Users
    [Documentation]    GET /api/admin/users with the query parameters of the Users page.
    [Arguments]    &{params}
    ${resp}=    GET On Session    admin_session    /api/admin/users    params=${params}    expected_status=200
    RETURN    ${resp}

Prefix Should List
    [Documentation]    The nickname prefix with the state lists exactly ${count} users (GSI lag on AWS).
    [Arguments]    ${prefix}    ${state}    ${count}
    ${resp}=    List Users    limit=${PAGE_LIMIT}    nickname=${prefix}    state=${state}
    Length Should Be    ${resp.json()}[items]    ${count}

Follow Cursor
    [Documentation]    The uuids of every page of a query, following nextCursor (at most 10 pages).
    [Arguments]    &{params}
    ${seen}=    Create List
    FOR    ${i}    IN RANGE    10
        ${resp}=    List Users    &{params}
        FOR    ${row}    IN    @{resp.json()}[items]
            Append To List    ${seen}    ${row}[uuid]
        END
        ${next}=    Set Variable    ${resp.json()}[nextCursor]
        IF    $next is None    BREAK
        Set To Dictionary    ${params}    cursor=${next}
    END
    RETURN    ${seen}

Row In List
    [Documentation]    The row of the user in GET /api/admin/users with these filters; fails when missing.
    [Arguments]    ${uuid}    &{params}
    ${resp}=    List Users    limit=${PAGE_LIMIT}    &{params}
    FOR    ${row}    IN    @{resp.json()}[items]
        IF    '${row}[uuid]' == '${uuid}'    RETURN    ${row}
    END
    Fail    User ${uuid} not in the page

User Detail
    [Documentation]    GET /api/admin/users/{uuid}: the body the detail page reads.
    [Arguments]    ${uuid}
    ${resp}=    GET On Session    admin_session    /api/admin/users/${uuid}    expected_status=200
    RETURN    ${resp.json()}

User Action
    [Documentation]    POST /api/admin/users/{uuid}/{action} {reason[, until]} as the dialogs send it; any status.
    [Arguments]    ${uuid}    ${action}    ${reason}    ${until}=${EMPTY}
    &{body}=    Create Dictionary    reason=${reason}
    IF    '${until}' != ''    Set To Dictionary    ${body}    until=${until}
    ${resp}=    POST On Session    admin_session    /api/admin/users/${uuid}/${action}    json=${body}
    ...    expected_status=any    timeout=${HTTP_POST_TIMEOUT}
    RETURN    ${resp}

Action Error Should Be
    [Documentation]    The refusal status and the error code the page maps to its message.
    [Arguments]    ${resp}    ${status}    ${code}
    Status Should Be    ${resp}    ${status}
    Should Be Equal    ${resp.json()}[error]    ${code}

Match History
    [Documentation]    GET /api/admin/matches?userUuid=&limit=20, the first page of the detail page history.
    [Arguments]    ${user_uuid}
    &{params}=    Create Dictionary    userUuid=${user_uuid}    limit=${MATCH_LIMIT}
    ${resp}=    GET On Session    admin_session    /api/admin/matches    params=${params}    expected_status=200
    RETURN    ${resp}

Match Row
    [Documentation]    The row of the match in the user's match history; fails when missing.
    [Arguments]    ${user_uuid}    ${match_uuid}
    ${resp}=    Match History    ${user_uuid}
    FOR    ${row}    IN    @{resp.json()}[items]
        IF    '${row}[uuid]' == '${match_uuid}'    RETURN    ${row}
    END
    Fail    Match ${match_uuid} not in the history of ${user_uuid}
