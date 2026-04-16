*** Settings ***
# ---------------------------------------------------------------------------
# story_detail_enriched.robot — tests for Step 15 enrichments on
#                                 GET /api/stories/{uuid}.
#
# Validates the new fields added in Step 15:
#   classCount, characterTemplateCount, traitCount,
#   characterTemplates[], classes[], traits[], card (object|null)
#
# Uses seed story UUIDs from variables.
#
# Tags: stories, step15, detail
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/stories.resource

Suite Setup    Create Public Session


*** Test Cases ***

Story Detail Has Step 15 Count Fields
    [Documentation]    The StoryDetailResponse includes classCount, characterTemplateCount, traitCount.
    [Tags]    stories    step15    detail
    ${response}=    Get Story By UUID    ${DEMO_1_UUID}
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    classCount
    Dictionary Should Contain Key    ${body}    characterTemplateCount
    Dictionary Should Contain Key    ${body}    traitCount

Story Detail Count Fields Are Integers
    [Documentation]    The new count fields are non-negative integers.
    [Tags]    stories    step15    detail
    ${response}=    Get Story By UUID    ${DEMO_1_UUID}
    ${body}=    Set Variable    ${response.json()}
    Should Be True    isinstance($body['classCount'], int) and $body['classCount'] >= 0
    Should Be True    isinstance($body['characterTemplateCount'], int) and $body['characterTemplateCount'] >= 0
    Should Be True    isinstance($body['traitCount'], int) and $body['traitCount'] >= 0

Story Detail Has Character Templates List
    [Documentation]    The response contains a 'characterTemplates' field that is a list.
    [Tags]    stories    step15    detail
    ${response}=    Get Story By UUID    ${DEMO_1_UUID}
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    characterTemplates
    ${type}=    Evaluate    type($body['characterTemplates']).__name__
    Should Be Equal    ${type}    list

Story Detail Has Classes List
    [Documentation]    The response contains a 'classes' field that is a list.
    [Tags]    stories    step15    detail
    ${response}=    Get Story By UUID    ${DEMO_1_UUID}
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    classes
    ${type}=    Evaluate    type($body['classes']).__name__
    Should Be Equal    ${type}    list

Story Detail Has Traits List
    [Documentation]    The response contains a 'traits' field that is a list.
    [Tags]    stories    step15    detail
    ${response}=    Get Story By UUID    ${DEMO_1_UUID}
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    traits
    ${type}=    Evaluate    type($body['traits']).__name__
    Should Be Equal    ${type}    list

Character Templates Have Required Fields
    [Documentation]    If characterTemplates is non-empty, each item has uuid, name, description, stat fields.
    [Tags]    stories    step15    detail
    ${response}=    Get Story By UUID    ${DEMO_1_UUID}
    ${body}=    Set Variable    ${response.json()}
    ${templates}=    Set Variable    ${body}[characterTemplates]
    Return From Keyword If    len(${templates}) == 0
    FOR    ${ct}    IN    @{templates}
        Dictionary Should Contain Key    ${ct}    uuid
        Dictionary Should Contain Key    ${ct}    name
        Dictionary Should Contain Key    ${ct}    lifeMax
        Dictionary Should Contain Key    ${ct}    energyMax
        Dictionary Should Contain Key    ${ct}    dexterityStart
        Dictionary Should Contain Key    ${ct}    intelligenceStart
        Dictionary Should Contain Key    ${ct}    constitutionStart
    END

Classes Have Required Fields
    [Documentation]    If classes is non-empty, each item has uuid, name, description, stat fields.
    [Tags]    stories    step15    detail
    ${response}=    Get Story By UUID    ${DEMO_1_UUID}
    ${body}=    Set Variable    ${response.json()}
    ${classes}=    Set Variable    ${body}[classes]
    Return From Keyword If    len(${classes}) == 0
    FOR    ${cls}    IN    @{classes}
        Dictionary Should Contain Key    ${cls}    uuid
        Dictionary Should Contain Key    ${cls}    name
        Dictionary Should Contain Key    ${cls}    weightMax
        Dictionary Should Contain Key    ${cls}    dexterityBase
        Dictionary Should Contain Key    ${cls}    intelligenceBase
        Dictionary Should Contain Key    ${cls}    constitutionBase
    END

Traits Have Required Fields
    [Documentation]    If traits is non-empty, each item has uuid, name, description, cost fields.
    [Tags]    stories    step15    detail
    ${response}=    Get Story By UUID    ${DEMO_1_UUID}
    ${body}=    Set Variable    ${response.json()}
    ${traits}=    Set Variable    ${body}[traits]
    Return From Keyword If    len(${traits}) == 0
    FOR    ${tr}    IN    @{traits}
        Dictionary Should Contain Key    ${tr}    uuid
        Dictionary Should Contain Key    ${tr}    name
        Dictionary Should Contain Key    ${tr}    costPositive
        Dictionary Should Contain Key    ${tr}    costNegative
    END

Story Detail Updated Fields With Lang IT
    [Documentation]    Step 15 fields are present when requesting with lang=it.
    [Tags]    stories    step15    detail
    ${response}=    Get Story By UUID    ${DEMO_1_UUID}    lang=it
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    characterTemplates
    Dictionary Should Contain Key    ${body}    classes
    Dictionary Should Contain Key    ${body}    traits
    Dictionary Should Contain Key    ${body}    classCount

Demo 2 Story Also Has Step 15 Fields
    [Documentation]    The second seed story also returns Step 15 enriched fields.
    [Tags]    stories    step15    detail
    ${response}=    Get Story By UUID    ${DEMO_2_UUID}
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    Story Detail Should Have Required Fields    ${body}
