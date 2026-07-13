*** Settings ***
# ---------------------------------------------------------------------------
# character_flags.robot — Step 29, admin control over a character's state flags.
#
# POST /api/admin/matches/{uuidMatch}/player/{uuidPlayer}/changeStatistics carries, next to
# the nine numeric statistics, two booleans: `sleeping` and `coma`. Omitting one leaves the
# flag as it is (the `-1` of the numbers).
#
# The contract under test, end-to-end and backend-agnostic:
#
#   1. A character in a coma can act on nothing: match-info blocks every event of its
#      location with reason COMA, and execute-event refuses with the same code (409).
#   2. A sleeping character is blocked the same way, but with reason SLEEPING — the two are
#      told apart, because one wakes up on its own and the other needs a rescue.
#   3. Clearing the coma hands back a character that can ACT: it is also woken up, and its
#      life is lifted to at least 1 — otherwise the engine would drop it straight back in.
#
# Point 3 is the reason the admin flag exists at all: the in-game rescue is Step 38, so
# until then this endpoint is the only way out of a coma.
#
# Tags: events, step29, admin, flags
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource

Suite Setup    Suite Setup Character Flags


*** Test Cases ***

A Character In A Coma Is Blocked With Reason COMA
    [Documentation]    Every event of the location goes unavailable, and execute-event agrees.
    [Tags]    events    step29    admin    flags
    Set Character Flags    coma=${True}

    ${events}=    Location Events
    Should Not Be Empty    ${events}
    FOR    ${e}    IN    @{events}
        Should Not Be True    ${e}[available]
        ...    msg=a comatose character must not be offered event ${e}[uuid]
        Should Be Equal    ${e}[reason]    COMA
    END

    ${resp}=    Execute Event    ${TOKEN}    ${MATCH_UUID}    ${events}[0][uuid]    409
    Should Be Equal    ${resp.json()}[error]    COMA

Clearing The Coma Wakes The Character And Lets It Act Again
    [Documentation]    The whole point of the flag: what comes back must be able to play.
    ...                Life is lifted to at least 1, so the engine cannot re-open the coma.
    [Tags]    events    step29    admin    flags
    Set Character Flags    coma=${False}

    ${character}=    Get Character Detail    ${TOKEN}    ${MATCH_UUID}    ${CHARACTER_MATCH_UUID}    200
    Should Be True    ${character.json()}[life] > 0
    ...    msg=a character out of a coma must have a life to act with

    ${uuid}=    Any Available Event Uuid
    Execute Event    ${TOKEN}    ${MATCH_UUID}    ${uuid}    200

A Sleeping Character Is Blocked With Reason SLEEPING
    [Documentation]    Same block, different news: asleep is not the same as comatose.
    [Tags]    events    step29    admin    flags
    Set Character Flags    sleeping=${True}

    ${events}=    Location Events
    FOR    ${e}    IN    @{events}
        Should Not Be True    ${e}[available]
        Should Be Equal    ${e}[reason]    SLEEPING
    END

    ${resp}=    Execute Event    ${TOKEN}    ${MATCH_UUID}    ${events}[0][uuid]    409
    Should Be Equal    ${resp.json()}[error]    SLEEPING

    # And waking it up puts it back in play.
    Set Character Flags    sleeping=${False}
    ${uuid}=    Any Available Event Uuid
    Execute Event    ${TOKEN}    ${MATCH_UUID}    ${uuid}    200


*** Keywords ***

Suite Setup Character Flags
    [Documentation]    A running single-player match whose character stands at the start
    ...                location, where the seeded Step 29 events live.
    Create Admin Session
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    ${guest}=    POST On Session    public_session    /api/auth/guest
    Status Should Be    ${guest}    201
    Set Suite Variable    ${TOKEN}    ${guest.json()}[accessToken]

    ${match}=    Create Match    ${TOKEN}    ${story}    ${difficulty}    robottest_step29_flags
    Status Should Be    ${match}    201
    Set Suite Variable    ${MATCH_UUID}    ${match.json()}[uuid]

    ${trait_list}=    Create List
    IF    '${trait}' != ''
        Append To List    ${trait_list}    ${trait}
    END
    ${join}=    Join Match    ${TOKEN}    ${MATCH_UUID}    ${character}    ${class}    ${trait_list}
    Status Should Be    ${join}    201
    # The character instance of THIS match — the uuid the admin endpoint addresses.
    Set Suite Variable    ${CHARACTER_MATCH_UUID}    ${join.json()}[uuid]
    Start Match    ${TOKEN}    ${MATCH_UUID}    200

Set Character Flags
    [Documentation]    POST changeStatistics with only the flags: every numeric field is left
    ...                out, so nothing else on the character moves.
    [Arguments]    ${sleeping}=${NONE}    ${coma}=${NONE}
    &{body}=    Create Dictionary
    IF    $sleeping is not None
        Set To Dictionary    ${body}    sleeping=${sleeping}
    END
    IF    $coma is not None
        Set To Dictionary    ${body}    coma=${coma}
    END
    ${resp}=    POST On Session    admin_session
    ...    /api/admin/matches/${MATCH_UUID}/player/${CHARACTER_MATCH_UUID}/changeStatistics
    ...    json=${body}    expected_status=200
    Should Be Equal    ${resp.json()}[status]    UPDATED

Location Events
    [Documentation]    The events of the location the character currently stands in.
    ${info}=    Get Match Info    ${TOKEN}    ${MATCH_UUID}    200    lang=en
    ${body}=    Set Variable    ${info.json()}
    ${current}=    Set Variable    ${body}[currentLocationId]
    FOR    ${entry}    IN    @{body}[locationsActive]
        IF    $entry['idLocation'] == $current    RETURN    ${entry}[events]
    END
    Fail    the character's location ${current} is not among locationsActive

Any Available Event Uuid
    [Documentation]    Any event `/info` currently offers: what the board offers, the endpoint
    ...                accepts.
    ${events}=    Location Events
    FOR    ${e}    IN    @{events}
        IF    $e['available']    RETURN    ${e}[uuid]
    END
    Fail    no event at the location is available
