*** Settings ***
# ---------------------------------------------------------------------------
# registry_case_insensitive.robot — v0.36.2, spelling must not decide a gate.
#
# The contract under test, end-to-end and backend-agnostic:
#
#   1. A string comparison (= and !=) ignores letter case and surrounding whitespace on
#      BOTH sides. A registry holding ' Ledger ' satisfies a condition asking for 'ledger',
#      and a registry holding 'green' satisfies one asking for '  GREEN  '.
#   2. A set does not gain a second spelling of a member it already holds: writing 'LEDGER'
#      into a key that already holds ' Ledger ' changes nothing.
#   3. Storage is untouched. The registry answers what the story actually wrote, padding and
#      capitals included — normalisation happens at comparison time and nowhere else.
#   4. A numeric comparison (> and <) is unaffected: it still needs a number on both sides.
#
# The fixtures are found by the shape of what they do, never by a seeded uuid: the writer is
# whichever available event writes the multi key, the gate is whichever event reads it. So
# the suite runs green on java-sqlite, java-postgres, python and aws alike.
#
# Tags: registry, step36-2
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource

Suite Setup    Suite Setup Case Registry


*** Variables ***
# The multi key the seed writes in three spellings, and the single key it never writes at all.
${PADDED_KEY}      case_notes
${DEFAULTED_KEY}   signal


*** Test Cases ***

A Condition Reads A Value The Story Wrote Padded And Capitalised
    [Documentation]    The whole claim of v0.36.2 in one pair of rows: the writer stores
    ...                ' Ledger ', the gate asks for 'ledger', and the gate opens.
    [Tags]    registry    step36-2
    ${token}    ${match}=    Fresh Case Match
    ${writer}    ${gate}=    Padded Writer And Gate    ${token}    ${match}

    Event Should Be Available    ${token}    ${match}    ${gate}    ${False}
    ...    msg=the gate opened before anything was written to ${PADDED_KEY}

    Execute Event    ${token}    ${match}    ${writer}    200

    Event Should Be Available    ${token}    ${match}    ${gate}    ${True}
    ...    msg=a lowercase condition did not read a value stored padded and capitalised

A Condition Padded And Capitalised Reads A Value The Story Wrote Bare
    [Documentation]    The mirror direction. The default of ${DEFAULTED_KEY} is written
    ...                lowercase by the seed; the condition on it is padded and upper case.
    ...                Nothing has to be executed first — it is open from the first turn.
    [Tags]    registry    step36-2
    ${token}    ${match}=    Fresh Case Match
    ${gate}=    Defaulted Key Gate

    Event Should Be Available    ${token}    ${match}    ${gate}    ${True}
    ...    msg=a padded, upper-case condition did not read the bare lowercase default

A Set Does Not Gain A Second Spelling Of A Member It Already Holds
    [Documentation]    ' Ledger ' and 'LEDGER' are one member, not two: a duplicate is not a
    ...                new value, however it is spelled.
    [Tags]    registry    step36-2
    ${token}    ${match}=    Fresh Case Match
    ${writer}    ${_}=    Padded Writer And Gate    ${token}    ${match}
    ${shouter}=    Second Spelling Writer    ${token}    ${match}

    Execute Event    ${token}    ${match}    ${writer}    200
    ${after_first}=    Registry Members    ${token}    ${match}    ${PADDED_KEY}
    Length Should Be    ${after_first}    1

    Execute Event    ${token}    ${match}    ${shouter}    200

    ${after_second}=    Registry Members    ${token}    ${match}    ${PADDED_KEY}
    Length Should Be    ${after_second}    1
    ...    msg=a second spelling of the same value joined the set as a new member

The Registry Answers What The Story WROTE, Not A Normalised Form Of It
    [Documentation]    Normalisation belongs to the comparison, not to the storage. The value
    ...                comes back with the padding and the capitals the author gave it.
    [Tags]    registry    step36-2
    ${token}    ${match}=    Fresh Case Match
    ${writer}    ${_}=    Padded Writer And Gate    ${token}    ${match}

    Execute Event    ${token}    ${match}    ${writer}    200

    ${members}=    Registry Members    ${token}    ${match}    ${PADDED_KEY}
    ${stored}=    Set Variable    ${members}[0]
    Should Not Be Equal    ${stored}    ${stored.strip().lower()}
    ...    msg=the registry stored a normalised value; only the COMPARISON may fold case

A Fresh Match Holds No Member For Either Key It Has Not Written
    [Documentation]    At the start nothing has been written: the multi key's set is empty.
    ...                The single key holds only the default its story definition carries.
    [Tags]    registry    step36-2
    ${token}    ${match}=    Fresh Case Match

    ${notes}=    Registry Members    ${token}    ${match}    ${PADDED_KEY}
    Should Be Empty    ${notes}    msg=a multi key with no default started with a member

    ${signal}=    Registry Members    ${token}    ${match}    ${DEFAULTED_KEY}
    Length Should Be    ${signal}    1
    ...    msg=a single key with a default did not start holding exactly it


*** Keywords ***

Suite Setup Case Registry
    [Documentation]    An admin session (for the story loadout and the story's own tables)
    ...                plus the loadout every case builds its own match from.
    Create Admin Session
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}    ${story}
    Set Suite Variable    ${DIFFICULTY}    ${difficulty}
    Set Suite Variable    ${CHARACTER}    ${character}
    Set Suite Variable    ${CLASS}    ${class}
    Set Suite Variable    ${TRAIT}    ${trait}

