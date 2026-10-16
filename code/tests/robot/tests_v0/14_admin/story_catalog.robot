*** Settings ***
# ---------------------------------------------------------------------------
# story_catalog.robot — v0.37.6 static story catalog export.
#
# Endpoint under test:
#   POST /api/admin/stories/catalog → 200 {status:"WRITTEN", target, files[]}
#                                   → 503 CATALOG_TARGET_NOT_CONFIGURED (no destination)
#                                   → 401/403 without an admin token
#
# The files are the body of GET /api/stories?lang=… — one per configured language.
# Backends: Java/Python write under CATALOG_EXPORT_DIR (the local run scripts export it
# and the suite reads the files back); AWS writes to the website S3 bucket.
# A backend with no destination configured answers 503 and the write tests are SKIPPED.
#
# Tags: admin, catalog, v0.37.6
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    OperatingSystem
Library    Collections
Library    ../../resources/JwtHelper.py
Resource   ../../resources/common.resource
Resource   ../../resources/stories.resource

Suite Setup      Initialize Catalog Suite

*** Variables ***
# Where the local backend was told to write (empty on AWS / unconfigured backends).
${CATALOG_EXPORT_DIR}    %{CATALOG_EXPORT_DIR=}

*** Keywords ***

Initialize Catalog Suite
    Create Public Session
    Create Admin Session

Post Catalog
    [Documentation]    POST /api/admin/stories/catalog; returns the response (any status).
    [Arguments]    ${session}=admin_session
    ${response}=    POST On Session    ${session}    /api/admin/stories/catalog    expected_status=any
    RETURN    ${response}

Post Catalog Or Skip
    [Documentation]    Runs the export; skips the test when this backend has no destination.
    ${response}=    Post Catalog
    Skip If    ${response.status_code} == 503    Static catalog destination not configured on this backend
    Should Be Equal As Integers    ${response.status_code}    200
    RETURN    ${response.json()}

*** Test Cases ***

Catalog Export Requires Admin
    [Tags]    admin    catalog    v0.37.6
    Create Session    anon_catalog    ${ADMIN_BASE_URL}    verify=false
    ${response}=    Post Catalog    anon_catalog
    Should Be True    ${response.status_code} in (401, 403)

Catalog Export Writes One File Per Language
    [Tags]    admin    catalog    v0.37.6
    ${body}=    Post Catalog Or Skip
    Should Be Equal    ${body["status"]}    WRITTEN
    Should Not Be Empty    ${body["target"]}
    ${files}=    Set Variable    ${body["files"]}
    Should Not Be Empty    ${files}
    ${langs}=    Create List
    FOR    ${f}    IN    @{files}
        Should Be Equal    ${f["path"]}    data/stories-${f["lang"]}.json
        Should Be True    ${f["bytes"]} >= 2
        Should Be True    ${f["count"]} >= 0
        Append To List    ${langs}    ${f["lang"]}
    END
    List Should Contain Value    ${langs}    en

Catalog File Count Matches The Public List
    [Tags]    admin    catalog    v0.37.6
    ${body}=    Post Catalog Or Skip
    FOR    ${f}    IN    @{body["files"]}
        ${public}=    Get Public Stories    ${f["lang"]}
        ${expected}=    Get Length    ${public.json()}
        Should Be Equal As Integers    ${f["count"]}    ${expected}
    END

Catalog File On Disk Is The Public List
    [Documentation]    Only where the suite can reach the export dir (local Java/Python runs).
    [Tags]    admin    catalog    v0.37.6
    Skip If    '${CATALOG_EXPORT_DIR}' == ''    CATALOG_EXPORT_DIR not set for this run
    ${body}=    Post Catalog Or Skip
    FOR    ${f}    IN    @{body["files"]}
        ${path}=    Set Variable    ${CATALOG_EXPORT_DIR}/${f["path"]}
        File Should Exist    ${path}
        ${raw}=    Get File    ${path}    encoding=UTF-8
        ${written}=    Evaluate    json.loads($raw)    modules=json
        ${public}=    Get Public Stories    ${f["lang"]}
        ${expected}=    Set Variable    ${public.json()}
        Should Be Equal    ${written}    ${expected}
        ${size}=    Get File Size    ${path}
        Should Be Equal As Integers    ${size}    ${f["bytes"]}
    END

Catalog Export Is Idempotent
    [Tags]    admin    catalog    v0.37.6
    ${first}=    Post Catalog Or Skip
    ${second}=    Post Catalog Or Skip
    Should Be Equal    ${first["files"]}    ${second["files"]}
