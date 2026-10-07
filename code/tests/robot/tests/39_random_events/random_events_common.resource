*** Settings ***
# ---------------------------------------------------------------------------
# random_events_common.resource — the fixture and the match every 39_random_events suite
# runs on.
#
# The suites SHIP THEIR OWN STORY — story_random_events.json, next to this file — imported
# in Suite Setup and deleted in Suite Teardown with every match it created. Scenarios are
# switched through the admin registry (Admin Upsert Registry), so AT MOST ONE row is ever
# eligible: Java and Python/AWS roll different generators on the same seed, and a suite that
# ran two eligible rows could not say which one fires on all backends.
#
#   events     20 wolves (+1 exp, ALL) — 21 never (+50) — 22 comet, type ONCE (+10) —
#              23 river (+100); all AUTOMATIC except 22, none owns choices or weather
#   random     1 → 20 at 100% on scenario=always     2 → 21 at 0% (never eligible)
#              3 → 22 at 100% on scenario=once       4 → 23 at 100% on level > 2
#   keys       scenario, level (ROBOT)
# The probabilities sum to 300: the story validates with ONE R11 warning (scaled %).
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Library    OperatingSystem
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource


*** Variables ***
${STORY_FILE}    ${CURDIR}/story_random_events.json
${STORY_UUID}    f0390001-0000-4000-8000-000000000390
@{CREATED_MATCHES}


*** Keywords ***

Suite Setup Random Events
    [Documentation]    Import the fixture (after removing a leftover copy) and resolve the
    ...                loadout and the events the cases address.
    Create Admin Session
    Create Public Session
    Run Keyword And Ignore Error    Delete Admin Story    ${STORY_UUID}
    ${import}=    Import Story From File    ${STORY_FILE}
    Should Be Equal As Integers    ${import.status_code}    201
    ...    msg=the random events story did not import: ${import.text}
    ${difficulty}=    First Admin Uuid    difficulties
    ${template}=      First Admin Uuid    character-templates
    ${class}=         First Admin Uuid    classes
    Set Suite Variable    ${DIFFICULTY}    ${difficulty}
    Set Suite Variable    ${CHARACTER}     ${template}
    Set Suite Variable    ${CLASS}         ${class}
    ${events}=    Admin Rows    events
    Set Suite Variable    ${EVENTS}    ${events}

Suite Teardown Random Events
    [Documentation]    Every match first — a story with live matches cannot go — then the story.
    FOR    ${match}    IN    @{CREATED_MATCHES}
        Run Keyword And Ignore Error    Admin Stop Match      ${ADMIN_TOKEN}    ${match}
        Run Keyword And Ignore Error    Admin Delete Match    ${ADMIN_TOKEN}    ${match}
    END
    Run Keyword And Ignore Error    Delete Admin Story    ${STORY_UUID}

Admin Rows
    [Documentation]    {story-local id: uuid} for one entity type of the fixture.
    [Arguments]    ${entity_type}
    ${resp}=    List Admin Entities    ${STORY_UUID}    ${entity_type}
    Status Should Be    ${resp}    200
    ${rows}=    Evaluate    {str(r['id']): r['uuid'] for r in $resp.json() if r.get('id') is not None and r.get('uuid')}
    Should Not Be Empty    ${rows}    msg=the fixture has no ${entity_type} rows
    RETURN    ${rows}

First Admin Uuid
    [Documentation]    The uuid of the fixture's only row of one entity type, by position.
    [Arguments]    ${entity_type}
    ${resp}=    List Admin Entities    ${STORY_UUID}    ${entity_type}
    Status Should Be    ${resp}    200
    Should Not Be Empty    ${resp.json()}    msg=the fixture has no ${entity_type} rows
    RETURN    ${resp.json()}[0][uuid]

Fresh Random Match
    [Documentation]    A running single-player match seeded with 42, on its own guest,
    ...                remembered for the teardown.
    ${token}=    New Guest Token
    ${match}=    Create Match With Rng Seed    ${token}    ${STORY_UUID}    ${DIFFICULTY}
    ...    rng_seed=42    name=robottest_random_events
    Status Should Be    ${match}    201
    ${uuid}=    Set Variable    ${match.json()}[uuid]
    Append To List    ${CREATED_MATCHES}    ${uuid}
    ${no_traits}=    Create List
    ${join}=    Join Match    ${token}    ${uuid}    ${CHARACTER}    ${CLASS}    ${no_traits}
    Status Should Be    ${join}    201
    Start Match    ${token}    ${uuid}    200
    RETURN    ${token}    ${uuid}

Set Scenario
    [Documentation]    Write one registry key through the admin console.
    [Arguments]    ${match}    ${key}    ${value}
    Admin Upsert Registry    ${ADMIN_TOKEN}    ${match}    ${key}    ${value}    200

Sleep And Get Random Events
    [Documentation]    Sleep (single-player: the time ends) and return the RANDOM_EVENT
    ...                entries of the answer's counterZero[].
    [Arguments]    ${token}    ${match}
    ${resp}=    Sleep Action    ${token}    ${match}    200
    Should Be True    ${resp.json()}[timeEndTriggered]    msg=the sleep did not end the time
    ${random}=    Evaluate    [c for c in $resp.json().get('counterZero') or [] if c.get('trigger') == 'RANDOM_EVENT']
    RETURN    ${random}

Rows Of Type
    [Documentation]    The timeline entries of one type, oldest first.
    [Arguments]    ${token}    ${match}    ${type}
    ${logs}=    Get Match Logs    ${token}    ${match}    200    limit=200
    ${rows}=    Evaluate    [e for e in $logs.json()['logs'] if e.get('type') == $type]
    RETURN    ${rows}

The Player Exp
    [Documentation]    The caller's experience, off its own /info players[] row.
    [Arguments]    ${token}    ${match}
    ${info}=    Get Match Info    ${token}    ${match}    200
    ${players}=    Set Variable    ${info.json()}[players]
    FOR    ${p}    IN    @{players}
        IF    $p.get('userUuid')    RETURN    ${p}[exp]
    END
    RETURN    ${players}[0][exp]
