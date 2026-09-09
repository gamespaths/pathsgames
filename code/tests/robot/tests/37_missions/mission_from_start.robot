*** Settings ***
# ---------------------------------------------------------------------------
# mission_from_start.robot — v0.37.1, the START location writes its key, and that key
# opens a mission.
#
# The party begins standing in idLocationStart and never ARRIVES there: the state row is
# seeded flagVisited = 1 on purpose (Step 33), so the place the story opens in does not
# announce itself as a discovery. Until this version that reasoning also swallowed the
# location's registry pair, which made keyToAdd the one authored field of the starting
# location that could never be written, at any point of any match — and a Step 37 mission
# waiting on that key could never open.
#
# The contract under test, end-to-end and backend-agnostic:
#
#   1. The key is absent while the match is CREATED: creation does not write it.
#   2. Starting the match (CREATED -> RUNNING) writes the FIRST-ENTRY pair of the starting
#      location, exactly once, with one REGISTRY_CHANGE row like any other write.
#   3. The mission whose conditionKey is that key is REACHED as the match starts — no event
#      executed, no movement made — and carries its authored steps.
#   4. A step no one has satisfied holds it at AVAILABLE: opening is not completing.
#
# The fixture is found by BEHAVIOUR: the suite walks the public stories and takes the first
# whose START location carries a keyToAdd that a mission reads. Nothing is addressed by a
# seeded id or uuid, and the whole suite Skips itself when no seed ships such a story.
#
# Tags: missions, step37, registry
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource
Resource   ../../resources/missions.resource

Suite Setup    Suite Setup Mission From Start


*** Test Cases ***

Creating A Match Does Not Write The Start Location Key
    [Documentation]    The key belongs to the START of the story, not to its creation: a
    ...                match that has not started holds nothing for it, and no mission.
    [Tags]    missions    step37    registry
    ${token}    ${match}=    Joined Match Not Started

    ${members}=    Registry Values Of    ${token}    ${match}    ${START_KEY}
    Should Be Empty    ${members}
    ...    msg=match creation wrote the start location key, which start-up must own

Starting The Match Writes The Start Location Key
    [Documentation]    The regression itself: the party never enters the starting location,
    ...                so only the CREATED -> RUNNING transition can write its first pair.
    [Tags]    missions    step37    registry
    ${token}    ${match}=    Started Match

    ${members}=    Registry Values Of    ${token}    ${match}    ${START_KEY}
    Should Contain    ${members}    ${START_VALUE}
    ...    msg=the starting location never wrote its keyToAdd

The Key Is Written Once And Logged Once
    [Documentation]    One write, one REGISTRY_CHANGE row — the audit trail of a start is
    ...                the audit trail of any other write, neither doubled nor silent.
    [Tags]    missions    step37    registry
    ${token}    ${match}=    Started Match

    ${members}=    Registry Values Of    ${token}    ${match}    ${START_KEY}
    Length Should Be    ${members}    1
    ${changes}=    Registry Change Rows    ${token}    ${match}    ${START_KEY}
    Length Should Be    ${changes}    1
    ...    msg=the start location's write must leave exactly one REGISTRY_CHANGE row

The Mission That Key Opens Is Reached As The Match Starts
    [Documentation]    No event executed and no step walked: the mission is in the payload
    ...                because the place the story opens in wrote its condition key.
    [Tags]    missions    step37
    ${token}    ${match}=    Started Match

    ${missions}=    Missions Of    ${token}    ${match}
    ${found}=    Mission By Uuid    ${missions}    ${START_MISSION}[uuid]

    Should Not Be Empty    ${found}[status]
    ...    msg=a reached mission must carry the status this match has it in
    Should Be Equal As Integers    ${found}[stepsTotal]    ${{ len($found['steps']) }}

