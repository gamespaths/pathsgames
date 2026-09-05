*** Settings ***
# ---------------------------------------------------------------------------
# registry_multi_value.robot — Step 36.1, a registry key may hold a SET of values.
#
# Until v0.36.0 a key held ONE value and every write replaced it. A key declared
# `multi_value = 1` now ACCUMULATES: each write adds a member, a member it already
# holds is not added twice, and `value_to_remove` takes one member away instead of
# clearing the key. A key left single behaves exactly as it did, which is why no
# authored story changed meaning.
#
# The contract under test, end-to-end and backend-agnostic:
#
#   1. A multi key with no default starts as an EMPTY SET — the entry is there, its
#      `values` is []. An empty set is the absence of rows, not a row holding nothing.
#   2. Two writes of two different values leave BOTH, ordered by the backend.
#   3. Writing a member the set already holds changes nothing, and says nothing: no
#      second member, and no second REGISTRY_CHANGE on the log.
#   4. `=` quantifies EXISTENTIALLY over the members: an event gated on one member is
#      blocked until that member is in the set, whatever else the set holds.
#   5. `value_to_remove` on a multi key removes THAT member and leaves the rest.
#   6. Removing the last member leaves the key with an empty set — the key does not
#      vanish, and it is still `multiValue`.
#   7. /info and /registry carry the same set, as they carry the same keys.
#
# The seed ships the test-bed on the tutorial story: one multi key, two FREE events
# that each add one member, one event gated on a member, and a choice-event whose
# only option removes a member. Everything here is discovered from the story through
# the admin API — the multi key is the one the story declares multi, the adders are
# the events whose effects write it — so the suite runs green on java-sqlite,
# java-postgres, python and aws alike, whatever each backend's seed ids happen to be.
#
# Every case that writes runs on its OWN match: a set latches, and a member added by
# one case would be read by the next.
#
# Tags: registry, step36, multivalue
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource

Suite Setup    Suite Setup Registry Multi Value


*** Variables ***
${LEDGER}      ledger
${LETTER}      letter


*** Test Cases ***

A Multi Key Starts As An Empty Set, Not As A Missing Key
    [Documentation]    A multi key with no default seeds NO row, and the entry is there all the
    ...                same: the story declares the key, so the payload carries it holding
    ...                nothing. A board must be able to render "none found yet".
    [Tags]    registry    step36    multivalue
    ${token}    ${match}=    Fresh Multi Value Match

    ${entry}=    Multi Key Entry    ${token}    ${match}
    Should Be Empty    ${entry}[values]
    ...    msg=a multi key with no default must start with an EMPTY set
    Should Be True    ${entry}[multiValue]
    ...    msg=the payload must say the key accumulates, so a client can render it as a set

Each Write Adds A Member Instead Of Replacing The Value
    [Documentation]    The whole point of Step 36.1. Two writes of two different values leave
    ...                BOTH on the key, where a single key would have kept only the last one.
    [Tags]    registry    step36    multivalue
    ${token}    ${match}=    Fresh Multi Value Match

    Add Member    ${token}    ${match}    ${LEDGER}
    ${after_first}=    Multi Key Values    ${token}    ${match}
    Should Be Equal    ${after_first}    ${{ ['${LEDGER}'] }}

    Add Member    ${token}    ${match}    ${LETTER}
    ${after_second}=    Multi Key Values    ${token}    ${match}
    Length Should Be    ${after_second}    2
    ...    msg=the second write REPLACED the first — the key is not accumulating
    List Should Contain Value    ${after_second}    ${LEDGER}
    List Should Contain Value    ${after_second}    ${LETTER}

    # Ordered by the backend, so every client renders the same set the same way: numbers
    # numerically first, then everything else alphabetically. Both members are words here.
    ${sorted}=    Evaluate    sorted($after_second)
    Should Be Equal    ${sorted}    ${after_second}
    ...    msg=the members are not ordered as the backend promises

