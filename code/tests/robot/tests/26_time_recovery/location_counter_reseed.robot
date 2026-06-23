*** Settings ***
# ---------------------------------------------------------------------------
# location_counter_reseed.robot — Step 26: location counter behaviour and the
# re-seeding fix (bug: counter stayed at 0 when counter_time was added to a
# location AFTER the match was already created).
#
# Scenarios covered:
#
#  1. Normal seeding: match created AFTER counter_time is set on the location →
#     gaming_state_locations.clock_counter pre-seeded correctly at match creation,
#     then decremented by one on each time-end (sleep).
#
#  2. Re-seeding fix: match created BEFORE counter_time is set on the location →
#     the backend re-seeds the counter to the definition value the first time the
#     character sleeps while standing at that location.
#
#  3. No re-seed after counter reaches zero: a location whose counter hit 0 and
#     whose flag_already_actived was set to 1 must NOT be re-seeded, even though
#     the story definition still carries counter_time > 0.
#
# The location under test is the one the joined character actually occupies — read
# from match-info (currentLocationUuid = story location entity UUID for admin PUT;
# currentLocationId = integer id matched against the match-state locations[]). This
# keeps the suite backend-agnostic and independent of which seed story is chosen.
#
# Admin operations (update location counterTime) are issued on admin_session; the
# original counterTime is restored in teardown.
#
# Tags: time-recovery, step26, counter-reseed
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource

Suite Setup       Suite Setup Counter Reseed
Suite Teardown    Restore Start Location Counter    ${ORIGINAL_COUNTER_TIME}


*** Variables ***
# Populated by Suite Setup from the chosen public story.
${TOKEN}              ${EMPTY}
${STORY_UUID}         ${EMPTY}
${DIFFICULTY_UUID}    ${EMPTY}
${CHARACTER_UUID}     ${EMPTY}
${CLASS_UUID}         ${EMPTY}
${TRAIT_UUID}         ${EMPTY}
# The location the character occupies on join:
#   START_LOC_UUID — story location entity UUID, used for admin PUT.
#   START_LOC_ID   — integer id, matched against idLocation in the match state.
${START_LOC_UUID}           ${EMPTY}
${START_LOC_ID}             ${NONE}
${ORIGINAL_COUNTER_TIME}    ${0}


*** Test Cases ***

Normal Seeding Counter Decrements On Sleep
    [Documentation]    With a positive counter_time on the occupied location at match
    ...                creation time, the match state is pre-seeded with that clockCounter
    ...                and it decrements by one on each time-end (single-player sleep).
    [Tags]    time-recovery    step26    counter-reseed
    Admin Update Location Counter Time    ${START_LOC_UUID}    ${3}
    ${match}=    New Match With Character
    Start Match    ${TOKEN}    ${match}    200
    ${info_before}=    Get Match Info    ${TOKEN}    ${match}
    ${counter_before}=    Get Occupied Location Counter    ${info_before.json()}[locations]
    Should Be Equal As Integers    ${counter_before}    ${3}
    ...    msg=Counter must be pre-seeded to 3 at match creation
    Sleep Action    ${TOKEN}    ${match}    200
    ${info_after}=    Get Match Info    ${TOKEN}    ${match}
    ${counter_after}=    Get Occupied Location Counter    ${info_after.json()}[locations]
    Should Be Equal As Integers    ${counter_after}    ${2}
    ...    msg=Counter must decrement by exactly 1 after one time-end

Counter Reseeds When Set After Match Creation
    [Documentation]    Reproduces the bug: when counter_time is 0 at match creation
    ...                (clock_counter pre-seeded to 0) and counter_time is later raised
    ...                to a positive value, the first sleep while the character occupies
    ...                that location must re-seed the counter to the definition value and
    ...                then decrement it.
    ...
    ...                With reseed_value = 3:
    ...                  match created  → clockCounter = 0  (bug: stays 0 forever)
    ...                  location → counterTime = 3
    ...                  sleep          → clockCounter = 2  (fix: re-seed 3, then -1)
    [Tags]    time-recovery    step26    counter-reseed
    # 1. counterTime = 0 so the match is created with clockCounter = 0.
    Admin Update Location Counter Time    ${START_LOC_UUID}    ${0}
    ${match}=    New Match With Character
    ${info_zero}=    Get Match Info    ${TOKEN}    ${match}
    ${counter_zero}=    Get Occupied Location Counter    ${info_zero.json()}[locations]
    Should Be Equal As Integers    ${counter_zero}    ${0}
    ...    msg=clockCounter must be 0 when the match was created with counterTime=0
    # 2. Raise counterTime to 3 AFTER the match already exists.
    Admin Update Location Counter Time    ${START_LOC_UUID}    ${3}
    # 3. Start and sleep → re-seed to 3, then decrement to 2.
    Start Match    ${TOKEN}    ${match}    200
    ${sleep_resp}=    Sleep Action    ${TOKEN}    ${match}    200
    Should Be Equal As Strings    ${sleep_resp.json()}[timeEndTriggered]    ${True}
    ${info_after}=    Get Match Info    ${TOKEN}    ${match}
    ${counter_after}=    Get Occupied Location Counter    ${info_after.json()}[locations]
    Should Be Equal As Integers    ${counter_after}    ${2}
    ...    msg=Counter must be re-seeded to 3 then decremented to 2

