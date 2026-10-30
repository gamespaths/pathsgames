*** Settings ***
# user_profile_page.robot — v1.7.0 V1 step 7: the API flows of the react-game profile page: first-login copy of
# the device values, profile over device, logout of all devices, the deletion that ends the page session.
Resource   ../../resources/google_sso.resource

Suite Setup       Profile Page Suite Setup
Force Tags        v1_step07    user-profile


*** Test Cases ***

First Login Copies The Device Values Into The Profile
    [Documentation]    newUser true: the page sends one PATCH /me with the device language and high contrast.
    ${email}    ${sub}=    New Robot Gmail
    ${login}=    Google Login From Device    ${email}    ${sub}    language=it
    Should Be True    ${login.json()}[newUser]
    ${copy}=    Patch Me From Page    ${login}    language=it    highContrast=${True}
    Status Should Be    ${copy}    200
    ${me}=    Call Me Endpoint    ${login.json()}[accessToken]
    Should Be Equal    ${me.json()}[preferences][language]    it
    Should Be True    ${me.json()}[preferences][highContrast]
    Should Be Equal    ${me.json()}[preferences][theme]    high-contrast

An Existing User Keeps Its Profile Over The Device Values
    [Documentation]    newUser false: the device language of the login body changes nothing, GET /me wins.
    ${email}    ${sub}=    New Robot Gmail
    ${first}=    Google Login From Device    ${email}    ${sub}    language=it
    ${copy}=    Patch Me From Page    ${first}    highContrast=${True}
    Status Should Be    ${copy}    200
    ${second}=    Google Login From Device    ${email}    ${sub}    language=en
    Should Not Be True    ${second.json()}[newUser]
    Should Be Equal    ${second.json()}[language]    it
    ${me}=    Call Me Endpoint    ${second.json()}[accessToken]
    Should Be Equal    ${me.json()}[preferences][language]    it
    Should Be True    ${me.json()}[preferences][highContrast]

Statistics Of The Profile Page Start At Zero
    [Documentation]    The statistics block the page formats: every counter present, a new user at zero.
    ${email}    ${sub}=    New Robot Gmail
    ${login}=    Google Login From Device    ${email}    ${sub}
    ${me}=    Call Me Endpoint    ${login.json()}[accessToken]
    FOR    ${key}    IN    matchesPlayed    matchesCompleted    matchesGameOver    playTimeMs    clocksPlayed
        Should Be Equal As Integers    ${me.json()}[stats][${key}]    0
    END

Logout Of All Devices Closes Every Session
    [Documentation]    Two devices of one Google user; POST /api/auth/logout/all from one closes both refresh cookies.
    ${email}    ${sub}=    New Robot Gmail
    ${pc}=    Google Login From Device    ${email}    ${sub}
    ${phone}=    Google Login From Device    ${email}    ${sub}
    ${pc_cookie}=    Refresh Cookie Of    ${pc}
    ${phone_cookie}=    Refresh Cookie Of    ${phone}
    ${headers}=    Get Auth Headers    ${pc.json()}[accessToken]
    ${resp}=    POST On Session    public_session    /api/auth/logout/all    headers=${headers}
    ...    expected_status=200    timeout=${HTTP_POST_TIMEOUT}
    Refresh Should Be Refused    ${pc_cookie}
    Refresh Should Be Refused    ${phone_cookie}

Account Deletion Ends The Session Of The Page
    [Documentation]    202 with a fresh token and its nonce; the refresh cookie of the page no longer works.
    ${email}    ${sub}=    New Robot Gmail
    ${login}=    Google Login From Device    ${email}    ${sub}
    ${cookie}=    Refresh Cookie Of    ${login}
    ${fresh}=    Fake Google Token    sub=${sub}    email=${email}    nonce=profile-page-nonce
    ${deleted}=    Delete Me    ${login.json()}[accessToken]    ${fresh}    profile-page-nonce
    Status Should Be    ${deleted}    202
    ${after}=    Refresh With Cookie Pair    ${cookie}
    Should Be True    ${after.status_code} in (401, 403)
    ${removed}=    Run Account Deletion Job
    Should Be True    ${removed} >= 1


*** Keywords ***

Profile Page Suite Setup
    Create Public Session
    Create Dev Session

Google Login From Device
    [Documentation]    POST /api/auth/google on a fresh session, with the device language when given.
    [Arguments]    ${email}    ${sub}    ${language}=${EMPTY}
    ${token}=    Fake Google Token    sub=${sub}    email=${email}    nonce=robot-nonce
    ${alias}=    Generate Random String    8    [LOWER]
    Create Http Session    device_${alias}    ${BASE_URL}    verify=false
    &{body}=    Create Dictionary    idToken=${token}    nonce=robot-nonce
    IF    '${language}' != ''    Set To Dictionary    ${body}    language=${language}
    ${resp}=    POST On Session    device_${alias}    /api/auth/google    json=${body}
    ...    expected_status=200    timeout=${HTTP_POST_TIMEOUT}
    RETURN    ${resp}

Patch Me From Page
    [Documentation]    PATCH /api/auth/me with the X-CSRF-TOKEN of the login answer.
    [Arguments]    ${login}    &{fields}
    ${headers}=    Get Auth Headers    ${login.json()}[accessToken]
    Set To Dictionary    ${headers}    Content-Type=application/json    X-CSRF-TOKEN=${login.json()}[csrfToken]
    ${resp}=    PATCH On Session    public_session    /api/auth/me    json=${fields}    headers=${headers}
    ...    expected_status=any    timeout=${HTTP_POST_TIMEOUT}
    RETURN    ${resp}

Refresh Cookie Of
    [Documentation]    The "name=value" refresh cookie of a login answer (Secure: replayed by hand, not by the jar).
    [Arguments]    ${response}
    ${pair}=    Evaluate    next((f"{k}={v}" for k, v in $response.cookies.items() if 'refresh' in k.lower()), '')
    Should Not Be Empty    ${pair}
    RETURN    ${pair}

Refresh With Cookie Pair
    [Documentation]    POST /api/auth/refresh with the given cookie pair; any status.
    [Arguments]    ${cookie_pair}
    ${headers}=    Create Dictionary    Cookie=${cookie_pair}
    ${resp}=    POST On Session    public_session    /api/auth/refresh    headers=${headers}
    ...    expected_status=any    timeout=${HTTP_POST_TIMEOUT}
    RETURN    ${resp}

Refresh Should Be Refused
    [Documentation]    A closed session: 401 with SESSION_REVOKED or INVALID_REFRESH_TOKEN.
    [Arguments]    ${cookie_pair}
    ${resp}=    Refresh With Cookie Pair    ${cookie_pair}
    Status Should Be    ${resp}    401
    Should Contain Any    ${resp.json()}[error]    SESSION_REVOKED    INVALID_REFRESH_TOKEN
