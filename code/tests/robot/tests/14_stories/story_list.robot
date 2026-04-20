*** Settings ***
# ---------------------------------------------------------------------------
# story_list.robot — tests for GET /api/stories (public story listing).
#
# Seed data present in dev DB (R__insert_story_seed_data.sql):
#   - The Tutorial   uuid: a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d  (PUBLIC)
#   - Demo 1     uuid: b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e  (PUBLIC)
#
# Tags: stories, step14
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/stories.resource

Suite Setup    Create Public Session


*** Test Cases ***

Public Stories Endpoint Returns 200
    [Documentation]    GET /api/stories?lang=en returns HTTP 200.
    [Tags]    stories    step14
    ${response}=    Get Public Stories
    Status Should Be    ${response}    200

Public Stories Response Is A List
    [Documentation]    The response body is a JSON array (not an object).
    [Tags]    stories    step14
    ${response}=    Get Public Stories
    ${body}=    Set Variable    ${response.json()}
    ${type}=    Evaluate    type(${body}).__name__
    Should Be Equal    ${type}    list

Public Stories List Is Not Empty
    [Documentation]    The list contains at least one story (Tutorial seed data is present).
    [Tags]    stories    step14
    ${response}=    Get Public Stories
    List Response Should Not Be Empty    ${response}

Public Stories Items Have UUID Field
    [Documentation]    Every item in the list must have a 'uuid' field.
    [Tags]    stories    step14
    ${response}=    Get Public Stories
    List Item Should Contain Field    ${response}    uuid

Public Stories Items Have Required Summary Fields
    [Documentation]    Every item must pass all StorySummaryResponse field checks.
    [Tags]    stories    step14
    ${response}=    Get Public Stories
    ${body}=    Set Variable    ${response.json()}
    FOR    ${item}    IN    @{body}
        Story Summary Should Have Required Fields    ${item}
    END

Tutorial Story Is In Public List
    [Documentation]    The seed Tutorial story UUID appears in the public list.
    [Tags]    stories    step14
    ${response}=    Get Public Stories
    ${body}=    Set Variable    ${response.json()}
    ${uuids}=    Evaluate    [s['uuid'] for s in ${body}]
    Should Contain    ${uuids}    ${DEMO_1_UUID}
    ...    msg=Tutorial story not found in public list

Demo 1 Story Is In Public List
    [Documentation]    The seed Demo 1 story UUID appears in the public list.
    [Tags]    stories    step14
    ${response}=    Get Public Stories
    ${body}=    Set Variable    ${response.json()}
    ${uuids}=    Evaluate    [s['uuid'] for s in ${body}]
    Should Contain    ${uuids}    ${DEMO_2_UUID}
    ...    msg=Demo 1 story not found in public list

Lang Param Is Accepted
    [Documentation]    Both lang=en and lang=it return 200 without errors.
    [Tags]    stories    step14
    ${resp_en}=    Get Public Stories    lang=en
    ${resp_it}=    Get Public Stories    lang=it
    Status Should Be    ${resp_en}    200
    Status Should Be    ${resp_it}    200

Stories Have difficultyCount Field
    [Documentation]    Each story summary has the difficultyCount integer field (v0.14 addition).
    [Tags]    stories    step14
    ${response}=    Get Public Stories
    ${body}=    Set Variable    ${response.json()}
    FOR    ${item}    IN    @{body}
        Dictionary Should Contain Key    ${item}    difficultyCount
    END

Stories Have Card Field
    [Documentation]    Each story summary has the card field (may be null or an object).
    [Tags]    stories    step14
    ${response}=    Get Public Stories
    ${body}=    Set Variable    ${response.json()}
    FOR    ${item}    IN    @{body}
        Dictionary Should Contain Key    ${item}    card
    END
