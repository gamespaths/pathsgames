*** Settings ***
# ---------------------------------------------------------------------------
# difficulty_stat_fields.robot — tests for v0.19.7 difficulty stat columns.
#
# Validates that GET /api/stories/{uuid} returns the seven new stat fields
# (life, energy, sad, dexterity, intelligence, constitution, weight) on every
# DifficultyResponse entry of the demo stories.
#
# Tags: stories, difficulty, step19, v0_19_7
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/stories.resource

Suite Setup    Create Public Session


*** Test Cases ***

Tutorial Story Difficulties Expose Stat Fields
    [Documentation]    Every difficulty entry of DEMO_1 has the seven stat fields and they are integers.
    [Tags]    stories    difficulty    v0_19_7
    ${response}=    Get Story By UUID    ${DEMO_1_UUID}
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    ${difficulties}=    Get From Dictionary    ${body}    difficulties
    Should Not Be Empty    ${difficulties}
    FOR    ${diff}    IN    @{difficulties}
        Difficulty Should Have Stat Fields    ${diff}
    END

DEMO_2 Story Difficulties Expose Stat Fields
    [Documentation]    Every difficulty entry of DEMO_2 has the seven stat fields and they are integers.
    [Tags]    stories    difficulty    v0_19_7
    ${response}=    Get Story By UUID    ${DEMO_2_UUID}
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    ${difficulties}=    Get From Dictionary    ${body}    difficulties
    Should Not Be Empty    ${difficulties}
    FOR    ${diff}    IN    @{difficulties}
        Difficulty Should Have Stat Fields    ${diff}
    END

Tutorial First Difficulty Has Expected Stat Values
    [Documentation]    First difficulty of DEMO_1 should match seed values (life=120, energy=110, sad=0, dexterity=12, ...).
    [Tags]    stories    difficulty    v0_19_7
    ${response}=    Get Story By UUID    ${DEMO_1_UUID}
    ${body}=    Set Variable    ${response.json()}
    ${difficulties}=    Get From Dictionary    ${body}    difficulties
    ${diff}=    Get From List    ${difficulties}    0
    Should Be Equal As Integers    ${diff}[life]            120
    Should Be Equal As Integers    ${diff}[energy]          110
    Should Be Equal As Integers    ${diff}[sad]               0
    Should Be Equal As Integers    ${diff}[dexterity]        12
    Should Be Equal As Integers    ${diff}[intelligence]     12
    Should Be Equal As Integers    ${diff}[constitution]     12
    Should Be Equal As Integers    ${diff}[weight]           12

Difficulty Stat Values Are Non Negative
    [Documentation]    Stat fields life/energy/dexterity/intelligence/constitution/weight should be > 0; sad >= 0.
    [Tags]    stories    difficulty    v0_19_7
    ${response}=    Get Story By UUID    ${DEMO_2_UUID}
    ${body}=    Set Variable    ${response.json()}
    ${difficulties}=    Get From Dictionary    ${body}    difficulties
    FOR    ${diff}    IN    @{difficulties}
        Should Be True    $diff['life'] > 0
        Should Be True    $diff['energy'] > 0
        Should Be True    $diff['sad'] >= 0
        Should Be True    $diff['dexterity'] > 0
        Should Be True    $diff['intelligence'] > 0
        Should Be True    $diff['constitution'] > 0
        Should Be True    $diff['weight'] > 0
    END


*** Keywords ***

Difficulty Should Have Stat Fields
    [Documentation]    Asserts that a difficulty dict has the seven v0.19.7 stat fields as integers.
    [Arguments]    ${diff}
    Dictionary Should Contain Key    ${diff}    life
    Dictionary Should Contain Key    ${diff}    energy
    Dictionary Should Contain Key    ${diff}    sad
    Dictionary Should Contain Key    ${diff}    dexterity
    Dictionary Should Contain Key    ${diff}    intelligence
    Dictionary Should Contain Key    ${diff}    constitution
    Dictionary Should Contain Key    ${diff}    weight
    Should Be True    isinstance($diff['life'], int)
    Should Be True    isinstance($diff['energy'], int)
    Should Be True    isinstance($diff['sad'], int)
    Should Be True    isinstance($diff['dexterity'], int)
    Should Be True    isinstance($diff['intelligence'], int)
    Should Be True    isinstance($diff['constitution'], int)
    Should Be True    isinstance($diff['weight'], int)
