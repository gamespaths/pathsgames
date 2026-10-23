*** Settings ***
# multi_device.robot — v1.7.0 V1 step 12: one Google user on three devices (scenario A, B, C, B, A), "log out of
# all devices", the cap of 12 sessions (SESSION_LIMIT), activeSessions, refresh lifetimes, admin paging and filters.
Resource   ../../resources/google_sso.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource

Suite Setup       Multi Device Suite Setup
Force Tags        v1_step12    multi-device


*** Variables ***
${DAY_MS}             86400000
${REFRESH_MAX_AGE}    Max-Age=21600000


*** Test Cases ***

Scenario A B C B A Every Device Sees The Last Move
    [Documentation]    A creates and moves; B sees it and moves; C sees it and moves; B writes with its old
    ...                version and gets 409 STALE_MATCH; B refetches and moves; A refetches and sees B's move.
    ${a}    ${b}    ${c}=    Three Devices Of One Player
    ${match}    ${v0}=    Started Match Of    ${a}[accessToken]
    ${a_move}=    Versioned Write    ${a}[accessToken]    /api/gameplay/${match}/action/pass    ${v0}
    Status Should Be    ${a_move}    200
    ${v1}=    Set Variable    ${a_move.json()}[matchVersion]
    ${b_seen}=    Version Seen By    ${b}[accessToken]    ${match}
    Should Be Equal    ${b_seen}    ${v1}
    ${b_move}=    Versioned Write    ${b}[accessToken]    /api/gameplay/${match}/action/pass    ${b_seen}
    Status Should Be    ${b_move}    200
    ${v2}=    Set Variable    ${b_move.json()}[matchVersion]
    ${c_seen}=    Version Seen By    ${c}[accessToken]    ${match}
    Should Be Equal    ${c_seen}    ${v2}
    ${c_move}=    Versioned Write    ${c}[accessToken]    /api/gameplay/${match}/action/pass    ${c_seen}
    Status Should Be    ${c_move}    200
    ${v3}=    Set Variable    ${c_move.json()}[matchVersion]
    ${stale}=    Versioned Write    ${b}[accessToken]    /api/gameplay/${match}/action/pass    ${v2}
    Status Should Be    ${stale}    409
    Should Be Equal    ${stale.json()}[error]    STALE_MATCH
    Should Be Equal    ${stale.json()}[matchVersion]    ${v3}
    ${b_again}=    Version Seen By    ${b}[accessToken]    ${match}
    Should Be Equal    ${b_again}    ${v3}
    ${b_retry}=    Versioned Write    ${b}[accessToken]    /api/gameplay/${match}/action/pass    ${b_again}
    Status Should Be    ${b_retry}    200
    ${a_seen}=    Version Seen By    ${a}[accessToken]    ${match}
    Should Be Equal    ${a_seen}    ${b_retry.json()}[matchVersion]
    Should Not Be Equal    ${a_seen}    ${v1}

Me Counts The Active Sessions
    [Documentation]    GET /api/auth/me adds activeSessions: the sessions used in the last 30 days.
    ${a}    ${b}    ${c}=    Three Devices Of One Player
    ${me}=    Call Me Endpoint    ${c}[accessToken]
    Status Should Be    ${me}    200
    Should Be Equal As Integers    ${me.json()}[activeSessions]    3

