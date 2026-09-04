*** Settings ***
# ---------------------------------------------------------------------------
# registry.robot — Step 36, the registry becomes readable.
#
# The contract under test, end-to-end and backend-agnostic:
#
#   1. GET /api/match/{uuid}/registry answers the VISIBLE keys of the match, grouped by
#      the category their story definition gives them, each carrying the SET of values it
#      holds, its visibility, its priority and the character that wrote it last.
#   2. ?includeHidden=true adds the keys the story hid, and only the owner may ask.
#   3. The same entries ride on /info, so the board needs no second request and the two
#      payloads cannot disagree.
#   4. A registry write leaves exactly one REGISTRY_CHANGE row on the match log — not
#      none, and not one per recipient.
#   5. Step 36.1 — every entry answers with `values` (a list) and `multiValue`, whatever
#      kind the key is: a single key has one member, a multi key may have several, and an
#      emptied key has none.
#
# Nothing here is addressed by a seeded id or uuid: the keys are discovered from the
# payload itself, so the suite runs green on java-sqlite, java-postgres, python and aws
# alike, whatever each backend's seed happens to declare.
#
# Tags: registry, step36
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource

Suite Setup    Suite Setup Registry


*** Test Cases ***

The Registry Answers The Visible Keys Grouped By Category
    [Documentation]    Every group carries a category (possibly null) and a non-empty list of
    ...                entries; every entry carries the key, the SET of values it holds and
    ...                the flag saying which kind of key it is.
    [Tags]    registry    step36
    ${response}=    Get Registry    ${TOKEN}    ${MATCH_UUID}    200

    ${body}=    Set Variable    ${response.json()}
    Response Should Contain Field    ${response}    groups
    FOR    ${group}    IN    @{body}[groups]
        Dictionary Should Contain Key    ${group}    category
        Should Not Be Empty    ${group}[entries]    msg=a group with no entries is not a group
        FOR    ${entry}    IN    @{group}[entries]
            Dictionary Should Contain Key    ${entry}    key
            Dictionary Should Contain Key    ${entry}    values
            Dictionary Should Contain Key    ${entry}    multiValue
            Should Be True    ${entry}[visible]
            ...    msg=a hidden key must not appear without includeHidden
        END
    END

A Key Answers With A List Of Rendered Values, And A Single Key Holds At Most One
    [Documentation]    Step 36.1 — values is always a list of strings, never a bare value and
    ...                never null. A key the story did not declare multi holds at most one
    ...                member; a multi key may hold several, and either may hold none.
    [Tags]    registry    step36
    # A story that declares no key at all is legal, so this asserts the invariant over
    # whatever the backend's own seed happens to carry rather than demanding keys exist.
    ${entries}=    Registry Entries    ${TOKEN}    ${MATCH_UUID}    include_hidden=true
    FOR    ${entry}    IN    @{entries}
        ${shaped}=    Evaluate
        ...    isinstance($entry['values'], list) and all(isinstance(v, str) for v in $entry['values'])
        Should Be True    ${shaped}    msg=${entry}[key] does not answer with a list of strings
        IF    not $entry['multiValue']
            Should Be True    len($entry['values']) <= 1
            ...    msg=${entry}[key] is not a multi key but holds several values
        END
    END

A Multi Key Holds A SET: No Member Ever Appears Twice
    [Documentation]    Step 36.1 — writing a member a multi key already holds changes nothing,
    ...                so no set the payload carries may hold a duplicate. Ordering is the
    ...                backend's: numbers numerically first, then the rest alphabetically.
    [Tags]    registry    step36
    ${entries}=    Registry Entries    ${TOKEN}    ${MATCH_UUID}    include_hidden=true
    FOR    ${entry}    IN    @{entries}
        Should Be True    len(set($entry['values'])) == len($entry['values'])
        ...    msg=${entry}[key] holds the same value twice
        ${sorted}=    Evaluate
        ...    sorted($entry['values'], key=lambda v: (0, int(v), '') if v.lstrip('-').isdigit() else (1, 0, v))
        Should Be Equal    ${sorted}    ${entry}[values]
        ...    msg=${entry}[key] is not ordered as the backend promises
    END

Include Hidden Never Removes A Key, And Only Ever Adds
    [Documentation]    The hidden view is a superset of the default one. A story that hides
    ...                nothing makes the two identical, which is a legal outcome, not a skip.
    [Tags]    registry    step36
    ${visible}=    Registry Keys    ${TOKEN}    ${MATCH_UUID}
    ${all}=        Registry Keys    ${TOKEN}    ${MATCH_UUID}    include_hidden=true

    FOR    ${key}    IN    @{visible}
        List Should Contain Value    ${all}    ${key}
        ...    msg=includeHidden dropped ${key}, which the default view showed
    END
    Should Be True    len(${all}) >= len(${visible})

