*** Settings ***
# google_sso.robot — v1.2.0 V1 steps 2-5: Google sign-in with the fake provider of the test endpoints:
# login and profile, nickname rules, identity and email rules, ID token security, guest link and merge,
# session revocation, account deletion (202, then data gone), state refusal, the Google switch.
Resource   ../../resources/google_sso.resource
Resource   ../../resources/matches.resource
Library    ../../resources/JwtHelper.py

Suite Setup       Google SSO Suite Setup
Force Tags        v1_step02    google-sso


*** Test Cases ***

Echo Status Exposes The Google Switch And Client Id
    [Documentation]    GET /api/echo/status answers googleEnabled (true) and the client id react-game reads.
    ${resp}=    GET On Session    public_session    /api/echo/status    expected_status=200
    Should Be True    ${resp.json()}[googleEnabled]
    Should Not Be Empty    ${resp.json()}[googleClientId]

A New Google User Gets Its Nickname And Profile
    [Documentation]    username google_<8>, nickname = email local part without +tag, displayName
    ...                "given family", the picture, accountType GOOGLE; GET /api/auth/me says the same.
    [Tags]    v1_step03
    ${suffix}=    Generate Random String    10    [LOWER][NUMBERS]
    ${token}=    Fake Google Token    sub=sub-robottest-${suffix}    email=robottest.${suffix}+games@gmail.com
    ...    nonce=robot-nonce    given_name=Robot    family_name=Tester    picture=https://lh3.googleusercontent.com/r
    ${resp}=    Google Login    ${token}
    Status Should Be    ${resp}    200
    ${body}=    Set Variable    ${resp.json()}
    Should Start With    ${body}[username]    google_
    Should Be Equal    ${body}[nickname]    robottest.${suffix}
    Should Be Equal    ${body}[displayName]    Robot Tester
    Should Be Equal    ${body}[accountType]    GOOGLE
    Should Be True    ${body}[newUser]
    ${me}=    Call Me Endpoint    ${body}[accessToken]
    Should Be Equal    ${me.json()}[nickname]    robottest.${suffix}
    Should Be Equal    ${me.json()}[pictureUrl]    https://lh3.googleusercontent.com/r

A Taken Nickname Gets A Suffix
    [Documentation]    Two Gmail addresses with the same local part before the +tag: the second
    ...                user is <nickname>#2.
    ${suffix}=    Generate Random String    10    [LOWER][NUMBERS]
    ${first}=    Fake Google Token    sub=sub-a-${suffix}    email=robottest.${suffix}+a@gmail.com    nonce=robot-nonce
    ${second}=    Fake Google Token    sub=sub-b-${suffix}    email=robottest.${suffix}+b@gmail.com    nonce=robot-nonce
    ${a}=    Google Login    ${first}
    ${b}=    Google Login    ${second}
    Should Be Equal    ${a.json()}[nickname]    robottest.${suffix}
    Should Be Equal    ${b.json()}[nickname]    robottest.${suffix}#2

The Same Account Signs In Again As The Same User
    ${resp}    ${email}    ${sub}=    Login As New Google User
    # v1.2.0 the profile is overwritten with the claims of every login
    ${again}=    Fake Google Token    sub=${sub}    email=${email}    nonce=robot-nonce
    ...    given_name=Changed    family_name=Again
    ${second}=    Google Login    ${again}
    Status Should Be    ${second}    200
    Should Be Equal    ${second.json()}[userUuid]    ${resp.json()}[userUuid]
    Should Not Be True    ${second.json()}[newUser]
    Should Be Equal    ${second.json()}[displayName]    Changed Again

