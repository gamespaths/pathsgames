*** Settings ***
# ---------------------------------------------------------------------------
# registry_repeated_writes.robot — v0.36.4, the registry under a write said twice.
#
# Nothing stops the same write reaching the registry more than once: an event re-executed,
# a console button double-clicked, two clients on one match. Java and Python lean on a
# partial UNIQUE index for that; AWS holds the registry as an embedded list and has no index
# at all. This suite pins the behaviour those three must AGREE on, from outside.
#
# The contract under test, end-to-end and backend-agnostic:
#
#   1. A multi key is a SET: the same member written twice leaves ONE member, and the second
#      write leaves no REGISTRY_CHANGE row — a write that changed nothing says nothing.
#   2. A set is not a journal: add, remove, add again ends holding the member exactly once.
#   3. A single key rewritten with the same value still holds exactly that one value.
#   4. v0.36.4 — PUT refuses a key the story does not declare (400 UNKNOWN_KEY) and writes
#      nothing: a typo there would leave an orphan key nobody can tell from an engine bug.
#   5. DELETE has no such guard on purpose — cleaning an orphan row up is the point of it.
#
# Tags: registry, step36-4
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource

Suite Setup    Suite Setup Repeated Writes


*** Test Cases ***

The Same Member Written Twice Leaves One Member
    [Documentation]    A multi key is a SET. Whatever each backend indexes underneath, the
    ...                second write of one member must not double it.
    [Tags]    registry    step36-4
    ${token}    ${match}=    Fresh Repeated Writes Match
    ${key}=    Any Multi Key    ${token}    ${match}

    Admin Upsert Registry    ${ADMIN_TOKEN}    ${match}    ${key}    ledger    200
    ${response}=    Admin Upsert Registry    ${ADMIN_TOKEN}    ${match}    ${key}    ledger    200

    Should Be Equal    ${response.json()}[values]    ${{ ['ledger'] }}
    ...    msg=the set held the same member twice
    ${members}=    Registry Members    ${token}    ${match}    ${key}
    Should Be Equal    ${members}    ${{ ['ledger'] }}

The Second Write Of One Member Leaves No REGISTRY_CHANGE
    [Documentation]    A write that changed nothing says nothing — the log is a record of
    ...                what happened, not of what was attempted.
    [Tags]    registry    step36-4
    ${token}    ${match}=    Fresh Repeated Writes Match
    ${key}=    Any Multi Key    ${token}    ${match}

    ${before}=    Registry Change Count    ${token}    ${match}
    Admin Upsert Registry    ${ADMIN_TOKEN}    ${match}    ${key}    ledger    200
    ${once}=    Registry Change Count    ${token}    ${match}
    Should Be Equal As Integers    ${once}    ${before + 1}
    ...    msg=the first write of a member left no REGISTRY_CHANGE

    Admin Upsert Registry    ${ADMIN_TOKEN}    ${match}    ${key}    ledger    200
    ${twice}=    Registry Change Count    ${token}    ${match}
    Should Be Equal As Integers    ${twice}    ${once}
    ...    msg=a duplicate write left a REGISTRY_CHANGE behind

Many Repeats Of One Member Never Grow The Set
    [Documentation]    Not two, five. The guard is a set property, not a special case for
    ...                the second write.
    [Tags]    registry    step36-4
    ${token}    ${match}=    Fresh Repeated Writes Match
    ${key}=    Any Multi Key    ${token}    ${match}

    FOR    ${i}    IN RANGE    5
        Admin Upsert Registry    ${ADMIN_TOKEN}    ${match}    ${key}    letter    200
    END

    ${members}=    Registry Members    ${token}    ${match}    ${key}
    Should Be Equal    ${members}    ${{ ['letter'] }}    msg=five writes left ${members}

A Set Is Not A Journal
    [Documentation]    Add, take away, add again: the member is held once at the end, and the
    ...                other member never moved.
    [Tags]    registry    step36-4
    ${token}    ${match}=    Fresh Repeated Writes Match
    ${key}=    Any Multi Key    ${token}    ${match}

    Admin Upsert Registry    ${ADMIN_TOKEN}    ${match}    ${key}    ledger    200
    Admin Upsert Registry    ${ADMIN_TOKEN}    ${match}    ${key}    letter    200
    Admin Delete Registry    ${ADMIN_TOKEN}    ${match}    ${key}    ledger    200
    Admin Upsert Registry    ${ADMIN_TOKEN}    ${match}    ${key}    ledger    200

    ${members}=    Registry Members    ${token}    ${match}    ${key}
    ${sorted}=    Evaluate    sorted($members)
    Should Be Equal    ${sorted}    ${{ ['ledger', 'letter'] }}
    ...    msg=the set replayed the writes instead of holding them

