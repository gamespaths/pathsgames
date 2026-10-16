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
# (TRAIT_COST_EXCEEDED). A null budget means "no limit". v0.35.2 adds a fifth:
# a trait flagged `hideOnStartMatch` is refused outright (TRAIT_NOT_SELECTABLE),
# while the API keeps returning it — an event or an item may grant it at any time.
#
# All data is resolved at runtime from the public story detail (seeded uuids
# are auto-generated). Scenarios that the running backend's seed cannot
# express (e.g. no class-restricted traits) are skipped, keeping the suite
# backend-agnostic across java-sqlite, java-postgres, python and aws.
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

Join With Empty Trait List Succeeds
    [Documentation]    The no-trait base case: joining with an empty trait list creates a
    ...                character with positive life and energy.
    [Tags]    traits    step23
    ${character}=    Join Fresh Match With Traits    ${EMPTY_LIST}
    Should Be True    ${character}[life] > 0
    Should Be True    ${character}[energy] > 0

Join With Blank Trait Uuid Is Ignored
    [Documentation]    A blank/empty trait uuid is silently filtered out (§6.2): the join
    ...                succeeds and the stats equal the no-trait baseline.
    [Tags]    traits    step23
    ${baseline}=    Join Fresh Match With Traits    ${EMPTY_LIST}
    ${blank_list}=    Create List    ${EMPTY}
    ${character}=    Join Fresh Match With Traits    ${blank_list}
    Should Be Equal As Integers    ${character}[life]            ${baseline}[life]
    Should Be Equal As Integers    ${character}[energy]          ${baseline}[energy]
    Should Be Equal As Integers    ${character}[dexterity]       ${baseline}[dexterity]
    Should Be Equal As Integers    ${character}[intelligence]    ${baseline}[intelligence]
    Should Be Equal As Integers    ${character}[constitution]    ${baseline}[constitution]

Join With Null Budget Ignores Cost Limit
    [Documentation]    A difficulty with NULL budgets imposes no cost limit: joining with
    ...                every compatible trait still succeeds (201).
    [Tags]    traits    step23
    ${diff_uuid}=    Find Null Budget Difficulty    ${DETAIL}
    IF    '${diff_uuid}' == ''
        Pass Execution    Seed has no NULL-budget difficulty — scenario skipped
    END
    # v0.35.2 — PICKABLE, not merely class-compatible: the endpoint keeps returning the
    # traits the story hides from the start-match page, and joining with one is refused.
    ${compatible}=    Pickable Trait Uuids    ${DETAIL}    ${CLASS_UUID}
    IF    not ${compatible}    Pass Execution    Seed has no selectable trait — scenario skipped
    ${character}=    Join Fresh Match With Difficulty And Traits    ${diff_uuid}    ${CLASS_UUID}    ${compatible}
    Should Be True    ${character}[life] > 0

Join With Permitted Match Trait Succeeds
    [Documentation]    A trait whose idClassPermitted equals the selected class is accepted.
    [Tags]    traits    step23
    ${trait}=    Find Permitted Match Trait    ${DETAIL}    ${CLASS_UUID}
    IF    '${trait}' == ''
        Pass Execution    Seed has no permitted-match trait for this class — scenario skipped
    END
    ${trait_list}=    Create List    ${trait}
    ${diff_uuid}=    Find Null Budget Difficulty    ${DETAIL}
    ${diff_uuid}=    Set Variable If    '${diff_uuid}' == ''    ${DIFFICULTY_UUID}    ${diff_uuid}
    ${character}=    Join Fresh Match With Difficulty And Traits    ${diff_uuid}    ${CLASS_UUID}    ${trait_list}
    Dictionary Should Contain Key    ${character}    idLocation

Join With Prohibited Other Class Trait Succeeds
    [Documentation]    A trait prohibited for a different class does not block the selected
    ...                class — the join succeeds.
    [Tags]    traits    step23
    ${trait}=    Find Prohibited Other Trait    ${DETAIL}    ${CLASS_UUID}
    IF    '${trait}' == ''
        Pass Execution    Seed has no prohibited-other-class trait — scenario skipped
    END
    ${trait_list}=    Create List    ${trait}
    ${diff_uuid}=    Find Null Budget Difficulty    ${DETAIL}
    ${diff_uuid}=    Set Variable If    '${diff_uuid}' == ''    ${DIFFICULTY_UUID}    ${diff_uuid}
    ${character}=    Join Fresh Match With Difficulty And Traits    ${diff_uuid}    ${CLASS_UUID}    ${trait_list}
    Dictionary Should Contain Key    ${character}    idLocation

