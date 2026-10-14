*** Settings ***
# ---------------------------------------------------------------------------
# duplicate_match_guard.robot — v0.32.1 one active match per user and story.
#
# POST /api/matches answers 409 ACTIVE_MATCH_ALREADY_EXISTS when the caller
# already owns a non-terminal match (CREATED / RUNNING / PAUSED) on that story.
# The guard runs after every 404 and 400, so a malformed request keeps reporting
# its own error, and nothing is written when it rejects.
#
# Every test creates its own guest: a guest that owns a match is exactly what the
# guard refuses, so a shared token would make the cases depend on their order.
#
# Endpoints under test:
#   POST /api/matches                              → 201 | 409
#   POST /api/admin/matches/{uuidMatch}/pause      → 200   (admin port)
#   POST /api/admin/matches/{uuidMatch}/stop       → 200   (admin port)
#
# Tags: matches, step19, duplicate
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource

Suite Setup       Suite Setup Duplicate Match Guard
Suite Teardown    Suite Teardown Duplicate Match Guard


*** Test Cases ***

Second Match On The Same Story Returns 409
    [Documentation]    A guest with a CREATED match on a story cannot create another
    ...                one: 409 ACTIVE_MATCH_ALREADY_EXISTS.
    [Tags]    matches    step19    duplicate
    ${token}=    New Guest Token
    ${first}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY_UUID}
    ...    robottest_dup_first
    Status Should Be    ${first}    201
    Remember Match    ${first.json()}[uuid]

    ${second}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY_UUID}
    ...    robottest_dup_second
    Status Should Be    ${second}    409
    Response Field Should Equal    ${second}    error    ACTIVE_MATCH_ALREADY_EXISTS

A Paused Match Still Blocks A New Match
    [Documentation]    PAUSED is suspended, not over: an admin-paused match keeps
    ...                occupying the story slot, so a new match is still refused.
    [Tags]    matches    step19    duplicate
    ${token}=    New Guest Token
    ${first}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY_UUID}
    ...    robottest_dup_paused
    Status Should Be    ${first}    201
    ${match_uuid}=    Set Variable    ${first.json()}[uuid]
    Remember Match    ${match_uuid}

    ${pause}=    Admin Pause Match    ${ADMIN_TOKEN}    ${match_uuid}
    Status Should Be    ${pause}    200

    ${second}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY_UUID}
    ...    robottest_dup_paused_second
    Status Should Be    ${second}    409
    Response Field Should Equal    ${second}    error    ACTIVE_MATCH_ALREADY_EXISTS

A New Match Is Allowed After The Previous One Is Ended
    [Documentation]    The guard is not a life sentence: once the match reaches a
    ...                terminal status the slot is free again.
    [Tags]    matches    step19    duplicate
    ${token}=    New Guest Token
    ${first}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY_UUID}
    ...    robottest_dup_ended
    Status Should Be    ${first}    201
    ${match_uuid}=    Set Variable    ${first.json()}[uuid]
    Remember Match    ${match_uuid}

    ${stop}=    Admin Stop Match    ${ADMIN_TOKEN}    ${match_uuid}
    Status Should Be    ${stop}    200

    ${second}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY_UUID}
    ...    robottest_dup_ended_second
    Status Should Be    ${second}    201
    Remember Match    ${second.json()}[uuid]

Another Guest Is Not Blocked By Someone Else's Match
    [Documentation]    The rule is per user AND story: a second guest may start the
    ...                same story while the first one is still playing it.
    [Tags]    matches    step19    duplicate
    ${first_token}=    New Guest Token
    ${first}=    Create Match    ${first_token}    ${STORY_UUID}    ${DIFFICULTY_UUID}
    ...    robottest_dup_owner
    Status Should Be    ${first}    201
    Remember Match    ${first.json()}[uuid]

    ${other_token}=    New Guest Token
    ${other}=    Create Match    ${other_token}    ${STORY_UUID}    ${DIFFICULTY_UUID}
    ...    robottest_dup_other_guest
    Status Should Be    ${other}    201
    Remember Match    ${other.json()}[uuid]

