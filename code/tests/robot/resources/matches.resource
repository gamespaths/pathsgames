*** Settings ***
# ---------------------------------------------------------------------------
# matches.resource — keywords for the Step 19 match endpoints.
#
# Authenticated (Bearer access token issued by /api/auth/guest):
#   POST /api/matches                  → 201, MatchSummary
#   GET  /api/matches                  → 200, MatchSummary[]
#   GET  /api/match/{uuidMatch}/info   → 200 MatchInfo | 404
#
# Admin (Bearer access token with role ADMIN):
#   GET  /api/admin/matches            → 200, MatchSummary[] | 403
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   common.resource
Resource   auth.resource


*** Keywords ***

Create Match
    [Documentation]    POST /api/matches with the given Bearer token and body.
    [Arguments]    ${token}    ${story_uuid}    ${difficulty_uuid}
    ...    ${name}=robottest_match    ${expected_status}=any
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

Create Match With Loadout
    [Documentation]    POST /api/matches with the full creator loadout —
    ...                character template, class, traits and single-player flag.
    [Arguments]    ${token}    ${story_uuid}    ${difficulty_uuid}
    ...    ${character_uuid}    ${class_uuid}    ${trait_uuids}    ${single_player}
    ...    ${expected_status}=any
    ${headers}=    Get Auth Headers    ${token}
    Set To Dictionary    ${headers}    Content-Type=application/json
    &{body}=    Create Dictionary
    ...    storyUuid=${story_uuid}
    ...    difficultyUuid=${difficulty_uuid}
    ...    name=robottest_loadout_match
    ...    characterTemplateUuid=${character_uuid}
    ...    classUuid=${class_uuid}
    ...    traitUuids=${trait_uuids}
    ...    singlePlayer=${single_player}
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

List All Matches
    [Documentation]    GET /api/admin/matches with the given Bearer token (admin-only).
    [Arguments]    ${token}    ${expected_status}=any
    ${headers}=    Get Auth Headers    ${token}
    ${response}=    GET On Session    public_session    /api/admin/matches
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
