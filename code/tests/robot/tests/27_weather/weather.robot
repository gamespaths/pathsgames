*** Settings ***
# ---------------------------------------------------------------------------
# weather.robot — Step 27 weather system (random selection & effects).
#
# At every time-start (match start and each clock advance) the backend selects
# one active weather rule for the story with a deterministic weighted roll
# (weight = probability), filtered by the current clock time range and an
# optional registry condition. The chosen weather is stored on the match, logged
# in log_weather and its delta_energy is applied to every character.
#
# Determinism: matches are created with rngSeed=42 so the selection is
# reproducible. The suite asserts the endpoint contract, determinism and the
# admin weather view. Backend-agnostic.
#
# Tags: weather, step27
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource

Suite Setup    Suite Setup Weather


*** Test Cases ***

Weather Endpoint Is 404 Before The Match Starts
    [Documentation]    A CREATED match has no weather selected yet → 404.
    [Tags]    weather    step27
    ${match}=    New Weather Match
    ${response}=    Get Match Weather    ${TOKEN}    ${match}    404
    Should Be Equal As Strings    ${response.json()}[error]    WEATHER_NOT_FOUND

Weather Is Selected When The Match Starts
    [Documentation]    Starting the match selects a weather; the endpoint then returns it
    ...                with the contract fields.
    [Tags]    weather    step27
    ${match}=    New Weather Match
    Start Match    ${TOKEN}    ${match}    200
    ${response}=    Get Match Weather    ${TOKEN}    ${match}    200
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    idWeather
    Dictionary Should Contain Key    ${body}    uuid
    Dictionary Should Contain Key    ${body}    deltaEnergy
    Dictionary Should Contain Key    ${body}    currentClock
    Should Not Be Equal    ${body}[idWeather]    ${None}
    # Step 27 — the active weather carries its idCard and a resolved card.
    Dictionary Should Contain Key    ${body}    idCard
    Dictionary Should Contain Key    ${body}    card
    Should Not Be Equal    ${body}[idCard]    ${None}
    Should Not Be Equal    ${body}[card]    ${None}
    Dictionary Should Contain Key    ${body}[card]    awesomeIcon

Weather Selection Is Deterministic For The Same Seed
    [Documentation]    Two matches created with rngSeed=42 select the same weather at start.
    [Tags]    weather    step27
    ${match1}=    New Weather Match
    Start Match    ${TOKEN}    ${match1}    200
    ${w1}=    Get Match Weather    ${TOKEN}    ${match1}    200
    ${match2}=    New Weather Match
    Start Match    ${TOKEN}    ${match2}    200
    ${w2}=    Get Match Weather    ${TOKEN}    ${match2}    200
    Should Be Equal    ${w1.json()}[idWeather]    ${w2.json()}[idWeather]

Weather Persists After A Time End
    [Documentation]    After a sleep-triggered time-end the match still exposes a weather.
    [Tags]    weather    step27
    ${match}=    New Weather Match
    Start Match    ${TOKEN}    ${match}    200
    Sleep Action    ${TOKEN}    ${match}    200
    ${response}=    Get Match Weather    ${TOKEN}    ${match}    200
    Should Not Be Equal    ${response.json()}[idWeather]    ${None}

Admin Weather View Exposes Rng Seed Current And Log
    [Documentation]    The admin endpoint returns the per-match rngSeed, the current weather
    ...                and the log_weather history (one entry after start).
    [Tags]    weather    step27
    ${match}=    New Weather Match
    Start Match    ${TOKEN}    ${match}    200
    ${response}=    Get Admin Match Weather    ${ADMIN_TOKEN}    ${match}    200
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Integers    ${body}[rngSeed]    42
    Dictionary Should Contain Key    ${body}    current
    Should Not Be Equal    ${body}[current]    ${None}
    Should Not Be Empty    ${body}[log]
    Dictionary Should Contain Key    ${body}[log][0]    clock
    # Step 27 — the admin view lists every weather rule, one flagged current.
    Dictionary Should Contain Key    ${body}    rules
    Should Not Be Empty    ${body}[rules]
    Dictionary Should Contain Key    ${body}[rules][0]    probability
    ${current_count}=    Evaluate    sum(1 for r in $body['rules'] if r.get('current'))
    Should Be Equal As Integers    ${current_count}    1

Admin Weather View Requires A Match Uuid
    [Documentation]    Blank uuid is rejected with 400 INVALID_INPUT.
    [Tags]    weather    step27
    ${response}=    Get Admin Match Weather    ${ADMIN_TOKEN}    %20    400
    Should Be Equal As Strings    ${response.json()}[error]    INVALID_INPUT


*** Keywords ***

Suite Setup Weather
    [Documentation]    Guest + admin sessions, then resolve a joinable loadout.
    Create Public Session
    Create Admin Session
    ${response}=    POST On Session    public_session    /api/auth/guest
    Status Should Be    ${response}    201
    Set Suite Variable    ${TOKEN}    ${response.json()}[accessToken]
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}        ${story}
    Set Suite Variable    ${DIFFICULTY_UUID}   ${difficulty}
    Set Suite Variable    ${CHARACTER_UUID}    ${character}
    Set Suite Variable    ${CLASS_UUID}        ${class}
    Set Suite Variable    ${TRAIT_UUID}        ${trait}

New Weather Match
    [Documentation]    Creates a CREATED match with rngSeed=42 and joins one character.
    ${match}=    Create Match With Rng Seed    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}    42
    Status Should Be    ${match}    201
    ${match_uuid}=    Set Variable    ${match.json()}[uuid]
    ${trait_list}=    Create List
    IF    '${TRAIT_UUID}' != ''
        Append To List    ${trait_list}    ${TRAIT_UUID}
    END
    ${join}=    Join Match    ${TOKEN}    ${match_uuid}    ${CHARACTER_UUID}    ${CLASS_UUID}    ${trait_list}
    Status Should Be    ${join}    201
    RETURN    ${match_uuid}