A Second Match On A Different Story Is Allowed
    [Documentation]    Same guest, another story: allowed. Skipped when the seed
    ...                exposes only one public story with a difficulty.
    [Tags]    matches    step19    duplicate
    IF    '${SECOND_STORY_UUID}' == ''
        Skip    Only one public story with a difficulty is seeded
    END
    ${token}=    New Guest Token
    ${first}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY_UUID}
    ...    robottest_dup_story_one
    Status Should Be    ${first}    201
    Remember Match    ${first.json()}[uuid]

    ${second}=    Create Match    ${token}    ${SECOND_STORY_UUID}    ${SECOND_DIFFICULTY_UUID}
    ...    robottest_dup_story_two
    # Whatever else the second story lacks (some seeds ship a demo story with no
    # locations), the guard must not be what refuses it.
    Should Not Be Equal As Integers    ${second.status_code}    409
    IF    ${second.status_code} == 400
        Skip    Second story cannot host a match on this seed: ${second.json()}[error]
    END
    Status Should Be    ${second}    201
    Remember Match    ${second.json()}[uuid]

An Unknown Story Still Returns 404 For A Guest With An Active Match
    [Documentation]    The guard runs after the 404s: a wrong story uuid keeps being
    ...                reported as not found even when the caller owns an active match.
    [Tags]    matches    step19    duplicate
    ${token}=    New Guest Token
    ${first}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY_UUID}
    ...    robottest_dup_order
    Status Should Be    ${first}    201
    Remember Match    ${first.json()}[uuid]

    ${unknown}=    Create Match    ${token}    ${UNKNOWN_UUID}    ${UNKNOWN_UUID}
    ...    robottest_dup_order_unknown
    Status Should Be    ${unknown}    404
    Response Field Should Equal    ${unknown}    error    STORY_NOT_FOUND


*** Keywords ***

Suite Setup Duplicate Match Guard
    [Documentation]    Opens the public and admin sessions, generates an admin token
    ...                (pause/stop live on the admin port) and resolves the story and
    ...                difficulty every test creates its matches on. Also resolves a
    ...                second public story when the seed has one.
    Create Public Session
    Create Session    admin_session    ${ADMIN_BASE_URL}    verify=false
    ${admin_token}=    Generate Admin Token
    Set Suite Variable    ${ADMIN_TOKEN}    ${admin_token}
    ${story_uuid}    ${difficulty_uuid}=    Pick First Public Story With Difficulty
    Set Suite Variable    ${STORY_UUID}        ${story_uuid}
    Set Suite Variable    ${DIFFICULTY_UUID}   ${difficulty_uuid}
    ${second_story}    ${second_difficulty}=    Pick Another Public Story With Difficulty
    ...    ${story_uuid}
    Set Suite Variable    ${SECOND_STORY_UUID}        ${second_story}
    Set Suite Variable    ${SECOND_DIFFICULTY_UUID}   ${second_difficulty}
    @{created}=    Create List
    Set Suite Variable    @{CREATED_MATCHES}    @{created}

Suite Teardown Duplicate Match Guard
    [Documentation]    Stops and deletes every match the suite created, so the guests
    ...                it leaves behind own no active match.
    FOR    ${match_uuid}    IN    @{CREATED_MATCHES}
        Run Keyword And Ignore Error    Admin Stop Match      ${ADMIN_TOKEN}    ${match_uuid}
        Run Keyword And Ignore Error    Admin Delete Match    ${ADMIN_TOKEN}    ${match_uuid}
    END

Remember Match
    [Documentation]    Records a match uuid for the suite teardown to clean up.
    [Arguments]    ${match_uuid}
    Append To List    ${CREATED_MATCHES}    ${match_uuid}

Pick Another Public Story With Difficulty
    [Documentation]    Returns (storyUuid, difficultyUuid) of the first public story
    ...                with at least one difficulty that is NOT the given one, or
    ...                (${EMPTY}, ${EMPTY}) when the seed has no second story.
    [Arguments]    ${exclude_story_uuid}
    ${response}=    GET On Session    public_session    /api/stories
    Status Should Be    ${response}    200
    FOR    ${story}    IN    @{response.json()}
        IF    "${story}[uuid]" == "${exclude_story_uuid}"    CONTINUE
        ${detail_response}=    GET On Session    public_session    /api/stories/${story}[uuid]
        IF    ${detail_response.status_code} != 200    CONTINUE
        ${difficulties}=    Get From Dictionary    ${detail_response.json()}    difficulties    ${EMPTY}
        IF    not ${difficulties}    CONTINUE
        RETURN    ${story}[uuid]    ${difficulties}[0][uuid]
    END
    RETURN    ${EMPTY}    ${EMPTY}
