*** Settings ***
# version_launch.robot — v1.1.0, V1 step 1: plain X.Y.Z version (V1 or later) on public and admin echo,
# plus the API part of the daily smoke flow (echo, stories, guest login) on every backend.
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/stories.resource

Suite Setup    Initialize Launch Sessions


*** Variables ***
${PLAIN_VERSION_V1_PLUS}    ^[1-9][0-9]*\\.[0-9]+\\.[0-9]+$


*** Keywords ***

Initialize Launch Sessions
    [Documentation]    Open a public session (BASE_URL) and an admin session (ADMIN_BASE_URL).
    Create Public Session
    Create Session    admin_session    ${ADMIN_BASE_URL}    verify=false

Echo Version On
    [Documentation]    Returns properties.version of GET /api/echo/status on the given session.
    [Arguments]    ${session}
    ${response}=    GET On Session    ${session}    /api/echo/status
    Status Should Be    ${response}    200
    RETURN    ${response.json()}[properties][version]


*** Test Cases ***

Public Echo Version Is Plain And V1 Or Later
    [Documentation]    The public version has no suffix (-SNAPSHOT, -RC, ...) and major >= 1.
    [Tags]    smoke    echo    v1    v1_step01
    ${version}=    Echo Version On    public_session
    Should Match Regexp    ${version}    ${PLAIN_VERSION_V1_PLUS}
    ...    msg=Expected a plain X.Y.Z version with major >= 1, got '${version}'

Admin And Public Echo Report The Same Version
    [Documentation]    bump-version.sh writes one number everywhere: admin and public echo agree.
    [Tags]    smoke    echo    admin    v1    v1_step01
    ${public}=    Echo Version On    public_session
    ${admin}=     Echo Version On    admin_session
    Should Be Equal As Strings    ${admin}    ${public}

Daily Smoke Flow Stories And Guest Login
    [Documentation]    API part of the daily smoke test: stories listed, then a valid guest login.
    [Tags]    smoke    stories    auth    v1    v1_step01
    ${stories}=    Get Public Stories
    Status Should Be    ${stories}    200
    List Response Should Not Be Empty    ${stories}
    Create Guest Session And Get Token
    Guest Login Response Should Be Valid    ${GUEST_RESPONSE}