A Step Nobody Satisfied Holds The Mission At Available
    [Documentation]    Opening is not completing: the mission the start writes stops at its
    ...                first unsatisfied step, and a match that has done nothing else has
    ...                closed none of them.
    [Tags]    missions    step37
    ${steps}=    Story Steps Of    ${START_MISSION}
    Skip If    not $steps    the fixture mission ships no step, so it completes at once
    ${token}    ${match}=    Started Match

    ${missions}=    Missions Of    ${token}    ${match}
    ${found}=    Mission By Uuid    ${missions}    ${START_MISSION}[uuid]

    Should Be Equal    ${found}[status]    AVAILABLE
    ${closed}=    Evaluate    [s for s in $found['steps'] if s.get('done')]
    Should Be Empty    ${closed}    msg=nothing was written for a step, so none may be closed


*** Keywords ***

Suite Setup Mission From Start
    [Documentation]    Finds, among the public stories, the first whose START location writes
    ...                a key a mission reads — and the loadout to play that very story. The
    ...                whole suite Skips when no seed ships one.
    Create Admin Session
    Create Public Session
    ${story}    ${location}    ${mission}=    Story Whose Start Location Opens A Mission
    Skip If    '${story}' == '${EMPTY}'
    ...    no public story gives its start location a keyToAdd that a mission reads
    Set Suite Variable    ${STORY_UUID}      ${story}
    Set Suite Variable    ${START_MISSION}   ${mission}
    Set Suite Variable    ${START_KEY}       ${location}[keyToAdd]
    Set Suite Variable    ${START_VALUE}     ${location}[keyValueToAdd]

    ${difficulty}    ${character}    ${class}    ${trait}=    Loadout Of Story    ${story}
    Set Suite Variable    ${DIFFICULTY}    ${difficulty}
    Set Suite Variable    ${CHARACTER}     ${character}
    Set Suite Variable    ${CLASS}         ${class}
    Set Suite Variable    ${TRAIT}         ${trait}

Story Whose Start Location Opens A Mission
    [Documentation]    (storyUuid, startLocation, mission) of the first public story whose
    ...                idLocationStart carries a keyToAdd that one of its missions reads, or
    ...                (${EMPTY}, ${EMPTY}, ${EMPTY}) when no seed ships such a story.
    ${stories}=    GET On Session    public_session    /api/stories
    Status Should Be    ${stories}    200
    FOR    ${story}    IN    @{stories.json()}
        ${detail}=    Get Admin Story By UUID    ${story}[uuid]
        IF    ${detail.status_code} != 200    CONTINUE
        ${start_id}=    Set Variable    ${{ $detail.json().get('idLocationStart') }}
        IF    $start_id is None    CONTINUE
        ${start}=    Start Location Of    ${story}[uuid]    ${start_id}
        IF    not $start or not $start.get('keyToAdd')    CONTINUE
        ${mission}=    Mission Reading    ${story}[uuid]    ${start}[keyToAdd]
        IF    $mission    RETURN    ${story}[uuid]    ${start}    ${mission}
    END
    RETURN    ${EMPTY}    ${EMPTY}    ${EMPTY}

Start Location Of
    [Documentation]    The story location the story itself names as its start, read through
    ...                the admin CRUD so no seeded id is written down here.
    [Arguments]    ${story_uuid}    ${id_location_start}
    ${locations}=    GET On Session    admin_session    /api/admin/stories/${story_uuid}/locations
    Status Should Be    ${locations}    200
    FOR    ${location}    IN    @{locations.json()}
        IF    int($location.get('id') or -1) == int($id_location_start)
            RETURN    ${location}
        END
    END
    RETURN    ${EMPTY}

Mission Reading
    [Documentation]    The story's mission whose conditionKey is exactly this key, or empty.
    [Arguments]    ${story_uuid}    ${key}
    ${missions}=    GET On Session    admin_session    /api/admin/stories/${story_uuid}/missions
    Status Should Be    ${missions}    200
    FOR    ${mission}    IN    @{missions.json()}
        IF    ($mission.get('conditionKey') or '').strip() == $key    RETURN    ${mission}
    END
    RETURN    ${EMPTY}