Log Out Of All Devices Closes Every Session
    [Documentation]    After "log out of all devices" on A, every refresh cookie answers SESSION_REVOKED and every
    ...                access token issued before answers 401 SESSION_REVOKED (sessions_valid_after).
    ${a}    ${b}    ${c}=    Three Devices Of One Player
    # the tokens must be older than the second of sessions_valid_after (a token of that same second is valid)
    Sleep    1.2s
    ${headers}=    Get Auth Headers    ${a}[accessToken]
    ${out}=    POST On Session    public_session    /api/auth/logout/all    headers=${headers}
    ...    expected_status=any    timeout=${HTTP_POST_TIMEOUT}
    Should Be True    ${out.status_code} == 200 or ${out.status_code} == 204
    FOR    ${device}    IN    ${a}    ${b}    ${c}
        ${refresh}=    Refresh With Cookie Pair    ${device}[cookie]
        Status Should Be    ${refresh}    401
        Should Be Equal    ${refresh.json()}[error]    SESSION_REVOKED
        Wait Until Keyword Succeeds    5x    1s    Access Token Should Be Revoked    ${device}[accessToken]
    END
    ${login}=    Google Login    ${a}[idTokenAgain]
    Status Should Be    ${login}    200
    ${me}=    Call Me Endpoint    ${login.json()}[accessToken]
    Status Should Be    ${me}    200

Thirteen Logins Make The First Session Answer Session Limit
    [Documentation]    The cap is 12 sessions per user: the 13th login revokes the least recently refreshed one,
    ...                whose refresh answers 401 SESSION_LIMIT; the newest one still refreshes. The run scripts
    ...                set RATE_LIMIT_GOOGLE_PER_IP=0, and this suite logs in at most 20 times (default limit 30).
    ${email}    ${sub}=    New Robot Gmail
    @{cookies}=    Create List
    FOR    ${i}    IN RANGE    13
        ${device}=    Google Device    ${email}    ${sub}
        Append To List    ${cookies}    ${device}[cookie]
        ${last}=    Set Variable    ${device}
    END
    ${first}=    Refresh With Cookie Pair    ${cookies}[0]
    Status Should Be    ${first}    401
    Should Be Equal    ${first.json()}[error]    SESSION_LIMIT
    ${me}=    Call Me Endpoint    ${last}[accessToken]
    Should Be Equal As Integers    ${me.json()}[activeSessions]    12
    ${newest}=    Refresh With Cookie Pair    ${cookies}[12]
    Status Should Be    ${newest}    200

The Refresh Cookie Lives 250 Days And A Guest Token 180
    [Documentation]    A Google refresh token lasts 250 days (cookie Max-Age too, renewed at each refresh); a guest
    ...                refresh token is capped at 180 days like the guest cookie.
    ${now}=    Evaluate    int(__import__('time').time() * 1000)
    ${email}    ${sub}=    New Robot Gmail
    ${device}=    Google Device    ${email}    ${sub}
    ${expires}=    Set Variable    ${device}[refreshTokenExpiresAt]
    Should Be True    abs(${expires} - ${now} - 250 * ${DAY_MS}) < ${DAY_MS}
    Should Contain    ${device}[setCookie]    ${REFRESH_MAX_AGE}
    ${refreshed}=    Refresh With Cookie Pair    ${device}[cookie]
    Status Should Be    ${refreshed}    200
    Should Contain    ${refreshed.headers}[Set-Cookie]    ${REFRESH_MAX_AGE}
    Create Http Session    guest_lifetime    ${BASE_URL}    verify=false
    ${guest}=    POST On Session    guest_lifetime    /api/auth/guest    timeout=${HTTP_POST_TIMEOUT}
    Status Should Be    ${guest}    201
    Should Be True    ${guest.json()}[refreshTokenExpiresAt] - ${now} <= 180 * ${DAY_MS} + 60000

Admin Stories Answer The Cursor Envelope
    [Documentation]    GET /api/admin/stories answers {items, nextCursor, limit}; the cursor reads the next page.
    ${headers}=    Get Auth Headers    ${ADMIN_TOKEN}
    ${params}=    Create Dictionary    lang=en    limit=1
    ${first}=    GET On Session    admin_session    /api/admin/stories    params=${params}    headers=${headers}
    ...    expected_status=200
    Should Be Equal As Integers    ${first.json()}[limit]    1
    ${count}=    Get Length    ${first.json()}[items]
    Should Be True    ${count} <= 1
    ${cursor}=    Evaluate    $first.json().get('nextCursor')
    IF    $cursor is not None
        Set To Dictionary    ${params}    cursor=${cursor}
        ${second}=    GET On Session    admin_session    /api/admin/stories    params=${params}    headers=${headers}
        ...    expected_status=200
        Should Not Be Equal    ${second.json()}[items][0][uuid]    ${first.json()}[items][0][uuid]
    END
    ${all}=    Get All Admin Story Uuids
    Should Contain    ${all}    ${STORY_UUID}