Counter Does Not Reseed After Reaching Zero
    [Documentation]    Once a counter has legitimately reached 0 (flag_already_actived=1),
    ...                the backend must NOT re-seed it on subsequent sleeps even when the
    ...                story definition still carries counter_time > 0. With counter_time=1,
    ...                the first sleep takes it to 0; a second sleep must leave it at 0.
    [Tags]    time-recovery    step26    counter-reseed
    Admin Update Location Counter Time    ${START_LOC_UUID}    ${1}
    ${match}=    New Match With Character
    Start Match    ${TOKEN}    ${match}    200
    # First sleep: 1 → 0, flag_already_actived set to 1.
    Sleep Action    ${TOKEN}    ${match}    200
    ${info1}=    Get Match Info    ${TOKEN}    ${match}
    ${counter1}=    Get Occupied Location Counter    ${info1.json()}[locations]
    Should Be Equal As Integers    ${counter1}    ${0}
    # Second sleep: must stay at 0 (no re-seed).
    Sleep Action    ${TOKEN}    ${match}    200
    ${info2}=    Get Match Info    ${TOKEN}    ${match}
    ${counter2}=    Get Occupied Location Counter    ${info2.json()}[locations]
    Should Be Equal As Integers    ${counter2}    ${0}
    ...    msg=Counter must stay at 0 after reaching zero — no re-seed allowed


*** Keywords ***

Suite Setup Counter Reseed
    [Documentation]    Guest + admin sessions; resolve a joinable loadout; then run a probe
    ...                match to discover the location the character occupies (its story UUID,
    ...                integer id and current counterTime, saved for teardown restore).
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
    # Probe match: join a character and read where it stands from match-info.
    ${probe}=    New Match With Character
    ${info}=    Get Match Info    ${TOKEN}    ${probe}
    Status Should Be    ${info}    200
    ${loc_uuid}=    Set Variable    ${info.json()}[currentLocationUuid]
    ${loc_id}=      Set Variable    ${info.json()}[currentLocationId]
    Should Not Be Equal    ${loc_uuid}    ${None}    msg=match-info must expose currentLocationUuid
    Should Not Be Equal    ${loc_id}      ${None}    msg=match-info must expose currentLocationId
    Set Suite Variable    ${START_LOC_UUID}    ${loc_uuid}
    Set Suite Variable    ${START_LOC_ID}      ${loc_id}
    # Record the location's current counterTime to restore it in teardown.
    ${orig}=    Get Location Counter Time    ${loc_uuid}
    Set Suite Variable    ${ORIGINAL_COUNTER_TIME}    ${orig}

New Match With Character
    [Documentation]    Creates a CREATED match and joins one character; returns the match UUID.
    ${match}=    Create Match    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}    robottest_reseed
    Status Should Be    ${match}    201
    ${match_uuid}=    Set Variable    ${match.json()}[uuid]
    ${trait_list}=    Create List
    IF    '${TRAIT_UUID}' != ''
        Append To List    ${trait_list}    ${TRAIT_UUID}
    END
    ${join}=    Join Match    ${TOKEN}    ${match_uuid}    ${CHARACTER_UUID}    ${CLASS_UUID}    ${trait_list}
    Status Should Be    ${join}    201
    RETURN    ${match_uuid}

Get Location Counter Time
    [Documentation]    GET /api/admin/stories/{uuid}/locations/{loc_uuid} → the location's
    ...                counterTime (0 if null). All backends expose the unified "counterTime" field.
    [Arguments]    ${loc_uuid}
    ${resp}=    GET On Session    admin_session
    ...    /api/admin/stories/${STORY_UUID}/locations/${loc_uuid}
    Status Should Be    ${resp}    200
    ${ct}=    Get From Dictionary    ${resp.json()}    counterTime    ${0}
    IF    $ct is None
        ${ct}=    Set Variable    ${0}
    END
    RETURN    ${ct}

Admin Update Location Counter Time
    [Documentation]    PUT /api/admin/stories/{uuid}/locations/{loc_uuid} setting counterTime —
    ...                the unified counter field used by all backends (Java/Python/AWS).
    [Arguments]    ${loc_uuid}    ${counter_time}
    &{body}=    Create Dictionary    counterTime=${counter_time}
    ${resp}=    PUT On Session    admin_session
    ...    /api/admin/stories/${STORY_UUID}/locations/${loc_uuid}
    ...    json=${body}
    Status Should Be    ${resp}    200

Restore Start Location Counter
    [Documentation]    Restores the occupied location's counterTime to its original value.
    ...                Used as suite teardown; no-op when the location was never resolved.
    [Arguments]    ${original_counter}
    IF    '${START_LOC_UUID}' != ''
        Admin Update Location Counter Time    ${START_LOC_UUID}    ${original_counter}
    END

Get Occupied Location Counter
    [Documentation]    Returns the clockCounter of the match-state location matching
    ...                START_LOC_ID (the integer idLocation the character occupies).
    [Arguments]    ${locations}
    FOR    ${loc}    IN    @{locations}
        ${loc_id}=    Get From Dictionary    ${loc}    idLocation    ${NONE}
        ${is_match}=    Run Keyword And Return Status
        ...    Should Be Equal As Integers    ${loc_id}    ${START_LOC_ID}
        IF    ${is_match}
            ${counter}=    Get From Dictionary    ${loc}    clockCounter    ${0}
            IF    $counter is None
                ${counter}=    Set Variable    ${0}
            END
            RETURN    ${counter}
        END
    END
    Fail    No match-state location with idLocation=${START_LOC_ID} found