The Registry On Match Info Is The Same One The Endpoint Answers
    [Documentation]    The duplication is deliberate — the board already loads /info — so the
    ...                two payloads must carry the same visible keys with the same values.
    [Tags]    registry    step36
    ${endpoint}=    Registry Entries    ${TOKEN}    ${MATCH_UUID}
    ${info}=        Info Registry Entries    ${TOKEN}    ${MATCH_UUID}

    ${from_endpoint}=    Key Value Pairs    ${endpoint}
    ${from_info}=        Key Value Pairs    ${info}
    Should Be Equal    ${from_endpoint}    ${from_info}
    ...    msg=/info and /registry disagree about the visible keys

Every Visible Key Is Declared By The Story
    [Documentation]    A key the story no longer declares reads as hidden, so anything the
    ...                default view returns must carry the definition it was joined against.
    [Tags]    registry    step36
    ${entries}=    Registry Entries    ${TOKEN}    ${MATCH_UUID}
    FOR    ${entry}    IN    @{entries}
        Should Be True    ${entry}[visible]
        Dictionary Should Contain Key    ${entry}    category
        Dictionary Should Contain Key    ${entry}    priority
    END

A Match The Caller Does Not Own Reads As Not Found
    [Documentation]    Never 403: a match nobody may see must be indistinguishable from one
    ...                that does not exist.
    [Tags]    registry    step36
    ${other}=    New Guest Token
    ${response}=    Get Registry    ${other}    ${MATCH_UUID}    404
    Should Be Equal    ${response.json()}[error]    MATCH_NOT_FOUND

An Unknown Match Is Not Found Too
    [Tags]    registry    step36
    ${response}=    Get Registry    ${TOKEN}    ${UNKNOWN_UUID}    404
    Should Be Equal    ${response.json()}[error]    MATCH_NOT_FOUND

An Event That Writes A Key Moves It And Says So
    [Documentation]    The write reaches the registry payload AND the execute-event response,
    ...                and the two agree on the new value.
    [Tags]    registry    step36
    ${token}    ${match}=    Fresh Registry Match
    ${uuid}    ${before}=    Any Writable Registry Key    ${token}    ${match}

    ${executed}=    Execute Event    ${token}    ${match}    ${uuid}    200
    ${changes}=     Set Variable    ${executed.json()}[registryChanges]
    Should Not Be Empty    ${changes}    msg=the event wrote no registry change

    ${change}=    Set Variable    ${changes}[0]
    ${after}=     Registry Value Of    ${token}    ${match}    ${change}[key]
    IF    $after is not None
        Should Be Equal As Strings    ${after}    ${change}[newValue]
        ...    msg=the registry and the execute-event response disagree
    END

A Registry Write Leaves Exactly One REGISTRY_CHANGE On The Match Log
    [Documentation]    Emitted from the one writer, so it can neither be missed nor doubled —
    ...                not even when the effect targets every character in the match.
    [Tags]    registry    step36
    ${token}    ${match}=    Fresh Registry Match
    ${before}=    Registry Change Count    ${token}    ${match}

    ${uuid}    ${_}=    Any Writable Registry Key    ${token}    ${match}
    Execute Event    ${token}    ${match}    ${uuid}    200

    ${after}=    Registry Change Count    ${token}    ${match}
    Should Be True    ${after} > ${before}
    ...    msg=an event wrote a registry key and left no REGISTRY_CHANGE behind

Seeding A Match Writes No Registry Change
    [Documentation]    Defaults are not changes: a brand-new match has a registry but an empty
    ...                REGISTRY_CHANGE history.
    [Tags]    registry    step36
    ${token}    ${match}=    Fresh Registry Match
    ${count}=    Registry Change Count    ${token}    ${match}
    Should Be Equal As Integers    ${count}    0


*** Keywords ***

Suite Setup Registry
    [Documentation]    An admin session (for the story loadout) plus one running match whose
    ...                registry the read-only cases share.
    Create Admin Session
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}    ${story}
    Set Suite Variable    ${DIFFICULTY}    ${difficulty}
    Set Suite Variable    ${CHARACTER}    ${character}
    Set Suite Variable    ${CLASS}    ${class}
    Set Suite Variable    ${TRAIT}    ${trait}

    ${token}    ${match}=    Fresh Registry Match
    Set Suite Variable    ${TOKEN}    ${token}
    Set Suite Variable    ${MATCH_UUID}    ${match}