Fresh Case Match
    [Documentation]    A running single-player match on its own guest. Fresh per case: a
    ...                registry key latches, so no two cases may share one match.
    ${token}=    New Guest Token
    ${match}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY}    robottest_step362
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

Admin Rows
    [Documentation]    One of the story's own tables, straight from the admin CRUD.
    [Arguments]    ${slug}
    ${response}=    GET On Session    admin_session    /api/admin/stories/${STORY_UUID}/${slug}
    Status Should Be    ${response}    200
    RETURN    ${response.json()}

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

Event Should Be Available
    [Documentation]    Whether the board currently offers one event. Availability is on
    ...                match-info, so no attempt to run it is needed to read the verdict.
    [Arguments]    ${token}    ${match_uuid}    ${event_uuid}    ${expected}    ${msg}=${EMPTY}
    ${info}=    Get Match Info    ${token}    ${match_uuid}    200
    FOR    ${location}    IN    @{info.json()}[locationsActive]
        FOR    ${event}    IN    @{location}[events]
            IF    $event['uuid'] == $event_uuid
                Should Be Equal    ${event}[available]    ${expected}    msg=${msg}
                RETURN
            END
        END
    END
    Fail    the board does not list the event ${event_uuid}

Padded Writer And Gate
    [Documentation]    Two events found by what they do, never by a seeded id: the writer is
    ...                the available event whose effect stores a value for ${PADDED_KEY} that
    ...                is NOT already bare-lowercase; the gate is the event whose registry
    ...                condition on that key IS bare-lowercase. Together they are the claim.
    [Arguments]    ${token}    ${match_uuid}
    ${events}=     Admin Rows    events
    ${effects}=    Admin Rows    event-effects
    ${offered}=    Available Event Uuids    ${token}    ${match_uuid}

    ${writer}=    Set Variable    ${None}
    FOR    ${effect}    IN    @{effects}
        ${value}=    Set Variable    ${effect.get('keyValueToAdd')}
        IF    $effect.get('keyToAdd') == $PADDED_KEY and $value and $value != $value.strip().lower()
            ${writer}=    Event Uuid By Id    ${events}    ${effect}[idEvent]
            IF    $writer in $offered    BREAK
            ${writer}=    Set Variable    ${None}
        END
    END
    Should Not Be Equal    ${writer}    ${None}
    ...    msg=no available event writes ${PADDED_KEY} with padding or capitals

    ${gate}=    Set Variable    ${None}
    FOR    ${event}    IN    @{events}
        ${expected}=    Set Variable    ${event.get('registryValueCondition')}
        IF    $event.get('registryKeyCondition') == $PADDED_KEY and $expected == $expected.strip().lower()
            ${gate}=    Set Variable    ${event}[uuid]
            BREAK
        END
    END
    Should Not Be Equal    ${gate}    ${None}
    ...    msg=no event reads ${PADDED_KEY} with a bare lowercase condition
    RETURN    ${writer}    ${gate}

Second Spelling Writer
    [Documentation]    The other available event writing ${PADDED_KEY} — the one whose value
    ...                is bare and upper case, i.e. a third spelling of the same member.
    [Arguments]    ${token}    ${match_uuid}
    ${events}=     Admin Rows    events
    ${effects}=    Admin Rows    event-effects
    ${offered}=    Available Event Uuids    ${token}    ${match_uuid}
    FOR    ${effect}    IN    @{effects}
        ${value}=    Set Variable    ${effect.get('keyValueToAdd')}
        IF    $effect.get('keyToAdd') == $PADDED_KEY and $value and $value == $value.upper()
            ${uuid}=    Event Uuid By Id    ${events}    ${effect}[idEvent]
            IF    $uuid in $offered    RETURN    ${uuid}
        END
    END
    Fail    no available event writes ${PADDED_KEY} in a second, upper-case spelling

Defaulted Key Gate
    [Documentation]    The event whose condition on ${DEFAULTED_KEY} is padded or capitalised —
    ...                the mirror of the case above, read against a bare stored default.
    ${events}=    Admin Rows    events
    FOR    ${event}    IN    @{events}
        ${expected}=    Set Variable    ${event.get('registryValueCondition')}
        IF    $event.get('registryKeyCondition') == $DEFAULTED_KEY and $expected and $expected != $expected.strip().lower()
            RETURN    ${event}[uuid]
        END
    END
    Fail    no event reads ${DEFAULTED_KEY} with a padded or upper-case condition

Available Event Uuids
    [Documentation]    Every event the board currently offers, whatever the location.
    [Arguments]    ${token}    ${match_uuid}
    ${info}=    Get Match Info    ${token}    ${match_uuid}    200
    ${uuids}=    Create List
    FOR    ${location}    IN    @{info.json()}[locationsActive]
        FOR    ${event}    IN    @{location}[events]
            IF    $event.get('available')    Append To List    ${uuids}    ${event}[uuid]
        END
    END
    RETURN    ${uuids}

Event Uuid By Id
    [Arguments]    ${events}    ${event_id}
    FOR    ${event}    IN    @{events}
        IF    $event['id'] == $event_id    RETURN    ${event}[uuid]
    END
    RETURN    ${None}
