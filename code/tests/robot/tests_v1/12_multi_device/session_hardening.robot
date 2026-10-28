*** Settings ***
# session_hardening.robot — v1.10.0 V1 steps 10 and 12: a refresh token rotated just before "log out of all
# devices" is refused inside its 2-minute grace too, a refresh after a ban is refused, a suspension ends by itself
# (dev endpoint POST /api/dev/users/{uuid}/expire-suspension) and the auth cookies carry the configured SameSite.
Library    DateTime
Resource   ../../resources/google_sso.resource
Resource   ../../resources/matches.resource
Resource   sessions_common.resource

Suite Setup       Session Hardening Suite Setup
Force Tags        v1_step12    multi-device    v1_10


*** Variables ***
# the SameSite the backend under test is configured with (COOKIE_SAME_SITE; AWS test uses None); empty = any valid one
${EXPECTED_SAME_SITE}    ${EMPTY}


*** Test Cases ***

A Rotated Refresh Token Is Refused After Log Out Of All Devices
    [Documentation]    R1 is rotated into R2 (R1 stays usable for 2 minutes, two tabs refreshing together); "log out
    ...                of all devices" then refuses both: R1 is older than sessions_valid_after, R2 is revoked.
    ${email}    ${sub}=    New Robot Gmail
    ${device}=    Google Device    ${email}    ${sub}
    # R1 must be older than the second of sessions_valid_after (a token of that same second is valid)
    Sleep    1.2s
    ${rotated}=    Refresh With Cookie Pair    ${device}[cookie]
    Status Should Be    ${rotated}    200
    ${r2}=    Refresh Cookie Of    ${rotated}
    ${headers}=    Get Auth Headers    ${rotated.json()}[accessToken]
    ${out}=    POST On Session    public_session    /api/auth/logout/all    headers=${headers}
    ...    expected_status=any    timeout=${HTTP_POST_TIMEOUT}
    Should Be True    ${out.status_code} == 200 or ${out.status_code} == 204
    # a MOCK_REFRESH_ token (local AWS, ALLOW_MOCK_ACCESS) has no iat: only a real JWT carries the issue time
    ${mock}=    Evaluate    $device['accessToken'].startswith('MOCK_ACCESS_')
    IF    not ${mock}
        ${old}=    Refresh With Cookie Pair    ${device}[cookie]
        Status Should Be    ${old}    401
        Should Be Equal    ${old.json()}[error]    SESSION_REVOKED
    END
    ${new}=    Refresh With Cookie Pair    ${r2}
    Status Should Be    ${new}    401
    Should Be Equal    ${new.json()}[error]    SESSION_REVOKED

A Refresh After A Ban Is Refused
    [Documentation]    The ban revokes every session: the active refresh token answers 401 SESSION_REVOKED, the one
    ...                rotated a moment before (inside its grace) reaches the state check and answers 403
    ...                ACCOUNT_DISABLED; a new login is refused too.
    ${email}    ${sub}=    New Robot Gmail
    ${device}=    Google Device    ${email}    ${sub}
    ${rotated}=    Refresh With Cookie Pair    ${device}[cookie]
    Status Should Be    ${rotated}    200
    ${active}=    Refresh Cookie Of    ${rotated}
    ${ban}=    User Action    ${device}[userUuid]    ban    reason=Robot test: refresh after a ban
    Status Should Be    ${ban}    200
    ${refused}=    Refresh With Cookie Pair    ${active}
    Status Should Be    ${refused}    401
    Should Be Equal    ${refused.json()}[error]    SESSION_REVOKED
    ${in_grace}=    Refresh With Cookie Pair    ${device}[cookie]
    Status Should Be    ${in_grace}    403
    Should Be Equal    ${in_grace.json()}[error]    ACCOUNT_DISABLED
    ${login}=    Google Login    ${device}[idTokenAgain]
    Google Error Should Be    ${login}    403    ACCOUNT_DISABLED

