*** Settings ***
# ---------------------------------------------------------------------------
# missions_conditions.robot — Step 37, how a mission condition is read.
#
# The contract under test:
#
#   1. There is no operator on a mission: the comparison is always "=", which on a
#      single-valued key means equality and on a multi-valued (set) key means CONTAINED IN.
#   2. conditionValues is a PIPE list read as an AND: on a set key EVERY listed value must
#      be present, not just one. A mission with no steps completes on that condition alone.
#   3. A blank conditionKey makes the row invalid — the mission never opens, whatever the
#      registry holds. That is the opposite of the registry's own "blank key = no condition".
#   4. Comparison is blind to case and to padding, exactly as events read the registry,
#      because it is literally the same code.
#
# The multi-value fixtures are discovered from the story: a mission whose conditionValues
# names several members of a key the story declares multiValue.
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

An AND Mission Stays Shut While The Set Holds Only Part Of What It Asks
    [Documentation]    conditionValues means ALL of them. One member present is not enough,
    ...                which is the whole difference between an AND and a membership test.
    [Tags]    missions    step37
    ${mission}    ${values}    ${writers}=    Mission With Condition Values
    ${token}    ${match}=    Fresh Mission Match

    Satisfy Value    ${token}    ${match}    ${writers}    ${mission}[conditionKey]    ${values}[0]

    ${status}=    Status Of    ${token}    ${match}    ${mission}
    Should Be Equal    ${status}    ${NONE}
    ...    msg=an AND satisfied in part must not open the mission

Every Listed Value Present Completes It In One Write
    [Documentation]    The last missing member arrives and the mission — which has no steps —
    ...                goes from unreached to COMPLETED in that single write.
    [Tags]    missions    step37
    ${mission}    ${values}    ${writers}=    Mission With Condition Values
    ${token}    ${match}=    Fresh Mission Match

    FOR    ${value}    IN    @{values}
        Satisfy Value    ${token}    ${match}    ${writers}    ${mission}[conditionKey]    ${value}
    END

    ${payload}=    Mission Payload    ${token}    ${match}    ${mission}
    Should Be Equal    ${payload}[status]    COMPLETED
    Should Be Equal As Integers    ${payload}[stepsTotal]    0

The Registry Behind It Still Reads As An Ordinary Set
    [Documentation]    Nothing about a mission changes what the key itself is: the members
    ...                are on /registry as they always were, and the mission rides beside it.
    [Tags]    missions    step37
    ${mission}    ${values}    ${writers}=    Mission With Condition Values
    ${token}    ${match}=    Fresh Mission Match

    FOR    ${value}    IN    @{values}
        Satisfy Value    ${token}    ${match}    ${writers}    ${mission}[conditionKey]    ${value}
    END

    ${entries}=    Get Registry    ${token}    ${match}    200    include_hidden=true
    ${ns}=      Create Dictionary    _b=${entries.json()}    _k=${mission}[conditionKey]
    ${held}=    Evaluate
    ...    [e['values'] for g in _b['groups'] for e in g['entries'] if e['key'] == _k]
    ...    namespace=${ns}
    Should Not Be Empty    ${held}    msg=the key the mission reads must still be a key
    ${ns2}=        Create Dictionary    _h=${held}[0]
    ${lowered}=    Evaluate    [v.lower() for v in _h]    namespace=${ns2}
    FOR    ${value}    IN    @{values}
        Should Contain    ${lowered}    ${value.lower()}
    END

A Value Written In Another Case Still Satisfies The Condition
    [Documentation]    v0.36.2 case-folding is the mission engine's too: the admin writes the
    ...                member upper-case and padded, the mission reads it just the same.
    [Tags]    missions    step37
    ${mission}    ${values}    ${writers}=    Mission With Condition Values
    ${token}    ${match}=    Fresh Mission Match

    FOR    ${value}    IN    @{values}
        ${shouted}=    Set Variable    ${SPACE}${SPACE}${value.upper()}${SPACE}${SPACE}
        Admin Upsert Registry    ${ADMIN_TOKEN}    ${match}    ${mission}[conditionKey]
        ...    ${shouted}    200
    END

    ${status}=    Status Of    ${token}    ${match}    ${mission}
    Should Be Equal    ${status}    COMPLETED
    ...    msg=spelling must not decide whether a mission opens

A Mission Whose Key Nothing Holds Never Opens
    [Documentation]    The negative case that makes the others mean something: with nothing
    ...                written, no mission of the story is reached.
    [Tags]    missions    step37
    ${token}    ${match}=    Fresh Mission Match

    ${missions}=    Missions Of    ${token}    ${match}

    Should Be Empty    ${missions}