Writing A Member The Set Already Holds Changes Nothing
    [Documentation]    A SET holds each value once. Running the same adder twice must leave one
    ...                member — and must not report a change either: the second write is
    ...                refused by the registry, so it leaves no REGISTRY_CHANGE behind.
    [Tags]    registry    step36    multivalue
    ${token}    ${match}=    Fresh Multi Value Match

    Add Member    ${token}    ${match}    ${LEDGER}
    ${changes_after_first}=    Registry Change Count    ${token}    ${match}

    ${second}=    Execute Event    ${token}    ${match}    ${ADDERS}[${LEDGER}]    200
    Should Be Empty    ${second.json()}[registryChanges]
    ...    msg=adding a member the set already holds must report no change

    ${values}=    Multi Key Values    ${token}    ${match}
    Should Be Equal    ${values}    ${{ ['${LEDGER}'] }}
    ...    msg=the same value was added twice — the key is a list, not a set

    ${changes_after_second}=    Registry Change Count    ${token}    ${match}
    Should Be Equal As Integers    ${changes_after_second}    ${changes_after_first}
    ...    msg=a write that changed nothing still wrote a REGISTRY_CHANGE row

Equals Is Met When ANY Member Of The Set Matches
    [Documentation]    `=` quantifies existentially. The gated event stays blocked while the
    ...                set does not hold its value — even once the set holds another one — and
    ...                opens as soon as that value joins.
    [Tags]    registry    step36    multivalue
    ${token}    ${match}=    Fresh Multi Value Match

    ${blocked}=    Event Verdict    ${token}    ${match}    ${GATED_EVENT}
    Should Not Be True    ${blocked}[available]
    ...    msg=an empty set must not satisfy an = condition
    Should Be Equal    ${blocked}[reason]    REGISTRY_CONDITION_NOT_MET

    # Another member joins: the condition names a value the set still does not hold.
    Add Member    ${token}    ${match}    ${LEDGER}
    ${still_blocked}=    Event Verdict    ${token}    ${match}    ${GATED_EVENT}
    Should Not Be True    ${still_blocked}[available]
    ...    msg=a set holding some OTHER member must not satisfy the condition

    # And now the one it names.
    Add Member    ${token}    ${match}    ${LETTER}
    ${open}=    Event Verdict    ${token}    ${match}    ${GATED_EVENT}
    Should Be True    ${open}[available]
    ...    msg=one member equal to the expected value is enough to satisfy =
    Execute Event    ${token}    ${match}    ${GATED_EVENT}    200

value_to_remove Takes One Member Away And Leaves The Rest
    [Documentation]    On a single key value_to_remove clears the value; on a multi key it
    ...                removes THAT member only. The option is an `otherwise` fallback, so it
    ...                is always selectable whatever the character rolled.
    [Tags]    registry    step36    multivalue
    ${token}    ${match}=    Fresh Multi Value Match
    Add Member    ${token}    ${match}    ${LEDGER}
    Add Member    ${token}    ${match}    ${LETTER}

    Remove Member    ${token}    ${match}

    ${values}=    Multi Key Values    ${token}    ${match}
    Should Be Equal    ${values}    ${{ ['${LETTER}'] }}
    ...    msg=removing one member must leave every other member standing

Emptying A Multi Key Leaves It With An Empty Set, Never Absent
    [Documentation]    The last member goes, the key does not: its row disappears, its entry
    ...                stays, and it still reports itself as a multi key. Otherwise a board
    ...                could not tell "nothing found" from "this story has no such key".
    [Tags]    registry    step36    multivalue
    ${token}    ${match}=    Fresh Multi Value Match
    Add Member    ${token}    ${match}    ${LEDGER}

    Remove Member    ${token}    ${match}

    ${entry}=    Multi Key Entry    ${token}    ${match}
    Should Be Empty    ${entry}[values]    msg=the last member was not removed
    Should Be True    ${entry}[multiValue]
    ...    msg=an emptied multi key must still declare itself multi

