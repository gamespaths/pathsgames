*** Settings ***
# ---------------------------------------------------------------------------
# registry_admin_edit.robot — v0.36.2, the console correcting one registry key.
#
# A support case sometimes needs a key put right: a story bug wrote the wrong value, or a
# match is wedged behind a gate nobody can open any more. Until now the only way in was SQL.
#
# The contract under test, end-to-end and backend-agnostic:
#
#   1. PUT /api/admin/matches/{uuid}/registry with { key, value } writes the key. It goes
#      through the ordinary engine, so a single key is REPLACED and a multi key GAINS a
#      member — the console does not get a private set of rules.
#   2. DELETE ...?key=K&value=V takes one member away; without a value the key is emptied
#      outright, whatever it holds.
#   3. The player's own GET /registry sees the correction immediately — one registry, not two.
#   4. Every admin write leaves a REGISTRY_CHANGE row: a correction the log does not mention
#      is a correction nobody can trace.
#   5. An unknown match is 404 and a blank key is 400, on both verbs.
#
# Tags: registry, step36-2
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource

Suite Setup    Suite Setup Admin Registry


*** Test Cases ***

The Console Writes A Key And The Player Sees It
    [Documentation]    One registry, not two: the admin write and the player read are the
    ...                same rows.
    [Tags]    registry    step36-2
    ${token}    ${match}=    Fresh Admin Registry Match
    ${key}=    Any Single Key    ${token}    ${match}

    ${response}=    Admin Upsert Registry    ${ADMIN_TOKEN}    ${match}    ${key}    corrected
    Status Should Be    ${response}    200
    Should Be Equal    ${response.json()}[key]    ${key}
    Should Be Equal    ${response.json()}[values]    ${{ ['corrected'] }}

    ${members}=    Registry Members    ${token}    ${match}    ${key}
    Should Be Equal    ${members}    ${{ ['corrected'] }}
    ...    msg=the player's registry did not show the admin correction

A Console Write Obeys The Engine, Not A Private Set Of Rules
    [Documentation]    On a SINGLE key the second write replaces the first — exactly as an
    ...                event effect would. The console has no special path.
    [Tags]    registry    step36-2
    ${token}    ${match}=    Fresh Admin Registry Match
    ${key}=    Any Single Key    ${token}    ${match}

    Admin Upsert Registry    ${ADMIN_TOKEN}    ${match}    ${key}    first     200
    ${response}=    Admin Upsert Registry    ${ADMIN_TOKEN}    ${match}    ${key}    second    200

    Should Be Equal    ${response.json()}[values]    ${{ ['second'] }}
    ...    msg=a single key held two values after two console writes

Deleting Without Naming A Value Empties The Key Outright
    [Documentation]    The console is correcting the row, not playing the story: it does not
    ...                have to name the value it is throwing away.
    [Tags]    registry    step36-2
    ${token}    ${match}=    Fresh Admin Registry Match
    ${key}=    Any Single Key    ${token}    ${match}
    Admin Upsert Registry    ${ADMIN_TOKEN}    ${match}    ${key}    doomed    200

    ${response}=    Admin Delete Registry    ${ADMIN_TOKEN}    ${match}    ${key}
    Status Should Be    ${response}    200
    Should Be Empty    ${response.json()}[values]

    ${members}=    Registry Members    ${token}    ${match}    ${key}
    Should Be Empty    ${members}    msg=the key still held a value after being emptied

An Admin Write Leaves A REGISTRY_CHANGE Behind
    [Documentation]    A correction the log does not mention is one nobody can trace.
    [Tags]    registry    step36-2
    ${token}    ${match}=    Fresh Admin Registry Match
    ${key}=    Any Single Key    ${token}    ${match}
    ${before}=    Registry Change Count    ${token}    ${match}

    Admin Upsert Registry    ${ADMIN_TOKEN}    ${match}    ${key}    audited    200

    ${after}=    Registry Change Count    ${token}    ${match}
    Should Be True    ${after} > ${before}
    ...    msg=the console wrote the registry and left no REGISTRY_CHANGE behind

An Unknown Match Is Not Found On Either Verb
    [Tags]    registry    step36-2
    ${put}=    Admin Upsert Registry    ${ADMIN_TOKEN}    ${UNKNOWN_UUID}    any_key    v
    Status Should Be    ${put}    404
    ${delete}=    Admin Delete Registry    ${ADMIN_TOKEN}    ${UNKNOWN_UUID}    any_key
    Status Should Be    ${delete}    404

A Blank Key Is Refused On Either Verb
    [Documentation]    A key is the one thing neither verb can guess.
    [Tags]    registry    step36-2
    ${token}    ${match}=    Fresh Admin Registry Match

    ${put}=    Admin Upsert Registry    ${ADMIN_TOKEN}    ${match}    ${EMPTY}    v
    Status Should Be    ${put}    400
    ${delete}=    Admin Delete Registry    ${ADMIN_TOKEN}    ${match}    ${EMPTY}
    Status Should Be    ${delete}    400


*** Keywords ***

Suite Setup Admin Registry
    [Documentation]    An admin session (the edits are admin-only) plus the loadout every
    ...                case builds its own match from.
    Create Admin Session
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}    ${story}
    Set Suite Variable    ${DIFFICULTY}    ${difficulty}
    Set Suite Variable    ${CHARACTER}    ${character}
    Set Suite Variable    ${CLASS}    ${class}
    Set Suite Variable    ${TRAIT}    ${trait}

Fresh Admin Registry Match
    [Documentation]    A running single-player match on its own guest. Fresh per case: a
    ...                registry key latches, so no two cases may share one match.
    ${token}=    New Guest Token
    ${match}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY}    robottest_step362adm
    Status Should Be    ${match}    201
    ${uuid}=    Set Variable    ${match.json()}[uuid]
    ${trait_list}=    Create List
    IF    '${TRAIT}' != ''
        Append To List    ${trait_list}    ${TRAIT}
    END
    ${join}=    Join Match    ${token}    ${uuid}    ${CHARACTER}    ${CLASS}    ${trait_list}
    Status Should Be    ${join}    201
    Start Match    ${token}    ${uuid}    200
    RETURN    ${token}    ${uuid}

Any Single Key
    [Documentation]    The first key of the match that is NOT multi-valued — a single key is
    ...                the one whose replace-on-write behaviour these cases assert.
    [Arguments]    ${token}    ${match_uuid}
    ${response}=    Get Registry    ${token}    ${match_uuid}    200    include_hidden=true
    FOR    ${group}    IN    @{response.json()}[groups]
        FOR    ${entry}    IN    @{group}[entries]
            IF    not $entry['multiValue']    RETURN    ${entry}[key]
        END
    END
    Fail    the story declares no single-valued registry key

Registry Members
    [Documentation]    The SET one key holds right now, as the registry answers it.
    [Arguments]    ${token}    ${match_uuid}    ${key}
    ${response}=    Get Registry    ${token}    ${match_uuid}    200    include_hidden=true
    FOR    ${group}    IN    @{response.json()}[groups]
        FOR    ${entry}    IN    @{group}[entries]
            IF    $entry['key'] == $key    RETURN    ${entry}[values]
        END
    END
    Fail    the registry carries no entry for ${key}

Registry Change Count
    [Documentation]    How many REGISTRY_CHANGE rows the match log carries so far.
    [Arguments]    ${token}    ${match_uuid}
    ${logs}=    Get Match Logs    ${token}    ${match_uuid}    200
    ${count}=    Evaluate
    ...    len([e for e in $logs.json()['logs'] if e.get('type') == 'REGISTRY_CHANGE'])
    RETURN    ${count}
