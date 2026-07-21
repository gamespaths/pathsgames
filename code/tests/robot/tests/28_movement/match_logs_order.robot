*** Settings ***
# ---------------------------------------------------------------------------
# match_logs_order.robot — v0.30.3 ?order=asc|desc on the match logs API.
#
# Endpoints under test:
#   GET /api/matches/{uuidMatch}/logs?order=asc|desc
#   GET /api/admin/matches/{uuid}/logs?order=asc|desc   (admin port)
#
# Contract under test:
#   - no order given  → asc, oldest entry first (unchanged, backwards compatible)
#   - order=desc      → newest entry first, the whole timeline reversed
#   - the response echoes the effective `order`
#   - unknown values (and any casing) fall back to asc
#   - the timeline is reversed BEFORE the page is cut, so with desc the cursor
#     walks towards the older entries and never repeats an entry
#
# Each test builds its own match (start → weather, sleep → sleep/clock entries)
# so the timeline has at least two entries to order.
#
# Backend-agnostic: asserts relative ordering and the envelope, never exact
# counts, so it runs against Java / Python / AWS interchangeably.
#
# Tags: match-logs, match-logs-order, step28-7
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource

Suite Setup    Suite Setup Logs Order


*** Test Cases ***

Logs Default To The Oldest Entry First
    [Documentation]    v0.30.3 — no ?order= keeps the historical behaviour: the
    ...                timestamps grow from the first entry to the last, and the
    ...                response echoes order=asc.
    [Tags]    match-logs    match-logs-order    step28-7
    ${match}=    New Ordered Logs Match
    ${response}=    Get Match Logs    ${TOKEN}    ${match}    200
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Strings    ${body}[order]    asc
    Timestamps Should Be Ascending    ${body}[logs]

Order Desc Starts From The Most Recent Entry
    [Documentation]    v0.30.3 — ?order=desc reverses the timeline: the timestamps
    ...                shrink from the first entry to the last.
    [Tags]    match-logs    match-logs-order    step28-7
    ${match}=    New Ordered Logs Match
    ${response}=    Get Match Logs    ${TOKEN}    ${match}    200    order=desc
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Strings    ${body}[order]    desc
    Timestamps Should Be Descending    ${body}[logs]

Desc Is Exactly The Reverse Of Asc
    [Documentation]    v0.30.3 — same match, same page size: the desc page is the
    ...                asc timeline read backwards, entry by entry. Guards against a
    ...                backend that only reverses one of the log sources.
    [Tags]    match-logs    match-logs-order    step28-7
    ${match}=    New Ordered Logs Match
    ${asc}=     Get Match Logs    ${TOKEN}    ${match}    200    order=asc
    ${desc}=    Get Match Logs    ${TOKEN}    ${match}    200    order=desc
    ${asc_logs}=     Set Variable    ${asc.json()}[logs]
    ${desc_logs}=    Set Variable    ${desc.json()}[logs]
    Length Should Be    ${desc_logs}    ${asc.json()}[total]
    Should Be Equal As Integers    ${asc.json()}[total]    ${desc.json()}[total]
    ${reversed}=    Evaluate    list(reversed($asc_logs))
    Lists Should Be Equal    ${desc_logs}    ${reversed}

Unknown Order Value Falls Back To Ascending
    [Documentation]    v0.30.3 — a junk ?order= is not an error: the server answers
    ...                200 with the default ascending timeline.
    [Tags]    match-logs    match-logs-order    step28-7
    ${match}=    New Ordered Logs Match
    ${response}=    Get Match Logs    ${TOKEN}    ${match}    200    order=sideways
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Strings    ${body}[order]    asc
    Timestamps Should Be Ascending    ${body}[logs]

Order Value Is Case Insensitive
    [Documentation]    v0.30.3 — DESC is accepted just like desc.
    [Tags]    match-logs    match-logs-order    step28-7
    ${match}=    New Ordered Logs Match
    ${response}=    Get Match Logs    ${TOKEN}    ${match}    200    order=DESC
    Should Be Equal As Strings    ${response.json()}[order]    desc
    Timestamps Should Be Descending    ${response.json()}[logs]

Desc Cursor Walks Towards The Older Entries
    [Documentation]    v0.30.3 — the timeline is reversed before the page is cut, so
    ...                page 2 of a desc read is older than page 1 and never repeats it.
    [Tags]    match-logs    match-logs-order    step28-7
    ${match}=    New Ordered Logs Match
    ${page1}=    Get Match Logs    ${TOKEN}    ${match}    200    limit=1    order=desc
    Should Not Be Equal    ${page1.json()}[nextCursor]    ${None}
    ${cursor}=    Set Variable    ${page1.json()}[nextCursor]
    ${page2}=    Get Match Logs    ${TOKEN}    ${match}    200    limit=1    cursor=${cursor}    order=desc
    ${newest}=    Set Variable    ${page1.json()}[logs][0]
    ${older}=     Set Variable    ${page2.json()}[logs][0]
    Should Not Be Equal    ${newest}[timestamp]    ${older}[timestamp]
    Should Be True    '${older}[timestamp]' <= '${newest}[timestamp]'