Only Verified Gmail Accounts Enter
    [Documentation]    EMAIL_NOT_VERIFIED; EMAIL_DOMAIN_NOT_ALLOWED for googlemail.com and any other domain.
    [Tags]    v1_step05
    ${suffix}=    Generate Random String    10    [LOWER][NUMBERS]
    ${unverified}=    Fake Google Token    sub=s1-${suffix}    email=robottest.${suffix}@gmail.com
    ...    email_verified=${False}    nonce=robot-nonce
    ${r}=    Google Login    ${unverified}
    Google Error Should Be    ${r}    403    EMAIL_NOT_VERIFIED
    ${googlemail}=    Fake Google Token    sub=s2-${suffix}    email=robottest.${suffix}@googlemail.com    nonce=robot-nonce
    ${resp}=    Google Login    ${googlemail}
    Google Error Should Be    ${resp}    403    EMAIL_DOMAIN_NOT_ALLOWED
    ${company}=    Fake Google Token    sub=s3-${suffix}    email=robottest.${suffix}@example.org    nonce=robot-nonce
    ${resp}=    Google Login    ${company}
    Google Error Should Be    ${resp}    403    EMAIL_DOMAIN_NOT_ALLOWED

The Same Email With Another Subject Is An Identity Mismatch
    [Documentation]    The email is the key: another Google subject for it answers 409 IDENTITY_MISMATCH.
    ${resp}    ${email}    ${sub}=    Login As New Google User
    ${other}=    Fake Google Token    sub=${sub}-other    email=${email}    nonce=robot-nonce
    ${resp}=    Google Login    ${other}
    Google Error Should Be    ${resp}    409    IDENTITY_MISMATCH

A Renamed Email Is A New User
    [Documentation]    Same subject, new email (Gmail rename): a new user with fresh progress.
    ${resp}    ${email}    ${sub}=    Login As New Google User
    ${suffix}=    Generate Random String    8    [LOWER][NUMBERS]
    ${renamed}=    Fake Google Token    sub=${sub}    email=robottest.renamed${suffix}@gmail.com    nonce=robot-nonce
    ${second}=    Google Login    ${renamed}
    Status Should Be    ${second}    200
    Should Not Be Equal    ${second.json()}[userUuid]    ${resp.json()}[userUuid]
    Should Be True    ${second.json()}[newUser]

ID Token Security Checks
    [Documentation]    aud, iss, exp (INVALID_TOKEN), nonce (INVALID_NONCE) and replay (TOKEN_REPLAYED).
    [Tags]    v1_step05    security
    ${email}    ${sub}=    New Robot Gmail
    ${aud}=    Fake Google Token    sub=${sub}    email=${email}    nonce=robot-nonce    aud=another-client
    ${r}=    Google Login    ${aud}
    Google Error Should Be    ${r}    401    INVALID_TOKEN
    ${iss}=    Fake Google Token    sub=${sub}    email=${email}    nonce=robot-nonce    iss=https://evil.example
    ${r}=    Google Login    ${iss}
    Google Error Should Be    ${r}    401    INVALID_TOKEN
    ${exp}=    Fake Google Token    sub=${sub}    email=${email}    nonce=robot-nonce    expOffsetSeconds=${-120}
    ${r}=    Google Login    ${exp}
    Google Error Should Be    ${r}    401    INVALID_TOKEN
    ${nonce}=    Fake Google Token    sub=${sub}    email=${email}    nonce=another-nonce
    ${r}=    Google Login    ${nonce}
    Google Error Should Be    ${r}    401    INVALID_NONCE
    ${good}=    Fake Google Token    sub=${sub}    email=${email}    nonce=robot-nonce
    ${first}=    Google Login    ${good}
    Status Should Be    ${first}    200
    ${replay}=    Google Login    ${good}
    Google Error Should Be    ${replay}    401    TOKEN_REPLAYED