A Suspension Ends By Itself
    [Documentation]    A suspended user is refused until the date; once the date is past (dev endpoint) the next
    ...                login unblocks the user automatically; the dev endpoint refuses a user not suspended.
    ${email}    ${sub}=    New Robot Gmail
    ${device}=    Google Device    ${email}    ${sub}
    ${uuid}=    Set Variable    ${device}[userUuid]
    ${until}=    Get Current Date    UTC    increment=7 days    result_format=%Y-%m-%d
    ${done}=    User Action    ${uuid}    suspend    reason=Robot test: auto unblock    until=${until}
    Status Should Be    ${done}    200
    ${token}=    Fake Google Token    sub=${sub}    email=${email}    nonce=robot-nonce
    ${refused}=    Google Login    ${token}
    Google Error Should Be    ${refused}    403    ACCOUNT_DISABLED
    ${expired}=    POST On Session    dev_session    /api/dev/users/${uuid}/expire-suspension
    ...    expected_status=any    timeout=${HTTP_POST_TIMEOUT}
    Status Should Be    ${expired}    200
    Should Be Equal As Integers    ${expired.json()}[state]    3
    ${again}=    Fake Google Token    sub=${sub}    email=${email}    nonce=robot-nonce
    ${back}=    Google Login    ${again}
    Status Should Be    ${back}    200
    Should Be Equal    ${back.json()}[userUuid]    ${uuid}
    ${detail}=    GET On Session    admin_session    /api/admin/users/${uuid}    expected_status=200
    Should Be Equal As Integers    ${detail.json()}[state]    2
    ${not_suspended}=    POST On Session    dev_session    /api/dev/users/${uuid}/expire-suspension
    ...    expected_status=any    timeout=${HTTP_POST_TIMEOUT}
    Status Should Be    ${not_suspended}    409
    Should Be Equal    ${not_suspended.json()}[error]    INVALID_STATE_TRANSITION

The Auth Cookies Carry The Configured SameSite
    [Documentation]    The refresh cookie of a Google login and the guest cookie: HttpOnly, SameSite Lax, Strict or
    ...                None (the configured one when EXPECTED_SAME_SITE is given), Secure whenever SameSite is None.
    ${email}    ${sub}=    New Robot Gmail
    ${id_token}=    Fake Google Token    sub=${sub}    email=${email}    nonce=robot-nonce
    ${login}=    Google Login    ${id_token}
    Status Should Be    ${login}    200
    Cookie Should Carry SameSite    ${login}    pathsgames.refreshToken
    Create Http Session    guest_same_site    ${BASE_URL}    verify=false
    ${guest}=    POST On Session    guest_same_site    /api/auth/guest    timeout=${HTTP_POST_TIMEOUT}
    Status Should Be    ${guest}    201
    Cookie Should Carry SameSite    ${guest}    pathsgames.guestcookie


*** Keywords ***

Session Hardening Suite Setup
    Create Public Session
    Create Admin Session
    Create Dev Session

Refresh Cookie Of
    [Documentation]    The "name=value" refresh cookie a refresh answer sets.
    [Arguments]    ${resp}
    ${pair}=    Evaluate    next((f"{k}={v}" for k, v in $resp.cookies.items() if 'refresh' in k.lower()), '')
    Should Not Be Empty    ${pair}    msg=the refresh answer set no refresh cookie
    RETURN    ${pair}

User Action
    [Documentation]    POST /api/admin/users/{uuid}/{action} with {reason, until}; any status.
    [Arguments]    ${uuid}    ${action}    ${reason}=${EMPTY}    ${until}=${EMPTY}
    &{body}=    Create Dictionary
    IF    '${reason}' != ''    Set To Dictionary    ${body}    reason=${reason}
    IF    '${until}' != ''    Set To Dictionary    ${body}    until=${until}
    ${resp}=    POST On Session    admin_session    /api/admin/users/${uuid}/${action}    json=${body}
    ...    expected_status=any    timeout=${HTTP_POST_TIMEOUT}
    RETURN    ${resp}

Cookie Should Carry SameSite
    [Documentation]    The Set-Cookie line of ${name}: HttpOnly, a valid SameSite (the expected one if given),
    ...                Secure with SameSite=None.
    [Arguments]    ${resp}    ${name}
    ${lines}=    Evaluate    [l for l in $resp.raw.headers.getlist('Set-Cookie') if l.startswith($name + '=')]
    Should Not Be Empty    ${lines}    msg=no ${name} cookie in ${resp.headers}
    ${attributes}=    Evaluate    {a.split('=', 1)[0].strip().lower(): (a.split('=', 1) + [''])[1].strip() for a in $lines[0].split(';')[1:]}
    Dictionary Should Contain Key    ${attributes}    httponly
    ${same_site}=    Evaluate    $attributes.get('samesite', '').capitalize()
    Should Contain Any    ${same_site}    Lax    Strict    None    msg=${name}: SameSite missing in ${lines}[0]
    IF    '${EXPECTED_SAME_SITE}' != ''
        Should Be Equal    ${same_site}    ${EXPECTED_SAME_SITE.capitalize()}
    END
    IF    '${same_site}' == 'None'    Dictionary Should Contain Key    ${attributes}    secure