Every Authored Mission Declares A Condition Key
    [Documentation]    A blank conditionKey is invalid: the engine ignores such a row and no
    ...                match would ever open it. The seeded story must not ship one, and
    ...                story validation says so — this is the fixture guard for both.
    [Tags]    missions    step37
    ${missions}=    Story Missions
    ${steps}=       Story Mission Steps

    FOR    ${row}    IN    @{missions}    @{steps}
        ${key}=    Set Variable    ${{ ($row.get('conditionKey') or '').strip() }}
        Should Not Be Empty    ${key}
        ...    msg=a mission row with no condition key never activates, progresses or completes
        ${value}=     Set Variable    ${{ ($row.get('conditionValue') or '').strip() }}
        ${raw}=       Set Variable    ${{ $row.get('conditionValues') or '' }}
        ${ns}=        Create Dictionary    _r=${raw}
        ${values}=    Evaluate    [p for p in _r.split('|') if p.strip()]    namespace=${ns}
        Should Be True    $value != '' or len($values) > 0
        ...    msg=a condition with nothing to compare against is never satisfied
    END

Story Validation Reports A Mission With No Condition Key
    [Documentation]    R10_MISSION_CONDITION. The seeded story is clean, so the rule is
    ...                proven by the report's shape: it runs, and it finds nothing to say
    ...                about the missions it walked.
    [Tags]    missions    step37
    ${response}=    GET On Session    admin_session
    ...    /api/admin/stories/${STORY_UUID}/validate
    Status Should Be    ${response}    200

    ${mission_errors}=    Evaluate
    ...    [e for e in $response.json().get('errors', []) if e.get('rule') == 'R10_MISSION_CONDITION']
    Should Be Empty    ${mission_errors}
    ...    msg=the seeded story must not ship a mission the engine will ignore


*** Keywords ***

Mission With Condition Values
    [Documentation]    The first story mission authored with a PIPE list, the values it asks
    ...                for, and the writers that can supply them. Skips the whole case when
    ...                the story has none, so a leaner seed does not fail the suite.
    ${missions}=    Story Missions
    ${writers}=     Key Writing Event Uuids
    FOR    ${mission}    IN    @{missions}
        ${raw}=    Set Variable    ${{ $mission.get('conditionValues') or '' }}
        ${ns}=     Create Dictionary    _r=${raw}
        ${values}=    Evaluate    [p.strip() for p in _r.split('|') if p.strip()]
        ...    namespace=${ns}
        IF    len($values) > 1
            RETURN    ${mission}    ${values}    ${writers}
        END
    END
    Skip    the seeded story declares no mission with a conditionValues list

Satisfy Value
    [Documentation]    Write one member of a key. The board event is preferred when one
    ...                writes exactly that value; otherwise the admin console does it, which
    ...                is a registry write like any other and moves missions the same way.
    [Arguments]    ${token}    ${match_uuid}    ${writers}    ${key}    ${value}
    ${event}=    Event Writing    ${key}    ${value}
    IF    '${event}' != '${EMPTY}'
        Execute Board Event    ${token}    ${match_uuid}    ${event}
    ELSE
        Admin Upsert Registry    ${ADMIN_TOKEN}    ${match_uuid}    ${key}    ${value}    200
    END

Event Writing
    [Documentation]    The uuid of the event whose effect writes exactly this key/value pair,
    ...                or empty when the story has none.
    [Arguments]    ${key}    ${value}
    ${effects}=    GET On Session    admin_session
    ...    /api/admin/stories/${STORY_UUID}/event-effects
    Status Should Be    ${effects}    200
    ${events}=    GET On Session    admin_session    /api/admin/stories/${STORY_UUID}/events
    Status Should Be    ${events}    200
    ${by_id}=    Create Dictionary
    FOR    ${event}    IN    @{events.json()}
        Set To Dictionary    ${by_id}    ${event}[id]    ${event}[uuid]
    END
    ${wanted}=    Set Variable    ${{ $value.strip().lower() }}
    ${found}=    Set Variable    ${EMPTY}
    FOR    ${effect}    IN    @{effects.json()}
        ${written}=    Set Variable    ${{ ($effect.get('keyValueToAdd') or '').strip().lower() }}
        ${hit}=    Evaluate    $effect.get('keyToAdd') == $key and $written == $wanted
        IF    $hit and $effect.get('idEvent') in $by_id
            ${found}=    Set Variable    ${by_id}[${effect}[idEvent]]
            BREAK
        END
    END
    RETURN    ${found}
