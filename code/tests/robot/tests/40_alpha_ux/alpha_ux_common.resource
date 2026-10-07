*** Settings ***
# ---------------------------------------------------------------------------
# alpha_ux_common.resource — the fixture and the match every 40_alpha_ux suite runs on.
#
# The suites SHIP THEIR OWN STORY — story_alpha_ux.json, next to this file — imported in Suite
# Setup and deleted in Suite Teardown with every match it created. Scenarios are switched
# through the admin registry (Set Scenario), so exactly one weather rule is ever eligible.
#
#   locations  1 Camp (start, counter 1 → event 20)   2 Tower (first arrival 21 ends the time,
#              start-time 25)   3 Swamp (start-time 22, life -99)
#   weather    1 Sun on scenario=sun   2 Rain on scenario=rain (both 100%)
#   random     23 Coin rain (+1 coin, party) on scenario=random
#   events     20 Dawn supplies (+1 food, sets Rain)   30 Rest by the fire (FREE, ends the
#              time, +1 coin)   31 Crossroads → option 1 runs 33 (ends the time)
#              32 Merchant → option 2 (+2 food +1 coin) / option 3 (exp only)
#              34 Broken gate (ONCE) → option 4   35 A quiet walk (exp)
#              36 Take the quest (quest=done → mission reward 24, +1 magic)   37 lantern
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Library    OperatingSystem
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource


*** Variables ***
${STORY_FILE}    ${CURDIR}/story_alpha_ux.json
${STORY_UUID}    f0400001-0000-4000-8000-000000000400
@{CREATED_MATCHES}


*** Keywords ***

Suite Setup Alpha Ux
    [Documentation]    Import the fixture (after removing a leftover copy) and resolve the
    ...                loadout, the events, the options and the locations the cases address.
    Create Admin Session
    Create Public Session
    Run Keyword And Ignore Error    Delete Admin Story    ${STORY_UUID}
    ${import}=    Import Story From File    ${STORY_FILE}
    Should Be Equal As Integers    ${import.status_code}    201
    ...    msg=the alpha ux story did not import: ${import.text}
    ${difficulty}=    First Admin Uuid    difficulties
    ${template}=      First Admin Uuid    character-templates
    ${class}=         First Admin Uuid    classes
    Set Suite Variable    ${DIFFICULTY}    ${difficulty}
    Set Suite Variable    ${CHARACTER}     ${template}
    Set Suite Variable    ${CLASS}         ${class}
    ${events}=    Admin Rows    events
    ${choices}=   Admin Rows    choices
    ${locations}=    Admin Rows    locations
    Set Suite Variable    ${EVENTS}       ${events}
    Set Suite Variable    ${CHOICES}      ${choices}
    Set Suite Variable    ${LOCATIONS}    ${locations}

Suite Teardown Alpha Ux
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

Fresh Alpha Match
    [Documentation]    A running single-player match seeded with 42, on its own guest,
    ...                remembered for the teardown, with the given scenario already written.
    [Arguments]    ${scenario}=sun
    ${token}=    New Guest Token
    ${match}=    Create Match With Rng Seed    ${token}    ${STORY_UUID}    ${DIFFICULTY}
    ...    rng_seed=42    name=robottest_alpha_ux
    Status Should Be    ${match}    201
    ${uuid}=    Set Variable    ${match.json()}[uuid]
    Append To List    ${CREATED_MATCHES}    ${uuid}
    ${no_traits}=    Create List
    ${join}=    Join Match    ${token}    ${uuid}    ${CHARACTER}    ${CLASS}    ${no_traits}
    Status Should Be    ${join}    201
    Start Match    ${token}    ${uuid}    200
    Set Scenario    ${uuid}    ${scenario}
    RETURN    ${token}    ${uuid}

Set Scenario
    [Documentation]    Write the scenario key through the admin console.
    [Arguments]    ${match}    ${value}
    Admin Upsert Registry    ${ADMIN_TOKEN}    ${match}    scenario    ${value}    200

Run Event
    [Documentation]    Execute one fixture event by story-local id and insist it ran.
    [Arguments]    ${token}    ${match}    ${id}
    ${resp}=    Execute Event    ${token}    ${match}    ${EVENTS}[${id}]    200
    RETURN    ${resp}

Pick Option
    [Documentation]    Open a choice-event, then resolve one of its options, by story-local ids.
    [Arguments]    ${token}    ${match}    ${event_id}    ${choice_id}
    ${open}=    Run Event    ${token}    ${match}    ${event_id}
    Should Be Equal    ${open.json()}[status]    CHOICES_PENDING
    ${resp}=    Select Choice    ${token}    ${match}    ${CHOICES}[${choice_id}]    200
    RETURN    ${resp}

Forced Time End By
    [Documentation]    End the time early through one of the three doors and return the answer:
    ...                event (30), choice (31 → option 1 → 33) or movement (to the Tower).
    [Arguments]    ${token}    ${match}    ${door}
    IF    '${door}' == 'event'
        ${resp}=    Run Event    ${token}    ${match}    30
    ELSE IF    '${door}' == 'choice'
        ${resp}=    Pick Option    ${token}    ${match}    31    1
    ELSE
        ${resp}=    Start Movement    ${token}    ${match}    ${LOCATIONS}[2]    200
    END
    Should Be True    ${resp.json()}[timeEnded]    msg=the ${door} did not end the time
    RETURN    ${resp}

Triggers Of
    [Documentation]    The (trigger, eventUuid) pairs of an answer's counterZero[].
    [Arguments]    ${resp}
    ${pairs}=    Evaluate    [(c.get('trigger'), c.get('eventUuid')) for c in $resp.json().get('counterZero') or []]
    RETURN    ${pairs}

Rows Of Type
    [Documentation]    The timeline entries of one type, oldest first.
    [Arguments]    ${token}    ${match}    ${type}
    ${logs}=    Get Match Logs    ${token}    ${match}    200    limit=200
    ${rows}=    Evaluate    [e for e in $logs.json()['logs'] if e.get('type') == $type]
    RETURN    ${rows}

Event Rows Of
    [Documentation]    The EVENT timeline rows of one fixture event, by story-local id.
    [Arguments]    ${token}    ${match}    ${id}
    ${rows}=    Rows Of Type    ${token}    ${match}    EVENT
    ${mine}=    Evaluate    [r for r in $rows if int(r.get('idEvent') or 0) == int($id)]
    RETURN    ${mine}

Gains Of
    [Documentation]    The four *Gain values of a timeline row, as a dict.
    [Arguments]    ${row}
    ${gains}=    Evaluate    {k: int($row.get(k) or 0) for k in ('energyGain', 'foodGain', 'magicGain', 'coinGain')}
    RETURN    ${gains}
