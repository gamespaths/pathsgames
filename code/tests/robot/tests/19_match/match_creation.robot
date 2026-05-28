*** Settings ***
# ---------------------------------------------------------------------------
# match_creation.robot — Step 19 single-player match creation.
#
# Endpoints under test:
#   POST /api/matches                  → 201
#   GET  /api/matches                  → 200
#   GET  /api/admin/matches            → 200 | 403
#   GET  /api/match/{uuidMatch}/info   → 200 | 404
#
# Tags: matches, step19
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource

Suite Setup    Suite Setup Match Creation


*** Test Cases ***

Create Match Without Token Returns 401
    [Documentation]    POST /api/matches without an Authorization header is rejected with 401.
    [Tags]    matches    step19
    Create Public Session
    &{body}=    Create Dictionary    storyUuid=${STORY_UUID}    difficultyUuid=${DIFFICULTY_UUID}
    ${response}=    POST On Session    public_session    /api/matches
    ...    json=${body}
    ...    expected_status=any
    Status Should Be    ${response}    401

Create Match With Empty Body Returns 400
    [Documentation]    POST /api/matches with empty JSON body is rejected with 400.
    [Tags]    matches    step19
    ${headers}=    Get Auth Headers    ${TOKEN}
    Set To Dictionary    ${headers}    Content-Type=application/json
    &{empty}=    Create Dictionary
    ${response}=    POST On Session    public_session    /api/matches
    ...    json=${empty}
    ...    headers=${headers}
    ...    expected_status=any
    Status Should Be    ${response}    400

Create Match With Unknown Story Returns 404
    [Documentation]    POST /api/matches for a non-existent story uuid → 404 STORY_NOT_FOUND.
    [Tags]    matches    step19
    ${response}=    Create Match    ${TOKEN}    ${UNKNOWN_UUID}    ${UNKNOWN_UUID}
    Status Should Be    ${response}    404
    Response Field Should Equal    ${response}    error    STORY_NOT_FOUND

Create Match With Unknown Difficulty Returns 404
    [Documentation]    Existing story but unknown difficulty uuid → 404 DIFFICULTY_NOT_FOUND.
    [Tags]    matches    step19
    ${response}=    Create Match    ${TOKEN}    ${STORY_UUID}    ${UNKNOWN_UUID}
    Status Should Be    ${response}    404
    Response Field Should Equal    ${response}    error    DIFFICULTY_NOT_FOUND

Create Match Happy Path Returns 201
    [Documentation]    Valid story+difficulty creates a match (201) and surfaces a uuid.
    [Tags]    matches    step19
    ${response}=    Create Match    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}
    Status Should Be    ${response}    201
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    uuid
    Dictionary Should Contain Key    ${body}    status
    Should Be Equal As Strings    ${body}[status]    CREATED
    Set Suite Variable    ${MATCH_UUID}    ${body}[uuid]

List Matches Returns Created Match
    [Documentation]    GET /api/matches lists the match created above.
    [Tags]    matches    step19
    ${response}=    List Matches    ${TOKEN}
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    Should Not Be Empty    ${body}
    ${found}=    Set Variable    ${False}
    FOR    ${m}    IN    @{body}
        IF    "${m}[uuid]" == "${MATCH_UUID}"
            ${found}=    Set Variable    ${True}
            BREAK
        END
    END
    Should Be True    ${found}

List All Matches As Admin Returns Created Match
    [Documentation]    GET /api/admin/matches with an ADMIN token lists every
    ...                match on the platform, including the one created above.
    [Tags]    matches    step19
    ${admin_token}=    Generate Admin Token
    ${response}=    List All Matches    ${admin_token}
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    Should Not Be Empty    ${body}
    ${found}=    Set Variable    ${False}
    FOR    ${m}    IN    @{body}
        IF    "${m}[uuid]" == "${MATCH_UUID}"
            ${found}=    Set Variable    ${True}
            BREAK
        END
    END
    Should Be True    ${found}

List All Matches As Non Admin Returns 403
    [Documentation]    GET /api/admin/matches with a non-admin (guest) token → 403.
    [Tags]    matches    step19
    ${response}=    List All Matches    ${TOKEN}
    Status Should Be    ${response}    403

Get Match Info Returns Runtime State
    [Documentation]    GET /api/match/{uuid}/info returns the runtime state created at POST time.
    [Tags]    matches    step19
    ${response}=    Get Match Info    ${TOKEN}    ${MATCH_UUID}
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    match
    Dictionary Should Contain Key    ${body}    locations
    Dictionary Should Contain Key    ${body}    registry
    Dictionary Should Contain Key    ${body}    events
    Dictionary Should Contain Key    ${body}    choices
    Should Be Equal As Strings    ${body}[match][uuid]    ${MATCH_UUID}

Get Match Info For Unknown Match Returns 404
    [Documentation]    Unknown match uuid → 404 MATCH_NOT_FOUND.
    [Tags]    matches    step19
    ${response}=    Get Match Info    ${TOKEN}    ${UNKNOWN_UUID}
    Status Should Be    ${response}    404

Get Match Info From Other User Returns 404
    [Documentation]    A new guest user cannot see the original user's match.
    [Tags]    matches    step19
    ${response}=    POST On Session    public_session    /api/auth/guest
    Status Should Be    ${response}    201
    ${other_token}=    Set Variable    ${response.json()}[accessToken]
    ${response}=    Get Match Info    ${other_token}    ${MATCH_UUID}
    Status Should Be    ${response}    404

Create Match With Loadout Persists Character Class Traits And Flag
    [Documentation]    POST /api/matches with characterTemplateUuid, classUuid,
    ...                traitUuids and singlePlayer returns 201; the loadout is
    ...                persisted and read back via GET /api/match/{uuid}/info.
    [Tags]    matches    step19
    ${traits}=    Create List
    ...    11111111-1111-1111-1111-111111111111
    ...    22222222-2222-2222-2222-222222222222
    ${response}=    Create Match With Loadout    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}
    ...    aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa    bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb    ${traits}    ${1}
    Status Should Be    ${response}    201
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Integers    ${body}[singlePlayer]    1
    Should Be Equal As Strings    ${body}[characterTemplateUuid]    aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
    Should Be Equal As Strings    ${body}[classUuid]    bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
    Length Should Be    ${body}[traitUuids]    2
    ${info}=    Get Match Info    ${TOKEN}    ${body}[uuid]
    Status Should Be    ${info}    200
    ${match}=    Set Variable    ${info.json()}[match]
    Should Be Equal As Integers    ${match}[singlePlayer]    1
    Should Be Equal As Strings    ${match}[classUuid]    bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
    Length Should Be    ${match}[traitUuids]    2


*** Keywords ***

Suite Setup Match Creation
    [Documentation]    Logs in as guest, picks the first public story with at least
    ...                one difficulty and stores them as suite variables.
    Create Public Session
    ${response}=    POST On Session    public_session    /api/auth/guest
    Status Should Be    ${response}    201
    ${body}=    Set Variable    ${response.json()}
    Set Suite Variable    ${TOKEN}    ${body}[accessToken]
    ${story_uuid}    ${difficulty_uuid}=    Pick First Public Story With Difficulty
    Set Suite Variable    ${STORY_UUID}        ${story_uuid}
    Set Suite Variable    ${DIFFICULTY_UUID}   ${difficulty_uuid}
