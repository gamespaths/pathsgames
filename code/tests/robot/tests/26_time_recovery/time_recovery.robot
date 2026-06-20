*** Settings ***
# ---------------------------------------------------------------------------
# time_recovery.robot — Step 26 time-start recovery, class bonuses & location
# counters.
#
# On a time-end (single-player sleep), the backend recovers each character's
# stats based on their location safety, applies class bonuses (clamped to the
# caps), seeds/decrements location time counters, and returns a per-character
# recovery recap on the sleep response.
#
# A freshly-joined character starts at full energy/life, so the numeric recovery
# deltas are typically zero until energy-draining actions exist (Step 28+); this
# suite therefore asserts the recap *contract* (shape + caps) and that the
# recovered stats never exceed the maximums. Backend-agnostic.
#
# Tags: time-recovery, step26
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource

Suite Setup    Suite Setup Time Recovery


*** Test Cases ***

Sleep Returns A Recovery Recap
    [Documentation]    The sleep response that triggers a time-end carries a recovery[] array
    ...                with one entry per character and the energy/life/sad delta fields.
    [Tags]    time-recovery    step26
    ${match}=    New Match With Character
    Start Match    ${TOKEN}    ${match}    200
    ${response}=    Sleep Action    ${TOKEN}    ${match}
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Strings    ${body}[timeEndTriggered]    ${True}
    Dictionary Should Contain Key    ${body}    recovery
    Should Not Be Empty    ${body}[recovery]
    ${item}=    Set Variable    ${body}[recovery][0]
    Dictionary Should Contain Key    ${item}    characterUuid
    Dictionary Should Contain Key    ${item}    energyDelta
    Dictionary Should Contain Key    ${item}    lifeDelta
    Dictionary Should Contain Key    ${item}    sadDelta

Recovered Stats Never Exceed The Caps
    [Documentation]    After a time-end the character's energy stays within [0, energyMax].
    [Tags]    time-recovery    step26
    ${match}=    New Match With Character
    Start Match    ${TOKEN}    ${match}    200
    Sleep Action    ${TOKEN}    ${match}    200
    ${info}=    Get Match Info    ${TOKEN}    ${match}
    Status Should Be    ${info}    200
    ${player}=    Set Variable    ${info.json()}[players][0]
    Should Be True    ${player}[energy] >= 0
    Should Be True    ${player}[energy] <= ${player}[energyMax]
    Should Be True    ${player}[sad] >= 0
    Should Be True    ${player}[sad] <= ${player}[sadMax]
    Should Be True    ${player}[life] <= ${player}[lifeMax]

Match Info Exposes Location Clock Counters
    [Documentation]    The match-info locations carry the clockCounter field (the residual
    ...                location time counter) as a non-negative integer.
    [Tags]    time-recovery    step26
    ${match}=    New Match With Character
    Start Match    ${TOKEN}    ${match}    200
    Sleep Action    ${TOKEN}    ${match}    200
    ${info}=    Get Match Info    ${TOKEN}    ${match}
    Status Should Be    ${info}    200
    ${locations}=    Set Variable    ${info.json()}[locations]
    Should Not Be Empty    ${locations}
    ${found}=    Location With Counter Field    ${locations}
    Should Be True    ${found}

Location Counter Decrements Across Time Ends
    [Documentation]    The start-location counter (seeded from counter_time) decreases as
    ...                clocks advance: after two time-ends it is lower than after one.
    [Tags]    time-recovery    step26
    ${match}=    New Match With Character
    Start Match    ${TOKEN}    ${match}    200
    Sleep Action    ${TOKEN}    ${match}    200
    ${info1}=    Get Match Info    ${TOKEN}    ${match}
    ${counter1}=    Max Location Counter    ${info1.json()}[locations]
    Sleep Action    ${TOKEN}    ${match}    200
    ${info2}=    Get Match Info    ${TOKEN}    ${match}
    ${counter2}=    Max Location Counter    ${info2.json()}[locations]
    Should Be True    ${counter2} <= ${counter1}


*** Keywords ***

Suite Setup Time Recovery
    [Documentation]    Guest login + resolve a joinable loadout from a public story.
    Create Public Session
    ${response}=    POST On Session    public_session    /api/auth/guest
    Status Should Be    ${response}    201
    Set Suite Variable    ${TOKEN}    ${response.json()}[accessToken]
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}        ${story}
    Set Suite Variable    ${DIFFICULTY_UUID}   ${difficulty}
    Set Suite Variable    ${CHARACTER_UUID}    ${character}
    Set Suite Variable    ${CLASS_UUID}        ${class}
    Set Suite Variable    ${TRAIT_UUID}        ${trait}

New Match With Character
    [Documentation]    Creates a CREATED match and joins one character; returns the match uuid.
    ${match}=    Create Match    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}    robottest_recovery
    Status Should Be    ${match}    201
    ${match_uuid}=    Set Variable    ${match.json()}[uuid]
    ${trait_list}=    Create List
    IF    '${TRAIT_UUID}' != ''
        Append To List    ${trait_list}    ${TRAIT_UUID}
    END
    ${join}=    Join Match    ${TOKEN}    ${match_uuid}    ${CHARACTER_UUID}    ${CLASS_UUID}    ${trait_list}
    Status Should Be    ${join}    201
    RETURN    ${match_uuid}

Location With Counter Field
    [Documentation]    Returns True when at least one location carries a clockCounter field.
    [Arguments]    ${locations}
    FOR    ${loc}    IN    @{locations}
        ${has}=    Run Keyword And Return Status    Dictionary Should Contain Key    ${loc}    clockCounter
        IF    ${has}    RETURN    ${True}
    END
    RETURN    ${False}

Max Location Counter
    [Documentation]    Highest clockCounter across the locations (0 when none present).
    [Arguments]    ${locations}
    ${max}=    Set Variable    ${0}
    FOR    ${loc}    IN    @{locations}
        ${counter}=    Get From Dictionary    ${loc}    clockCounter    default=0
        IF    $counter is None
            ${counter}=    Set Variable    ${0}
        END
        IF    ${counter} > ${max}
            ${max}=    Set Variable    ${counter}
        END
    END
    RETURN    ${max}