Join With Two Valid Traits Sums Deltas
    [Documentation]    Two compatible traits apply the sum of their stat deltas. Uses a
    ...                NULL-budget difficulty so cost limits never interfere.
    [Tags]    traits    step23
    ${diff_uuid}=    Find Null Budget Difficulty    ${DETAIL}
    IF    '${diff_uuid}' == ''
        Pass Execution    Seed has no NULL-budget difficulty — scenario skipped
    END
    ${two}=    Find Two Compatible Traits    ${DETAIL}    ${CLASS_UUID}
    ${len}=    Get Length    ${two}
    IF    ${len} < 2    Pass Execution    Seed has fewer than two compatible traits — scenario skipped
    ${baseline}=    Join Fresh Match With Difficulty And Traits    ${diff_uuid}    ${CLASS_UUID}    ${EMPTY_LIST}
    ${with_traits}=    Join Fresh Match With Difficulty And Traits    ${diff_uuid}    ${CLASS_UUID}    ${two}
    ${deltas}=    Sum Trait Stat Deltas    ${DETAIL}    ${two}
    Should Be Equal As Integers    ${with_traits}[life]            ${${baseline}[life] + ${deltas}[life]}
    Should Be Equal As Integers    ${with_traits}[energy]          ${${baseline}[energy] + ${deltas}[energy]}
    Should Be Equal As Integers    ${with_traits}[dexterity]       ${${baseline}[dexterity] + ${deltas}[dexterity]}
    Should Be Equal As Integers    ${with_traits}[intelligence]    ${${baseline}[intelligence] + ${deltas}[intelligence]}
    Should Be Equal As Integers    ${with_traits}[constitution]    ${${baseline}[constitution] + ${deltas}[constitution]}

Story Detail Exposes Trait Budget Fields
    [Documentation]    Every difficulty in the story detail carries the two new budget
    ...                fields (value may be null = unlimited).
    [Tags]    traits    step23
    ${difficulties}=    Set Variable    ${DETAIL}[difficulties]
    Should Not Be Empty    ${difficulties}
    FOR    ${difficulty}    IN    @{difficulties}
        Dictionary Should Contain Key    ${difficulty}    traitCostPositiveBudget
        Dictionary Should Contain Key    ${difficulty}    traitCostNegativeBudget
    END

Create Match With Duplicated Loadout Trait Returns 400
    [Documentation]    The creator loadout rejects a duplicated trait uuid.
    [Tags]    traits    step23
    IF    '${TRAIT_UUID}' == ''    Pass Execution    Seed has no traits — scenario skipped
    ${trait_list}=    Create List    ${TRAIT_UUID}    ${TRAIT_UUID}
    ${response}=    Create Match With Loadout    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}
    ...    ${CHARACTER_UUID}    ${CLASS_UUID}    ${trait_list}    ${1}    expected_status=400
    Should Be Equal As Strings    ${response.json()}[error]    TRAIT_DUPLICATED

Create Match With Incompatible Loadout Trait Returns 400
    [Documentation]    The creator loadout rejects a trait incompatible with the class.
    [Tags]    traits    step23
    ${bad_trait}=    Find Incompatible Trait    ${DETAIL}    ${CLASS_UUID}
    IF    '${bad_trait}' == ''
        Pass Execution    Seed has no class-restricted trait — scenario skipped
    END
    ${trait_list}=    Create List    ${bad_trait}
    ${response}=    Create Match With Loadout    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}
    ...    ${CHARACTER_UUID}    ${CLASS_UUID}    ${trait_list}    ${1}    expected_status=400
    Should Be Equal As Strings    ${response.json()}[error]    TRAIT_NOT_COMPATIBLE

# ── v0.35.2 — traits the story keeps out of the start-match page ──────────────

A Hidden Trait Is Still Returned By The API, With Its Flag
    [Documentation]    v0.35.2 — `hideOnStartMatch` is REPORTED, never filtered out: the
    ...                same list resolves the traits a character already owns, and an event
    ...                or an item may grant a hidden one at any time. Hiding it is the
    ...                client's job, on the start-match page alone.
    [Tags]    traits    step23    hide-on-start-match
    ${hidden}=    Find Hidden Trait    ${DETAIL}
    IF    '${hidden}' == ''
        Pass Execution    Seed has no hidden trait — scenario skipped
    END
    # Every trait carries the key, so a client can tell "not hidden" from "old backend".
    FOR    ${trait}    IN    @{DETAIL}[traits]
        Dictionary Should Contain Key    ${trait}    hideOnStartMatch
    END

The Per-Class Trait List Carries The Flag Too
    [Documentation]    Both projections that return traits report it, or the picker would
    ...                have to guess on one of the two.
    [Tags]    traits    step23    hide-on-start-match
    ${hidden}=    Find Hidden Trait    ${DETAIL}
    IF    '${hidden}' == ''
        Pass Execution    Seed has no hidden trait — scenario skipped
    END
    ${response}=    Get Traits For Class    ${STORY_UUID}    ${CLASS_UUID}    200

    FOR    ${trait}    IN    @{response.json()}
        Dictionary Should Contain Key    ${trait}    hideOnStartMatch
    END

