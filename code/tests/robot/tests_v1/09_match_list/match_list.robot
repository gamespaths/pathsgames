*** Settings ***
# match_list.robot — v1.7.0 V1 step 9: GET /api/matches envelope (active first, then last played), tsUpdate ISO,
# and the merge rule at Google login (the Google user's active match always wins, cancelledMatchUuids).
Resource   ../../resources/google_sso.resource
Resource   ../../resources/matches.resource

Suite Setup       Match List Suite Setup
Force Tags        v1_step09    match-list


*** Variables ***
${ISO_UTC}    ^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z$


*** Test Cases ***

The Match List Is An Envelope With The Last Played Time
    [Documentation]    {items, nextCursor, limit}: limit 50, nextCursor null up to 50 matches, tsUpdate ISO-8601 UTC.
    ${guest}=    New Guest Token
    ${created}=    Create Match    ${guest}    ${STORY_UUID}    ${DIFFICULTY_UUID}    name=robottest_match_list
    Status Should Be    ${created}    201
    ${list}=    List Matches    ${guest}    200
    Should Be Equal As Integers    ${list.json()}[limit]    50
    Should Be Equal    ${list.json()}[nextCursor]    ${None}
    ${item}=    Match Of List    ${list}    ${created.json()}[uuid]
    Should Match Regexp    ${item}[tsUpdate]    ${ISO_UTC}

The Last Played Time Moves With A Write
    [Documentation]    join and start stamp the match: tsUpdate in the list is later after them.
    ${guest}=    New Guest Token
    ${match}    ${before}=    Guest Match With Its Last Played    ${guest}
    Sleep    1.1s    reason=the stamp must move past the previous second on every backend
    Join And Start    ${guest}    ${match}
    ${after}=    Last Played Of    ${guest}    ${match}
    ${moved}=    Evaluate    __import__('datetime').datetime.fromisoformat($after.replace('Z', '+00:00')) > __import__('datetime').datetime.fromisoformat($before.replace('Z', '+00:00'))
    Should Be True    ${moved}    msg=tsUpdate did not move: ${before} -> ${after}

A Guest Plays, Logs In And Keeps Its Match
    [Documentation]    No active Google match on the story: the guest's running match moves to the user and survives.
    ${guest}=    New Guest Token
    ${match}    ${seen}=    Guest Match With Its Last Played    ${guest}
    Join And Start    ${guest}    ${match}
    ${email}    ${sub}=    New Robot Gmail
    ${token}=    Fake Google Token    sub=${sub}    email=${email}    nonce=robot-nonce
    ${login}=    Google Login    ${token}    bearer=${guest}
    Status Should Be    ${login}    200
    Should Be True    ${login.json()}[mergedGuest]
    Should Be Equal As Integers    ${login.json()}[cancelledMatches]    0
    Should Be Empty    ${login.json()}[cancelledMatchUuids]
    ${list}=    List Matches    ${login.json()}[accessToken]    200
    ${item}=    Match Of List    ${list}    ${match}
    Should Be Equal    ${item}[status]    RUNNING
    Should Match Regexp    ${item}[tsUpdate]    ${ISO_UTC}

A Newer Guest Match Still Loses To The Google Match
    [Documentation]    The Google user has an active match on the story; a guest plays the same story later and
    ...                signs in: its match is CANCELLED, named in cancelledMatchUuids, and listed after the active one.
    ${email}    ${sub}=    New Robot Gmail
    ${first}=    Fake Google Token    sub=${sub}    email=${email}    nonce=robot-nonce
    ${google}=    Google Login    ${first}
    Status Should Be    ${google}    200
    ${kept}=    Create Match    ${google.json()}[accessToken]    ${STORY_UUID}    ${DIFFICULTY_UUID}    name=robottest_match_list_kept
    Status Should Be    ${kept}    201
    ${guest}=    New Guest Token
    ${loser}    ${seen}=    Guest Match With Its Last Played    ${guest}
    Join And Start    ${guest}    ${loser}
    ${second}=    Fake Google Token    sub=${sub}    email=${email}    nonce=robot-nonce
    ${merged}=    Google Login    ${second}    bearer=${guest}
    Status Should Be    ${merged}    200
    Should Be True    ${merged.json()}[mergedGuest]
    Should Be Equal As Integers    ${merged.json()}[cancelledMatches]    1
    Should Be Equal    ${merged.json()}[cancelledMatchUuids]    ${{ [$loser] }}
    ${list}=    List Matches    ${merged.json()}[accessToken]    200
    ${uuids}=    Evaluate    [m['uuid'] for m in $list.json()['items']]
    Should Be Equal    ${uuids}[0]    ${kept.json()}[uuid]    msg=the active match is listed first
    ${winner}=    Match Of List    ${list}    ${kept.json()}[uuid]
    ${cancelled}=    Match Of List    ${list}    ${loser}
    Should Be Equal    ${winner}[status]    CREATED
    Should Be Equal    ${cancelled}[status]    CANCELLED
    Should Match Regexp    ${cancelled}[tsUpdate]    ${ISO_UTC}

