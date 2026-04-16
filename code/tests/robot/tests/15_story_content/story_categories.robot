*** Settings ***
# ---------------------------------------------------------------------------
# story_categories.robot — tests for GET /api/stories/categories
#                           and GET /api/stories/category/{category}.
#
# Tags: stories, step15, categories
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/stories.resource

Suite Setup    Create Public Session


*** Test Cases ***

Categories Endpoint Returns 200
    [Documentation]    GET /api/stories/categories returns HTTP 200.
    [Tags]    stories    step15    categories
    ${response}=    Get Story Categories
    Status Should Be    ${response}    200

Categories Response Is A List
    [Documentation]    The response body is a JSON array of strings.
    [Tags]    stories    step15    categories
    ${response}=    Get Story Categories
    ${body}=    Set Variable    ${response.json()}
    ${type}=    Evaluate    type(${body}).__name__
    Should Be Equal    ${type}    list

Categories List Is Not Empty
    [Documentation]    At least one category exists from seed data.
    [Tags]    stories    step15    categories
    ${response}=    Get Story Categories
    List Response Should Not Be Empty    ${response}

Categories Are Strings
    [Documentation]    Every category in the list is a non-empty string.
    [Tags]    stories    step15    categories
    ${response}=    Get Story Categories
    ${body}=    Set Variable    ${response.json()}
    FOR    ${cat}    IN    @{body}
        Should Be True    isinstance($cat, str) and len($cat) > 0
    END

Stories By Category Returns 200
    [Documentation]    GET /api/stories/category/{first_category} returns HTTP 200.
    [Tags]    stories    step15    categories
    ${cat_resp}=    Get Story Categories
    ${cats}=    Set Variable    ${cat_resp.json()}
    ${first_cat}=    Set Variable    ${cats}[0]
    ${response}=    Get Stories By Category    ${first_cat}
    Status Should Be    ${response}    200

Stories By Category Response Is A List
    [Documentation]    The response body is a JSON array.
    [Tags]    stories    step15    categories
    ${cat_resp}=    Get Story Categories
    ${first_cat}=    Set Variable    ${cat_resp.json()}[0]
    ${response}=    Get Stories By Category    ${first_cat}
    ${body}=    Set Variable    ${response.json()}
    ${type}=    Evaluate    type(${body}).__name__
    Should Be Equal    ${type}    list

Stories By Category Have Required Summary Fields
    [Documentation]    Each story in the category result has all StorySummaryResponse fields.
    [Tags]    stories    step15    categories
    ${cat_resp}=    Get Story Categories
    ${first_cat}=    Set Variable    ${cat_resp.json()}[0]
    ${response}=    Get Stories By Category    ${first_cat}
    ${body}=    Set Variable    ${response.json()}
    FOR    ${item}    IN    @{body}
        Story Summary Should Have Required Fields    ${item}
    END

Stories By Category Match Requested Category
    [Documentation]    Every returned story has the category matching the request.
    [Tags]    stories    step15    categories
    ${cat_resp}=    Get Story Categories
    ${first_cat}=    Set Variable    ${cat_resp.json()}[0]
    ${response}=    Get Stories By Category    ${first_cat}
    ${body}=    Set Variable    ${response.json()}
    FOR    ${item}    IN    @{body}
        Should Be Equal As Strings    ${item}[category]    ${first_cat}
    END

Stories By Unknown Category Returns Empty List
    [Documentation]    Requesting stories for a non-existing category returns empty list.
    [Tags]    stories    step15    categories
    ${response}=    Get Stories By Category    __nonexistent_category_42__
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    Should Be Empty    ${body}

Stories By Category Lang Param Works
    [Documentation]    Both lang=en and lang=it return 200.
    [Tags]    stories    step15    categories
    ${cat_resp}=    Get Story Categories
    ${first_cat}=    Set Variable    ${cat_resp.json()}[0]
    ${resp_en}=    Get Stories By Category    ${first_cat}    lang=en
    ${resp_it}=    Get Stories By Category    ${first_cat}    lang=it
    Status Should Be    ${resp_en}    200
    Status Should Be    ${resp_it}    200

Categories Accessible Without Auth
    [Documentation]    The categories endpoint is public — no Bearer token required.
    [Tags]    stories    step15    categories
    ${response}=    Get Story Categories
    Status Should Be    ${response}    200