Admin Matches Filter By User And Story On The Server
    [Documentation]    userUuid and storyUuid are applied by the server; a page may hold fewer items than the
    ...                limit while nextCursor is set, so the pages are followed.
    ${a}    ${b}    ${c}=    Three Devices Of One Player
    ${match}    ${version}=    Started Match Of    ${a}[accessToken]
    ${by_user}=    Admin Match Uuids    userUuid=${a}[userUuid]
    Should Contain    ${by_user}[uuids]    ${match}
    ${only_a}=    Evaluate    {$a['userUuid']}
    Should Be Equal    ${by_user}[creators]    ${only_a}
    ${by_both}=    Admin Match Uuids    userUuid=${a}[userUuid]    storyUuid=${STORY_UUID}
    Should Contain    ${by_both}[uuids]    ${match}
    ${by_story}=    Admin Match Uuids    storyUuid=${STORY_UUID}    sinceDays=1
    Should Contain    ${by_story}[uuids]    ${match}
    ${only_story}=    Evaluate    {$STORY_UUID}
    Should Be Equal    ${by_story}[stories]    ${only_story}
    ${other}=    Admin Match Uuids    userUuid=${a}[userUuid]    storyUuid=00000000-0000-4000-8000-000000000000
    Should Not Contain    ${other}[uuids]    ${match}


*** Keywords ***

Multi Device Suite Setup
    Create Public Session
    Create Admin Session
    Create Dev Session
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}       ${story}
    Set Suite Variable    ${DIFFICULTY_UUID}  ${difficulty}
    Set Suite Variable    ${CHARACTER_UUID}   ${character}
    Set Suite Variable    ${CLASS_UUID}       ${class}
    Set Suite Variable    ${TRAIT_UUID}       ${trait}

Google Device
    [Documentation]    One more device of the fake Google account: its tokens, refresh cookie and a spare ID token.
    [Arguments]    ${email}    ${sub}
    ${id_token}=    Fake Google Token    sub=${sub}    email=${email}    nonce=robot-nonce    given_name=Robot
    ${resp}=    Google Login    ${id_token}
    Status Should Be    ${resp}    200
    ${again}=    Fake Google Token    sub=${sub}    email=${email}    nonce=robot-nonce    given_name=Robot
    ${pair}=    Evaluate    next((f"{k}={v}" for k, v in $resp.cookies.items() if 'refresh' in k.lower()), '')
    Should Not Be Empty    ${pair}
    &{device}=    Create Dictionary    accessToken=${resp.json()}[accessToken]    userUuid=${resp.json()}[userUuid]
    ...    cookie=${pair}    refreshTokenExpiresAt=${resp.json()}[refreshTokenExpiresAt]
    ...    setCookie=${resp.headers}[Set-Cookie]    idTokenAgain=${again}
    RETURN    ${device}

Three Devices Of One Player
    [Documentation]    One new fake Google account signed in on three devices (A, B, C).
    ${email}    ${sub}=    New Robot Gmail
    ${a}=    Google Device    ${email}    ${sub}
    ${b}=    Google Device    ${email}    ${sub}
    ${c}=    Google Device    ${email}    ${sub}
    Should Be Equal    ${a}[userUuid]    ${c}[userUuid]
    RETURN    ${a}    ${b}    ${c}

