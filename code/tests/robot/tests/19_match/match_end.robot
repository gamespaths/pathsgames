*** Settings ***
# ---------------------------------------------------------------------------
# match_end.robot — Step 20.1 single-player match completion via end-game event.
#
# Endpoints under test:
#   PATCH /api/match/{uuidMatch}/end/{uuidEvent}
#     200 → match status set to ENDED when uuidEvent is the story's idEventEndGame
#     401 → no Bearer token
#     404 → unknown match uuid or caller is not the owner
#     406 → uuidEvent is not the configured end-game event (EVENT_NOT_END_GAME)
#
# Note: the API never exposes the story's idEventEndGame value. The Robot suite
# only validates the negative paths (401 / 404 / 406) which do not require
# knowing the actual end-game event uuid; happy-path completion is covered by
# the backend unit tests in each language (Java/Python/AWS lambda).
#
# Tags: matches, step20
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource

Suite Setup    Suite Setup Match End


*** Test Cases ***

End Match Without Token Returns 401
    [Documentation]    PATCH /api/match/{uuid}/end/{event} without Authorization → 401.
    [Tags]    matches    step20
    Create Public Session
    ${response}=    PATCH On Session    public_session
    ...    /api/match/${MATCH_UUID}/end/${RANDOM_EVENT_UUID}
    ...    expected_status=any
    Status Should Be    ${response}    401

End Match With Unknown Match Returns 404
    [Documentation]    PATCH against a non-existent match uuid → 404 MATCH_NOT_FOUND.
    [Tags]    matches    step20
    ${response}=    End Match    ${TOKEN}    ${UNKNOWN_UUID}    ${RANDOM_EVENT_UUID}
    Status Should Be    ${response}    404
    Response Field Should Equal    ${response}    error    MATCH_NOT_FOUND

End Match With Wrong Event Returns 406
    [Documentation]    PATCH with an event uuid that is NOT the story's idEventEndGame
    ...                → 406 EVENT_NOT_END_GAME.
    [Tags]    matches    step20
    ${response}=    End Match    ${TOKEN}    ${MATCH_UUID}    ${RANDOM_EVENT_UUID}
    Status Should Be    ${response}    406
    Response Field Should Equal    ${response}    error    EVENT_NOT_END_GAME

End Match From Other User Returns 404
    [Documentation]    PATCH on a match the caller does not own → 404 MATCH_NOT_FOUND
    ...                (ownership failures must NOT leak that the match exists).
    [Tags]    matches    step20
    ${response}=    POST On Session    public_session    /api/auth/guest
    Status Should Be    ${response}    201
    ${other_token}=    Set Variable    ${response.json()}[accessToken]
    ${response}=    End Match    ${other_token}    ${MATCH_UUID}    ${RANDOM_EVENT_UUID}
    Status Should Be    ${response}    404

End Match Response Never Exposes Id Event End Game
    [Documentation]    None of the End Match responses (200/404/406) may include
    ...                the story's idEventEndGame field — the value is private.
    [Tags]    matches    step20
    ${not_found}=    End Match    ${TOKEN}    ${UNKNOWN_UUID}    ${RANDOM_EVENT_UUID}
    Should Not Contain    ${not_found.text}    idEventEndGame
    ${not_accept}=    End Match    ${TOKEN}    ${MATCH_UUID}    ${RANDOM_EVENT_UUID}
    Should Not Contain    ${not_accept.text}    idEventEndGame


*** Keywords ***

Suite Setup Match End
    [Documentation]    Logs in as guest, creates a fresh match, and stores the
    ...                match uuid + a random "not the end game" event uuid as suite
    ...                variables for the test cases.
    Create Public Session
    ${response}=    POST On Session    public_session    /api/auth/guest
    Status Should Be    ${response}    201
    ${body}=    Set Variable    ${response.json()}
    Set Suite Variable    ${TOKEN}    ${body}[accessToken]
    ${story_uuid}    ${difficulty_uuid}=    Pick First Public Story With Difficulty
    ${created}=    Create Match    ${TOKEN}    ${story_uuid}    ${difficulty_uuid}
    Status Should Be    ${created}    201
    Set Suite Variable    ${MATCH_UUID}            ${created.json()}[uuid]
    # A UUID very unlikely to be the configured idEventEndGame
    Set Suite Variable    ${RANDOM_EVENT_UUID}     deadbeef-dead-beef-dead-beefdeadbeef
