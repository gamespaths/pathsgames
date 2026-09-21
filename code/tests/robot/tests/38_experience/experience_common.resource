*** Settings ***
# ---------------------------------------------------------------------------
# experience_common.resource — the fixture and the match every 38_experience suite runs on.
#
# The suites SHIP THEIR OWN STORY — story_experience.json, next to this file — so no seed
# changes: it is imported in Suite Setup and deleted in Suite Teardown, with every match it
# created stopped and deleted first. Entities are addressed by their story-local `id`
# through the admin CRUD lists, never by uuid (uuids are generated per import).
#
#   loadout    one template (DEX/INT/COS start at 2), one class (bases 0), one difficulty
#              (expCost 1, expCostBase 0, maxStatValue 4 → the first DEX point costs 2,
#              the next 3, and a stat stops at 4)
#   locations  1 the Hall (secureParam 1, start) — 2 the Wilds (secureParam 0), one edge
#   events     10 small lesson (+1 exp), 11 great lesson (+50 exp), 18 opens the quests,
#              12/13/14 close quest A/B/C (qa/qb/qc=done); 15/16/17 are the rewards a
#              completed mission fires (+1 exp each) and belong to no location;
#              19 is the reward of the Nimble quest (+1 exp), v0.38.3
#   missions   A/B/C: available on quests=open, one step each on qa/qb/qc=done
#              v0.38.3 — First lesson: completed on use-exp=1 (no steps, no reward);
#              Nimble: available on use-exp=1, one step on use-exp-DEX=4, reward 19
#   keys       quests/qa/qb/qc (QUESTS); v0.38.3 use-exp, use-exp-DEX (EXPERIENCE) — the
#              keys use-exp writes; use-exp-INT / use-exp-COS are NOT declared on purpose
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Library    OperatingSystem
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource


*** Variables ***
${STORY_FILE}    ${CURDIR}/story_experience.json
${STORY_UUID}    f0380001-0000-4000-8000-000000000380
@{CREATED_MATCHES}


*** Keywords ***

Suite Setup Experience
    [Documentation]    Import the fixture (after removing a leftover copy) and resolve every
    ...                entity the cases address: story-local id → uuid, per entity type.
    Create Admin Session
    Create Public Session
    Run Keyword And Ignore Error    Delete Admin Story    ${STORY_UUID}
    ${import}=    Import Story From File    ${STORY_FILE}
    Should Be Equal As Integers    ${import.status_code}    201
    ...    msg=the experience story did not import: ${import.text}

    ${difficulty}=    First Admin Uuid    difficulties
    ${template}=      First Admin Uuid    character-templates
    ${class}=         First Admin Uuid    classes
    Set Suite Variable    ${DIFFICULTY}    ${difficulty}
    Set Suite Variable    ${CHARACTER}     ${template}
    Set Suite Variable    ${CLASS}         ${class}

    ${events}=       Admin Rows    events
    ${locations}=    Admin Rows    locations
    Set Suite Variable    ${EVENTS}       ${events}
    Set Suite Variable    ${LOCATIONS}    ${locations}

Suite Teardown Experience
    [Documentation]    Every match first — a story with live matches cannot go — then the story.
    FOR    ${match}    IN    @{CREATED_MATCHES}
        Run Keyword And Ignore Error    Admin Stop Match      ${ADMIN_TOKEN}    ${match}
        Run Keyword And Ignore Error    Admin Delete Match    ${ADMIN_TOKEN}    ${match}
    END
    Run Keyword And Ignore Error    Delete Admin Story    ${STORY_UUID}

Admin Rows
    [Documentation]    {story-local id: uuid} for one entity type of the fixture, from the
    ...                admin CRUD list. Ids are integers in the JSON and may come back as
    ...                strings from a document backend, so both are normalised.
    [Arguments]    ${entity_type}
    ${resp}=    List Admin Entities    ${STORY_UUID}    ${entity_type}
    Status Should Be    ${resp}    200
    ${rows}=    Evaluate    {str(r['id']): r['uuid'] for r in $resp.json() if r.get('id') is not None and r.get('uuid')}
    Should Not Be Empty    ${rows}    msg=the fixture has no ${entity_type} rows
    RETURN    ${rows}