Refresh With Cookie Pair
    [Documentation]    POST /api/auth/refresh with the "name=value" refresh cookie on a cookie-less session.
    [Arguments]    ${cookie_pair}
    ${alias}=    Generate Random String    8    [LOWER]
    Create Http Session    r_${alias}    ${BASE_URL}    verify=false
    ${headers}=    Create Dictionary    Cookie=${cookie_pair}
    ${resp}=    POST On Session    r_${alias}    /api/auth/refresh    headers=${headers}
    ...    expected_status=any    timeout=${HTTP_POST_TIMEOUT}
    RETURN    ${resp}

Access Token Should Be Revoked
    [Arguments]    ${token}
    ${headers}=    Get Auth Headers    ${token}
    ${me}=    GET On Session    public_session    /api/auth/me    headers=${headers}    expected_status=any
    Status Should Be    ${me}    401
    Should Be Equal    ${me.json()}[error]    SESSION_REVOKED

Version Seen By
    [Documentation]    The matchVersion a device reads from GET /api/match/{uuid}/info.
    [Arguments]    ${token}    ${match}
    ${info}=    Get Match Info    ${token}    ${match}    expected_status=200
    RETURN    ${info.json()}[matchVersion]

If Match Headers
    [Arguments]    ${token}    ${version}
    ${headers}=    Get Auth Headers    ${token}
    Set To Dictionary    ${headers}    Content-Type=application/json
    IF    '${version}' != ''    Set To Dictionary    ${headers}    If-Match=${version}
    RETURN    ${headers}

Versioned Write
    [Documentation]    POST a gameplay write with If-Match.
    [Arguments]    ${token}    ${path}    ${version}
    ${headers}=    If Match Headers    ${token}    ${version}
    ${resp}=    POST On Session    public_session    ${path}    headers=${headers}
    ...    expected_status=any    timeout=${HTTP_POST_TIMEOUT}
    RETURN    ${resp}

Started Match Of
    [Documentation]    A robottest match of the player, joined and started: (uuid, its current matchVersion).
    [Arguments]    ${token}
    ${created}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY_UUID}    name=robottest_multi_device
    Status Should Be    ${created}    201
    ${match}=    Set Variable    ${created.json()}[uuid]
    ${headers}=    If Match Headers    ${token}    ${created.json()}[matchVersion]
    ${traits}=    Create List
    IF    '${TRAIT_UUID}' != ''    Append To List    ${traits}    ${TRAIT_UUID}
    &{body}=    Create Dictionary    characterTemplateUuid=${CHARACTER_UUID}    traitUuids=${traits}
    IF    '${CLASS_UUID}' != ''    Set To Dictionary    ${body}    classUuid=${CLASS_UUID}
    ${join}=    POST On Session    public_session    /api/matches/${match}/join    json=${body}
    ...    headers=${headers}    expected_status=201    timeout=${HTTP_POST_TIMEOUT}
    ${start}=    Versioned Write    ${token}    /api/matches/${match}/start    ${join.json()}[matchVersion]
    Status Should Be    ${start}    200
    RETURN    ${match}    ${start.json()}[matchVersion]

Admin Match Uuids
    [Documentation]    Every page of GET /api/admin/matches with the given filters (status any, limit 50, at most
    ...                20 pages): the match uuids, their creators and stories.
    [Arguments]    &{filters}
    @{uuids}=    Create List
    ${creators}=    Evaluate    set()
    ${stories}=    Evaluate    set()
    ${params}=    Create Dictionary    limit=50    &{filters}
    FOR    ${page}    IN RANGE    20
        ${resp}=    List All Matches    ${ADMIN_TOKEN}    expected_status=200    params=${params}
        FOR    ${item}    IN    @{resp.json()}[items]
            Append To List    ${uuids}    ${item}[uuid]
            Evaluate    $creators.add($item.get('userCreatorUuid'))
            Evaluate    $stories.add($item.get('storyUuid'))
        END
        ${cursor}=    Evaluate    $resp.json().get('nextCursor')
        IF    $cursor is None    BREAK
        Set To Dictionary    ${params}    cursor=${cursor}
    END
    &{result}=    Create Dictionary    uuids=${uuids}    creators=${creators}    stories=${stories}
    RETURN    ${result}
