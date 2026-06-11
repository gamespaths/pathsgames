*** Settings ***
# ---------------------------------------------------------------------------
# trait_selection.robot — Step 23 character stats initialization.
#
# Endpoints under test:
#   GET  /api/stories/{uuidStory}/classes/{uuidClass}/traits → 200 | 404
#   POST /api/matches/{uuidMatch}/join                       → 201 | 400
#
# Step 23 hardens the trait selection at character creation: every trait uuid
# must exist (TRAIT_NOT_FOUND), no duplicates (TRAIT_DUPLICATED), traits must
# be compatible with the selected class (TRAIT_NOT_COMPATIBLE) and the summed
# positive/negative costs must respect the difficulty budgets
# (TRAIT_COST_EXCEEDED). A null budget means "no limit".
#
# All data is resolved at runtime from the public story detail (seeded uuids
# are auto-generated). Scenarios that the running backend's seed cannot
# express (e.g. no class-restricted traits) are skipped, keeping the suite
# backend-agnostic across java-sqlite, java-postgres, python, php and aws.
#
# Tags: characters, traits, step23
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Library    ../../resources/Step23Helper.py
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource

Suite Setup    Suite Setup Trait Selection


*** Test Cases ***

Trait Listing Returns Only Class Compatible Traits
    [Documentation]    GET /api/stories/{s}/classes/{c}/traits returns exactly the traits
    ...                whose idClassPermitted/idClassProhibited allow the class.
    [Tags]    traits    step23
    ${response}=    Get Traits For Class    ${STORY_UUID}    ${CLASS_UUID}
    Status Should Be    ${response}    200
    ${returned}=    Evaluate    [t['uuid'] for t in $response.json()]
    ${expected}=    Filtered Trait Uuids    ${DETAIL}    ${CLASS_UUID}
    Lists Should Be Equal    ${returned}    ${expected}

Trait Listing Unknown Class Returns 404
    [Documentation]    An unknown class uuid yields 404 CLASS_NOT_FOUND.
    [Tags]    traits    step23
    ${response}=    Get Traits For Class    ${STORY_UUID}    no-such-class    expected_status=404
    Should Be Equal As Strings    ${response.json()}[error]    CLASS_NOT_FOUND

Trait Listing Unknown Story Returns 404
    [Documentation]    An unknown story uuid yields 404 STORY_NOT_FOUND.
    [Tags]    traits    step23
    ${response}=    Get Traits For Class    no-such-story    ${CLASS_UUID}    expected_status=404
    Should Be Equal As Strings    ${response.json()}[error]    STORY_NOT_FOUND

Join With Valid Trait Applies Its Stat Deltas
    [Documentation]    Joining with traits[0] produces a character whose stats differ from a
    ...                no-trait character by exactly the trait's stat deltas; life and energy
    ...                start at their computed maximum (positive values).
    [Tags]    traits    step23
    IF    '${TRAIT_UUID}' == ''    Pass Execution    Seed has no traits — scenario skipped
    ${baseline}=    Join Fresh Match With Traits    ${EMPTY_LIST}
    ${trait_list}=    Create List    ${TRAIT_UUID}
    ${with_trait}=    Join Fresh Match With Traits    ${trait_list}
    ${deltas}=    Trait Stat Deltas    ${DETAIL}    ${TRAIT_UUID}
    Should Be Equal As Integers    ${with_trait}[life]            ${${baseline}[life] + ${deltas}[life]}
    Should Be Equal As Integers    ${with_trait}[energy]          ${${baseline}[energy] + ${deltas}[energy]}
    Should Be Equal As Integers    ${with_trait}[dexterity]       ${${baseline}[dexterity] + ${deltas}[dexterity]}
    Should Be Equal As Integers    ${with_trait}[intelligence]    ${${baseline}[intelligence] + ${deltas}[intelligence]}
    Should Be Equal As Integers    ${with_trait}[constitution]    ${${baseline}[constitution] + ${deltas}[constitution]}
    Should Be True    ${with_trait}[life] > 0
    Should Be True    ${with_trait}[energy] > 0
    Dictionary Should Contain Key    ${with_trait}    idLocation

Join With Unknown Trait Returns 400 TRAIT_NOT_FOUND
    [Documentation]    Unknown trait uuids are rejected (Step 21 silently ignored them).
    [Tags]    traits    step23
    ${match_uuid}=    Create Fresh Match
    ${trait_list}=    Create List    no-such-trait
    ${response}=    Join Match    ${TOKEN}    ${match_uuid}
    ...    ${CHARACTER_UUID}    ${CLASS_UUID}    ${trait_list}    expected_status=400
    Should Be Equal As Strings    ${response.json()}[error]    TRAIT_NOT_FOUND