Desc First Page Holds The Newest Entry Of The Whole Timeline
    [Documentation]    v0.30.3 — with ?limit=1&order=desc the single returned entry is
    ...                the last one of the ascending timeline, not the first.
    [Tags]    match-logs    match-logs-order    step28-7
    ${match}=    New Ordered Logs Match
    ${asc}=    Get Match Logs    ${TOKEN}    ${match}    200
    ${asc_logs}=    Set Variable    ${asc.json()}[logs]
    ${last_index}=    Evaluate    len($asc_logs) - 1
    ${newest}=    Set Variable    ${asc_logs}[${last_index}]
    ${desc}=    Get Match Logs    ${TOKEN}    ${match}    200    limit=1    order=desc
    Length Should Be    ${desc.json()}[logs]    1
    Should Be Equal As Strings    ${desc.json()}[logs][0][timestamp]    ${newest}[timestamp]
    Should Be Equal As Strings    ${desc.json()}[logs][0][type]    ${newest}[type]

Admin Logs Honour The Order Too
    [Documentation]    v0.30.3 — the admin endpoint (port 8044) exposes the same
    ...                parameter with the same default.
    [Tags]    match-logs    match-logs-order    step28-7
    ${match}=    New Ordered Logs Match
    ${asc}=     Get Admin Match Logs    ${ADMIN_TOKEN}    ${match}    200
    ${desc}=    Get Admin Match Logs    ${ADMIN_TOKEN}    ${match}    200    order=desc
    Should Be Equal As Strings    ${asc.json()}[order]     asc
    Should Be Equal As Strings    ${desc.json()}[order]    desc
    Timestamps Should Be Ascending     ${asc.json()}[logs]
    Timestamps Should Be Descending    ${desc.json()}[logs]


*** Keywords ***

Suite Setup Logs Order
    [Documentation]    Guest + admin sessions and story loadout for the ordering suite.
    Create Public Session
    Create Admin Session
    ${response}=    POST On Session    public_session    /api/auth/guest
    Status Should Be    ${response}    201
    Set Suite Variable    ${TOKEN}    ${response.json()}[accessToken]
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}       ${story}
    Set Suite Variable    ${DIFFICULTY_UUID}  ${difficulty}
    Set Suite Variable    ${CHARACTER_UUID}   ${character}
    Set Suite Variable    ${CLASS_UUID}       ${class}
    Set Suite Variable    ${TRAIT_UUID}       ${trait}

New Ordered Logs Match
    [Documentation]    A started match with a slept character: the timeline holds at
    ...                least a WEATHER and a SLEEP entry, so it has an order to assert.
    ${match}=    Create Match With Rng Seed    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}    42
    Status Should Be    ${match}    201
    ${match_uuid}=    Set Variable    ${match.json()}[uuid]
    ${trait_list}=    Create List
    IF    '${TRAIT_UUID}' != ''
        Append To List    ${trait_list}    ${TRAIT_UUID}
    END
    ${join}=    Join Match    ${TOKEN}    ${match_uuid}    ${CHARACTER_UUID}    ${CLASS_UUID}    ${trait_list}
    Status Should Be    ${join}    201
    Start Match     ${TOKEN}    ${match_uuid}    200
    Sleep Action    ${TOKEN}    ${match_uuid}    200
    ${logs}=    Get Match Logs    ${TOKEN}    ${match_uuid}    200
    Should Be True    ${logs.json()}[total] >= 2    The ordering assertions need at least two entries
    RETURN    ${match_uuid}

Timestamps Should Be Ascending
    [Documentation]    Every entry's ISO timestamp is >= the previous one.
    ...                ISO-8601 timestamps are lexicographically comparable.
    [Arguments]    ${logs}
    Should Not Be Empty    ${logs}
    ${sorted}=    Evaluate    sorted([e.get('timestamp') or '' for e in $logs])
    ${actual}=    Evaluate    [e.get('timestamp') or '' for e in $logs]
    Lists Should Be Equal    ${actual}    ${sorted}    Logs are not sorted oldest-first

Timestamps Should Be Descending
    [Documentation]    Every entry's ISO timestamp is <= the previous one.
    [Arguments]    ${logs}
    Should Not Be Empty    ${logs}
    ${sorted}=    Evaluate    sorted([e.get('timestamp') or '' for e in $logs], reverse=True)
    ${actual}=    Evaluate    [e.get('timestamp') or '' for e in $logs]
    Lists Should Be Equal    ${actual}    ${sorted}    Logs are not sorted newest-first
