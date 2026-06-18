*** Settings ***
# ---------------------------------------------------------------------------
# story_validation.robot — tests for Step 22 story integrity validation.
#
# Endpoints under test:
#   POST /api/admin/stories/import            → 400 INVALID_STORY on broken refs
#   GET  /api/admin/stories/{uuid}/validate   → 200 { valid, count, errors[] }
#
# The validator hard-fails import on referential-integrity violations (dangling
# references, event-chain cycles, empty choices, class conflicts) and exposes a
# read-only validation report. Admin CRUD is lenient (forward refs allowed).
#
# Backend-agnostic: runs green against java-sqlite, java-postgres, python.
#
# Tags: admin, validation, step22
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Library    ../../resources/JwtHelper.py
Resource   ../../resources/common.resource
Resource   ../../resources/stories.resource

Suite Setup    Initialize Validation Suite

*** Keywords ***

Initialize Validation Suite
    Create Public Session
    Create Session    admin_session    ${ADMIN_BASE_URL}    verify=false
    ${token}=    Generate Admin Token
    Set Suite Variable    ${ADMIN_TOKEN}    ${token}

*** Variables ***
${VALID_UUID}    a2222222-2222-4222-8222-222222222222

*** Test Cases ***

Import Choice With Missing Event Returns 400
    [Documentation]    A choice referencing a non-existent event id fails validation.
    [Tags]    admin    validation    step22
    ${payload}=    Catenate    SEPARATOR=
    ...    {"uuid":"a1111111-0001-4000-8000-000000000001","author":"val-test",
    ...    "events":[{"id":1,"type":"NORMAL"}],
    ...    "choices":[{"id":1,"idEvent":999,"otherwiseFlag":1}]}
    ${body}=    Import Payload Should Fail Validation    ${payload}
    ${fields}=    Evaluate    [e['field'] for e in $body['errors']]
    Should Contain    ${fields}    idEvent

Import Neighbor With Missing Location Returns 400
    [Documentation]    A location-neighbor pointing to a non-existent location fails.
    [Tags]    admin    validation    step22
    ${payload}=    Catenate    SEPARATOR=
    ...    {"uuid":"a1111111-0002-4000-8000-000000000002","author":"val-test",
    ...    "locations":[{"id":1}],
    ...    "locationNeighbors":[{"id":1,"idLocationFrom":1,"idLocationTo":77,"direction":"N"}]}
    Import Payload Should Fail Validation    ${payload}

Import Event Chain Cycle Returns 400
    [Documentation]    An idEventNext loop is detected as a cycle.
    [Tags]    admin    validation    step22
    ${payload}=    Catenate    SEPARATOR=
    ...    {"uuid":"a1111111-0003-4000-8000-000000000003","author":"val-test",
    ...    "events":[{"id":1,"idEventNext":2},{"id":2,"idEventNext":1}]}
    ${body}=    Import Payload Should Fail Validation    ${payload}
    ${rules}=    Evaluate    [e['rule'] for e in $body['errors']]
    Should Contain    ${rules}    R3_EVENT_CYCLE

Import Choice Without Option Or Otherwise Returns 400
    [Documentation]    A choice with no choice-effects and no otherwise fallback fails.
    [Tags]    admin    validation    step22
    ${payload}=    Catenate    SEPARATOR=
    ...    {"uuid":"a1111111-0004-4000-8000-000000000004","author":"val-test",
    ...    "events":[{"id":1,"type":"NORMAL"}],
    ...    "choices":[{"id":1,"idEvent":1,"otherwiseFlag":0}]}
    ${body}=    Import Payload Should Fail Validation    ${payload}
    ${rules}=    Evaluate    [e['rule'] for e in $body['errors']]
    Should Contain    ${rules}    R4_CHOICE_EMPTY

Import Template With Class Conflict Returns 400
    [Documentation]    A character template whose permitted class equals its prohibited class fails.
    [Tags]    admin    validation    step22
    ${payload}=    Catenate    SEPARATOR=
    ...    {"uuid":"a1111111-0005-4000-8000-000000000005","author":"val-test",
    ...    "classes":[{"id":1}],
    ...    "characterTemplates":[{"id":1,"lifeMax":10,"energyMax":10,"idClassPermitted":1,"idClassProhibited":1}]}
    ${body}=    Import Payload Should Fail Validation    ${payload}
    ${rules}=    Evaluate    [e['rule'] for e in $body['errors']]
    Should Contain    ${rules}    R6_CLASS_CONFLICT

Import Valid Story Returns 201 And Validates Clean
    [Documentation]    Regression guard: a consistent story imports (201) and the validate
    ...                endpoint reports it valid; then it is cleaned up. The payload is kept
    ...                minimal (locations + events only) so it round-trips identically across
    ...                every backend's persistence layer (no FK-constrained sub-entities).
    [Tags]    admin    validation    step22
    ${payload}=    Catenate    SEPARATOR=
    ...    {"uuid":"${VALID_UUID}","author":"val-test",
    ...    "locations":[{"id":1},{"id":2}],
    ...    "events":[{"id":1,"type":"NORMAL"},{"id":2,"type":"NORMAL"}]}
    ${response}=    Post Admin Story Import    ${payload}
    Should Be Equal As Integers    ${response.status_code}    201

    ${val}=    Validate Admin Story    ${VALID_UUID}
    Should Be Equal As Integers    ${val.status_code}    200
    ${vbody}=    Set Variable    ${val.json()}
    Should Be Equal    ${vbody}[valid]    ${True}
    Should Be Equal As Integers    ${vbody}[count]    0

    [Teardown]    Delete Admin Story    ${VALID_UUID}

