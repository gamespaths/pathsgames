*** Settings ***
# ---------------------------------------------------------------------------
# experience_admin.robot — the story contract of Step 38 through the admin API: import,
# export (GET /stories/{uuid}), the entity lists and the CRUD of a difficulty carry
# expCostBase / maxStatValue, and neither costMaxCharacteristics nor isSafe survive.
#
# Tags: experience, step38, admin
# ---------------------------------------------------------------------------
Resource   experience_common.resource

Suite Setup       Suite Setup Experience
Suite Teardown    Suite Teardown Experience

*** Variables ***
${LEGACY_UUID}    f0380002-0000-4000-8000-000000000381


*** Test Cases ***

The Imported Difficulty Reads Back With The Step 38 Columns
    [Documentation]    The fixture ships one difficulty; it is taken by position because not
    ...                every backend echoes the story-local id on that list.
    [Tags]    experience    step38    admin    import
    ${difficulty}=    First Entity    difficulties
    Should Be Equal As Integers    ${difficulty}[expCost]       1
    Should Be Equal As Integers    ${difficulty}[expCostBase]   0
    Should Be Equal As Integers    ${difficulty}[maxStatValue]  4
    Dictionary Should Not Contain Key    ${difficulty}    costMaxCharacteristics

The Imported Location Carries secureParam And No isSafe
    [Tags]    experience    step38    admin    import
    ${hall}=     Entity With Id    locations    1
    ${wilds}=    Entity With Id    locations    2
    Should Be Equal As Integers    ${hall}[secureParam]     1
    Should Be Equal As Integers    ${wilds}[secureParam]    0
    Dictionary Should Not Contain Key    ${hall}    isSafe

The Export Carries The Same Columns
    [Documentation]    react-admin's "Export JSON" is the story head (GET /stories/{uuid})
    ...                plus every admin entity list: what those lists name is what a re-import
    ...                reads, so they must carry the new columns and none of the old ones.
    [Tags]    experience    step38    admin    export
    ${story}=    Get Admin Story By UUID    ${STORY_UUID}
    Status Should Be    ${story}    200
    Should Be Equal    ${story.json()}[uuid]    ${STORY_UUID}
    ${difficulties}=    List Admin Entities    ${STORY_UUID}    difficulties
    Status Should Be    ${difficulties}    200
    ${dkeys}=    Evaluate    {k for d in $difficulties.json() for k in d.keys()}
    Should Contain    ${dkeys}    expCostBase
    Should Contain    ${dkeys}    maxStatValue
    Should Not Contain    ${dkeys}    costMaxCharacteristics
    ${locations}=    List Admin Entities    ${STORY_UUID}    locations
    Status Should Be    ${locations}    200
    ${lkeys}=    Evaluate    {k for l in $locations.json() for k in l.keys()}
    Should Not Contain    ${lkeys}    isSafe
    Should Contain    ${lkeys}    secureParam

A Difficulty Created And Updated Through The CRUD Keeps The Two Columns
    [Tags]    experience    step38    admin    crud
    &{body}=    Create Dictionary    idTextName=${62}    idTextDescription=${62}    expCost=${2}
    ...    expCostBase=${5}    maxStatValue=${9}    energy=${20}
    ${created}=    Create Admin Entity    ${STORY_UUID}    difficulties    ${body}
    Should Be Equal As Integers    ${created.status_code}    201
    ${uuid}=    Set Variable    ${created.json()}[uuid]
    ${stored}=    Entity With Uuid    difficulties    ${uuid}
    Should Be Equal As Integers    ${stored}[expCostBase]   5
    Should Be Equal As Integers    ${stored}[maxStatValue]  9

    &{patch}=    Create Dictionary    expCostBase=${1}    maxStatValue=${0}
    ${updated}=    Update Admin Entity    ${STORY_UUID}    difficulties    ${uuid}    ${patch}
    Should Be Equal As Integers    ${updated.status_code}    200
    ${stored}=    Entity With Uuid    difficulties    ${uuid}
    Should Be Equal As Integers    ${stored}[expCostBase]   1
    Should Be Equal As Integers    ${stored}[maxStatValue]  0
    [Teardown]    Delete Admin Entity    ${STORY_UUID}    difficulties    ${uuid}