The Cursor Pages The Sorted List
    [Documentation]    limit=1 on a user with two matches: a cursor on the first page, none on the second.
    ${email}    ${sub}=    New Robot Gmail
    ${first}=    Fake Google Token    sub=${sub}    email=${email}    nonce=robot-nonce
    ${google}=    Google Login    ${first}
    ${kept}=    Create Match    ${google.json()}[accessToken]    ${STORY_UUID}    ${DIFFICULTY_UUID}    name=robottest_match_list_page
    Status Should Be    ${kept}    201
    ${guest}=    New Guest Token
    ${loser}    ${seen}=    Guest Match With Its Last Played    ${guest}
    ${second}=    Fake Google Token    sub=${sub}    email=${email}    nonce=robot-nonce
    ${merged}=    Google Login    ${second}    bearer=${guest}
    ${access}=    Set Variable    ${merged.json()}[accessToken]
    ${page1}=    List Matches    ${access}    200    params=${{ {'limit': '1'} }}
    Should Be Equal As Integers    ${page1.json()}[limit]    1
    Length Should Be    ${page1.json()}[items]    1
    Should Be Equal    ${page1.json()}[items][0][uuid]    ${kept.json()}[uuid]
    Should Not Be Equal    ${page1.json()}[nextCursor]    ${None}
    ${page2}=    List Matches    ${access}    200    params=${{ {'limit': '1', 'cursor': $page1.json()['nextCursor']} }}
    Length Should Be    ${page2.json()}[items]    1
    Should Be Equal    ${page2.json()}[items][0][uuid]    ${loser}
    Should Be Equal    ${page2.json()}[nextCursor]    ${None}


*** Keywords ***

Match List Suite Setup
    Create Public Session
    Create Admin Session
    Create Dev Session
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}       ${story}
    Set Suite Variable    ${DIFFICULTY_UUID}  ${difficulty}
    Set Suite Variable    ${CHARACTER_UUID}   ${character}
    Set Suite Variable    ${CLASS_UUID}       ${class}
    Set Suite Variable    ${TRAIT_UUID}       ${trait}

Match Of List
    [Documentation]    The item of the list response with the given uuid (fails when missing).
    [Arguments]    ${response}    ${uuid}
    ${found}=    Evaluate    [m for m in $response.json()['items'] if m['uuid'] == $uuid]
    Should Not Be Empty    ${found}    msg=match ${uuid} not in GET /api/matches
    RETURN    ${found}[0]

Last Played Of
    [Arguments]    ${token}    ${uuid}
    ${list}=    List Matches    ${token}    200
    ${item}=    Match Of List    ${list}    ${uuid}
    Should Match Regexp    ${item}[tsUpdate]    ${ISO_UTC}
    RETURN    ${item}[tsUpdate]

Guest Match With Its Last Played
    [Documentation]    A robottest match of the guest on the suite story: (uuid, its tsUpdate in the list).
    [Arguments]    ${token}
    ${created}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY_UUID}    name=robottest_match_list_guest
    Status Should Be    ${created}    201
    ${ts}=    Last Played Of    ${token}    ${created.json()}[uuid]
    RETURN    ${created.json()}[uuid]    ${ts}

Join And Start
    [Documentation]    The guest joins with the story loadout and starts the match (RUNNING).
    [Arguments]    ${token}    ${match}
    ${traits}=    Create List
    IF    '${TRAIT_UUID}' != ''    Append To List    ${traits}    ${TRAIT_UUID}
    ${class}=    Set Variable If    '${CLASS_UUID}' != ''    ${CLASS_UUID}    ${NONE}
    ${join}=    Join Match    ${token}    ${match}    character_uuid=${CHARACTER_UUID}    class_uuid=${class}
    ...    trait_uuids=${traits}
    Status Should Be    ${join}    201
    ${start}=    Start Match    ${token}    ${match}
    Status Should Be    ${start}    200
