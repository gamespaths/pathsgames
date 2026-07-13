*** Settings ***
# ---------------------------------------------------------------------------
# match_info_lang.robot — language propagation on match info.
#
# Endpoint under test (player, Bearer access token from /api/auth/guest):
#   GET /api/match/{uuidMatch}/info?lang={lang}  → 200 MatchInfo
#
# The `?lang=` query parameter selects the language used to resolve EVERY card
# text in the payload — the active location card, its neighbor cards and its
# event cards (e.g. the END_GAME "Complete the story" event). Before this fix
# the endpoint ignored the language and always returned English, so the story
# card and the end-game card stayed in English while class/difficulty cards
# (loaded from the lang-aware /api/stories/{uuid}) were translated.
#
# Verified here, backend- and seed-agnostic (does not assume any specific
# location/card has an Italian translation, only that the plumbing + fallback
# behave correctly):
#   * `?lang=it` is accepted and returns the same STRUCTURE as English
#     (language changes text only, never the shape of the board);
#   * omitting `lang` is equivalent to `lang=en` (English is the default);
#   * a blank or unknown language falls back to English (never empty / error).
#
# Backend-agnostic: runs against any backend implementing the shared contract.
#
# Tags: match-info, lang, i18n
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource

Suite Setup    Suite Setup Match Info Lang


*** Test Cases ***

Match Info Accepts The Lang Query Parameter
    [Documentation]    GET /info?lang=it returns 200 with a well-formed locationsActive block;
    ...                the language parameter must never break the payload.
    [Tags]    match-info    lang    i18n
    ${match}=    New Match With Character
    Start Match    ${TOKEN}    ${match}    200
    ${response}=    Get Match Info    ${TOKEN}    ${match}    200    lang=it
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    locationsActive
    ${is_list}=    Evaluate    isinstance($body['locationsActive'], list)
    Should Be True    ${is_list}    msg=locationsActive must be a list
    Should Not Be Empty    ${body}[locationsActive]
    ${active}=    Set Variable    ${body}[locationsActive][0]
    Dictionary Should Contain Key    ${active}    card
    ...    msg=the active location must carry a card resolved in the requested language

Omitting Lang Defaults To English
    [Documentation]    A request without `lang` resolves card texts identically to `lang=en`.
    [Tags]    match-info    lang    i18n    default
    ${match}=    New Match With Character
    Start Match    ${TOKEN}    ${match}    200
    ${default}=    Get Match Info    ${TOKEN}    ${match}    200
    ${english}=    Get Match Info    ${TOKEN}    ${match}    200    lang=en
    ${default_title}=    Active Card Title    ${default.json()}
    ${english_title}=    Active Card Title    ${english.json()}
    Should Be Equal    ${default_title}    ${english_title}
    ...    msg=no `lang` must behave like `lang=en`

Blank Lang Falls Back To English
    [Documentation]    An empty `lang=` value falls back to English rather than returning
    ...                an empty or missing card title.
    [Tags]    match-info    lang    i18n    fallback
    ${match}=    New Match With Character
    Start Match    ${TOKEN}    ${match}    200
    ${english}=    Get Match Info    ${TOKEN}    ${match}    200    lang=en
    ${blank}=    Get Match Info    ${TOKEN}    ${match}    200    lang=${EMPTY}
    ${english_title}=    Active Card Title    ${english.json()}
    ${blank_title}=    Active Card Title    ${blank.json()}
    Should Be Equal    ${blank_title}    ${english_title}
    ...    msg=blank `lang=` must fall back to English

Unknown Lang Falls Back To English
    [Documentation]    An unsupported language code (no translations seeded) falls back to the
    ...                English text rather than returning an error or a different value.
    [Tags]    match-info    lang    i18n    fallback
    ${match}=    New Match With Character
    Start Match    ${TOKEN}    ${match}    200
    ${english}=    Get Match Info    ${TOKEN}    ${match}    200    lang=en
    ${unknown}=    Get Match Info    ${TOKEN}    ${match}    200    lang=zz
    ${english_title}=    Active Card Title    ${english.json()}
    ${unknown_title}=    Active Card Title    ${unknown.json()}
    Should Be Equal    ${unknown_title}    ${english_title}
    ...    msg=unknown `lang` must fall back to English

