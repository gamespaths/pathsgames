*** Settings ***
# admin_path_guard.robot — v1.10.0 security fix: on the public URL an admin or dev endpoint is never reached by an
# encoded or ;-padded path (/api/%61dmin, /api;x/admin, //, dot segments). Java answers 400 INVALID_PATH, the other
# backends 404 (Python 401 without a token: its auth middleware runs before routing); the request is sent byte
# for byte by resources/RawPathHelper.py.
Resource   ../../resources/auth.resource
Library    ../../resources/RawPathHelper.py

Suite Setup       Create Public Session
Force Tags        v1_step10    admin-users    security    v1_10


*** Test Cases ***

An Encoded Admin Path Is Refused On The Public URL
    ${token}=    New Guest Token
    FOR    ${path}    IN    /api/%61dmin/users    /api/a%64min/users?limit=5    /api;x/admin/users
    ...    /api/admin;x/users    //api//admin/users    /api/x/../admin/users    /api/%2e%2e/api/admin/users
        ${resp}=    Raw Request    ${BASE_URL}    GET    ${path}    ${token}    timeout=${HTTP_POST_TIMEOUT}
        Should Be True    ${resp}[status] in (400, 403, 404)    msg=GET ${path} answered ${resp}[status]: ${resp}[body]
    END

An Encoded Dev Path Never Mints An Admin Token On The Public URL
    FOR    ${path}    IN    /api/%64ev/admin-token    /api;x/dev/admin-token    /api/%64ev/google-token
        ${resp}=    Raw Request    ${BASE_URL}    POST    ${path}    timeout=${HTTP_POST_TIMEOUT}
        Should Be True    ${resp}[status] in (400, 401, 403, 404)    msg=POST ${path} answered ${resp}[status]: ${resp}[body]
        Should Not Contain    ${resp}[body]    accessToken
        Should Not Contain    ${resp}[body]    idToken
    END
