*** Settings ***
# ---------------------------------------------------------------------------
# registry_location_writes.robot — v0.36.2, a LOCATION writes the registry.
#
# Before this, only an event effect or a choice effect could write a key. A place could not
# record that the party had been there without an author wiring a dummy AUTOMATIC event.
#
# The contract under test, end-to-end and backend-agnostic:
#
#   1. list_locations carries two pairs: key_to_add / key_value_to_add for the FIRST arrival,
#      and key_to_add_not_first / key_value_to_add_not_first for every later one.
#   2. An arrival takes ONE branch, never both. The first arrival writes the first pair; the
#      second arrival at the same place writes the second, replacing it on a single key.
#   3. The write happens on arrival, with no event involved — nobody executes anything.
#   4. A key a location writes starts absent: a fresh match holds nothing for it.
#   5. Every write leaves exactly one REGISTRY_CHANGE row on the match log, like any other.
#
# The location is found by the shape of what it does — it is whichever location the story
# gives both pairs to — never by a seeded uuid, so the suite runs green on java-sqlite,
# java-postgres, python and aws alike.
#
# Tags: registry, step36-2
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource

Suite Setup    Suite Setup Location Registry


*** Test Cases ***

A Key Only A Location Writes Starts Empty
    [Documentation]    Nothing has been entered yet, so the key the vault writes holds nothing.
    ...                A default would make every later assertion meaningless.
    [Tags]    registry    step36-2
    ${token}    ${match}=    Fresh Location Match

    ${members}=    Registry Members    ${token}    ${match}    ${WRITER_KEY}
    Should Be Empty    ${members}
    ...    msg=the key a location writes already held a value before anyone arrived

Arriving Somewhere For The First Time Writes The First Pair
    [Documentation]    No event is executed: walking in is the whole action.
    [Tags]    registry    step36-2
    ${token}    ${match}=    Fresh Location Match

    Walk To    ${token}    ${match}    ${WRITER_LOCATION}

    ${members}=    Registry Members    ${token}    ${match}    ${WRITER_KEY}
    Should Be Equal    ${members}    ${{ [$FIRST_VALUE] }}
    ...    msg=the first arrival did not write key_to_add / key_value_to_add

Arriving Again Writes The OTHER Pair, Not The First One Twice
    [Documentation]    The history branch chooses the pair exactly as it chooses the automatic
    ...                event: first or subsequent, never both.
    [Tags]    registry    step36-2
    ${token}    ${match}=    Fresh Location Match
    ${start}=    Current Location Uuid    ${token}    ${match}

    Walk To    ${token}    ${match}    ${WRITER_LOCATION}
    Walk To    ${token}    ${match}    ${start}
    Walk To    ${token}    ${match}    ${WRITER_LOCATION}

    ${members}=    Registry Members    ${token}    ${match}    ${WRITER_KEY}
    Should Be Equal    ${members}    ${{ [$LATER_VALUE] }}
    ...    msg=a later arrival did not write the key_to_add_not_first pair

The First Arrival Does Not Also Write The Later Pair
    [Documentation]    The two pairs are exclusive: after ONE arrival the key holds the first
    ...                value and nothing else, whatever kind of key it is.
    [Tags]    registry    step36-2
    ${token}    ${match}=    Fresh Location Match

    Walk To    ${token}    ${match}    ${WRITER_LOCATION}

    ${members}=    Registry Members    ${token}    ${match}    ${WRITER_KEY}
    Length Should Be    ${members}    1
    Should Not Contain    ${members}    ${LATER_VALUE}
    ...    msg=the first arrival wrote BOTH pairs

A Location Write Leaves Exactly One REGISTRY_CHANGE Behind
    [Documentation]    One writer, one audit row — the same invariant an event write keeps.
    [Tags]    registry    step36-2
    ${token}    ${match}=    Fresh Location Match
    ${before}=    Registry Change Count    ${token}    ${match}

    Walk To    ${token}    ${match}    ${WRITER_LOCATION}

    ${after}=    Registry Change Count    ${token}    ${match}
    Should Be Equal As Integers    ${after}    ${{ $before + 1 }}
    ...    msg=an arrival that wrote the registry left ${after} - ${before} audit rows, not one


*** Keywords ***

Suite Setup Location Registry
    [Documentation]    The loadout every case builds its own match from, plus the location the
    ...                story gives both registry pairs to — discovered, never hardcoded.
    Create Admin Session
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}    ${story}
    Set Suite Variable    ${DIFFICULTY}    ${difficulty}
    Set Suite Variable    ${CHARACTER}    ${character}
    Set Suite Variable    ${CLASS}    ${class}
    Set Suite Variable    ${TRAIT}    ${trait}

    ${uuid}    ${key}    ${first}    ${later}=    Registry Writing Location
    Set Suite Variable    ${WRITER_LOCATION}    ${uuid}
    Set Suite Variable    ${WRITER_KEY}    ${key}
    Set Suite Variable    ${FIRST_VALUE}    ${first}
    Set Suite Variable    ${LATER_VALUE}    ${later}

Registry Writing Location
    [Documentation]    The story's own location table decides: the fixture is whichever
    ...                location carries BOTH pairs, so any story with one runs this suite.
    ${locations}=    GET On Session    admin_session
    ...    /api/admin/stories/${STORY_UUID}/locations
    Status Should Be    ${locations}    200
    FOR    ${location}    IN    @{locations.json()}
        IF    $location.get('keyToAdd') and $location.get('keyToAddNotFirst')
            RETURN    ${location}[uuid]    ${location}[keyToAdd]
            ...       ${location}[keyValueToAdd]    ${location}[keyValueToAddNotFirst]
        END
    END
    Fail    the story gives no location both registry pairs

Fresh Location Match
    [Documentation]    A running single-player match on its own guest. Fresh per case: an
    ...                arrival latches flag_visited, so no two cases may share one match.
    ${token}=    New Guest Token
    ${match}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY}    robottest_step362loc
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

Walk To
    [Documentation]    Move to an adjacent location and insist it worked: a silent refusal
    ...                would make every registry assertion below vacuously true.
    [Arguments]    ${token}    ${match_uuid}    ${target_uuid}
    ${response}=    Start Movement    ${token}    ${match_uuid}    ${target_uuid}
    Status Should Be    ${response}    200
    Should Be Equal As Strings    ${response.json()}[toLocationUuid]    ${target_uuid}

Current Location Uuid
    [Documentation]    Where the character stands right now — the place to walk back to.
    [Arguments]    ${token}    ${match_uuid}
    ${info}=    Get Match Info    ${token}    ${match_uuid}    200
    RETURN    ${info.json()}[currentLocationUuid]

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
