*** Settings ***
# google_sso.resource — v1.2.0 (V1 steps 2-5) the fake Google provider of the test endpoints
# (POST {ADMIN_BASE_URL}/api/dev/google-token) and POST /api/auth/google on a cookie-isolated session.
Library    RequestsLibrary
Library    Collections
Library    String
Resource   common.resource
Resource   auth.resource


*** Keywords ***

Create Dev Session
    [Documentation]    The admin URL, where every backend serves /api/dev/** (test endpoints only).
    Create Http Session    dev_session    ${ADMIN_BASE_URL}    verify=false

Fake Google Token
    [Documentation]    An ID token of the fake provider; claims not given default to iss Google,
    ...                aud = the client id, email_verified true, exp now + 1 h.
    [Arguments]    &{claims}
    ${resp}=    POST On Session    dev_session    /api/dev/google-token    json=${claims}    expected_status=200    timeout=${HTTP_POST_TIMEOUT}
    RETURN    ${resp.json()}[idToken]

New Robot Gmail
    [Documentation]    (email, subject) of a brand-new fake Google account; the nickname starts with
    ...                robottest, so POST /api/dev/cleanup removes the user and its matches.
    ${suffix}=    Generate Random String    10    [LOWER][NUMBERS]
    RETURN    robottest.${suffix}@gmail.com    sub-robottest-${suffix}

Google Login
    [Documentation]    POST /api/auth/google on a fresh session (no cookie of another login rides along).
    ...                ${bearer}: the guest whose session is linked to the Google user.
    [Arguments]    ${id_token}    ${nonce}=robot-nonce    ${bearer}=${EMPTY}    ${expected_status}=any
    ${alias}=    Generate Random String    8    [LOWER]
    Create Http Session    g_${alias}    ${BASE_URL}    verify=false
    &{headers}=    Create Dictionary    Content-Type=application/json
    IF    '${bearer}' != ''    Set To Dictionary    ${headers}    Authorization=Bearer ${bearer}
    &{body}=    Create Dictionary    idToken=${id_token}    nonce=${nonce}
    ${resp}=    POST On Session    g_${alias}    /api/auth/google    json=${body}    headers=${headers}
    ...    expected_status=${expected_status}    timeout=${HTTP_POST_TIMEOUT}
    RETURN    ${resp}

Login As New Google User
    [Documentation]    A new Google user: (login response, email, subject).
    ${email}    ${sub}=    New Robot Gmail
    ${token}=    Fake Google Token    sub=${sub}    email=${email}    nonce=robot-nonce
    ...    given_name=Robot    family_name=Tester    picture=https://lh3.googleusercontent.com/robot
    ${resp}=    Google Login    ${token}
    Status Should Be    ${resp}    200
    RETURN    ${resp}    ${email}    ${sub}

Google Error Should Be
    [Documentation]    The refusal status and its error code.
    [Arguments]    ${resp}    ${status}    ${code}
    Status Should Be    ${resp}    ${status}
    Should Be Equal    ${resp.json()}[error]    ${code}

Delete Me
    [Documentation]    DELETE /api/auth/me with a Google ID token (fresh or not).
    [Arguments]    ${access_token}    ${id_token}    ${nonce}=${EMPTY}
    ${headers}=    Get Auth Headers    ${access_token}
    &{body}=    Create Dictionary    idToken=${id_token}
    IF    '${nonce}' != ''    Set To Dictionary    ${body}    nonce=${nonce}
    ${resp}=    DELETE On Session    public_session    /api/auth/me    json=${body}    headers=${headers}
    ...    expected_status=any    timeout=${HTTP_POST_TIMEOUT}
    RETURN    ${resp}

Run Account Deletion Job
    [Documentation]    POST /api/dev/jobs/account-deletion: the deletion job, now.
    ${resp}=    POST On Session    dev_session    /api/dev/jobs/account-deletion    expected_status=200    timeout=${HTTP_POST_TIMEOUT}
    RETURN    ${resp.json()}[deletedUsers]