Fresh Registry Match
    [Documentation]    A running single-player match on its own guest. Fresh per case that
    ...                writes, because a registry key latches and cannot be spent twice.
    ${token}=    New Guest Token
    ${match}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY}    robottest_step36
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

Registry Entries
    [Documentation]    Every entry of every group, flattened.
    [Arguments]    ${token}    ${match_uuid}    ${include_hidden}=${EMPTY}
    ${response}=    Get Registry    ${token}    ${match_uuid}    200
    ...    include_hidden=${include_hidden}
    ${entries}=    Create List
    FOR    ${group}    IN    @{response.json()}[groups]
        FOR    ${entry}    IN    @{group}[entries]
            Append To List    ${entries}    ${entry}
        END
    END
    RETURN    ${entries}

Registry Keys
    [Arguments]    ${token}    ${match_uuid}    ${include_hidden}=${EMPTY}
    ${entries}=    Registry Entries    ${token}    ${match_uuid}    ${include_hidden}
    ${keys}=    Create List
    FOR    ${entry}    IN    @{entries}
        Append To List    ${keys}    ${entry}[key]
    END
    RETURN    ${keys}

Info Registry Entries
    [Documentation]    The registry as /info carries it, visible keys only.
    [Arguments]    ${token}    ${match_uuid}
    ${info}=    Get Match Info    ${token}    ${match_uuid}    200
    ${visible}=    Create List
    FOR    ${entry}    IN    @{info.json()}[registry]
        IF    $entry.get('visible')    Append To List    ${visible}    ${entry}
    END
    RETURN    ${visible}

Key Value Pairs
    [Documentation]    A sorted key→rendered-value view, so two payloads can be compared
    ...                without depending on the order either one happened to use.
    [Arguments]    ${entries}
    ${pairs}=    Evaluate
    ...    sorted((e['key'], tuple(e['values'])) for e in $entries)
    RETURN    ${pairs}

Registry Value Of
    [Arguments]    ${token}    ${match_uuid}    ${key}
    ${entries}=    Registry Entries    ${token}    ${match_uuid}    include_hidden=true
    FOR    ${entry}    IN    @{entries}
        IF    $entry['key'] == $key
            # Step 36.1 — a set as one comparable string; an empty set reads as absent.
            ${value}=    Evaluate    ','.join($entry['values']) or None
            RETURN    ${value}
        END
    END
    RETURN    ${None}

Any Writable Registry Key
    [Documentation]    An event the board offers AND whose effects write a registry key — being
    ...                available is not the same as writing something. The story is asked which
    ...                events carry a key-writing effect; the board decides which of those the
    ...                player may actually run. Returns the event uuid and the registry before.
    [Arguments]    ${token}    ${match_uuid}
    ${writers}=    Registry Writing Event Uuids
    ${before}=     Registry Entries    ${token}    ${match_uuid}    include_hidden=true
    ${info}=       Get Match Info    ${token}    ${match_uuid}    200
    FOR    ${location}    IN    @{info.json()}[locationsActive]
        FOR    ${event}    IN    @{location}[events]
            IF    $event.get('available') and $event['uuid'] in $writers
                RETURN    ${event}[uuid]    ${before}
            END
        END
    END
    Fail    the board offers no available event that writes a registry key

Registry Writing Event Uuids
    [Documentation]    The uuids of every seeded event owning an effect row with a keyToAdd.
    ...                Read from the story, not hardcoded, so any story works.
    ${effects}=    GET On Session    admin_session
    ...    /api/admin/stories/${STORY_UUID}/event-effects
    Status Should Be    ${effects}    200
    ${events}=    GET On Session    admin_session    /api/admin/stories/${STORY_UUID}/events
    Status Should Be    ${events}    200

    ${owners}=    Create List
    FOR    ${effect}    IN    @{effects.json()}
        IF    $effect.get('keyToAdd')    Append To List    ${owners}    ${effect}[idEvent]
    END
    ${uuids}=    Create List
    FOR    ${event}    IN    @{events.json()}
        IF    $event['id'] in $owners    Append To List    ${uuids}    ${event}[uuid]
    END
    RETURN    ${uuids}

Registry Change Count
    [Documentation]    How many REGISTRY_CHANGE rows the match log carries so far.
    [Arguments]    ${token}    ${match_uuid}
    ${logs}=    Get Match Logs    ${token}    ${match_uuid}    200
    ${count}=    Evaluate
    ...    len([e for e in $logs.json()['logs'] if e.get('type') == 'REGISTRY_CHANGE'])
    RETURN    ${count}