Join With Duplicated Trait Returns 400 TRAIT_DUPLICATED
    [Documentation]    The same trait uuid twice in the selection is rejected.
    [Tags]    traits    step23
    IF    '${TRAIT_UUID}' == ''    Pass Execution    Seed has no traits — scenario skipped
    ${match_uuid}=    Create Fresh Match
    ${trait_list}=    Create List    ${TRAIT_UUID}    ${TRAIT_UUID}
    ${response}=    Join Match    ${TOKEN}    ${match_uuid}
    ...    ${CHARACTER_UUID}    ${CLASS_UUID}    ${trait_list}    expected_status=400
    Should Be Equal As Strings    ${response.json()}[error]    TRAIT_DUPLICATED

Join With Incompatible Trait Returns 400 TRAIT_NOT_COMPATIBLE
    [Documentation]    A trait restricted to (or prohibited for) another class is rejected.
    [Tags]    traits    step23
    ${bad_trait}=    Find Incompatible Trait    ${DETAIL}    ${CLASS_UUID}
    IF    '${bad_trait}' == ''
        Pass Execution    Seed has no class-restricted trait — scenario skipped
    END
    ${match_uuid}=    Create Fresh Match
    ${trait_list}=    Create List    ${bad_trait}
    ${response}=    Join Match    ${TOKEN}    ${match_uuid}
    ...    ${CHARACTER_UUID}    ${CLASS_UUID}    ${trait_list}    expected_status=400
    Should Be Equal As Strings    ${response.json()}[error]    TRAIT_NOT_COMPATIBLE

Join Exceeding Positive Budget Returns 400 TRAIT_COST_EXCEEDED
    [Documentation]    A selection whose summed costPositive exceeds the difficulty's
    ...                traitCostPositiveBudget is rejected.
    [Tags]    traits    step23
    ${class_uuid}    ${trait_list}=    Find Positive Budget Overflow    ${DETAIL}
    IF    '${class_uuid}' == ''
        Pass Execution    Seed cannot exceed the positive budget — scenario skipped
    END
    ${match_uuid}=    Create Fresh Match
    ${response}=    Join Match    ${TOKEN}    ${match_uuid}
    ...    ${CHARACTER_UUID}    ${class_uuid}    ${trait_list}    expected_status=400
    Should Be Equal As Strings    ${response.json()}[error]    TRAIT_COST_EXCEEDED

Join Exceeding Negative Budget Returns 400 TRAIT_COST_EXCEEDED
    [Documentation]    A selection whose summed costNegative exceeds the difficulty's
    ...                traitCostNegativeBudget is rejected.
    [Tags]    traits    step23
    ${class_uuid}    ${trait_list}=    Find Negative Budget Overflow    ${DETAIL}
    IF    '${class_uuid}' == ''
        Pass Execution    Seed cannot exceed the negative budget — scenario skipped
    END
    ${match_uuid}=    Create Fresh Match
    ${response}=    Join Match    ${TOKEN}    ${match_uuid}
    ...    ${CHARACTER_UUID}    ${class_uuid}    ${trait_list}    expected_status=400
    Should Be Equal As Strings    ${response.json()}[error]    TRAIT_COST_EXCEEDED

Create Match With Invalid Loadout Trait Returns 400
    [Documentation]    The creator loadout is validated at match creation too:
    ...                an unknown trait uuid fails with 400 TRAIT_NOT_FOUND.
    [Tags]    traits    step23
    ${trait_list}=    Create List    no-such-trait
    ${response}=    Create Match With Loadout    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}
    ...    ${CHARACTER_UUID}    ${CLASS_UUID}    ${trait_list}    ${1}    expected_status=400
    Should Be Equal As Strings    ${response.json()}[error]    TRAIT_NOT_FOUND


*** Keywords ***

Suite Setup Trait Selection
    [Documentation]    Guest login + resolve loadout and the full story detail.
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
    ${detail_response}=    GET On Session    public_session    /api/stories/${story}
    Status Should Be    ${detail_response}    200
    Set Suite Variable    ${DETAIL}    ${detail_response.json()}
    ${empty}=    Create List
    Set Suite Variable    ${EMPTY_LIST}    ${empty}

Create Fresh Match
    [Documentation]    Creates a new single-player match (no loadout traits) and
    ...                returns its uuid.
    ${match}=    Create Match    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}    robottest_step23
    Status Should Be    ${match}    201
    RETURN    ${match.json()}[uuid]

Join Fresh Match With Traits
    [Documentation]    Creates a match with a fresh guest and joins it with the
    ...                shared template/class and the given traits; returns the
    ...                created character JSON.
    [Arguments]    ${trait_uuids}
    ${guest}=    POST On Session    public_session    /api/auth/guest
    Status Should Be    ${guest}    201
    ${token}=    Set Variable    ${guest.json()}[accessToken]
    ${match}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY_UUID}    robottest_step23
    Status Should Be    ${match}    201
    ${response}=    Join Match    ${token}    ${match.json()}[uuid]
    ...    ${CHARACTER_UUID}    ${CLASS_UUID}    ${trait_uuids}    expected_status=201
    RETURN    ${response.json()}