A Token Of A User That Does Not Exist Is Refused
    [Documentation]    v1.2.0 — the user of a token must exist: a well-signed token (same iss/aud) of an
    ...                unknown uuid answers 401, and the ADMIN claim of a player is never trusted.
    [Tags]    v1_step03    security
    ${resp}    ${email}    ${sub}=    Login As New Google User
    ${access}=    Set Variable    ${resp.json()}[accessToken]
    IF    $access.startswith('MOCK_ACCESS_')
        # AllowMockAccess=true (AWS local): mock tokens have no claims, an unknown uuid is still refused
        ${ghost_uuid}=    Evaluate    str(uuid.uuid4())    modules=uuid
        ${me}=    GET On Session    public_session    /api/auth/me    expected_status=any
        ...    headers=${{ {'Authorization': 'Bearer MOCK_ACCESS_' + $ghost_uuid} }}
        Status Should Be    ${me}    401
        Pass Execution    Mock tokens carry no iss/aud: the signed-token checks run on the other targets.
    END
    ${claims}=    Token Claims    ${access}
    ${ghost}=    Generate Player Token    issuer=${claims}[iss]    audience=${claims}[aud]
    ${me}=    GET On Session    public_session    /api/auth/me    headers=${{ {'Authorization': 'Bearer ' + $ghost} }}
    ...    expected_status=any
    Status Should Be    ${me}    401
    ${fake_admin}=    Generate Player Token    user_uuid=${resp.json()}[userUuid]    role=ADMIN
    ...    issuer=${claims}[iss]    audience=${claims}[aud]
    ${list}=    GET On Session    admin_session    /api/admin/guests    expected_status=any
    ...    headers=${{ {'Authorization': 'Bearer ' + $fake_admin} }}
    Should Be True    ${list.status_code} in (401, 403)

The Guest Is Linked At Login And Its Token Dies
    [Documentation]    The guest of the bearer is merged into the Google user: its matches move to the
    ...                user, the guest itself is deleted (its token answers 401) and the response says so.
    [Tags]    v1_step04
    ${guest}=    New Guest Token
    ${match}=    Create Match    ${guest}    ${STORY}    ${DIFFICULTY}    name=robottest_google_link
    Status Should Be    ${match}    201
    ${email}    ${sub}=    New Robot Gmail
    ${token}=    Fake Google Token    sub=${sub}    email=${email}    nonce=robot-nonce
    ${resp}=    Google Login    ${token}    bearer=${guest}
    Status Should Be    ${resp}    200
    Should Be True    ${resp.json()}[mergedGuest]
    ${matches}=    List Matches    ${resp.json()}[accessToken]    200
    ${uuids}=    Evaluate    [m['uuid'] for m in $matches.json()['items']]
    Should Contain    ${uuids}    ${match.json()}[uuid]
    ${me}=    GET On Session    public_session    /api/auth/me    headers=${{ {'Authorization': 'Bearer ' + $guest} }}
    ...    expected_status=any
    Status Should Be    ${me}    401

A Second Guest With A Match On The Same Story Is Cancelled
    [Documentation]    Merge rule (v1.7.0 step 9): per story the Google user's active match always wins, the
    ...                guest's becomes CANCELLED (a terminal status) even when newer; ended matches are kept.
    [Tags]    v1_step04
    ${first_guest}=    New Guest Token
    ${older}=    Create Match    ${first_guest}    ${STORY}    ${DIFFICULTY}    name=robottest_google_older
    Status Should Be    ${older}    201
    ${email}    ${sub}=    New Robot Gmail
    ${t1}=    Fake Google Token    sub=${sub}    email=${email}    nonce=robot-nonce
    ${login}=    Google Login    ${t1}    bearer=${first_guest}
    Status Should Be    ${login}    200
    ${second_guest}=    New Guest Token
    ${newer}=    Create Match    ${second_guest}    ${STORY}    ${DIFFICULTY}    name=robottest_google_newer
    Status Should Be    ${newer}    201
    ${t2}=    Fake Google Token    sub=${sub}    email=${email}    nonce=robot-nonce
    ${merged}=    Google Login    ${t2}    bearer=${second_guest}
    Status Should Be    ${merged}    200
    Should Be Equal As Integers    ${merged.json()}[cancelledMatches]    1
    Should Be Equal    ${merged.json()}[cancelledMatchUuids]    ${{ [$newer.json()['uuid']] }}
    ${list}=    List Matches    ${merged.json()}[accessToken]    200
    ${statuses}=    Evaluate    {m['uuid']: m['status'] for m in $list.json()['items']}
    Should Not Be Equal    ${statuses}[${older.json()}[uuid]]    CANCELLED
    Should Be Equal    ${statuses}[${newer.json()}[uuid]]    CANCELLED