Story Steps Of
    [Documentation]    The authored steps of one mission, in the order the story gives them.
    [Arguments]    ${mission}
    ${steps}=    GET On Session    admin_session
    ...    /api/admin/stories/${STORY_UUID}/mission-steps
    Status Should Be    ${steps}    200
    ${mine}=    Evaluate
    ...    [s for s in $steps.json() if str(s.get('idMission')) == str($mission.get('id'))]
    RETURN    ${mine}

Loadout Of Story
    [Documentation]    (difficulty, characterTemplate, class, trait) of ONE named story —
    ...                Pick Story Loadout answers for the first story that has them, and the
    ...                fixture here is whichever story the seed gives the start key to.
    [Arguments]    ${story_uuid}
    ${detail}=    GET On Session    public_session    /api/stories/${story_uuid}
    Status Should Be    ${detail}    200
    ${difficulties}=    Get From Dictionary    ${detail.json()}    difficulties          ${EMPTY}
    ${templates}=       Get From Dictionary    ${detail.json()}    characterTemplates    ${EMPTY}
    ${classes}=         Get From Dictionary    ${detail.json()}    classes               ${EMPTY}
    Should Not Be Empty    ${difficulties}    msg=the fixture story cannot host a match
    Should Not Be Empty    ${templates}       msg=the fixture story has no character template
    Should Not Be Empty    ${classes}         msg=the fixture story has no class
    ${traits}=      Get From Dictionary    ${detail.json()}    traits    ${EMPTY}
    ${pickable}=    Evaluate    [t for t in $traits if not t.get('hideOnStartMatch')]
    ${trait}=       Set Variable If    ${pickable}    ${pickable}[0][uuid]    ${EMPTY}
    RETURN    ${difficulties}[0][uuid]    ${templates}[0][uuid]    ${classes}[0][uuid]    ${trait}

Joined Match Not Started
    [Documentation]    A match with a character in it, still CREATED. Fresh per case: the
    ...                start writes a key that latches.
    ${token}=    New Guest Token
    ${match}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY}    robottest_v0371
    Status Should Be    ${match}    201
    ${uuid}=    Set Variable    ${match.json()}[uuid]
    ${trait_list}=    Create List
    IF    '${TRAIT}' != ''
        Append To List    ${trait_list}    ${TRAIT}
    END
    ${join}=    Join Match    ${token}    ${uuid}    ${CHARACTER}    ${CLASS}    ${trait_list}
    Status Should Be    ${join}    201
    RETURN    ${token}    ${uuid}

Started Match
    [Documentation]    The same match, taken through CREATED -> RUNNING, which is the moment
    ...                under test.
    ${token}    ${uuid}=    Joined Match Not Started
    Start Match    ${token}    ${uuid}    200
    RETURN    ${token}    ${uuid}

Registry Values Of
    [Documentation]    What one key holds right now, or an empty list when the registry
    ...                carries no entry for it at all.
    [Arguments]    ${token}    ${match_uuid}    ${key}
    ${response}=    Get Registry    ${token}    ${match_uuid}    200    include_hidden=true
    FOR    ${group}    IN    @{response.json()}[groups]
        FOR    ${entry}    IN    @{group}[entries]
            IF    $entry['key'] == $key    RETURN    ${entry}[values]
        END
    END
    ${empty}=    Create List
    RETURN    ${empty}

Registry Change Rows
    [Documentation]    The REGISTRY_CHANGE rows of the match log that name one key.
    [Arguments]    ${token}    ${match_uuid}    ${key}
    ${logs}=    Get Match Logs    ${token}    ${match_uuid}    200
    ${rows}=    Evaluate
    ...    [e for e in $logs.json()['logs'] if e.get('type') == 'REGISTRY_CHANGE' and $key in (e.get('message') or '')]
    RETURN    ${rows}