Join With A Hidden Trait Returns 400 TRAIT_NOT_SELECTABLE
    [Documentation]    The refusal is server-side on purpose: the API keeps returning the
    ...                trait, so a client that merely hid the row would be a rule anyone
    ...                could walk around with curl.
    [Tags]    traits    step23    hide-on-start-match
    ${hidden}=    Find Hidden Trait    ${DETAIL}
    IF    '${hidden}' == ''
        Pass Execution    Seed has no hidden trait — scenario skipped
    END
    ${match_uuid}=    Create Fresh Match
    ${trait_list}=    Create List    ${hidden}
    ${response}=    Join Match    ${TOKEN}    ${match_uuid}
    ...    ${CHARACTER_UUID}    ${CLASS_UUID}    ${trait_list}    expected_status=400
    Should Be Equal As Strings    ${response.json()}[error]    TRAIT_NOT_SELECTABLE

Create Match With A Hidden Loadout Trait Returns 400
    [Documentation]    Both doors are the same door: creator loadout and join share one
    ...                validator, so the refusal cannot exist on one side only.
    [Tags]    traits    step23    hide-on-start-match
    ${hidden}=    Find Hidden Trait    ${DETAIL}
    IF    '${hidden}' == ''
        Pass Execution    Seed has no hidden trait — scenario skipped
    END
    ${trait_list}=    Create List    ${hidden}
    ${response}=    Create Match With Loadout    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}
    ...    ${CHARACTER_UUID}    ${CLASS_UUID}    ${trait_list}    ${1}    expected_status=400
    Should Be Equal As Strings    ${response.json()}[error]    TRAIT_NOT_SELECTABLE

A Pickable Trait Is Still Pickable
    [Documentation]    The guard must refuse the flagged trait and nothing else — the
    ...                loadout keyword every suite uses picks a selectable one.
    [Tags]    traits    step23    hide-on-start-match
    IF    '${TRAIT_UUID}' == ''    Pass Execution    Seed has no selectable trait — scenario skipped
    ${match_uuid}=    Create Fresh Match
    ${trait_list}=    Create List    ${TRAIT_UUID}
    Join Match    ${TOKEN}    ${match_uuid}
    ...    ${CHARACTER_UUID}    ${CLASS_UUID}    ${trait_list}    expected_status=201


*** Keywords ***

Find Hidden Trait
    [Documentation]    The uuid of the first trait the story keeps out of the start-match
    ...                page, or the empty string when the seed authors none.
    [Arguments]    ${detail}
    ${traits}=    Get From Dictionary    ${detail}    traits    ${EMPTY}
    ${hidden}=    Evaluate    [t['uuid'] for t in $traits if t.get('hideOnStartMatch')]
    ${uuid}=    Set Variable If    ${hidden}    ${hidden}[0]    ${EMPTY}
    RETURN    ${uuid}

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
    ...                v0.32.1 — each match belongs to its own guest: one user may own
    ...                only one active match per story (409 ACTIVE_MATCH_ALREADY_EXISTS).
    ...                ${TOKEN} is rebound for the rest of the test, so the caller keeps
    ...                using it to act on the match it just got.
    ${token}=    Use A Fresh Guest Token
    ${match}=    Create Match    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}    robottest_step23
    Status Should Be    ${match}    201
    RETURN    ${match.json()}[uuid]

Join Fresh Match With Traits
    [Documentation]    Creates a match with a fresh guest and joins it with the
    ...                shared template/class and the given traits; returns the
    ...                created character JSON.
    [Arguments]    ${trait_uuids}
    ${character}=    Join Fresh Match With Difficulty And Traits
    ...    ${DIFFICULTY_UUID}    ${CLASS_UUID}    ${trait_uuids}
    RETURN    ${character}

Join Fresh Match With Difficulty And Traits
    [Documentation]    Creates a match with a fresh guest on the given difficulty and joins
    ...                it with the shared template, the given class and traits; returns the
    ...                created character JSON.
    [Arguments]    ${difficulty_uuid}    ${class_uuid}    ${trait_uuids}
    ${guest}=    POST On Session    public_session    /api/auth/guest
    Status Should Be    ${guest}    201
    ${token}=    Set Variable    ${guest.json()}[accessToken]
    ${match}=    Create Match    ${token}    ${STORY_UUID}    ${difficulty_uuid}    robottest_step23
    Status Should Be    ${match}    201
    ${response}=    Join Match    ${token}    ${match.json()}[uuid]
    ...    ${CHARACTER_UUID}    ${class_uuid}    ${trait_uuids}    expected_status=201
    RETURN    ${response.json()}
