*** Settings ***
# ---------------------------------------------------------------------------
# stories.resource — keywords for story-related API calls.
#
# Public:
#   GET  /api/stories?lang={lang}        → 200, StorySummaryResponse[]
#   GET  /api/stories/{uuid}?lang={lang} → 200 | 404
#
# Admin:
#   POST   /api/admin/stories/import     → 201, StoryImportResponse
#   GET    /api/admin/stories?lang={lang}→ 200, list (all visibility)
#   DELETE /api/admin/stories/{uuid}     → 200 {status:"DELETED", uuid} | 404
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    OperatingSystem
Library    Collections
Resource   common.resource


*** Keywords ***

Get Public Stories
    [Documentation]    Calls GET /api/stories with optional lang param (default: \${DEFAULT_LANG}).
    [Arguments]    ${lang}=${DEFAULT_LANG}
    ${params}=    Create Dictionary    lang=${lang}
    ${response}=    GET On Session    public_session    /api/stories    params=${params}
    RETURN    ${response}

Get Story By UUID
    [Documentation]    Calls GET /api/stories/{uuid}. Returns the response.
    [Arguments]    ${uuid}    ${lang}=${DEFAULT_LANG}
    ${params}=    Create Dictionary    lang=${lang}
    ${response}=    GET On Session    public_session    /api/stories/${uuid}
    ...    params=${params}    expected_status=any
    RETURN    ${response}

Story Summary Should Have Required Fields
    [Documentation]    Validates that a single StorySummaryResponse item has all required fields.
    [Arguments]    ${item}
    Dictionary Should Contain Key    ${item}    uuid
    Dictionary Should Contain Key    ${item}    title
    Dictionary Should Contain Key    ${item}    description
    Dictionary Should Contain Key    ${item}    author
    Dictionary Should Contain Key    ${item}    category
    Dictionary Should Contain Key    ${item}    group
    Dictionary Should Contain Key    ${item}    visibility
    Dictionary Should Contain Key    ${item}    priority
    Dictionary Should Contain Key    ${item}    peghi
    Dictionary Should Contain Key    ${item}    difficultyCount

Story Detail Should Have Required Fields
    [Documentation]    Validates that a StoryDetailResponse body has all required fields.
    ...                Note: StoryDetailResponse has 'difficulties' (list) and counts, but NOT
    ...                'difficultyCount' (that field is only on StorySummaryResponse).
    [Arguments]    ${body}
    Dictionary Should Contain Key    ${body}    uuid
    Dictionary Should Contain Key    ${body}    title
    Dictionary Should Contain Key    ${body}    description
    Dictionary Should Contain Key    ${body}    author
    Dictionary Should Contain Key    ${body}    category
    Dictionary Should Contain Key    ${body}    group
    Dictionary Should Contain Key    ${body}    visibility
    Dictionary Should Contain Key    ${body}    priority
    Dictionary Should Contain Key    ${body}    peghi
    Dictionary Should Contain Key    ${body}    difficulties
    Dictionary Should Contain Key    ${body}    locationCount
    Dictionary Should Contain Key    ${body}    eventCount
    Dictionary Should Contain Key    ${body}    itemCount

Import Story From File
    [Documentation]    Calls POST /api/admin/stories/import with the given JSON file content.
    ...                Returns the 201 response.
    [Arguments]    ${json_file_path}
    ${body}=    Get File    ${json_file_path}
    &{headers}=    Create Dictionary
    ...    Authorization=Bearer ${ADMIN_TOKEN}
    ...    Content-Type=application/json
    ${response}=    POST On Session    public_session    /api/admin/stories/import
    ...    data=${body}    headers=${headers}    expected_status=any
    RETURN    ${response}

Delete Admin Story
    [Documentation]    Calls DELETE /api/admin/stories/{uuid}. Returns the response.
    [Arguments]    ${uuid}
    &{headers}=    Create Dictionary    Authorization=Bearer ${ADMIN_TOKEN}
    ${response}=    DELETE On Session    public_session    /api/admin/stories/${uuid}
    ...    headers=${headers}    expected_status=any
    RETURN    ${response}

Get Admin Stories
    [Documentation]    Calls GET /api/admin/stories. Returns the response.
    [Arguments]    ${lang}=${DEFAULT_LANG}
    ${params}=    Create Dictionary    lang=${lang}
    &{headers}=    Create Dictionary    Authorization=Bearer ${ADMIN_TOKEN}
    ${response}=    GET On Session    public_session    /api/admin/stories
    ...    params=${params}    headers=${headers}
    RETURN    ${response}
