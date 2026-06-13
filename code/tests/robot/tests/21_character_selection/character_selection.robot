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
Library    ../../resources/JwtHelper.py
Library    ../../resources/Step21Helper.py
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

Match Info Exposes Players Array
    [Documentation]    GET /api/match/{uuid}/info carries the additive players[] array (Step
    ...                21 §2.4) listing the joined character.
    [Tags]    characters    step21
    ${response}=    Get Match Info    ${TOKEN}    ${MATCH_UUID}
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    players
    Should Not Be Empty    ${body}[players]
    ${uuids}=    Evaluate    [p.get('uuid') for p in $body['players']]
    Should Contain    ${uuids}    ${CHAR_UUID}

Join With Unknown Template Returns 404
    [Documentation]    Joining with an unresolvable characterTemplateUuid → 404 TEMPLATE_NOT_FOUND.
    [Tags]    characters    step21
    ${match_uuid}=    Create Fresh Joinable Match
    ${response}=    Join Match    ${TOKEN}    ${match_uuid}
    ...    no-such-template    ${CLASS_UUID}    ${NONE}    expected_status=404
    Should Be Equal As Strings    ${response.json()}[error]    TEMPLATE_NOT_FOUND

Join With Unknown Class Returns 404
    [Documentation]    Joining with an unresolvable classUuid → 404 CLASS_NOT_FOUND.
    [Tags]    characters    step21
    ${match_uuid}=    Create Fresh Joinable Match
    ${response}=    Join Match    ${TOKEN}    ${match_uuid}
    ...    ${CHARACTER_UUID}    no-such-class    ${NONE}    expected_status=404
    Should Be Equal As Strings    ${response.json()}[error]    CLASS_NOT_FOUND

Join With Incompatible Class Returns 409
    [Documentation]    A template restricted to (or prohibiting) a class, joined with an
    ...                incompatible class → 409 CLASS_NOT_COMPATIBLE. Skipped when the seed
    ...                exposes no class-restricted template.
    [Tags]    characters    step21
    ${tpl_uuid}    ${cls_uuid}=    Find Incompatible Template Class    ${DETAIL}
    IF    '${tpl_uuid}' == ''
        Pass Execution    Seed has no class-restricted template — scenario skipped
    END
    ${match_uuid}=    Create Fresh Joinable Match
    ${response}=    Join Match    ${TOKEN}    ${match_uuid}
    ...    ${tpl_uuid}    ${cls_uuid}    ${NONE}    expected_status=409
    Should Be Equal As Strings    ${response.json()}[error]    CLASS_NOT_COMPATIBLE

Join Terminated Match Returns 409
    [Documentation]    A match stopped by the admin (status ENDED) is no longer joinable →
    ...                409 MATCH_NOT_JOINABLE.
    [Tags]    characters    step21
    ${match_uuid}=    Create Fresh Joinable Match
    ${stop}=    Admin Stop Match    ${ADMIN_TOKEN}    ${match_uuid}
    Status Should Be    ${stop}    200
    ${response}=    Join Match    ${TOKEN}    ${match_uuid}
    ...    ${CHARACTER_UUID}    ${CLASS_UUID}    ${NONE}    expected_status=409
    Should Be Equal As Strings    ${response.json()}[error]    MATCH_NOT_JOINABLE

Get Players From Non Participant Returns 404
    [Documentation]    A guest who has no character in the match cannot list its players → 404.
    [Tags]    characters    step21
    ${other}=    POST On Session    public_session    /api/auth/guest
    Status Should Be    ${other}    201
    ${response}=    Get Match Players    ${other.json()}[accessToken]    ${MATCH_UUID}
    Status Should Be    ${response}    404


*** Keywords ***

Create Fresh Joinable Match
    [Documentation]    Creates a new CREATED (joinable) single-player match and returns its uuid.
    ${match}=    Create Match    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}    robottest_step21
    Status Should Be    ${match}    201
    RETURN    ${match.json()}[uuid]

Suite Setup Character Selection
    [Documentation]    Logs in as guest and resolves a real joinable loadout from a
    ...                public story (story, difficulty, character template, class, trait).
    ...                Also opens an admin session (admin port) and loads the full story
    ...                detail for the class-compatibility / players scenarios.
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
    ${detail}=    GET On Session    public_session    /api/stories/${story}
    Status Should Be    ${detail}    200
    Set Suite Variable    ${DETAIL}    ${detail.json()}
    ${admin_token}=    Generate Admin Token
    Set Suite Variable    ${ADMIN_TOKEN}    ${admin_token}
    Create Session    admin_session    ${ADMIN_BASE_URL}    verify=false
