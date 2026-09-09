*** Settings ***
# ---------------------------------------------------------------------------
# mission_log.robot — v0.37.2, a mission that moves says so on the match log.
#
# Until this version the state row said WHERE a match stood and never HOW it got there: the
# timeline carried the REGISTRY_CHANGE that opened a mission but not the opening itself, so
# reading a log meant knowing by heart which key belonged to which mission.
#
# The contract under test, end-to-end and backend-agnostic:
#
#   1. A match that has moved no mission carries no MISSION_CHANGE row at all.
#   2. Opening one writes exactly ONE row, naming the mission's uuid and both statuses.
#   3. Closing a step writes another, naming the step number the AUTHOR wrote.
#   4. The row is the engine's, not a character's: no character rides on it.
#   5. Every row lands on the same timeline as the REGISTRY_CHANGE that caused it, and after
#      it — the state is written first, the log says so second.
#   6. v0.37.2 — one pass is one row per thing that happened, and each wears its own card: the
#      MISSION's when it opens and again when it is over, the STEP's for every step closed.
#
# The mission is found by BEHAVIOUR through resources/missions.resource, never by a seeded
# uuid, so this runs green on java-sqlite, java-postgres, python and aws alike.
#
# Tags: missions, step37
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource
Resource   ../../resources/missions.resource

Suite Setup    Suite Setup Missions


*** Test Cases ***

A Match That Moved No Mission Carries No Mission Row
    [Documentation]    The negative case that makes the others mean something: nothing has
    ...                opened, so the timeline says nothing about missions.
    [Tags]    missions    step37
    ${token}    ${match}=    Fresh Mission Match

    ${rows}=    Mission Change Rows    ${token}    ${match}

    Should Be Empty    ${rows}    msg=a match with no mission reached logged a MISSION_CHANGE

Opening A Mission Writes One Row Naming It And Both Statuses
    [Documentation]    One move, one row — neither missed nor doubled, the rule REGISTRY_CHANGE
    ...                already follows. The mission is named by uuid, so the row can be read
    ...                against the payload without guessing.
    [Tags]    missions    step37
    ${token}    ${match}    ${mission}=    Match With One Mission Open

    ${rows}=    Mission Change Rows    ${token}    ${match}    ${mission}[uuid]

    Length Should Be    ${rows}    1
    Should Contain    ${rows}[0][message]    ${mission}[uuid]
    Should Contain    ${rows}[0][message]    AVAILABLE
    # "none" is where the previous status goes for a mission the match had never reached.
    Should Contain    ${rows}[0][message]    none

The Row Is The Engine's, Not A Character's
    [Documentation]    Nobody in the fiction moves a mission: the row carries no character,
    ...                exactly as the engine writes it.
    [Tags]    missions    step37
    ${token}    ${match}    ${mission}=    Match With One Mission Open

    ${rows}=    Mission Change Rows    ${token}    ${match}    ${mission}[uuid]

    ${character}=    Set Variable    ${{ $rows[0].get('characterUuid') }}
    Should Be Equal    ${character}    ${None}
    ...    msg=a MISSION_CHANGE row must not name a character

Closing A Step Writes A Row Naming The Authored Step Number
    [Documentation]    The number the author wrote on the step, not the row id: this line is
    ...                read by a person, and the two differ in every seed.
    [Tags]    missions    step37
    ${mission}    ${steps}    ${writers}=    Mission With Steps    2
    ${token}    ${match}=    Fresh Mission Match

    Satisfy    ${token}    ${match}    ${writers}    ${mission}[conditionKey]
    Satisfy    ${token}    ${match}    ${writers}    ${steps}[0][conditionKey]

    ${rows}=    Mission Change Rows    ${token}    ${match}    ${mission}[uuid]

    Length Should Be    ${rows}    2
    Should Contain    ${rows}[1][message]    ACTIVE
    Should Contain    ${rows}[1][message]    step ${steps}[0][step]
    # v0.37.2 — an advance is the STEP's news, so the row wears the step's card and not the
    # mission's. A story that gives the step no card leaves the row without one either way.
    ${step_card}=    Set Variable    ${{ $steps[0].get('idCard') }}
    IF    $step_card is not None
        Should Be Equal As Integers    ${rows}[1][idCard]    ${step_card}
    END

The Mission Row Follows The Registry Write That Caused It
    [Documentation]    The state is written first and the log says so second, so on one
    ...                timeline the REGISTRY_CHANGE comes before the MISSION_CHANGE it opened.
    [Tags]    missions    step37
    ${token}    ${match}    ${mission}=    Match With One Mission Open

    ${entries}=    Timeline Types    ${token}    ${match}
    ${registry_at}=    Get Index From List    ${entries}    REGISTRY_CHANGE
    ${mission_at}=     Get Index From List    ${entries}    MISSION_CHANGE

    Should Be True    ${registry_at} >= 0    msg=the opening write left no REGISTRY_CHANGE
    Should Be True    ${mission_at} > ${registry_at}
    ...    msg=the mission row must follow the registry write that opened it


