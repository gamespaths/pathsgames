*** Settings ***
# alpha_prep_common.resource — v0.41.1 fixture of the 41_alpha_prep story suites (logging_gaps, snapshots, kpi):
# story_alpha_prep.json, imported in Suite Setup and deleted with its matches in Suite Teardown.
Library    RequestsLibrary
Library    Collections
Library    OperatingSystem
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource


*** Variables ***
${STORY_FILE}    ${CURDIR}/story_alpha_prep.json
${STORY_UUID}    f0410001-0000-4000-8000-000000000410
@{CREATED_MATCHES}


*** Keywords ***

Suite Setup Alpha Prep
    [Documentation]    Import the fixture (after removing a leftover copy) and resolve the
    ...                loadout, the events, the trait and the locations the cases address.
    ...                Locations: 1 Camp (start, safe) <-> 2 Road (unsafe). Events: 10 Find a charm
    ...                (+trait 1), 11 Lose the charm (-trait 1), 12 Poisoned well (life -99),
    ...                13 Old gate (ONCE, exp +1), 14 Take the quest (quest=done opens mission 1,
    ...                whose reward 15 gives +1 magic), 16 A long day (ends the time, +1 coin),
    ...                17 Grief (sad +99), 18 A fork (v0.41.2: choice 1, food +1), 40 The end (END),
    ...                20 Find a lantern (v0.41.6: adds item 1 Lantern; item 2 Rope is never given).
    ...                Weather 1 Clear (100%).
    Create Admin Session
    Create Public Session
    Run Keyword And Ignore Error    Delete Admin Story    ${STORY_UUID}
    ${import}=    Import Story From File    ${STORY_FILE}
    Should Be Equal As Integers    ${import.status_code}    201
    ...    msg=the alpha prep story did not import: ${import.text}
    ${difficulty}=    First Prep Uuid    difficulties
    ${template}=      First Prep Uuid    character-templates
    ${class}=         First Prep Uuid    classes
    ${trait}=         First Prep Uuid    traits
    Set Suite Variable    ${DIFFICULTY}    ${difficulty}
    Set Suite Variable    ${CHARACTER}     ${template}
    Set Suite Variable    ${CLASS}         ${class}
    Set Suite Variable    ${TRAIT}         ${trait}
    ${events}=       Prep Rows    events
    ${locations}=    Prep Rows    locations
    Set Suite Variable    ${EVENTS}       ${events}
    Set Suite Variable    ${LOCATIONS}    ${locations}

Suite Teardown Alpha Prep
    [Documentation]    Every match first — a story with live matches cannot go — then the story.
    FOR    ${match}    IN    @{CREATED_MATCHES}
        Run Keyword And Ignore Error    Admin Stop Match      ${ADMIN_TOKEN}    ${match}
        Run Keyword And Ignore Error    Admin Delete Match    ${ADMIN_TOKEN}    ${match}
    END
    Run Keyword And Ignore Error    Delete Admin Story    ${STORY_UUID}

Prep Rows
    [Documentation]    {story-local id: uuid} for one entity type of the fixture.
    [Arguments]    ${entity_type}
    ${resp}=    List Admin Entities    ${STORY_UUID}    ${entity_type}
    Status Should Be    ${resp}    200
    ${rows}=    Evaluate    {str(r['id']): r['uuid'] for r in $resp.json() if r.get('id') is not None and r.get('uuid')}
    Should Not Be Empty    ${rows}    msg=the fixture has no ${entity_type} rows
    RETURN    ${rows}

First Prep Uuid
    [Documentation]    The uuid of the fixture's only row of one entity type.
    [Arguments]    ${entity_type}
    ${resp}=    List Admin Entities    ${STORY_UUID}    ${entity_type}
    Status Should Be    ${resp}    200
    Should Not Be Empty    ${resp.json()}    msg=the fixture has no ${entity_type} rows
    RETURN    ${resp.json()}[0][uuid]

Created Prep Match
    [Documentation]    A CREATED single-player match seeded with 42, on its own guest, one
    ...                character joined, remembered for the teardown. Not started.
    ${token}=    New Guest Token
    ${match}=    Create Match With Rng Seed    ${token}    ${STORY_UUID}    ${DIFFICULTY}
    ...    rng_seed=42    name=robottest_alpha_prep
    Status Should Be    ${match}    201
    ${uuid}=    Set Variable    ${match.json()}[uuid]
    Append To List    ${CREATED_MATCHES}    ${uuid}
    ${no_traits}=    Create List
    ${join}=    Join Match    ${token}    ${uuid}    ${CHARACTER}    ${CLASS}    ${no_traits}
    Status Should Be    ${join}    201
    RETURN    ${token}    ${uuid}

Fresh Prep Match
    [Documentation]    The same match, started: RUNNING at clock 0 in the Camp.
    ${token}    ${uuid}=    Created Prep Match
    Start Match    ${token}    ${uuid}    200
    RETURN    ${token}    ${uuid}

Run Prep Event
    [Documentation]    Execute one fixture event by story-local id and insist it ran.
    [Arguments]    ${token}    ${match}    ${id}
    ${resp}=    Execute Event    ${token}    ${match}    ${EVENTS}[${id}]    200
    RETURN    ${resp}

The Prep Player
    [Documentation]    The uuid of the match's only character, off /info players[].
    [Arguments]    ${token}    ${match}
    ${info}=    Get Match Info    ${token}    ${match}    200
    Should Not Be Empty    ${info.json()}[players]
    RETURN    ${info.json()}[players][0][uuid]

Timeline
    [Documentation]    The whole admin timeline, oldest first (one page of 200 is enough here).
    [Arguments]    ${match}
    ${logs}=    Get Admin Match Logs    ${ADMIN_TOKEN}    ${match}    200    limit=200    order=asc
    RETURN    ${logs.json()}

Rows Of Type
    [Documentation]    The admin timeline entries of one type, oldest first.
    [Arguments]    ${match}    ${type}
    ${body}=    Timeline    ${match}
    ${rows}=    Evaluate    [e for e in $body['logs'] if e.get('type') == $type]
    RETURN    ${rows}

Messages Of Type
    [Documentation]    The `message` of every entry of one type, oldest first.
    [Arguments]    ${match}    ${type}
    ${rows}=    Rows Of Type    ${match}    ${type}
    ${messages}=    Evaluate    [e.get('message') for e in $rows]
    RETURN    ${messages}