First Admin Uuid
    [Documentation]    The uuid of the fixture's only row of one entity type, taken by position
    ...                (character-templates echoes no story-local id).
    [Arguments]    ${entity_type}
    ${resp}=    List Admin Entities    ${STORY_UUID}    ${entity_type}
    Status Should Be    ${resp}    200
    Should Not Be Empty    ${resp.json()}    msg=the fixture has no ${entity_type} rows
    RETURN    ${resp.json()}[0][uuid]

Fresh Experience Match
    [Documentation]    A running single-player match on its own guest, remembered for the
    ...                teardown. Fresh per case: experience and stats latch.
    ${token}=    New Guest Token
    ${match}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY}    robottest_experience
    Status Should Be    ${match}    201
    ${uuid}=    Set Variable    ${match.json()}[uuid]
    Append To List    ${CREATED_MATCHES}    ${uuid}
    ${no_traits}=    Create List
    ${join}=    Join Match    ${token}    ${uuid}    ${CHARACTER}    ${CLASS}    ${no_traits}
    Status Should Be    ${join}    201
    Start Match    ${token}    ${uuid}    200
    RETURN    ${token}    ${uuid}

Run Event
    [Documentation]    Execute one fixture event by story-local id and insist it ran.
    [Arguments]    ${token}    ${match}    ${id}
    ${resp}=    Execute Event    ${token}    ${match}    ${EVENTS}[${id}]    200
    RETURN    ${resp}

The Player
    [Documentation]    The caller's own row of /info players[] — the one that carries its userUuid.
    [Arguments]    ${token}    ${match}
    ${info}=    Get Match Info    ${token}    ${match}    200
    ${players}=    Set Variable    ${info.json()}[players]
    Should Not Be Empty    ${players}
    FOR    ${p}    IN    @{players}
        IF    $p.get('userUuid')    RETURN    ${p}
    END
    RETURN    ${players}[0]

Give Exp
    [Documentation]    Set the caller's experience through the admin override (Step 38 lets
    ...                the console write it), so a refusal is reached without playing towards it.
    [Arguments]    ${token}    ${match}    ${exp}
    ${player}=    The Player    ${token}    ${match}
    ${resp}=    Admin Change Statistics    ${ADMIN_TOKEN}    ${match}    ${player}[uuid]    200    exp=${exp}
    ${after}=    The Player    ${token}    ${match}
    Should Be Equal As Integers    ${after}[exp]    ${exp}
    ...    msg=the admin override did not write exp (${after}[exp] instead of ${exp})

Rows Of Type
    [Documentation]    The timeline entries of one type, oldest first.
    [Arguments]    ${token}    ${match}    ${type}
    ${logs}=    Get Match Logs    ${token}    ${match}    200
    ${rows}=    Evaluate    [e for e in $logs.json()['logs'] if e.get('type') == $type]
    RETURN    ${rows}

Registry Values Of
    [Documentation]    v0.38.3 — the SET one key holds right now, or None when the registry
    ...                carries no entry for it (a key the story never declared, never written).
    [Arguments]    ${token}    ${match}    ${key}
    ${response}=    Get Registry    ${token}    ${match}    200    include_hidden=true
    FOR    ${group}    IN    @{response.json()}[groups]
        FOR    ${entry}    IN    @{group}[entries]
            IF    $entry['key'] == $key    RETURN    ${entry}[values]
        END
    END
    RETURN    ${None}

Mission Named
    [Documentation]    v0.38.3 — the /missions row of one mission by name, or None when the
    ...                match has not reached it yet.
    [Arguments]    ${token}    ${match}    ${name}
    ${missions}=    Get Missions    ${token}    ${match}    200
    FOR    ${m}    IN    @{missions.json()}[missions]
        IF    $m['name'] == $name    RETURN    ${m}
    END
    RETURN    ${None}