A Single Key Rewritten With Its Own Value Still Holds One Value
    [Documentation]    The single key has no set to grow, but it must not end up with two
    ...                rows either — that is what its own unique index is for.
    [Tags]    registry    step36-4
    ${token}    ${match}=    Fresh Repeated Writes Match
    ${key}=    Any Single Key    ${token}    ${match}

    Admin Upsert Registry    ${ADMIN_TOKEN}    ${match}    ${key}    steady    200
    ${response}=    Admin Upsert Registry    ${ADMIN_TOKEN}    ${match}    ${key}    steady    200

    Should Be Equal    ${response.json()}[values]    ${{ ['steady'] }}
    ${members}=    Registry Members    ${token}    ${match}    ${key}
    Should Be Equal    ${members}    ${{ ['steady'] }}    msg=the single key held ${members}

The Console Refuses A Key The Story Does Not Declare
    [Documentation]    v0.36.4 — a typo would create an orphan key the player never sees and
    ...                the console cannot tell from an engine bug.
    [Tags]    registry    step36-4
    ${token}    ${match}=    Fresh Repeated Writes Match

    ${response}=    Admin Upsert Registry    ${ADMIN_TOKEN}    ${match}    no_such_key_36_4    v
    Status Should Be    ${response}    400
    Should Be Equal    ${response.json()}[error]    UNKNOWN_KEY

    ${registry}=    Get Registry    ${token}    ${match}    200    include_hidden=true
    ${keys}=    Registry Key Names    ${registry}
    Should Not Contain    ${keys}    no_such_key_36_4
    ...    msg=the refused write landed in the registry anyway

Deleting An Undeclared Key Is Still Allowed
    [Documentation]    The DELETE has no declaration guard on purpose: an orphan row is
    ...                exactly what the console has to be able to clean up.
    [Tags]    registry    step36-4
    ${token}    ${match}=    Fresh Repeated Writes Match

    ${response}=    Admin Delete Registry    ${ADMIN_TOKEN}    ${match}    no_such_key_36_4
    Status Should Be    ${response}    200
    Should Be Empty    ${response.json()}[values]


*** Keywords ***

Suite Setup Repeated Writes
    [Documentation]    An admin session (the writes are admin-only) plus the loadout every
    ...                case builds its own match from.
    Create Admin Session
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}    ${story}
    Set Suite Variable    ${DIFFICULTY}    ${difficulty}
    Set Suite Variable    ${CHARACTER}    ${character}
    Set Suite Variable    ${CLASS}    ${class}
    Set Suite Variable    ${TRAIT}    ${trait}

Fresh Repeated Writes Match
    [Documentation]    A running single-player match on its own guest. Fresh per case: a
    ...                registry key latches, so no two cases may share one match.
    ${token}=    New Guest Token
    ${match}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY}    robottest_step364rep
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

Any Multi Key
    [Documentation]    The first multi-valued key of the match — the one whose SET behaviour
    ...                these cases assert. Found by what it is, never by a seeded id.
    [Arguments]    ${token}    ${match_uuid}
    ${response}=    Get Registry    ${token}    ${match_uuid}    200    include_hidden=true
    FOR    ${group}    IN    @{response.json()}[groups]
        FOR    ${entry}    IN    @{group}[entries]
            IF    $entry['multiValue']    RETURN    ${entry}[key]
        END
    END
    Fail    the story declares no multi-valued registry key

Any Single Key
    [Documentation]    The first key that is NOT multi-valued — replace-on-write, one row.
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

Registry Key Names
    [Documentation]    Every key name the registry answer carries, across all its groups.
    [Arguments]    ${response}
    ${names}=    Evaluate
    ...    [e['key'] for g in $response.json()['groups'] for e in g['entries']]
    RETURN    ${names}

Registry Change Count
    [Documentation]    How many REGISTRY_CHANGE rows the match log carries so far.
    [Arguments]    ${token}    ${match_uuid}
    ${logs}=    Get Match Logs    ${token}    ${match_uuid}    200
    ${count}=    Evaluate
    ...    len([e for e in $logs.json()['logs'] if e.get('type') == 'REGISTRY_CHANGE'])
    RETURN    ${count}
