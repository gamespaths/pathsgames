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
    # Step 15 additions
    Dictionary Should Contain Key    ${body}    classCount
    Dictionary Should Contain Key    ${body}    characterTemplateCount
    Dictionary Should Contain Key    ${body}    traitCount
    Dictionary Should Contain Key    ${body}    characterTemplates
    Dictionary Should Contain Key    ${body}    classes
    Dictionary Should Contain Key    ${body}    traits

Get Story Categories
    [Documentation]    Calls GET /api/stories/categories. Returns the response.
    ${response}=    GET On Session    public_session    /api/stories/categories
    RETURN    ${response}

Get Stories By Category
    [Documentation]    Calls GET /api/stories/category/{category}. Returns the response.
    [Arguments]    ${category}    ${lang}=${DEFAULT_LANG}
    ${params}=    Create Dictionary    lang=${lang}
    ${response}=    GET On Session    public_session    /api/stories/category/${category}
    ...    params=${params}    expected_status=any
    RETURN    ${response}

Get Story Groups
    [Documentation]    Calls GET /api/stories/groups. Returns the response.
    ${response}=    GET On Session    public_session    /api/stories/groups
    RETURN    ${response}

Get Stories By Group
    [Documentation]    Calls GET /api/stories/group/{group}. Returns the response.
    [Arguments]    ${group}    ${lang}=${DEFAULT_LANG}
    ${params}=    Create Dictionary    lang=${lang}
    ${response}=    GET On Session    public_session    /api/stories/group/${group}
    ...    params=${params}    expected_status=any
    RETURN    ${response}

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

# ── Step 16: Content Info Keywords ────────────────────────────────────

Get Card Info
    [Documentation]    Calls GET /api/content/{uuidStory}/cards/{uuidCard}?lang={lang}.
    [Arguments]    ${uuid_story}    ${uuid_card}    ${lang}=${DEFAULT_LANG}
    ${params}=    Create Dictionary    lang=${lang}
    ${response}=    GET On Session    public_session    /api/content/${uuid_story}/cards/${uuid_card}
    ...    params=${params}    expected_status=any
    RETURN    ${response}

Get Text Detail
    [Documentation]    Calls GET /api/content/{uuidStory}/texts/{idText}/lang/{lang}.
    [Arguments]    ${uuid_story}    ${id_text}    ${lang}=${DEFAULT_LANG}
    ${response}=    GET On Session    public_session    /api/content/${uuid_story}/texts/${id_text}/lang/${lang}
    ...    expected_status=any
    RETURN    ${response}

Get Creator Detail
    [Documentation]    Calls GET /api/content/{uuidStory}/creators/{uuidCreator}?lang={lang}.
    [Arguments]    ${uuid_story}    ${uuid_creator}    ${lang}=${DEFAULT_LANG}
    ${params}=    Create Dictionary    lang=${lang}
    ${response}=    GET On Session    public_session    /api/content/${uuid_story}/creators/${uuid_creator}
    ...    params=${params}    expected_status=any
    RETURN    ${response}

Card Info Should Have Required Fields
    [Documentation]    Validates that a CardInfoResponse body has all required fields.
    [Arguments]    ${body}
    Dictionary Should Contain Key    ${body}    uuid
    Dictionary Should Contain Key    ${body}    title
    Dictionary Should Contain Key    ${body}    imageUrl
    Dictionary Should Contain Key    ${body}    alternativeImage
    Dictionary Should Contain Key    ${body}    awesomeIcon
    Dictionary Should Contain Key    ${body}    styleMain
    Dictionary Should Contain Key    ${body}    styleDetail
    Dictionary Should Contain Key    ${body}    description
    Dictionary Should Contain Key    ${body}    copyrightText
    Dictionary Should Contain Key    ${body}    linkCopyright

Text Detail Should Have Required Fields
    [Documentation]    Validates that a TextInfoResponse body has all required fields.
    [Arguments]    ${body}
    Dictionary Should Contain Key    ${body}    idText
    Dictionary Should Contain Key    ${body}    lang
    Dictionary Should Contain Key    ${body}    resolvedLang
    Dictionary Should Contain Key    ${body}    shortText
    Dictionary Should Contain Key    ${body}    longText

Creator Detail Should Have Required Fields
    [Documentation]    Validates that a CreatorInfoResponse body has all required fields.
    [Arguments]    ${body}
    Dictionary Should Contain Key    ${body}    uuid
    Dictionary Should Contain Key    ${body}    name
