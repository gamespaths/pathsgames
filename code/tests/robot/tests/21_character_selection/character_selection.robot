*** Settings ***
# ---------------------------------------------------------------------------
# character_selection.robot — Step 21 character template & class selection.
#
# Endpoints under test (player, Bearer access token from /api/auth/guest):
#   POST /api/matches/{uuidMatch}/join                       → 201 | 400 | 401 | 404 | 409
#   GET  /api/match/{uuidMatch}/players                      → 200 | 401 | 404
#   GET  /api/match/{uuidMatch}/characters/{uuidCharacter}   → 200 | 404
#
# The loadout (character template + class + difficulty) is resolved at runtime
# from a public story's detail, because the seeded uuids are auto-generated.
#
# Tags: characters, step21
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource

Suite Setup    Suite Setup Character Selection


*** Test Cases ***

Join Match Creates Character With Computed Stats
    [Documentation]    POST /api/matches/{uuid}/join returns 201 with a character whose
    ...                statistics are the computed template+class+difficulty(+traits) totals;
    ...                life and energy start at their maximum (> 0).
    [Tags]    characters    step21
    ${match}=    Create Match    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}    robottest_step21
    Status Should Be    ${match}    201
    ${match_uuid}=    Set Variable    ${match.json()}[uuid]
    Set Suite Variable    ${MATCH_UUID}    ${match_uuid}

    ${trait_list}=    Create List
    IF    '${TRAIT_UUID}' != ''
        Append To List    ${trait_list}    ${TRAIT_UUID}
    END
    ${response}=    Join Match    ${TOKEN}    ${MATCH_UUID}
    ...    ${CHARACTER_UUID}    ${CLASS_UUID}    ${trait_list}
    Status Should Be    ${response}    201
    ${char}=    Set Variable    ${response.json()}
    Set Suite Variable    ${CHAR_UUID}    ${char}[uuid]

    Should Be Equal As Strings    ${char}[characterTemplateUuid]    ${CHARACTER_UUID}
    Should Be Equal As Strings    ${char}[classUuid]    ${CLASS_UUID}
    Should Be True    ${char}[life] > 0
    Should Be True    ${char}[energy] > 0
    Should Be True    ${char}[dexterity] > 0
    Dictionary Should Contain Key    ${char}    food
    Dictionary Should Contain Key    ${char}    matchUuid

Get Match Players Lists The Joined Character
    [Documentation]    GET /api/match/{uuid}/players returns the single joined character.
    [Tags]    characters    step21
    ${response}=    Get Match Players    ${TOKEN}    ${MATCH_UUID}
    Status Should Be    ${response}    200
    ${players}=    Set Variable    ${response.json()}
    Length Should Be    ${players}    1
    Should Be Equal As Strings    ${players}[0][uuid]    ${CHAR_UUID}
    Should Be True    ${players}[0][life] > 0

Get Character Detail Returns Full Stats
    [Documentation]    GET /api/match/{uuid}/characters/{uuidCharacter} returns the full detail.
    [Tags]    characters    step21
    ${response}=    Get Character Detail    ${TOKEN}    ${MATCH_UUID}    ${CHAR_UUID}
    Status Should Be    ${response}    200
    ${char}=    Set Variable    ${response.json()}
    Should Be Equal As Strings    ${char}[uuid]    ${CHAR_UUID}
    Should Be True    ${char}[life] > 0
    Dictionary Should Contain Key    ${char}    traitUuids

Join Match Twice Returns 409
    [Documentation]    A second join by the same user in the same match → 409 ALREADY_JOINED.
    [Tags]    characters    step21
    ${response}=    Join Match    ${TOKEN}    ${MATCH_UUID}    ${CHARACTER_UUID}    ${CLASS_UUID}
    Status Should Be    ${response}    409

Join Unknown Match Returns 404
    [Documentation]    Joining a non-existent match → 404 MATCH_NOT_FOUND.
    [Tags]    characters    step21
    ${response}=    Join Match    ${TOKEN}    ${UNKNOWN_UUID}    ${CHARACTER_UUID}    ${CLASS_UUID}
    Status Should Be    ${response}    404

Get Match Players Without Token Returns 401
    [Documentation]    GET /api/match/{uuid}/players without a Bearer token → 401.
    [Tags]    characters    step21
    Create Public Session
    ${response}=    GET On Session    public_session    /api/match/${MATCH_UUID}/players
    ...    expected_status=any
    Status Should Be    ${response}    401

Get Unknown Character Returns 404
    [Documentation]    GET a non-existent character in a real match → 404 CHARACTER_NOT_FOUND.
    [Tags]    characters    step21
    ${response}=    Get Character Detail    ${TOKEN}    ${MATCH_UUID}    ${UNKNOWN_UUID}
    Status Should Be    ${response}    404


*** Keywords ***

Suite Setup Character Selection
    [Documentation]    Logs in as guest and resolves a real joinable loadout from a
    ...                public story (story, difficulty, character template, class, trait).
    Create Public Session
    ${response}=    POST On Session    public_session    /api/auth/guest
    Status Should Be    ${response}    201
    Set Suite Variable    ${TOKEN}    ${response.json()}[accessToken]
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}        ${story}
    Set Suite Variable    ${DIFFICULTY_UUID}   ${difficulty}
    Set Suite Variable    ${CHARACTER_UUID}    ${character}
    Set Suite Variable    ${CLASS_UUID}        ${class}
    Set Suite Variable    ${TRAIT_UUID}        ${trait}