Account Deletion Needs A Fresh Google Token
    [Documentation]    DELETE /api/auth/me refuses a missing token and one issued more than 5 minutes ago.
    [Tags]    v1_step05
    ${resp}    ${email}    ${sub}=    Login As New Google User
    ${access}=    Set Variable    ${resp.json()}[accessToken]
    ${none}=    Delete Me    ${access}    ${EMPTY}
    Google Error Should Be    ${none}    401    FRESH_TOKEN_REQUIRED
    ${stale}=    Fake Google Token    sub=${sub}    email=${email}    iatOffsetSeconds=${-600}
    ${old}=    Delete Me    ${access}    ${stale}
    Google Error Should Be    ${old}    401    FRESH_TOKEN_REQUIRED

Account Deletion Answers 202 Then The Data Is Gone
    [Documentation]    202 and state 7: the token is refused, a login answers ACCOUNT_DELETION_IN_PROGRESS;
    ...                after the job the user and its matches are gone and the same email is a new user.
    [Tags]    v1_step05
    ${guest}=    New Guest Token
    ${match}=    Create Match    ${guest}    ${STORY}    ${DIFFICULTY}    name=robottest_google_delete
    Status Should Be    ${match}    201
    ${email}    ${sub}=    New Robot Gmail
    ${t1}=    Fake Google Token    sub=${sub}    email=${email}    nonce=robot-nonce
    ${login}=    Google Login    ${t1}    bearer=${guest}
    ${access}=    Set Variable    ${login.json()}[accessToken]
    ${fresh}=    Fake Google Token    sub=${sub}    email=${email}    nonce=delete-nonce
    ${deleted}=    Delete Me    ${access}    ${fresh}    delete-nonce
    Status Should Be    ${deleted}    202
    Should Be Equal    ${deleted.json()}[status]    DELETING
    ${me}=    GET On Session    public_session    /api/auth/me    headers=${{ {'Authorization': 'Bearer ' + $access} }}
    ...    expected_status=any
    Google Error Should Be    ${me}    403    ACCOUNT_DELETION_IN_PROGRESS
    ${t2}=    Fake Google Token    sub=${sub}    email=${email}    nonce=robot-nonce
    ${refused}=    Google Login    ${t2}
    Google Error Should Be    ${refused}    403    ACCOUNT_DELETION_IN_PROGRESS
    ${removed}=    Run Account Deletion Job
    Should Be True    ${removed} >= 1
    ${info}=    Admin Get Match Info    ${ADMIN_TOKEN}    ${match.json()}[uuid]
    Should Be Equal As Integers    ${info.status_code}    404
    ${t3}=    Fake Google Token    sub=${sub}    email=${email}    nonce=robot-nonce
    ${again}=    Google Login    ${t3}
    Status Should Be    ${again}    200
    Should Be True    ${again.json()}[newUser]
    Should Not Be Equal    ${again.json()}[userUuid]    ${login.json()}[userUuid]


*** Keywords ***

Google SSO Suite Setup
    Create Public Session
    Create Admin Session
    Create Dev Session
    ${story}    ${difficulty}=    Pick First Public Story With Difficulty
    Set Suite Variable    ${STORY}    ${story}
    Set Suite Variable    ${DIFFICULTY}    ${difficulty}
