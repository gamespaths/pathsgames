*** Settings ***
# concurrency_common.resource — v1.10.0 keywords shared by the 08_match_concurrency suites: one player on two
# devices (two fake Google logins) and gameplay writes carrying If-Match.
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/google_sso.resource
Resource   ../../resources/matches.resource


*** Keywords ***

Two Devices Of One Player
    [Documentation]    One new fake Google account logged in twice: two access tokens of the same user.
    ${email}    ${sub}=    New Robot Gmail
    ${first}=    Fake Google Token    sub=${sub}    email=${email}    nonce=robot-nonce    given_name=Robot
    ${a}=    Google Login    ${first}
    Status Should Be    ${a}    200
    ${second}=    Fake Google Token    sub=${sub}    email=${email}    nonce=robot-nonce    given_name=Robot
    ${b}=    Google Login    ${second}
    Status Should Be    ${b}    200
    Should Be Equal    ${a.json()}[userUuid]    ${b.json()}[userUuid]
    RETURN    ${a.json()}[accessToken]    ${b.json()}[accessToken]

If Match Headers
    [Arguments]    ${token}    ${version}
    ${headers}=    Get Auth Headers    ${token}
    Set To Dictionary    ${headers}    Content-Type=application/json
    IF    '${version}' != ''    Set To Dictionary    ${headers}    If-Match=${version}
    RETURN    ${headers}

Versioned Write
    [Documentation]    POST a gameplay write with If-Match (none when the version is empty).
    [Arguments]    ${token}    ${path}    ${version}
    ${headers}=    If Match Headers    ${token}    ${version}
    ${resp}=    POST On Session    public_session    ${path}    headers=${headers}
    ...    expected_status=any    timeout=${HTTP_POST_TIMEOUT}
    RETURN    ${resp}

Versioned Request
    [Documentation]    v1.10.0 any gameplay write (POST or PATCH) with a JSON body and If-Match.
    [Arguments]    ${method}    ${token}    ${path}    ${version}    ${body}=${None}
    ${headers}=    If Match Headers    ${token}    ${version}
    ${resp}=    Run Keyword    ${method} On Session    public_session    ${path}    json=${body}
    ...    headers=${headers}    expected_status=any    timeout=${HTTP_POST_TIMEOUT}
    RETURN    ${resp}
