*** Settings ***
# ---------------------------------------------------------------------------
# import_integrity.robot — v0.35.8 import, schema and admin-CRUD regressions.
#
# Every case here failed against a real PostgreSQL deployment while passing on a
# local SQLite one, or imported "successfully" and silently dropped what it was
# given. They are grouped in one suite because they share one fixture: a story
# authored to carry, all at once, every reference and value that used to break.
#
#   story_import_integrity.json
#     · a shortText of 608 characters   → list_texts.short_text was VARCHAR(500)
#     · event 5 → idEventNext 6         → a reference to a row imported LATER
#     · event 5 → idItemToAdd 2         → items are imported after events
#     · event 5 → idWeather 1           → weather rules must go in FIRST
#     · weather rule 1 → idEvent 6      → and the cycle closes back onto events
#     · location 1 → four idEventIf*    → trigger events, imported after it
#     · location 2 → the pre-V0.33.2 idEventIfCharacterEnterFirstTime spelling
#     · eventEffect 1 → idWeather ""    → an empty string in a numeric column
#     · a top-level locationNeighbors[] → the canonical array, with its prices
#     · item 2 declares no flags        → the schema default decides
#     · item 3 declares them false      → what is authored always wins
#
# Endpoints under test:
#   POST   /api/admin/stories/import
#   GET    /api/admin/stories/{uuid}/{entityType}
#   PUT    /api/admin/stories/{uuid}/{entityType}/{entityUuid}
#   DELETE /api/admin/stories/{uuid}
#
# Backend-agnostic. A SQL backend answers with the column (0/1 for the flags,
# the schema default where the story declared nothing); AWS answers with the
# attribute as authored, and omits what was never authored. Both readings are
# accepted wherever they differ — what is asserted is the MEANING.
#
# The suite owns its story: it imports it in Suite Setup and the last test
# deletes it (the teardown repeats the delete, harmlessly, if a case aborts).
#
# Tags: admin, import, schema, step14, step17, v0358
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    OperatingSystem
Library    Collections
Library    String
Library    ../../resources/JwtHelper.py
Resource   ../../resources/common.resource
Resource   ../../resources/stories.resource

Suite Setup       Initialize Import Integrity Suite
Suite Teardown    Run Keyword And Ignore Error    Delete Admin Story    ${STORY_UUID}


*** Variables ***
${STORY_UUID}      f0350008-0000-4000-8000-000000000358
${STORY_FILE}      ${CURDIR}/story_import_integrity.json
${LONG_TEXT_ID}    ${2}


*** Keywords ***

Initialize Import Integrity Suite
    [Documentation]    Opens the admin session and imports the fixture story. A leftover
    ...                from an aborted run is removed first, so the suite is re-runnable.
    Create Session    admin_session    ${ADMIN_BASE_URL}    verify=false
    ${token}=    Generate Admin Token
    Set Suite Variable    ${ADMIN_TOKEN}    ${token}
    Run Keyword And Ignore Error    Delete Admin Story    ${STORY_UUID}
    ${response}=    Import Story From File    ${STORY_FILE}
    Should Be Equal As Integers    ${response.status_code}    201
    ...    msg=The fixture story must import cleanly — everything else reads what it wrote

Entity With Id
    [Documentation]    The entity of that type carrying that story-local id. Fails with the
    ...                ids actually returned, which is what one needs when it is missing.
    [Arguments]    ${entity_type}    ${id}
    ${response}=    List Admin Entities    ${STORY_UUID}    ${entity_type}
    Should Be Equal As Integers    ${response.status_code}    200
    ${rows}=    Set Variable    ${response.json()}
    FOR    ${row}    IN    @{rows}
        ${row_id}=    Get From Dictionary    ${row}    id    ${None}
        IF    "${row_id}" == "${id}"    RETURN    ${row}
    END
    ${ids}=    Evaluate    [r.get('id') for r in $rows]
    Fail    No ${entity_type} with id ${id} — the story has ${ids}

Value Of
    [Documentation]    A field of an entity, or ${None} when the backend does not carry it.
    ...                AWS omits an attribute that was never authored; a SQL backend always
    ...                answers with the column.
    [Arguments]    ${entity}    ${field}
    ${value}=    Get From Dictionary    ${entity}    ${field}    ${None}
    RETURN    ${value}

Should Read As Set
    [Documentation]    Asserts a flag column reads as SET: 1 or true. An absent attribute is
    ...                a set flag too — the shared schema defaults both flags to 1, so a
    ...                story that never authored one still means "yes" on every backend.
    [Arguments]    ${value}    ${what}
    ${set}=    Evaluate    $value is None or $value is True or str($value) in ('1', 'True')
    Should Be True    ${set}    msg=${what} should read as set, got ${value}

Should Read As Clear
    [Documentation]    Asserts a flag column reads as CLEAR: 0 or false, never absent — the
    ...                story authored it, so it must have survived the import.
    [Arguments]    ${value}    ${what}
    ${clear}=    Evaluate    $value is False or str($value) in ('0', 'False')
    Should Be True    ${clear}    msg=${what} should read as clear, got ${value}


*** Test Cases ***