Removing A Member The Set Never Held Changes Nothing
    [Documentation]    The mirror of the duplicate-add rule: an option may not wipe what the
    ...                set does not hold, and reports nothing when it changes nothing.
    [Tags]    registry    step36    multivalue
    ${token}    ${match}=    Fresh Multi Value Match
    Add Member    ${token}    ${match}    ${LETTER}
    ${before}=    Registry Change Count    ${token}    ${match}

    ${resolved}=    Remove Member    ${token}    ${match}
    Should Be Empty    ${resolved.json()}[registryChanges]
    ...    msg=removing a member the set never held must report no change

    ${values}=    Multi Key Values    ${token}    ${match}
    Should Be Equal    ${values}    ${{ ['${LETTER}'] }}
    ...    msg=the removal touched a member it does not name
    ${after}=    Registry Change Count    ${token}    ${match}
    Should Be Equal As Integers    ${after}    ${before}

Every Add Reports The Whole Set As The New Value
    [Documentation]    The execute-event response and the registry must agree, on a set as
    ...                they already did on a single value: newValue is the set the key holds
    ...                AFTER the write, and oldValue the one it held before.
    [Tags]    registry    step36    multivalue
    ${token}    ${match}=    Fresh Multi Value Match

    ${first}=    Add Member    ${token}    ${match}    ${LEDGER}
    ${change}=    Change For Multi Key    ${first}
    Should Be Equal    ${change}[oldValue]    ${None}
    ...    msg=an empty set must read as no value at all, not as an empty string
    Should Be Equal    ${change}[newValue]    ${LEDGER}

    ${second}=    Add Member    ${token}    ${match}    ${LETTER}
    ${change}=    Change For Multi Key    ${second}
    ${values}=    Multi Key Values    ${token}    ${match}
    Should Be Equal    ${change}[newValue]    ${{ ','.join($values) }}
    ...    msg=the response and the registry disagree about the set

An Option Gated On != Is Offered While The Set Does Not Hold The Value
    [Documentation]    Step 36.1 — `!=` over a set means "no member equals this". An empty set
    ...                holds nothing, so the option is selectable.
    [Tags]    registry    step36    multivalue
    ${token}    ${match}=    Fresh Multi Value Match

    ${option}=    Gated Option Verdict    ${token}    ${match}
    Should Be True    ${option}[available]
    ...    msg=a set holding nothing must satisfy != — "never set" IS different

An Option Gated On != Is Refused Once The Set Holds That Value
    [Documentation]    The regression this guards: the AWS choice check kept its own copy of
    ...                the comparison and matched the expected value against the whole LIST.
    ...                A string never equals a list, so every != passed whatever the set held,
    ...                and an option gated on "must NOT hold this" opened on a set holding it.
    [Tags]    registry    step36    multivalue
    ${token}    ${match}=    Fresh Multi Value Match
    Add Member    ${token}    ${match}    ${GATED_VALUE}
    ${values}=    Multi Key Values    ${token}    ${match}
    List Should Contain Value    ${values}    ${GATED_VALUE}
    ...    msg=the set does not hold the value the condition names — nothing is being tested

    ${option}=    Gated Option Verdict    ${token}    ${match}

    Should Not Be True    ${option}[available]
    ...    msg=!= was satisfied by a set that HOLDS the value
    Should Be Equal    ${option}[reason]    CONDITION_KEYS_NOT_MET

The Set On Match Info Is The One The Registry Endpoint Answers
    [Documentation]    /info carries the registry so the board needs no second request; the
    ...                two payloads cannot disagree about a set any more than about a value.
    [Tags]    registry    step36    multivalue
    ${token}    ${match}=    Fresh Multi Value Match
    Add Member    ${token}    ${match}    ${LEDGER}
    Add Member    ${token}    ${match}    ${LETTER}

    ${from_endpoint}=    Multi Key Values    ${token}    ${match}

    ${info}=    Get Match Info    ${token}    ${match}    200
    ${on_info}=    Evaluate
    ...    next((e['values'] for e in $info.json()['registry'] if e['key'] == '${MULTI_KEY}'), None)
    Should Not Be Equal    ${on_info}    ${None}
    ...    msg=/info does not carry the multi key at all
    Should Be Equal    ${on_info}    ${from_endpoint}
    ...    msg=/info and /registry disagree about the set


