*** Settings ***
# google_user_migration.robot — v1.2.0 V1 step 5: a Google user moves to another stage through the match
# export/import, which carries its identity (provider, subject, email): after the import the same Google
# account signs in as the same user and finds its match. Target: TARGET_BASE_URL + TARGET_ADMIN_BASE_URL
# (another backend or stage, e.g. test to dev); without them the user is deleted here first (a fresh stage).
Resource   ../../tests_v0/41_alpha_prep/alpha_prep_common.resource
Resource   ../../resources/google_sso.resource
Library    ../../resources/MatchExportHelper.py
Library    ../../resources/JwtHelper.py

Suite Setup       Migration Suite Setup
Suite Teardown    Suite Teardown Alpha Prep
Force Tags        v1_step05    google-sso    match-export


*** Variables ***
${TARGET_BASE_URL}          ${EMPTY}
${TARGET_ADMIN_BASE_URL}    ${EMPTY}


*** Test Cases ***

The Export Carries The Google Identity Of The User
    [Documentation]    The exported user has identities = [{provider GOOGLE, subject, email}].
    ${doc}    ${email}    ${sub}    ${user}=    Exported Google Match
    ${identities}=    Identities Of    ${doc}    ${user}
    Should Be Equal    ${identities}[0][provider]    GOOGLE
    Should Be Equal    ${identities}[0][subject]    ${sub}
    Should Be Equal    ${identities}[0][email]    ${email}

A Google User Moves To Another Stage And Signs In There As Itself
    [Documentation]    Import into the target (another stage, or this one after the user is deleted):
    ...                the user is recreated with its identity, the same account signs in as the same
    ...                uuid (newUser false) and its match is listed.
    ${doc}    ${email}    ${sub}    ${user}=    Exported Google Match
    IF    '${TARGET_BASE_URL}' == ''
        Delete The Google User Here    ${email}    ${sub}
        Set Test Variable    ${IMPORT_BASE}    ${BASE_URL}
        Set Test Variable    ${IMPORT_ADMIN}    ${ADMIN_BASE_URL}
    ELSE
        Set Test Variable    ${IMPORT_BASE}    ${TARGET_BASE_URL}
        Set Test Variable    ${IMPORT_ADMIN}    ${TARGET_ADMIN_BASE_URL}
    END
    ${admin}=    Generate Admin Token    admin_base_url=${IMPORT_ADMIN}
    Create Http Session    import_admin    ${IMPORT_ADMIN}    verify=false
    ${request}=    Import Request    ${doc}
    ${imported}=    POST On Session    import_admin    /api/admin/matches/import    json=${request}
    ...    headers=${{ {'Authorization': 'Bearer ' + $admin} }}    expected_status=any    timeout=${HTTP_POST_TIMEOUT}
    Should Be True    ${imported.status_code} in (200, 201)    msg=${imported.text}
    Append To List    ${CREATED_MATCHES}    ${doc}[match][uuid]
    Create Http Session    import_dev    ${IMPORT_ADMIN}    verify=false
    ${minted}=    POST On Session    import_dev    /api/dev/google-token    expected_status=200
    ...    json=${{ {'sub': $sub, 'email': $email, 'nonce': 'robot-nonce'} }}    timeout=${HTTP_POST_TIMEOUT}
    Create Http Session    import_public    ${IMPORT_BASE}    verify=false
    ${login}=    POST On Session    import_public    /api/auth/google    expected_status=200
    ...    json=${{ {'idToken': $minted.json()['idToken'], 'nonce': 'robot-nonce'} }}    timeout=${HTTP_POST_TIMEOUT}
    Should Be Equal    ${login.json()}[userUuid]    ${user}
    Should Not Be True    ${login.json()}[newUser]
    ${matches}=    GET On Session    import_public    /api/matches    expected_status=200
    ...    headers=${{ {'Authorization': 'Bearer ' + $login.json()['accessToken']} }}
    ${uuids}=    Evaluate    [m['uuid'] for m in $matches.json()]
    Should Contain    ${uuids}    ${doc}[match][uuid]


*** Keywords ***

Migration Suite Setup
    Suite Setup Alpha Prep
    Create Dev Session

Exported Google Match
    [Documentation]    A played prep match (snapshot written) whose guest signed in with a new Google
    ...                account (the match moved to it), exported: (document, email, subject, user uuid).
    ${guest}    ${match}=    Fresh Prep Match
    Run Prep Event    ${guest}    ${match}    14
    Sleep Action    ${guest}    ${match}    200
    ${email}    ${sub}=    New Robot Gmail
    ${token}=    Fake Google Token    sub=${sub}    email=${email}    nonce=robot-nonce
    ${login}=    Google Login    ${token}    bearer=${guest}
    Status Should Be    ${login}    200
    ${headers}=    Get Auth Headers    ${ADMIN_TOKEN}
    ${resp}=    POST On Session    admin_session    /api/admin/matches/${match}/export
    ...    headers=${headers}    expected_status=200    timeout=${HTTP_POST_TIMEOUT}
    RETURN    ${resp.json()}    ${email}    ${sub}    ${login.json()}[userUuid]

Delete The Google User Here
    [Documentation]    DELETE /api/auth/me with a fresh token, then the deletion job: this stage no longer
    ...                knows the user (nor its match), as a new stage would not.
    [Arguments]    ${email}    ${sub}
    ${t1}=    Fake Google Token    sub=${sub}    email=${email}    nonce=robot-nonce
    ${login}=    Google Login    ${t1}
    ${fresh}=    Fake Google Token    sub=${sub}    email=${email}
    ${deleted}=    Delete Me    ${login.json()}[accessToken]    ${fresh}
    Status Should Be    ${deleted}    202
    Run Account Deletion Job