Validate Endpoint Returns Report Structure
    [Documentation]    GET /api/admin/stories/{uuid}/validate on a seed story returns 200 with
    ...                the report structure (valid / count / errors), regardless of content.
    [Tags]    admin    validation    step22
    ${response}=    Validate Admin Story    ${DEMO_1_UUID}
    Should Be Equal As Integers    ${response.status_code}    200
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    valid
    Dictionary Should Contain Key    ${body}    count
    Dictionary Should Contain Key    ${body}    errors

Validate Unknown Story Returns 404
    [Documentation]    GET validate for a non-existent story returns 404.
    [Tags]    admin    validation    step22
    ${response}=    Validate Admin Story    ${UNKNOWN_UUID}
    Should Be Equal As Integers    ${response.status_code}    404

Validate Without Token Returns 401
    [Documentation]    GET /api/admin/stories/{uuid}/validate without an admin token is rejected.
    [Tags]    admin    validation    step22
    ${response}=    GET On Session    admin_session    /api/admin/stories/${DEMO_1_UUID}/validate
    ...    expected_status=any
    Should Be Equal As Integers    ${response.status_code}    401

Import Template With Zero Life Returns 400
    [Documentation]    A character template with lifeMax=0 fails the stat-range rule.
    [Tags]    admin    validation    step22
    ${payload}=    Catenate    SEPARATOR=
    ...    {"uuid":"a1111111-0006-4000-8000-000000000006","author":"val-test",
    ...    "characterTemplates":[{"id":1,"lifeMax":0,"energyMax":10}]}
    ${body}=    Import Payload Should Fail Validation    ${payload}
    ${rules}=    Evaluate    [e['rule'] for e in $body['errors']]
    Should Contain    ${rules}    R6_STAT_RANGE

Import Template With Zero Energy Returns 400
    [Documentation]    A character template with energyMax=0 fails the stat-range rule.
    [Tags]    admin    validation    step22
    ${payload}=    Catenate    SEPARATOR=
    ...    {"uuid":"a1111111-0007-4000-8000-000000000007","author":"val-test",
    ...    "characterTemplates":[{"id":1,"lifeMax":10,"energyMax":0}]}
    ${body}=    Import Payload Should Fail Validation    ${payload}
    ${rules}=    Evaluate    [e['rule'] for e in $body['errors']]
    Should Contain    ${rules}    R6_STAT_RANGE

Create Difficulty With Inverted Character Range Returns 400
    [Documentation]    The difficulty character-range rule (R6_DIFFICULTY_RANGE) is
    ...                entity-local: it is enforced on admin CRUD create, not on import.
    ...                A difficulty whose minCharacter exceeds maxCharacter is rejected.
    [Tags]    admin    validation    step22
    &{data}=    Create Dictionary    minCharacter=${5}    maxCharacter=${2}
    ${response}=    Create Admin Entity    ${DEMO_1_UUID}    difficulties    ${data}
    Should Be Equal As Integers    ${response.status_code}    400
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal As Strings    ${body}[error]    INVALID_STORY
    ${rules}=    Evaluate    [e['rule'] for e in $body['errors']]
    Should Contain    ${rules}    R6_DIFFICULTY_RANGE

Import Condition With Unknown Key Returns 400
    [Documentation]    A choice-condition whose key is not declared in keys[] fails.
    ...                The choice has an otherwise fallback so only R4_CONDITION_KEY fires.
    [Tags]    admin    validation    step22
    ${payload}=    Catenate    SEPARATOR=
    ...    {"uuid":"a1111111-0009-4000-8000-000000000009","author":"val-test",
    ...    "events":[{"id":1,"type":"NORMAL"}],
    ...    "choices":[{"id":1,"idEvent":1,"otherwiseFlag":1}],
    ...    "choiceConditions":[{"id":1,"idChoices":1,"key":"NOPE"}]}
    ${body}=    Import Payload Should Fail Validation    ${payload}
    ${rules}=    Evaluate    [e['rule'] for e in $body['errors']]
    Should Contain    ${rules}    R4_CONDITION_KEY

Import Neighbor Self Loop Returns 400
    [Documentation]    A neighbor whose from-location equals its to-location fails.
    [Tags]    admin    validation    step22
    ${payload}=    Catenate    SEPARATOR=
    ...    {"uuid":"a1111111-000a-4000-8000-00000000000a","author":"val-test",
    ...    "locations":[{"id":1}],
    ...    "locationNeighbors":[{"id":1,"idLocationFrom":1,"idLocationTo":1,"direction":"N"}]}
    ${body}=    Import Payload Should Fail Validation    ${payload}
    ${rules}=    Evaluate    [e['rule'] for e in $body['errors']]
    Should Contain    ${rules}    R2_NEIGHBOR_SELF