*** Keywords ***

Suite Setup Registry Multi Value
    [Documentation]    An admin session (to read the story), a loadout, and the fixtures the
    ...                seed ships — every one of them discovered from the story itself.
    Create Admin Session
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}    ${story}
    Set Suite Variable    ${DIFFICULTY}    ${difficulty}
    Set Suite Variable    ${CHARACTER}    ${character}
    Set Suite Variable    ${CLASS}    ${class}
    Set Suite Variable    ${TRAIT}    ${trait}

    ${key}=    Multi Key Name
    Set Suite Variable    ${MULTI_KEY}    ${key}
    ${adders}=    Adder Event Uuids    ${key}
    Set Suite Variable    ${ADDERS}    ${adders}
    Dictionary Should Contain Key    ${adders}    ${LEDGER}
    Dictionary Should Contain Key    ${adders}    ${LETTER}
    ${gated}=    Gated Event Uuid    ${key}
    Set Suite Variable    ${GATED_EVENT}    ${gated}
    ${event}    ${choice}=    Remover Event And Choice    ${key}
    Set Suite Variable    ${REMOVER_EVENT}    ${event}
    Set Suite Variable    ${REMOVER_CHOICE}    ${choice}
    ${gated_event}    ${gated_choice}    ${gated_value}=    Gated Option    ${key}
    Set Suite Variable    ${GATED_OPTION_EVENT}    ${gated_event}
    Set Suite Variable    ${GATED_OPTION}    ${gated_choice}
    Set Suite Variable    ${GATED_VALUE}    ${gated_value}
    Dictionary Should Contain Key    ${ADDERS}    ${gated_value}
    ...    msg=no seeded event adds ${gated_value}, so the != condition can never be armed

Fresh Multi Value Match
    [Documentation]    A running single-player match on its own guest. Fresh per case: a set
    ...                latches, and a member one case adds would be read by the next.
    ${token}=    New Guest Token
    ${match}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY}    robottest_step361
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

# ── the moves ───────────────────────────────────────────────────────────────

Add Member
    [Documentation]    Runs the event whose effect adds that value to the multi key.
    [Arguments]    ${token}    ${match_uuid}    ${value}
    ${response}=    Execute Event    ${token}    ${match_uuid}    ${ADDERS}[${value}]    200
    RETURN    ${response}

Remove Member
    [Documentation]    Opens the choice-event that owns the removing option and resolves it.
    ...                The option is an `otherwise` fallback, so it is always selectable.
    [Arguments]    ${token}    ${match_uuid}
    ${opened}=    Execute Event    ${token}    ${match_uuid}    ${REMOVER_EVENT}    200
    Should Be Equal    ${opened.json()}[status]    CHOICES_PENDING
    ...    msg=the removing event is not a choice-event any more
    ${response}=    Select Choice    ${token}    ${match_uuid}    ${REMOVER_CHOICE}    200
    Should Be Equal    ${response.json()}[status]    APPLIED
    RETURN    ${response}

# ── reading the set back ────────────────────────────────────────────────────

Multi Key Entry
    [Documentation]    The registry entry of the multi key, hidden keys included so the case
    ...                never depends on what the story chose to show.
    [Arguments]    ${token}    ${match_uuid}
    ${response}=    Get Registry    ${token}    ${match_uuid}    200    include_hidden=true
    FOR    ${group}    IN    @{response.json()}[groups]
        FOR    ${entry}    IN    @{group}[entries]
            IF    $entry['key'] == $MULTI_KEY    RETURN    ${entry}
        END
    END
    Fail    the registry carries no entry for ${MULTI_KEY} — an emptied key must keep its own

