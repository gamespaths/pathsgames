*** Settings ***
# ---------------------------------------------------------------------------
# story_card_populated.robot — Regression tests for card resolution from
#                               raw_cards / raw_texts (inline on the story item).
#
# These tests guard against the bug where _build_card looked up CARD#{id} as
# a separate DynamoDB item (which never exists): cards are stored inline in
# raw_cards during import, not as independent items.
#
# Affected endpoints:
#   GET /api/stories          → StorySummaryResponse[].card
#   GET /api/stories/{uuid}   → StoryDetailResponse.card (story-level)
#
# Tags: stories, step15, card, regression
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/stories.resource

Suite Setup    Create Public Session


*** Test Cases ***

Story Detail Card Is Not Null
    [Documentation]    GET /api/stories/{uuid} returns a non-null card object when the
    ...                story has an idCard set. Regression: was always null because
    ...                _build_card looked up CARD#{id} as a separate DynamoDB item.
    [Tags]    stories    step15    card    regression
    ${response}=    Get Story By UUID    ${DEMO_1_UUID}
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    card
    Should Not Be Equal    ${body}[card]    ${None}

Story Detail Card Has Required Fields
    [Documentation]    The card object in StoryDetailResponse contains uuid, urlImage,
    ...                awesomeIcon, styleMain, styleDetail, title, description.
    [Tags]    stories    step15    card    regression
    ${response}=    Get Story By UUID    ${DEMO_1_UUID}
    ${card}=    Set Variable    ${response.json()}[card]
    Dictionary Should Contain Key    ${card}    uuid
    Dictionary Should Contain Key    ${card}    urlImage
    Dictionary Should Contain Key    ${card}    alternativeImage
    Dictionary Should Contain Key    ${card}    awesomeIcon
    Dictionary Should Contain Key    ${card}    styleMain
    Dictionary Should Contain Key    ${card}    styleDetail
    Dictionary Should Contain Key    ${card}    title
    Dictionary Should Contain Key    ${card}    description
    Dictionary Should Contain Key    ${card}    linkCopyright

Story Detail Card UrlImage Is Not Empty
    [Documentation]    The UrlImage field inside card is a non-empty string.
    ...                This is the specific field that was missing in react-admin / DynamoDB view.
    [Tags]    stories    step15    card    regression
    ${response}=    Get Story By UUID    ${DEMO_1_UUID}
    ${card}=    Set Variable    ${response.json()}[card]
    Should Not Be Equal    ${card}[urlImage]    ${None}
    Should Not Be Empty    ${card}[urlImage]

Story Detail Card UUID Is Not Empty
    [Documentation]    The card uuid is a non-empty string (set during import).
    [Tags]    stories    step15    card    regression
    ${response}=    Get Story By UUID    ${DEMO_1_UUID}
    ${card}=    Set Variable    ${response.json()}[card]
    Should Not Be Equal    ${card}[uuid]    ${None}
    Should Not Be Empty    ${card}[uuid]

Story Detail Card Title Resolved For Lang IT
    [Documentation]    The card title is resolved from raw_texts when lang=it is requested.
    ...                Confirms that _resolve_raw_text walks the raw_texts list correctly.
    [Tags]    stories    step15    card    regression
    ${response}=    Get Story By UUID    ${DEMO_1_UUID}    lang=it
    Status Should Be    ${response}    200
    ${card}=    Set Variable    ${response.json()}[card]
    Should Not Be Equal    ${card}    ${None}
    Should Not Be Equal    ${card}[title]    ${None}
    Should Not Be Empty    ${card}[title]

Story Summary Card Is Not Null
    [Documentation]    GET /api/stories/{DEMO_1_UUID} in summary list has non-null card
    ...                (DEMO_1 seed has idCard=1 pointing to raw_cards[0]).
    [Tags]    stories    step15    card    regression
    ${response}=    Get Public Stories
    Status Should Be    ${response}    200
    ${items}=    Set Variable    ${response.json()}
    ${demo1}=    Set Variable    ${None}
    FOR    ${item}    IN    @{items}
        IF    '${item}[uuid]' == '${DEMO_1_UUID}'
            ${demo1}=    Set Variable    ${item}
        END
    END
    Should Not Be Equal    ${demo1}    ${None}    msg=DEMO_1 not found in story list
    Should Not Be Equal    ${demo1}[card]    ${None}
    ...    msg=Expected DEMO_1 card to be non-null (seed has idCard=1)

Story Summary Card UrlImage Not Empty When Card Present
    [Documentation]    In the story list, any non-null card object must have a non-empty urlImage.
    [Tags]    stories    step15    card    regression
    ${response}=    Get Public Stories
    ${items}=    Set Variable    ${response.json()}
    FOR    ${item}    IN    @{items}
        ${card}=    Set Variable    ${item}[card]
        IF    $card is not None
            Should Not Be Equal    ${card}[urlImage]    ${None}
            Should Not Be Empty    ${card}[urlImage]
        END
    END

Demo 2 Story Card Field Present
    [Documentation]    The second seed story also exposes a card field (even if null).
    [Tags]    stories    step15    card    regression
    ${response}=    Get Story By UUID    ${DEMO_2_UUID}
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    card