A Short Text Longer Than Five Hundred Characters Survives The Import
    [Documentation]    list_texts.short_text was VARCHAR(500) on PostgreSQL: a longer text
    ...                killed the whole import ("value too long for type character
    ...                varying(500)"), while SQLite — where it is TEXT — never noticed.
    ...                V0.35.8 widened it to 2000.
    [Tags]    admin    import    schema    v0358
    ${response}=    List Admin Entities    ${STORY_UUID}    texts
    Should Be Equal As Integers    ${response.status_code}    200
    ${matching}=    Evaluate
    ...    [t for t in $response.json() if str(t.get('idText')) == '${LONG_TEXT_ID}']
    Should Not Be Empty    ${matching}    msg=The long text did not survive the import
    ${short}=    Set Variable    ${matching}[0][shortText]
    ${length}=    Get Length    ${short}
    Should Be True    ${length} > 500
    ...    msg=The text came back truncated to ${length} characters

An Event Chained To A Later Event Keeps Its Next Event
    [Documentation]    list_events.id_event_next points INTO the same table, at a row
    ...                imported after it. Written on the first insert it breaks the foreign
    ...                key; v0.35.8 writes it in a second pass, once both events exist.
    [Tags]    admin    import    v0358
    ${event}=    Entity With Id    events    5
    ${next}=    Value Of    ${event}    idEventNext
    Should Be Equal As Integers    ${next}    6

An Event Handing Over An Item Keeps Its Item
    [Documentation]    list_events.id_item_to_add references list_items, which the import
    ...                writes AFTER the events. The Python import never mapped the field at
    ...                all, so the event handed over nothing.
    [Tags]    admin    import    v0358
    ${event}=    Entity With Id    events    5
    ${item}=    Value Of    ${event}    idItemToAdd
    Should Be Equal As Integers    ${item}    2

An Event Gated On Weather Keeps Its Rule
    [Documentation]    list_events.id_weather references list_weather_rules. The rules used
    ...                to be imported after the events, so a weather-gated event was
    ...                rejected outright by PostgreSQL.
    [Tags]    admin    import    v0358
    ${event}=    Entity With Id    events    5
    ${weather}=    Value Of    ${event}    idWeather
    Should Be Equal As Integers    ${weather}    1

A Location Keeps The Events It Fires By Itself
    [Documentation]    The four id_event_if_* columns of a location point at events imported
    ...                after it. They were never written at all, so an imported story lost
    ...                every automatic event: the counter fuse, the start-of-time trigger
    ...                and both first-visit ones.
    [Tags]    admin    import    v0358
    ${location}=    Entity With Id    locations    1
    ${counter}=      Value Of    ${location}    idEventIfCounterZero
    ${start_time}=   Value Of    ${location}    idEventIfCharacterStartTime
    ${not_first}=    Value Of    ${location}    idEventNotFirstTime
    ${first_time}=   Value Of    ${location}    idEventIfFirstTime
    Should Be Equal As Integers    ${counter}       10
    Should Be Equal As Integers    ${start_time}    11
    Should Be Equal As Integers    ${not_first}     12
    Should Be Equal As Integers    ${first_time}    13

The Pre V0332 Enter Key Still Names Its Trigger
    [Documentation]    V0.33.2 renamed id_event_if_character_enter_first_time to
    ...                id_event_if_character_enter_empty_location. A story exported before
    ...                that carries the old key — the import accepts both. AWS keeps the
    ...                authored spelling, a SQL backend answers with the renamed column, so
    ...                either key satisfies this.
    [Tags]    admin    import    v0358
    ${location}=    Entity With Id    locations    2
    ${renamed}=    Value Of    ${location}    idEventIfCharacterEnterEmptyLocation
    ${legacy}=     Value Of    ${location}    idEventIfCharacterEnterFirstTime
    ${named}=    Evaluate    [v for v in ($renamed, $legacy) if v is not None]
    Should Not Be Empty    ${named}
    ...    msg=Neither the renamed column nor the legacy key carries the trigger event
    Should Be Equal As Integers    ${named}[0]    14

A Weather Rule Keeps Its Label Its Hours And Its Event
    [Documentation]    idText (the rule's own label), timeFrom and timeTo were read from
    ...                keys the JSON never uses, so they were dropped in silence — the
    ...                weather went in nameless. idEvent closes the cycle with the events
    ...                and is written in the second pass.
    [Tags]    admin    import    v0358
    ${rule}=    Entity With Id    weather-rules    1
    ${id_text}=     Value Of    ${rule}    idText
    ${time_from}=   Value Of    ${rule}    timeFrom
    ${time_to}=     Value Of    ${rule}    timeTo
    ${id_event}=    Value Of    ${rule}    idEvent
    Should Be Equal As Integers    ${id_text}      3
    Should Be Equal As Integers    ${time_from}    6
    Should Be Equal As Integers    ${time_to}      20
    Should Be Equal As Integers    ${id_event}     6

An Empty String In A Numeric Field Does Not Break The Import
    [Documentation]    The admin form writes "" for a numeric field left empty, and stories
    ...                carry it. PostgreSQL refuses it outright ("invalid input syntax for
    ...                type integer"), taking the whole import down with it; the value must
    ...                be read as "not authored".
    [Tags]    admin    import    schema    v0358
    ${effect}=    Entity With Id    event-effects    1
    ${weather}=    Value Of    ${effect}    idWeather
    ${empty}=    Evaluate    $weather is None or str($weather).strip() == ''
    Should Be True    ${empty}    msg=Expected no weather on the effect, got ${weather}
    ${owner}=    Value Of    ${effect}    idEvent
    Should Be Equal As Integers    ${owner}    5

The Top Level Location Neighbors Array Is Imported
    [Documentation]    The canonical contract puts the edges in a top-level
    ...                locationNeighbors[]. The Python import read only the nested
    ...                location.neighbors form, so an imported story kept its locations and
    ...                lost every movement between them.
    [Tags]    admin    import    v0358
    ${edge}=    Entity With Id    location-neighbors    1
    ${from}=    Value Of    ${edge}    idLocationFrom
    ${to}=      Value Of    ${edge}    idLocationTo
    Should Be Equal As Integers    ${from}    1
    Should Be Equal As Integers    ${to}      2
    Should Be Equal As Strings    ${edge}[direction]    NORTH

An Edge Keeps Its Resource Price And Its Labels
    [Documentation]    The three edge-only costs and the two direction labels: half the
    ...                fields were not mapped, so a priced road imported as a free one and
    ...                a named passage lost its name.
    [Tags]    admin    import    v0358
    ${edge}=    Entity With Id    location-neighbors    1
    ${food}=     Value Of    ${edge}    costFood
    ${magic}=    Value Of    ${edge}    costMagic
    ${coin}=     Value Of    ${edge}    costCoin
    ${go}=       Value Of    ${edge}    idTextGo
    ${back}=     Value Of    ${edge}    idTextBack
    ${card_back}=    Value Of    ${edge}    idCardBack
    Should Be Equal As Integers    ${food}     2
    Should Be Equal As Integers    ${magic}    3
    Should Be Equal As Integers    ${coin}     4
    Should Be Equal As Integers    ${go}       4
    Should Be Equal As Integers    ${back}     5
    Should Be Equal As Integers    ${card_back}    2

An Item Declaring Nothing Takes The Schema Default
    [Documentation]    is_consumabile is NOT NULL DEFAULT 1 and the weight defaults to 1:
    ...                an item that declares neither is consumable and weighs something, on
    ...                every backend. AWS used to read the absence as a refusal, and the
    ...                Python import forced the weight to 0.
    [Tags]    admin    import    v0358
    ${item}=    Entity With Id    items    2
    ${consumable}=    Value Of    ${item}    isConsumabile
    ${effects}=       Value Of    ${item}    flagShowEffects
    Should Read As Set    ${consumable}    isConsumabile of an item that declares none
    Should Read As Set    ${effects}       flagShowEffects of an item that declares none

An Item Declaring The Flags False Keeps Them False
    [Documentation]    What the story authors always wins over the default — and a falsy
    ...                value must survive both the import and the export that reads it back.
    [Tags]    admin    import    v0358
    ${item}=    Entity With Id    items    3
    ${consumable}=    Value Of    ${item}    isConsumabile
    ${effects}=       Value Of    ${item}    flagShowEffects
    Should Read As Clear    ${consumable}    the authored isConsumabile false
    Should Read As Clear    ${effects}       the authored flagShowEffects false
    ${weight}=    Value Of    ${item}    weight
    Should Be Equal As Integers    ${weight}    2

Updating An Item With JSON Booleans Sticks
    [Documentation]    The admin form PUTs real JSON booleans. The insert path coerced them
    ...                to the integer the column is declared with; the update path set them
    ...                raw, and PostgreSQL refused ("column is_consumabile is of type
    ...                integer but expression is of type boolean").
    [Tags]    admin    crud    v0358
    ${item}=    Entity With Id    items    2
    &{body}=    Create Dictionary    isConsumabile=${False}    flagShowEffects=${False}
    ${response}=    Update Admin Entity    ${STORY_UUID}    items    ${item}[uuid]    ${body}
    Should Be Equal As Integers    ${response.status_code}    200
    ${updated}=    Entity With Id    items    2
    ${consumable}=    Value Of    ${updated}    isConsumabile
    ${effects}=       Value Of    ${updated}    flagShowEffects
    Should Read As Clear    ${consumable}    isConsumabile after the update
    Should Read As Clear    ${effects}       flagShowEffects after the update

Deleting The Story Removes It Whole
    [Documentation]    Runs LAST: it takes the fixture down. The story points at its own
    ...                end-game event and start location, and its texts and cards point at
    ...                its creator — so the delete has to clear those columns first and
    ...                remove the creator last, or PostgreSQL refuses it.
    [Tags]    admin    crud    v0358
    ${response}=    Delete Admin Story    ${STORY_UUID}
    Should Be Equal As Integers    ${response.status_code}    200
    ${after}=    Get Admin Story By UUID    ${STORY_UUID}
    Should Be Equal As Integers    ${after.status_code}    404