Language Changes Text Only Not Board Structure
    [Documentation]    The English and Italian payloads describe the SAME board: same active
    ...                location, same neighbor count and same event count. Only card text may
    ...                differ — the structure must be language-independent.
    [Tags]    match-info    lang    i18n    structure
    ${match}=    New Match With Character
    Start Match    ${TOKEN}    ${match}    200
    ${en}=    Get Match Info    ${TOKEN}    ${match}    200    lang=en
    ${it}=    Get Match Info    ${TOKEN}    ${match}    200    lang=it
    ${en_body}=    Set Variable    ${en.json()}
    ${it_body}=    Set Variable    ${it.json()}
    Should Be Equal    ${en_body}[currentLocationId]    ${it_body}[currentLocationId]
    ...    msg=the current location must not depend on the language
    ${en_active}=    Set Variable    ${en_body}[locationsActive][0]
    ${it_active}=    Set Variable    ${it_body}[locationsActive][0]
    Should Be Equal    ${en_active}[idLocation]    ${it_active}[idLocation]
    ${en_neighbors}=    Get Length    ${en_active}[neighbors]
    ${it_neighbors}=    Get Length    ${it_active}[neighbors]
    Should Be Equal As Integers    ${en_neighbors}    ${it_neighbors}
    ...    msg=neighbor count must be language-independent
    ${en_events}=    Get Length    ${en_active}[events]
    ${it_events}=    Get Length    ${it_active}[events]
    Should Be Equal As Integers    ${en_events}    ${it_events}
    ...    msg=event count must be language-independent


Story List Lang IT Never Blanks A Title That English Has
    [Documentation]    Regression for the AWS i18n bug: GET /api/stories?lang=it must NOT return a
    ...                null/empty `title` for a story that has a title under `lang=en`. The bug
    ...                read the title from a derived per-language map that could miss `it` even
    ...                when the Italian text existed in the raw rows, yielding a null title; the
    ...                fix resolves the title from the raw texts (idTextTitle + lang) with English
    ...                fallback, so a story with an English title always has an Italian one too
    ...                (translated when available, English fallback otherwise).
    ...
    ...                Backend- and seed-agnostic and order-independent: it only requires the
    ...                per-language consistency (it ⊇ en), never that any specific story carries
    ...                a title, so it survives the CRUD mutations of earlier suites.
    [Tags]    stories    lang    i18n    regression
    ${en}=    Get Public Stories    lang=en
    ${it}=    Get Public Stories    lang=it
    Status Should Be    ${en}    200
    Status Should Be    ${it}    200
    ${it_titles}=    Build Title Map By Uuid    ${it.json()}
    FOR    ${story}    IN    @{en.json()}
        ${en_title}=    Get From Dictionary    ${story}    title    default=${None}
        IF    $en_title is not None and $en_title != ''
            ${it_title}=    Get From Dictionary    ${it_titles}    ${story}[uuid]    default=${None}
            Should Not Be Equal    ${it_title}    ${None}
            ...    msg=story ${story}[uuid] has an English title but a null Italian title
            Should Not Be Empty    ${it_title}
            ...    msg=story ${story}[uuid] has an English title but an empty Italian title
        END
    END


*** Keywords ***

Build Title Map By Uuid
    [Documentation]    Returns a dict {uuid: title} from a list of story summaries.
    [Arguments]    ${stories}
    ${map}=    Create Dictionary
    FOR    ${story}    IN    @{stories}
        ${title}=    Get From Dictionary    ${story}    title    default=${None}
        Set To Dictionary    ${map}    ${story}[uuid]    ${title}
    END
    RETURN    ${map}

Suite Setup Match Info Lang
    [Documentation]    Guest login + resolve a joinable loadout from a public story.
    Create Public Session
    ${response}=    POST On Session    public_session    /api/auth/guest
    Status Should Be    ${response}    201
    Set Suite Variable    ${TOKEN}    ${response.json()}[accessToken]
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}        ${story}
    Set Suite Variable    ${DIFFICULTY_UUID}   ${difficulty}
    Set Suite Variable    ${CHARACTER_UUID}    ${character}
    Set Suite Variable    ${CLASS_UUID}        ${class}
    Set Suite Variable    ${TRAIT_UUID}        ${trait}

New Match With Character
    [Documentation]    Creates a CREATED match and joins one character; returns the match uuid.
    ${match}=    Create Match    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}    robottest_lang
    Status Should Be    ${match}    201
    ${match_uuid}=    Set Variable    ${match.json()}[uuid]
    ${trait_list}=    Create List
    IF    '${TRAIT_UUID}' != ''
        Append To List    ${trait_list}    ${TRAIT_UUID}
    END
    ${join}=    Join Match    ${TOKEN}    ${match_uuid}    ${CHARACTER_UUID}    ${CLASS_UUID}    ${trait_list}
    Status Should Be    ${join}    201
    RETURN    ${match_uuid}

Active Card Title
    [Documentation]    Returns the title of the first active location's card, or '' when absent.
    [Arguments]    ${body}
    ${active}=    Set Variable    ${body}[locationsActive][0]
    ${card}=    Set Variable    ${active}[card]
    IF    $card is None
        RETURN    ${EMPTY}
    END
    ${title}=    Get From Dictionary    ${card}    title    default=${EMPTY}
    IF    $title is None
        RETURN    ${EMPTY}
    END
    RETURN    ${title}
