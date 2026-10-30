*** Settings ***
# sessions_common.resource — v1.10.0 keywords shared by the 12_multi_device suites: one more device of a fake
# Google account (tokens, refresh cookie, spare ID token) and a refresh with a given cookie.
Library    RequestsLibrary
Library    Collections
Library    String
Resource   ../../resources/google_sso.resource


*** Keywords ***

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

Refresh With Cookie Pair
    [Documentation]    POST /api/auth/refresh with the "name=value" refresh cookie on a cookie-less session.
    [Arguments]    ${cookie_pair}
    ${alias}=    Generate Random String    8    [LOWER]
    Create Http Session    r_${alias}    ${BASE_URL}    verify=false
    ${headers}=    Create Dictionary    Cookie=${cookie_pair}
    ${resp}=    POST On Session    r_${alias}    /api/auth/refresh    headers=${headers}
    ...    expected_status=any    timeout=${HTTP_POST_TIMEOUT}
    RETURN    ${resp}
