*** Settings ***
# ---------------------------------------------------------------------------
# matches.resource — keywords for the Step 19 match endpoints.
#
# Authenticated (Bearer access token issued by /api/auth/guest):
#   POST /api/matches                  → 201, MatchSummary
#   GET  /api/matches                  → 200, MatchSummary[]
#   GET  /api/match/{uuidMatch}/info   → 200 MatchInfo | 404
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   common.resource
Resource   auth.resource


*** Keywords ***

Create Match
    [Documentation]    POST /api/matches with the given Bearer token and body.
    [Arguments]    ${token}    ${story_uuid}    ${difficulty_uuid}
    ...    ${name}=Robot match    ${expected_status}=any
    ${headers}=    Get Auth Headers    ${token}
    Set To Dictionary    ${headers}    Content-Type=application/json
    &{body}=    Create Dictionary
    ...    storyUuid=${story_uuid}
    ...    difficultyUuid=${difficulty_uuid}
    ...    name=${name}
    ${response}=    POST On Session    public_session    /api/matches
    ...    headers=${headers}
    ...    json=${body}
    ...    expected_status=${expected_status}
    RETURN    ${response}

List Matches
    [Documentation]    GET /api/matches with the given Bearer token.
    [Arguments]    ${token}    ${expected_status}=any
    ${headers}=    Get Auth Headers    ${token}
    ${response}=    GET On Session    public_session    /api/matches
    ...    headers=${headers}
    ...    expected_status=${expected_status}
    RETURN    ${response}

Get Match Info
    [Documentation]    GET /api/match/{uuidMatch}/info with the given Bearer token.
    [Arguments]    ${token}    ${match_uuid}    ${expected_status}=any
    ${headers}=    Get Auth Headers    ${token}
    ${response}=    GET On Session    public_session    /api/match/${match_uuid}/info
    ...    headers=${headers}
    ...    expected_status=${expected_status}
    RETURN    ${response}

Pick First Public Story With Difficulty
    [Documentation]    Returns (storyUuid, difficultyUuid) for the first
    ...                publicly visible story whose detail page exposes at
    ...                least one difficulty.
    Create Public Session
    ${response}=    GET On Session    public_session    /api/stories
    Status Should Be    ${response}    200
    ${stories}=    Set Variable    ${response.json()}
    Should Not Be Empty    ${stories}
    FOR    ${story}    IN    @{stories}
        ${detail_response}=    GET On Session    public_session    /api/stories/${story}[uuid]
        IF    ${detail_response.status_code} != 200    CONTINUE
        ${detail}=    Set Variable    ${detail_response.json()}
        ${difficulties}=    Get From Dictionary    ${detail}    difficulties    ${EMPTY}
        IF    not ${difficulties}    CONTINUE
        ${first_difficulty}=    Set Variable    ${difficulties}[0]
        RETURN    ${story}[uuid]    ${first_difficulty}[uuid]
    END
    Fail    No public story with at least one difficulty was found
