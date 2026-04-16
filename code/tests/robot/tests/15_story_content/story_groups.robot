*** Settings ***
# ---------------------------------------------------------------------------
# story_groups.robot — tests for GET /api/stories/groups
#                       and GET /api/stories/group/{group}.
#
# Tags: stories, step15, groups
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/stories.resource

Suite Setup    Create Public Session


*** Test Cases ***

Groups Endpoint Returns 200
    [Documentation]    GET /api/stories/groups returns HTTP 200.
    [Tags]    stories    step15    groups
    ${response}=    Get Story Groups
    Status Should Be    ${response}    200

Groups Response Is A List
    [Documentation]    The response body is a JSON array of strings.
    [Tags]    stories    step15    groups
    ${response}=    Get Story Groups
    ${body}=    Set Variable    ${response.json()}
    ${type}=    Evaluate    type(${body}).__name__
    Should Be Equal    ${type}    list

Groups List Is Not Empty
    [Documentation]    At least one group exists from seed data.
    [Tags]    stories    step15    groups
    ${response}=    Get Story Groups
    List Response Should Not Be Empty    ${response}

Groups Are Strings
    [Documentation]    Every group in the list is a non-empty string.
    [Tags]    stories    step15    groups
    ${response}=    Get Story Groups
    ${body}=    Set Variable    ${response.json()}
    FOR    ${grp}    IN    @{body}
        Should Be True    isinstance($grp, str) and len($grp) > 0
    END

Stories By Group Returns 200
    [Documentation]    GET /api/stories/group/{first_group} returns HTTP 200.
    [Tags]    stories    step15    groups
    ${grp_resp}=    Get Story Groups
    ${grps}=    Set Variable    ${grp_resp.json()}
    ${first_grp}=    Set Variable    ${grps}[0]
    ${response}=    Get Stories By Group    ${first_grp}
    Status Should Be    ${response}    200

Stories By Group Response Is A List
    [Documentation]    The response body is a JSON array.
    [Tags]    stories    step15    groups
    ${grp_resp}=    Get Story Groups
    ${first_grp}=    Set Variable    ${grp_resp.json()}[0]
    ${response}=    Get Stories By Group    ${first_grp}
    ${body}=    Set Variable    ${response.json()}
    ${type}=    Evaluate    type(${body}).__name__
    Should Be Equal    ${type}    list

Stories By Group Have Required Summary Fields
    [Documentation]    Each story in the group result has all StorySummaryResponse fields.
    [Tags]    stories    step15    groups
    ${grp_resp}=    Get Story Groups
    ${first_grp}=    Set Variable    ${grp_resp.json()}[0]
    ${response}=    Get Stories By Group    ${first_grp}
    ${body}=    Set Variable    ${response.json()}
    FOR    ${item}    IN    @{body}
        Story Summary Should Have Required Fields    ${item}
    END

Stories By Group Match Requested Group
    [Documentation]    Every returned story has the group matching the request.
    [Tags]    stories    step15    groups
    ${grp_resp}=    Get Story Groups
    ${first_grp}=    Set Variable    ${grp_resp.json()}[0]
    ${response}=    Get Stories By Group    ${first_grp}
    ${body}=    Set Variable    ${response.json()}
    FOR    ${item}    IN    @{body}
        Should Be Equal As Strings    ${item}[group]    ${first_grp}
    END

Stories By Unknown Group Returns Empty List
    [Documentation]    Requesting stories for a non-existing group returns empty list.
    [Tags]    stories    step15    groups
    ${response}=    Get Stories By Group    __nonexistent_group_42__
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    Should Be Empty    ${body}

Stories By Group Lang Param Works
    [Documentation]    Both lang=en and lang=it return 200.
    [Tags]    stories    step15    groups
    ${grp_resp}=    Get Story Groups
    ${first_grp}=    Set Variable    ${grp_resp.json()}[0]
    ${resp_en}=    Get Stories By Group    ${first_grp}    lang=en
    ${resp_it}=    Get Stories By Group    ${first_grp}    lang=it
    Status Should Be    ${resp_en}    200
    Status Should Be    ${resp_it}    200

Groups Accessible Without Auth
    [Documentation]    The groups endpoint is public — no Bearer token required.
    [Tags]    stories    step15    groups
    ${response}=    Get Story Groups
    Status Should Be    ${response}    200