Multi Key Values
    [Arguments]    ${token}    ${match_uuid}
    ${entry}=    Multi Key Entry    ${token}    ${match_uuid}
    RETURN    ${entry}[values]

Change For Multi Key
    [Documentation]    The registryChanges row naming the multi key, out of an execute-event
    ...                response — an event may legitimately write more than one key.
    [Arguments]    ${response}
    ${change}=    Evaluate
    ...    next((c for c in $response.json()['registryChanges'] if c.get('key') == '${MULTI_KEY}'), None)
    Should Not Be Equal    ${change}    ${None}
    ...    msg=the event wrote ${MULTI_KEY} and reported no change for it
    RETURN    ${change}

Event Verdict
    [Documentation]    The event as /info offers it, with its `available` flag and its reason.
    [Arguments]    ${token}    ${match_uuid}    ${event_uuid}
    ${info}=    Get Match Info    ${token}    ${match_uuid}    200
    FOR    ${location}    IN    @{info.json()}[locationsActive]
        FOR    ${event}    IN    @{location}[events]
            IF    $event['uuid'] == $event_uuid    RETURN    ${event}
        END
    END
    Fail    the board does not offer ${event_uuid} at all

Registry Change Count
    [Documentation]    How many REGISTRY_CHANGE rows the match log carries so far.
    [Arguments]    ${token}    ${match_uuid}
    ${logs}=    Get Match Logs    ${token}    ${match_uuid}    200
    ${count}=    Evaluate
    ...    len([e for e in $logs.json()['logs'] if e.get('type') == 'REGISTRY_CHANGE'])
    RETURN    ${count}

# ── addressing the seeded fixtures by behaviour ─────────────────────────────

Admin Rows
    [Documentation]    One admin collection of the story under test.
    [Arguments]    ${entity_type}
    ${response}=    GET On Session    admin_session    /api/admin/stories/${STORY_UUID}/${entity_type}
    Status Should Be    ${response}    200
    RETURN    ${response.json()}

Multi Key Name
    [Documentation]    The multi-valued key THIS suite is about: the one whose seeded events
    ...                add both members it works with. A SQL backend answers multiValue with
    ...                the column (0 where nothing was authored), AWS with the attribute as
    ...                authored and omits what was never set, so truthiness is what is read.
    ...
    ...                v0.36.2 — "the first multi key" is no longer enough: the seed declares
    ...                a second one for the case-and-padding pack, and picking it would leave
    ...                this suite hunting for members no event of that key ever adds.
    ${keys}=    Admin Rows    keys
    ${candidates}=    Evaluate
    ...    [k.get('name') or k.get('keyName') for k in $keys if k.get('multiValue')]
    Should Not Be Empty    ${candidates}
    ...    msg=the story declares no multi-valued key — the Step 36.1 seed is missing
    FOR    ${name}    IN    @{candidates}
        ${adders}=    Adder Event Uuids    ${name}
        ${has_both}=    Evaluate    $LEDGER in $adders and $LETTER in $adders
        IF    ${has_both}    RETURN    ${name}
    END
    Fail    no multi-valued key is written with both ${LEDGER} and ${LETTER}

Adder Event Uuids
    [Documentation]    value → the uuid of the event whose effect adds that value to the key.
    ...                A story event keeps its uuid inside a match, so the admin uuid is the
    ...                very uuid execute-event takes.
    [Arguments]    ${key}
    ${effects}=    Admin Rows    event-effects
    ${events}=     Admin Rows    events
    ${adders}=    Evaluate
    ...    {e['keyValueToAdd']: uuids[e['idEvent']] for e in $effects if e.get('keyToAdd') == '${key}' and e.get('keyValueToAdd') and e.get('idEvent') in uuids}
    ...    namespace=${{ {'effects': $effects, 'uuids': {e['id']: e['uuid'] for e in $events}} }}
    # Empty is not an error here: Multi Key Name probes every multi key with this, and the
    # callers that need members assert for the ones they actually work with.
    RETURN    ${adders}