Import Neighbor Without Direction Returns 400
    [Documentation]    A neighbor with a blank direction fails.
    [Tags]    admin    validation    step22
    ${payload}=    Catenate    SEPARATOR=
    ...    {"uuid":"a1111111-000b-4000-8000-00000000000b","author":"val-test",
    ...    "locations":[{"id":1},{"id":2}],
    ...    "locationNeighbors":[{"id":1,"idLocationFrom":1,"idLocationTo":2,"direction":""}]}
    ${body}=    Import Payload Should Fail Validation    ${payload}
    ${rules}=    Evaluate    [e['rule'] for e in $body['errors']]
    Should Contain    ${rules}    R2_NEIGHBOR_DIR

Import Duplicate Neighbor Direction Returns 400
    [Documentation]    Two neighbors sharing (from, direction) but pointing at different
    ...                locations fail the duplicate-direction rule.
    [Tags]    admin    validation    step22
    ${payload}=    Catenate    SEPARATOR=
    ...    {"uuid":"a1111111-000c-4000-8000-00000000000c","author":"val-test",
    ...    "locations":[{"id":1},{"id":2},{"id":3}],
    ...    "locationNeighbors":[
    ...    {"id":1,"idLocationFrom":1,"idLocationTo":2,"direction":"N"},
    ...    {"id":2,"idLocationFrom":1,"idLocationTo":3,"direction":"N"}]}
    ${body}=    Import Payload Should Fail Validation    ${payload}
    ${rules}=    Evaluate    [e['rule'] for e in $body['errors']]
    Should Contain    ${rules}    R2_NEIGHBOR_DUP

Import Event Self Cycle Returns 400
    [Documentation]    An event whose idEventNext points to itself is a cycle.
    [Tags]    admin    validation    step22
    ${payload}=    Catenate    SEPARATOR=
    ...    {"uuid":"a1111111-000d-4000-8000-00000000000d","author":"val-test",
    ...    "events":[{"id":1,"idEventNext":1}]}
    ${body}=    Import Payload Should Fail Validation    ${payload}
    ${rules}=    Evaluate    [e['rule'] for e in $body['errors']]
    Should Contain    ${rules}    R3_EVENT_CYCLE

Import With Multiple Errors Returns All
    [Documentation]    A payload with two distinct violations (dangling choice idEvent
    ...                AND a self-loop neighbor) reports both — the validator does not
    ...                stop at the first error.
    [Tags]    admin    validation    step22
    ${payload}=    Catenate    SEPARATOR=
    ...    {"uuid":"a1111111-000e-4000-8000-00000000000e","author":"val-test",
    ...    "locations":[{"id":1}],
    ...    "events":[{"id":1,"type":"NORMAL"}],
    ...    "choices":[{"id":1,"idEvent":999,"otherwiseFlag":1}],
    ...    "locationNeighbors":[{"id":1,"idLocationFrom":1,"idLocationTo":1,"direction":"N"}]}
    ${body}=    Import Payload Should Fail Validation    ${payload}
    ${count}=    Evaluate    len($body['errors'])
    Should Be True    ${count} >= 2
    ${rules}=    Evaluate    [e['rule'] for e in $body['errors']]
    Should Contain    ${rules}    R_EVENT_REF
    Should Contain    ${rules}    R2_NEIGHBOR_SELF

Validate Imported Story Reports Valid
    [Documentation]    Regression guard: a full imported demo story (DEMO_3) must validate
    ...                clean — valid:true and zero errors. Backends whose seed does not
    ...                include this story (validate → 404) skip the scenario.
    [Tags]    admin    validation    step22
    ${response}=    Validate Admin Story    ${DEMO_3_UUID}
    IF    ${response.status_code} == 404
        Pass Execution    Backend seed has no DEMO_3 imported story — scenario skipped
    END
    Should Be Equal As Integers    ${response.status_code}    200
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal    ${body}[valid]    ${True}
    Should Be Equal As Integers    ${body}[count]    0

Create Event With Forward Location Reference Is Lenient
    [Documentation]    Admin CRUD runs entity-local validation only — it never hard-fails a
    ...                forward reference with 400 INVALID_STORY. The persistence layer may
    ...                still enforce the FK: backends without FK enforcement (SQLite) persist
    ...                and return 201; backends that enforce it (PostgreSQL) reject cleanly
    ...                with 409 CONSTRAINT_VIOLATION (never a 500).
    [Tags]    admin    validation    step22
    &{data}=    Create Dictionary    type=NORMAL    idSpecificLocation=${99999}
    ${response}=    Create Admin Entity    ${DEMO_1_UUID}    events    ${data}
    Should Be True    ${response.status_code} == 201 or ${response.status_code} == 409
    IF    ${response.status_code} == 201
        Set Test Variable    ${CREATED_EVENT_UUID}    ${response.json()}[uuid]
        Delete Admin Entity    ${DEMO_1_UUID}    events    ${CREATED_EVENT_UUID}
    END