A Difficulty Created Without The Two Columns Defaults Them To Zero
    [Tags]    experience    step38    admin    crud
    &{body}=    Create Dictionary    idTextName=${62}    idTextDescription=${62}    expCost=${3}
    ${created}=    Create Admin Entity    ${STORY_UUID}    difficulties    ${body}
    Should Be Equal As Integers    ${created.status_code}    201
    ${stored}=    Entity With Uuid    difficulties    ${created.json()}[uuid]
    ${base}=    Value Of    ${stored}    expCostBase
    ${cap}=     Value Of    ${stored}    maxStatValue
    Should Be True    ($base or 0) == 0 and ($cap or 0) == 0
    ...    msg=a difficulty authored without the Step 38 columns must price with base 0 and no cap (${base}/${cap})
    [Teardown]    Delete Admin Entity    ${STORY_UUID}    difficulties    ${created.json()}[uuid]

A Legacy Payload Still Imports And Loses The Dropped Keys
    [Documentation]    A story exported before v0.38.0 carries costMaxCharacteristics and
    ...                isSafe: the import ignores both, and nothing reads them back.
    [Tags]    experience    step38    admin    import    legacy
    Run Keyword And Ignore Error    Delete Admin Story    ${LEGACY_UUID}
    ${payload}=    Catenate    SEPARATOR=
    ...    {"uuid":"${LEGACY_UUID}","author":"robottest_experience","category":"robottest","visibility":"PRIVATE",
    ...    "idTextTitle":1,"idTextDescription":2,
    ...    "texts":[{"id":1,"idText":1,"lang":"en","shortText":"Legacy"},{"id":2,"idText":2,"lang":"en","shortText":"Legacy"}],
    ...    "difficulties":[{"id":1,"expCost":2,"costMaxCharacteristics":7}],
    ...    "locations":[{"id":1,"isSafe":1,"secureParam":1}]}
    &{headers}=    Create Dictionary    Authorization=Bearer ${ADMIN_TOKEN}    Content-Type=application/json
    ${import}=    POST On Session    admin_session    /api/admin/stories/import
    ...    data=${payload}    headers=${headers}    expected_status=any
    Should Be Equal As Integers    ${import.status_code}    201
    ${diffs}=    List Admin Entities    ${LEGACY_UUID}    difficulties
    Status Should Be    ${diffs}    200
    Dictionary Should Not Contain Key    ${diffs.json()}[0]    costMaxCharacteristics
    Should Be Equal As Integers    ${diffs.json()}[0][expCost]    2
    ${locs}=    List Admin Entities    ${LEGACY_UUID}    locations
    Status Should Be    ${locs}    200
    Dictionary Should Not Contain Key    ${locs.json()}[0]    isSafe
    Should Be Equal As Integers    ${locs.json()}[0][secureParam]    1
    [Teardown]    Run Keyword And Ignore Error    Delete Admin Story    ${LEGACY_UUID}


*** Keywords ***

First Entity
    [Arguments]    ${entity_type}
    ${response}=    List Admin Entities    ${STORY_UUID}    ${entity_type}
    Should Be Equal As Integers    ${response.status_code}    200
    Should Not Be Empty    ${response.json()}    msg=the fixture has no ${entity_type} rows
    RETURN    ${response.json()}[0]

Entity With Id
    [Arguments]    ${entity_type}    ${id}
    ${response}=    List Admin Entities    ${STORY_UUID}    ${entity_type}
    Should Be Equal As Integers    ${response.status_code}    200
    FOR    ${row}    IN    @{response.json()}
        ${row_id}=    Get From Dictionary    ${row}    id    ${None}
        IF    $row_id is not None and str($row_id) == str($id)    RETURN    ${row}
    END
    Fail    no ${entity_type} row with id ${id}

Entity With Uuid
    [Arguments]    ${entity_type}    ${uuid}
    ${response}=    List Admin Entities    ${STORY_UUID}    ${entity_type}
    Should Be Equal As Integers    ${response.status_code}    200
    FOR    ${row}    IN    @{response.json()}
        IF    $row.get('uuid') == $uuid    RETURN    ${row}
    END
    Fail    no ${entity_type} row with uuid ${uuid}

Value Of
    [Arguments]    ${entity}    ${field}
    ${value}=    Get From Dictionary    ${entity}    ${field}    ${None}
    RETURN    ${value}