Gated Option
    [Documentation]    The option gated on the multi key with `!=`, and the value it names:
    ...                the choice-condition row carrying it, resolved to the event that owns
    ...                the option, the option's own uuid and the value under test. A story
    ...                choice keeps its uuid inside a match, as the Step 32 suite relies on.
    [Arguments]    ${key}
    ${conditions}=    Admin Rows    choice-conditions
    ${choices}=       Admin Rows    choices
    ${events}=        Admin Rows    events
    # Two spellings per field, and both are correct: the SQL backends answer with the short
    # `type`/`key`/`value`/`operator` while Python camelises its own column names, which are
    # `condition_*`. Same story for the link, `idChoices` against `idChoice`.
    ${found}=    Evaluate
    ...    next(((uuids[by_id[cid(c)]['idEvent']], by_id[cid(c)]['uuid'], fld(c, 'value', 'conditionValue')) for c in $conditions if str(fld(c, 'type', 'conditionType') or '').upper() == 'KEYS' and fld(c, 'key', 'conditionKey') == '${key}' and fld(c, 'operator', 'conditionOperator') == '!=' and cid(c) in by_id), None)
    ...    namespace=${{ {'by_id': {c['id']: c for c in $choices}, 'uuids': {e['id']: e['uuid'] for e in $events}, 'cid': lambda r: r['idChoices'] if r.get('idChoices') is not None else r.get('idChoice'), 'fld': lambda r, *names: next((r[n] for n in names if r.get(n) is not None), None)} }}
    Should Not Be Equal    ${found}    ${None}
    ...    msg=no seeded option is gated on ${key} with != — the Step 36.1 seed is missing
    RETURN    ${found}[0]    ${found}[1]    ${found}[2]

Gated Option Verdict
    [Documentation]    Opens the choice-event that owns the gated option and returns that
    ...                option as the board offers it, with its verdict and its reason.
    [Arguments]    ${token}    ${match_uuid}
    ${opened}=    Execute Event    ${token}    ${match_uuid}    ${GATED_OPTION_EVENT}    200
    Should Be Equal    ${opened.json()}[status]    CHOICES_PENDING
    FOR    ${option}    IN    @{opened.json()}[pendingChoices]
        IF    $option['uuid'] == $GATED_OPTION    RETURN    ${option}
    END
    Fail    the open did not offer the option gated on ${MULTI_KEY}

Gated Event Uuid
    [Documentation]    The event whose availability is conditioned on the multi key.
    [Arguments]    ${key}
    ${events}=    Admin Rows    events
    ${uuid}=    Evaluate
    ...    next((e['uuid'] for e in sorted($events, key=lambda x: x['id']) if e.get('registryKeyCondition') == '${key}'), None)
    Should Not Be Equal    ${uuid}    ${None}
    ...    msg=no seeded event is gated on ${key} — the Step 36.1 seed is missing
    RETURN    ${uuid}

Remover Event And Choice
    [Documentation]    The choice-event owning the option that REMOVES a member, and that
    ...                option's uuid: a story choice keeps its uuid inside a match too.
    [Arguments]    ${key}
    ${effects}=    Admin Rows    choice-effects
    ${choices}=    Admin Rows    choices
    ${events}=     Admin Rows    events
    ${found}=    Evaluate
    ...    next(((uuids[by_id[cid(e)]['idEvent']], by_id[cid(e)]['uuid']) for e in $effects if e.get('key') == '${key}' and e.get('valueToRemove') and cid(e) in by_id), None)
    ...    namespace=${{ {'by_id': {c['id']: c for c in $choices}, 'uuids': {e['id']: e['uuid'] for e in $events}, 'cid': lambda r: r['idChoices'] if r.get('idChoices') is not None else r.get('idChoice')} }}
    Should Not Be Equal    ${found}    ${None}
    ...    msg=no seeded option removes a member of ${key} — the Step 36.1 seed is missing
    RETURN    ${found}[0]    ${found}[1]
