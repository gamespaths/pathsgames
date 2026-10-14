*** Settings ***
# guest_cleanup.robot — v0.41.0 Step 41 E: aged guests (X-Test-Guest-Age-Days), withoutMatches purge,
# DELETE /expired keeping a guest that owns a match (the PostgreSQL FK regression); admin teardown.
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource

Suite Setup       Suite Setup Guest Cleanup
Suite Teardown    Suite Teardown Guest Cleanup


*** Variables ***
${GUESTS_PATH}      /api/admin/guests
${STALE_PATH}       /api/admin/guests/stale
${EXPIRED_PATH}     /api/admin/guests/expired
${AGE_DAYS}         400
${IDLE_BOUND}       365
@{CREATED_GUESTS}
@{CREATED_MATCHES}


*** Test Cases ***

The Match-Less Purge Takes The Idle Guest And Keeps The One With A Match
    [Documentation]    Guest A (no match) and guest B (one match), both idle for 400 days:
    ...                the preview and the purge with withoutMatches=true take A only, never
    ...                count a match, and B keeps both its account and its match.
    [Tags]    step41    alpha-prep    guests    admin
    ${a}=    New Aged Guest
    ${b}=    New Aged Guest
    ${match}=    Create Match    ${b}[accessToken]    ${STORY_UUID}    ${DIFFICULTY_UUID}    robottest_cleanup_b
    Status Should Be    ${match}    201
    Append To List    ${CREATED_MATCHES}    ${match.json()}[uuid]
    ${preview}=    Admin GET    ${STALE_PATH}?olderThanDays=${IDLE_BOUND}&withoutMatches=true
    Status Should Be    ${preview}    200
    Should Be True    ${preview.json()}[guests] >= 1    msg=the idle guest A was not counted
    Should Be Equal As Integers    ${preview.json()}[matches]    0
    ${purge}=    Admin DELETE    ${STALE_PATH}?olderThanDays=${IDLE_BOUND}&withoutMatches=true
    Status Should Be    ${purge}    200
    Should Be Equal    ${purge.json()}[status]    CLEANUP_COMPLETE
    Should Be True    ${purge.json()}[guests] >= 1
    Should Be Equal As Integers    ${purge.json()}[matches]    0
    ${gone}=    Admin GET    ${GUESTS_PATH}/${a}[userUuid]
    Status Should Be    ${gone}    404
    ${kept}=    Admin GET    ${GUESTS_PATH}/${b}[userUuid]
    Status Should Be    ${kept}    200
    ${info}=    Admin Get Match Info    ${ADMIN_TOKEN}    ${match.json()}[uuid]
    Status Should Be    ${info}    200

Any Other WithoutMatches Value Is Refused
    [Documentation]    Only true or false: anything else is 400 INVALID_INPUT, and the DELETE
    ...                removes nothing.
    [Tags]    step41    alpha-prep    guests    admin
    ${idle}=    New Aged Guest
    FOR    ${method}    IN    GET    DELETE
        ${resp}=    Admin Request    ${method}    ${STALE_PATH}?olderThanDays=${IDLE_BOUND}&withoutMatches=maybe
        Status Should Be    ${resp}    400
        Should Be Equal    ${resp.json()}[error]    INVALID_INPUT
    END
    ${still}=    Admin GET    ${GUESTS_PATH}/${idle}[userUuid]
    Status Should Be    ${still}    200

The Expired Cleanup Keeps The Expired Guest That Owns A Match
    [Documentation]    Guest C (expired, one match) and guest D (expired, no match):
    ...                DELETE /expired answers 200 — it used to fail on PostgreSQL, where a
    ...                match references its creator by foreign key — deletes D and keeps C.
    [Tags]    step41    alpha-prep    guests    admin    regression
    ${c}=    New Aged Guest
    ${d}=    New Aged Guest
    ${match}=    Create Match    ${c}[accessToken]    ${STORY_UUID}    ${DIFFICULTY_UUID}    robottest_cleanup_c
    Status Should Be    ${match}    201
    Append To List    ${CREATED_MATCHES}    ${match.json()}[uuid]
    ${resp}=    Admin DELETE    ${EXPIRED_PATH}
    Status Should Be    ${resp}    200
    Should Be Equal    ${resp.json()}[status]    CLEANUP_COMPLETE
    Should Be True    ${resp.json()}[deletedCount] >= 1
    ${kept}=    Admin GET    ${GUESTS_PATH}/${c}[userUuid]
    Status Should Be    ${kept}    200
    ${gone}=    Admin GET    ${GUESTS_PATH}/${d}[userUuid]
    Status Should Be    ${gone}    404
    ${info}=    Admin Get Match Info    ${ADMIN_TOKEN}    ${match.json()}[uuid]
    Status Should Be    ${info}    200


*** Keywords ***

Suite Setup Guest Cleanup
    Create Public Session
    Create Admin Session
    ${story}    ${difficulty}=    Pick First Public Story With Difficulty
    Set Suite Variable    ${STORY_UUID}    ${story}
    Set Suite Variable    ${DIFFICULTY_UUID}    ${difficulty}

Suite Teardown Guest Cleanup
    [Documentation]    Matches first (a match references its creator), then the guests.
    FOR    ${uuid}    IN    @{CREATED_MATCHES}
        Run Keyword And Ignore Error    Admin Stop Match      ${ADMIN_TOKEN}    ${uuid}
        Run Keyword And Ignore Error    Admin Delete Match    ${ADMIN_TOKEN}    ${uuid}
    END
    FOR    ${uuid}    IN    @{CREATED_GUESTS}
        Run Keyword And Ignore Error    Admin DELETE    ${GUESTS_PATH}/${uuid}
    END

New Aged Guest
    [Documentation]    A guest registered and last seen ${AGE_DAYS} days ago. The public session
    ...                sends X-Test-Marker; when the server ignores the age header (test
    ...                endpoints off) the suite has nothing to prove, so the case SKIPs.
    ${headers}=    Create Dictionary    X-Test-Guest-Age-Days=${AGE_DAYS}
    ${resp}=    POST On Session    public_session    /api/auth/guest    headers=${headers}
    Status Should Be    ${resp}    201
    ${body}=    Set Variable    ${resp.json()}
    Append To List    ${CREATED_GUESTS}    ${body}[userUuid]
    Remember Csrf Token    ${body}[accessToken]    ${body.get('csrfToken', '')}
    ${guest}=    Admin GET    ${GUESTS_PATH}/${body}[userUuid]
    Status Should Be    ${guest}    200
    ${seen}=    Set Variable    ${guest.json()}[tsLastAccess]
    ${days}=    Evaluate
    ...    (datetime.datetime.now(datetime.timezone.utc) - datetime.datetime.fromisoformat($seen.replace('Z', '+00:00'))).days
    ...    modules=datetime
    Skip If    ${days} < ${IDLE_BOUND}    X-Test-Guest-Age-Days is not honoured by this server (test endpoints off)
    RETURN    ${body}

Admin Request
    [Documentation]    Any admin call with the admin bearer; returns the response (any status).
    [Arguments]    ${method}    ${path}
    ${headers}=    Create Dictionary    Authorization=Bearer ${ADMIN_TOKEN}
    ${resp}=    Run Keyword    ${method} On Session    admin_session    ${path}
    ...    headers=${headers}    expected_status=any
    RETURN    ${resp}

Admin GET
    [Arguments]    ${path}
    ${resp}=    Admin Request    GET    ${path}
    RETURN    ${resp}

Admin DELETE
    [Arguments]    ${path}
    ${resp}=    Admin Request    DELETE    ${path}
    RETURN    ${resp}