Closing The Last Step Says So Twice: The Step, Then The Mission
    [Documentation]    v0.37.2 — the end of a mission is the mission's news as much as the last
    ...                step is the step's, and the two are narrated by different cards. So the
    ...                pass writes both rows, the step's first.
    [Tags]    missions    step37
    ${mission}    ${steps}    ${writers}=    Mission With Steps    2
    ${token}    ${match}=    Fresh Mission Match

    Satisfy    ${token}    ${match}    ${writers}    ${mission}[conditionKey]
    FOR    ${step}    IN    @{steps}
        Satisfy    ${token}    ${match}    ${writers}    ${step}[conditionKey]
    END

    ${rows}=    Mission Change Rows    ${token}    ${match}    ${mission}[uuid]
    ${messages}=    Evaluate    [r['message'] for r in $rows]

    # The opening, one row per step, and the mission's own closing row at the end.
    Should Be Equal As Integers    ${{ len($messages) }}    ${{ len($steps) + 2 }}
    Should Contain    ${messages}[-2]    step ${{ $steps[-1]['step'] }}
    Should Contain    ${messages}[-1]    COMPLETED
    Should Not Contain    ${messages}[-1]    step
    ...    msg=the last row must be the MISSION's, so it wears the mission's card

A Mission Row Is Narrated By The Mission Own Card
    [Documentation]    v0.37.2 — the timeline resolves the card from the uuid in the message,
    ...                so the board can show the mission's picture in the history. A story that
    ...                gives its missions no card skips this case rather than failing it.
    [Tags]    missions    step37
    ${token}    ${match}    ${mission}=    Match With One Mission Open
    ${id_card}=    Set Variable    ${{ $mission.get('idCard') }}
    Skip If    $id_card is None    the story gives this mission no card to be narrated by

    ${rows}=    Mission Change Rows    ${token}    ${match}    ${mission}[uuid]

    # Row 0 is the opening: no step named, so it is the mission's own card.
    Should Be Equal As Integers    ${rows}[0][idCard]    ${id_card}
    Should Not Be Equal    ${{ ($rows[0].get('card') or {}).get('title') }}    ${None}
    ...    msg=the row carries an idCard the timeline could not resolve into a card

A Mission Row Carries Its Own Card And Not The Event That Opened It
    [Documentation]    The lookup is keyed by the MISSION, not by whatever ran: the row and the
    ...                EVENT that opened it answer two different cards unless the story happens
    ...                to share one between them.
    [Tags]    missions    step37
    ${token}    ${match}    ${mission}=    Match With One Mission Open
    Skip If    ${{ $mission.get('idCard') is None }}    the story gives this mission no card

    ${missions}=    Mission Change Rows    ${token}    ${match}    ${mission}[uuid]
    ${events}=      Timeline Rows Of Type    ${token}    ${match}    EVENT

    Should Be Equal As Integers    ${missions}[0][idCard]    ${mission}[idCard]
    IF    ${{ len($events) > 0 and $events[0].get('idCard') is not None }}
        Should Not Be Equal As Integers    ${missions}[0][idCard]    ${events}[0][idCard]
        ...    msg=the mission row answered the event card, so the lookup read the wrong table
    END


*** Keywords ***

Mission Change Rows
    [Documentation]    The MISSION_CHANGE entries of the match timeline, optionally only the
    ...                ones naming one mission, in the order the timeline gives them.
    [Arguments]    ${token}    ${match_uuid}    ${uuid}=${EMPTY}
    ${logs}=    Get Match Logs    ${token}    ${match_uuid}    200
    ${rows}=    Evaluate
    ...    [e for e in $logs.json()['logs'] if e.get('type') == 'MISSION_CHANGE' and (not $uuid or $uuid in (e.get('message') or ''))]
    RETURN    ${rows}

Timeline Types
    [Documentation]    The `type` of every timeline entry, in order.
    [Arguments]    ${token}    ${match_uuid}
    ${logs}=    Get Match Logs    ${token}    ${match_uuid}    200
    ${types}=    Evaluate    [e.get('type') for e in $logs.json()['logs']]
    RETURN    ${types}

Timeline Rows Of Type
    [Documentation]    Every entry of one type, in the order the timeline gives them.
    [Arguments]    ${token}    ${match_uuid}    ${type}
    ${logs}=    Get Match Logs    ${token}    ${match_uuid}    200
    ${rows}=    Evaluate    [e for e in $logs.json()['logs'] if e.get('type') == $type]
    RETURN    ${rows}
