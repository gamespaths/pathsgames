*** Settings ***
# ---------------------------------------------------------------------------
# matches.resource — keywords for the Step 19 match endpoints.
#
# Authenticated (Bearer access token issued by /api/auth/guest):
#   POST /api/matches                  → 201, MatchSummary
#   GET  /api/matches                  → 200, MatchSummary[]
#   GET  /api/match/{uuidMatch}/info   → 200 MatchInfo | 404
#
# Admin (Bearer access token with role ADMIN):
#   GET  /api/admin/matches            → 200, MatchSummary[] | 403
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   common.resource
Resource   auth.resource


*** Keywords ***

Create Match
    [Documentation]    POST /api/matches with the given Bearer token and body.
    ...                If the suite variable CF_TURNSTILE_TOKEN is set to a non-empty
    ...                string it is included as turnstileToken (needed when the server
    ...                has a Turnstile key configured, e.g. AWS dev with test key).
    [Arguments]    ${token}    ${story_uuid}    ${difficulty_uuid}
    ...    ${name}=robottest_match    ${expected_status}=any
    ${headers}=    Get Auth Headers    ${token}
    Set To Dictionary    ${headers}    Content-Type=application/json
    &{body}=    Create Dictionary
    ...    storyUuid=${story_uuid}
    ...    difficultyUuid=${difficulty_uuid}
    ...    name=${name}
    ${cf_token}=    Get Variable Value    ${CF_TURNSTILE_TOKEN}    ${EMPTY}
    IF    '${cf_token}' != ''
        Set To Dictionary    ${body}    turnstileToken=${cf_token}
    END
    ${response}=    POST On Session    public_session    /api/matches
    ...    headers=${headers}
    ...    json=${body}
    ...    expected_status=${expected_status}
    RETURN    ${response}

Create Match With Rng Seed
    [Documentation]    POST /api/matches with an explicit rngSeed (Step 27) so weather
    ...                selection is deterministic. Robot always passes 42.
    [Arguments]    ${token}    ${story_uuid}    ${difficulty_uuid}
    ...    ${rng_seed}=42    ${name}=robottest_weather    ${expected_status}=any
    ${headers}=    Get Auth Headers    ${token}
    Set To Dictionary    ${headers}    Content-Type=application/json
    &{body}=    Create Dictionary
    ...    storyUuid=${story_uuid}
    ...    difficultyUuid=${difficulty_uuid}
    ...    name=${name}
    ...    rngSeed=${rng_seed}
    ${cf_token}=    Get Variable Value    ${CF_TURNSTILE_TOKEN}    ${EMPTY}
    IF    '${cf_token}' != ''
        Set To Dictionary    ${body}    turnstileToken=${cf_token}
    END
    ${response}=    POST On Session    public_session    /api/matches
    ...    headers=${headers}
    ...    json=${body}
    ...    expected_status=${expected_status}
    RETURN    ${response}

Get Match Weather
    [Documentation]    GET /api/matches/{uuidMatch}/weather (Step 27) — current weather.
    [Arguments]    ${token}    ${match_uuid}    ${expected_status}=any
    ${headers}=    Get Auth Headers    ${token}
    ${response}=    GET On Session    public_session    /api/matches/${match_uuid}/weather
    ...    headers=${headers}
    ...    expected_status=${expected_status}
    RETURN    ${response}

Get Admin Match Weather
    [Documentation]    GET /api/admin/matches/{uuidMatch}/weather (Step 27) — admin view
    ...                with rng_seed, current weather and log_weather history.
    [Arguments]    ${token}    ${match_uuid}    ${expected_status}=any
    ${headers}=    Get Auth Headers    ${token}
    ${response}=    GET On Session    admin_session    /api/admin/matches/${match_uuid}/weather
    ...    headers=${headers}
    ...    expected_status=${expected_status}
    RETURN    ${response}

Create Match With Loadout
    [Documentation]    POST /api/matches with the full creator loadout —
    ...                character template, class, traits and single-player flag.
    ...                Includes CF_TURNSTILE_TOKEN when set (same logic as Create Match).
    [Arguments]    ${token}    ${story_uuid}    ${difficulty_uuid}
    ...    ${character_uuid}    ${class_uuid}    ${trait_uuids}    ${single_player}
    ...    ${expected_status}=any
    ${headers}=    Get Auth Headers    ${token}
    Set To Dictionary    ${headers}    Content-Type=application/json
    &{body}=    Create Dictionary
    ...    storyUuid=${story_uuid}
    ...    difficultyUuid=${difficulty_uuid}
    ...    name=robottest_loadout_match
    ...    characterTemplateUuid=${character_uuid}
    ...    classUuid=${class_uuid}
    ...    traitUuids=${trait_uuids}
    ...    singlePlayer=${single_player}
    ${cf_token}=    Get Variable Value    ${CF_TURNSTILE_TOKEN}    ${EMPTY}
    IF    '${cf_token}' != ''
        Set To Dictionary    ${body}    turnstileToken=${cf_token}
    END
    ${response}=    POST On Session    public_session    /api/matches
    ...    headers=${headers}
    ...    json=${body}
    ...    expected_status=${expected_status}
    RETURN    ${response}

List Matches
    [Documentation]    GET /api/matches with the given Bearer token.
    [Arguments]    ${token}    ${expected_status}=any
    ${headers}=    Get Auth Headers    ${token}
    ${response}=    GET On Session    public_session    /api/matches
    ...    headers=${headers}
    ...    expected_status=${expected_status}
    RETURN    ${response}

List All Matches
    [Documentation]    GET /api/admin/matches with the given Bearer token (admin-only).
    ...                Served on the admin endpoint (admin_session → ADMIN_BASE_URL).
    [Arguments]    ${token}    ${expected_status}=any
    ${headers}=    Get Auth Headers    ${token}
    ${response}=    GET On Session    admin_session    /api/admin/matches
    ...    headers=${headers}
    ...    expected_status=${expected_status}
    RETURN    ${response}

Get Match Info
    [Documentation]    GET /api/match/{uuidMatch}/info with the given Bearer token.
    ...                When ${lang} is set it is forwarded as the `?lang=` query
    ...                parameter so card texts are resolved in that language.
    [Arguments]    ${token}    ${match_uuid}    ${expected_status}=any    ${lang}=${None}
    ${headers}=    Get Auth Headers    ${token}
    ${params}=    Create Dictionary
    IF    $lang is not None
        Set To Dictionary    ${params}    lang    ${lang}
    END
    ${response}=    GET On Session    public_session    /api/match/${match_uuid}/info
    ...    headers=${headers}
    ...    params=${params}
    ...    expected_status=${expected_status}
    RETURN    ${response}

End Match
    [Documentation]    PATCH /api/match/{uuidMatch}/end/{uuidEvent} — Step 20.1.
    ...                Returns 200 when uuidEvent is the story's idEventEndGame,
    ...                406 when the event is not the end-game event, 404 for unknown
    ...                or non-owned matches, 401 when no Bearer token is supplied.
    [Arguments]    ${token}    ${match_uuid}    ${event_uuid}    ${expected_status}=any
    ${headers}=    Get Auth Headers    ${token}
    ${response}=    PATCH On Session    public_session
    ...    /api/match/${match_uuid}/end/${event_uuid}
    ...    headers=${headers}
    ...    expected_status=${expected_status}
    RETURN    ${response}

Create Match With Turnstile Token
    [Documentation]    POST /api/matches with an optional Cloudflare Turnstile token.
    ...                When TURNSTILE_SECRET_KEY is not configured on the server the token
    ...                is ignored (dev bypass); in production it is verified against the
    ...                Cloudflare siteverify API and missing/invalid tokens return 400.
    [Arguments]    ${token}    ${story_uuid}    ${difficulty_uuid}
    ...    ${turnstile_token}=${NONE}    ${name}=robottest_match    ${expected_status}=any
    ${headers}=    Get Auth Headers    ${token}
    Set To Dictionary    ${headers}    Content-Type=application/json
    &{body}=    Create Dictionary
    ...    storyUuid=${story_uuid}
    ...    difficultyUuid=${difficulty_uuid}
    ...    name=${name}
    IF    $turnstile_token is not None
        Set To Dictionary    ${body}    turnstileToken=${turnstile_token}
    END
    ${response}=    POST On Session    public_session    /api/matches
    ...    headers=${headers}
    ...    json=${body}
    ...    expected_status=${expected_status}
    RETURN    ${response}

Pick First Public Story With Difficulty
    [Documentation]    Returns (storyUuid, difficultyUuid) for the first
    ...                publicly visible story whose detail page exposes at
    ...                least one difficulty.
    Create Public Session
    ${response}=    GET On Session    public_session    /api/stories
    Status Should Be    ${response}    200
    ${stories}=    Set Variable    ${response.json()}
    Should Not Be Empty    ${stories}
    FOR    ${story}    IN    @{stories}
        ${detail_response}=    GET On Session    public_session    /api/stories/${story}[uuid]
        IF    ${detail_response.status_code} != 200    CONTINUE
        ${detail}=    Set Variable    ${detail_response.json()}
        ${difficulties}=    Get From Dictionary    ${detail}    difficulties    ${EMPTY}
        IF    not ${difficulties}    CONTINUE
        ${first_difficulty}=    Set Variable    ${difficulties}[0]
        RETURN    ${story}[uuid]    ${first_difficulty}[uuid]
    END
    Fail    No public story with at least one difficulty was found

# ── Step 21 — character template & class selection ──

Pick Story Loadout
    [Documentation]    Resolve a real, joinable loadout from a public story's detail:
    ...                (storyUuid, difficultyUuid, characterTemplateUuid, classUuid, traitUuid).
    ...                Uses the first story that exposes at least one difficulty, character
    ...                template and class. The first character template in the seeds carries
    ...                no class restriction, so [0]+[0] is a compatible pair. traitUuid is the
    ...                empty string when the story has no traits.
    Create Public Session
    ${response}=    GET On Session    public_session    /api/stories
    Status Should Be    ${response}    200
    ${stories}=    Set Variable    ${response.json()}
    Should Not Be Empty    ${stories}
    FOR    ${story}    IN    @{stories}
        ${detail_response}=    GET On Session    public_session    /api/stories/${story}[uuid]
        IF    ${detail_response.status_code} != 200    CONTINUE
        ${detail}=    Set Variable    ${detail_response.json()}
        ${difficulties}=    Get From Dictionary    ${detail}    difficulties            ${EMPTY}
        ${templates}=       Get From Dictionary    ${detail}    characterTemplates     ${EMPTY}
        ${classes}=         Get From Dictionary    ${detail}    classes                ${EMPTY}
        IF    not ${difficulties} or not ${templates} or not ${classes}    CONTINUE
        # Need a template + class that actually carry uuids (skip otherwise).
        ${tpl_uuid}=    Get From Dictionary    ${templates}[0]    uuid    ${EMPTY}
        ${cls_uuid}=    Get From Dictionary    ${classes}[0]      uuid    ${EMPTY}
        IF    '${tpl_uuid}' == '' or '${cls_uuid}' == ''    CONTINUE
        ${traits}=    Get From Dictionary    ${detail}    traits    ${EMPTY}
        ${trait_uuid}=    Set Variable If    ${traits}    ${traits}[0][uuid]    ${EMPTY}
        RETURN    ${story}[uuid]    ${difficulties}[0][uuid]
        ...    ${tpl_uuid}    ${cls_uuid}    ${trait_uuid}
    END
    Fail    No public story with a difficulty, character template and class was found

# ── Step 23 — trait listing filtered by class ──

Get Traits For Class
    [Documentation]    GET /api/stories/{uuidStory}/classes/{uuidClass}/traits —
    ...                Step 23. Public endpoint: returns the traits selectable
    ...                with the given class (id_class_permitted/prohibited filter).
    [Arguments]    ${story_uuid}    ${class_uuid}    ${expected_status}=any
    ${response}=    GET On Session    public_session
    ...    /api/stories/${story_uuid}/classes/${class_uuid}/traits
    ...    expected_status=${expected_status}
    RETURN    ${response}

Join Match
    [Documentation]    POST /api/matches/{uuidMatch}/join. Loadout fields are optional;
    ...                pass ${NONE} to omit one (the backend falls back to the match loadout).
    [Arguments]    ${token}    ${match_uuid}    ${character_uuid}=${NONE}
    ...    ${class_uuid}=${NONE}    ${trait_uuids}=${NONE}    ${expected_status}=any
    ${headers}=    Get Auth Headers    ${token}
    Set To Dictionary    ${headers}    Content-Type=application/json
    &{body}=    Create Dictionary
    IF    $character_uuid is not None
        Set To Dictionary    ${body}    characterTemplateUuid=${character_uuid}
    END
    IF    $class_uuid is not None
        Set To Dictionary    ${body}    classUuid=${class_uuid}
    END
    IF    $trait_uuids is not None
        Set To Dictionary    ${body}    traitUuids=${trait_uuids}
    END
    ${response}=    POST On Session    public_session    /api/matches/${match_uuid}/join
    ...    headers=${headers}
    ...    json=${body}
    ...    expected_status=${expected_status}
    RETURN    ${response}

Get Match Players
    [Documentation]    GET /api/match/{uuidMatch}/players with the given Bearer token.
    [Arguments]    ${token}    ${match_uuid}    ${expected_status}=any
    ${headers}=    Get Auth Headers    ${token}
    ${response}=    GET On Session    public_session    /api/match/${match_uuid}/players
    ...    headers=${headers}
    ...    expected_status=${expected_status}
    RETURN    ${response}

Get Character Detail
    [Documentation]    GET /api/match/{uuidMatch}/characters/{uuidCharacter}.
    [Arguments]    ${token}    ${match_uuid}    ${character_uuid}    ${expected_status}=any
    ${headers}=    Get Auth Headers    ${token}
    ${response}=    GET On Session    public_session
    ...    /api/match/${match_uuid}/characters/${character_uuid}
    ...    headers=${headers}
    ...    expected_status=${expected_status}
    RETURN    ${response}

# ── Admin match control — Step 20 (admin port 8044) ──

Admin Get Match Info
    [Documentation]    GET /api/admin/matches/{uuidMatch}/info via admin_session.
    [Arguments]    ${token}    ${match_uuid}    ${expected_status}=any
    ${headers}=    Get Auth Headers    ${token}
    ${response}=    GET On Session    admin_session    /api/admin/matches/${match_uuid}/info
    ...    headers=${headers}
    ...    expected_status=${expected_status}
    RETURN    ${response}

Admin Stop Match
    [Documentation]    POST /api/admin/matches/{uuidMatch}/stop — sets status to ENDED.
    [Arguments]    ${token}    ${match_uuid}    ${expected_status}=any
    ${headers}=    Get Auth Headers    ${token}
    ${response}=    POST On Session    admin_session    /api/admin/matches/${match_uuid}/stop
    ...    headers=${headers}
    ...    expected_status=${expected_status}
    RETURN    ${response}

Admin Pause Match
    [Documentation]    POST /api/admin/matches/{uuidMatch}/pause — sets status to PAUSED.
    [Arguments]    ${token}    ${match_uuid}    ${expected_status}=any
    ${headers}=    Get Auth Headers    ${token}
    ${response}=    POST On Session    admin_session    /api/admin/matches/${match_uuid}/pause
    ...    headers=${headers}
    ...    expected_status=${expected_status}
    RETURN    ${response}

Admin Resume Match
    [Documentation]    POST /api/admin/matches/{uuidMatch}/resume — sets status to RUNNING.
    [Arguments]    ${token}    ${match_uuid}    ${expected_status}=any
    ${headers}=    Get Auth Headers    ${token}
    ${response}=    POST On Session    admin_session    /api/admin/matches/${match_uuid}/resume
    ...    headers=${headers}
    ...    expected_status=${expected_status}
    RETURN    ${response}

Admin Delete Match
    [Documentation]    DELETE /api/admin/matches/{uuidMatch} — removes a terminal match.
    [Arguments]    ${token}    ${match_uuid}    ${expected_status}=any
    ${headers}=    Get Auth Headers    ${token}
    ${response}=    DELETE On Session    admin_session    /api/admin/matches/${match_uuid}
    ...    headers=${headers}
    ...    expected_status=${expected_status}
    RETURN    ${response}

# ── Step 24 — turn cycle engine ──

Start Match
    [Documentation]    POST /api/matches/{uuidMatch}/start — CREATED -> RUNNING + turn queue.
    [Arguments]    ${token}    ${match_uuid}    ${expected_status}=any
    ${headers}=    Get Auth Headers    ${token}
    ${response}=    POST On Session    public_session    /api/matches/${match_uuid}/start
    ...    headers=${headers}    expected_status=${expected_status}
    RETURN    ${response}

Pass Turn
    [Documentation]    POST /api/gameplay/{uuidMatch}/action/pass — voluntary turn pass.
    [Arguments]    ${token}    ${match_uuid}    ${expected_status}=any
    ${headers}=    Get Auth Headers    ${token}
    ${response}=    POST On Session    public_session    /api/gameplay/${match_uuid}/action/pass
    ...    headers=${headers}    expected_status=${expected_status}
    RETURN    ${response}

Get Turn Sequence
    [Documentation]    GET /api/match/{uuidMatch}/turn-sequence — turn queue with status.
    [Arguments]    ${token}    ${match_uuid}    ${expected_status}=any
    ${headers}=    Get Auth Headers    ${token}
    ${response}=    GET On Session    public_session    /api/match/${match_uuid}/turn-sequence
    ...    headers=${headers}    expected_status=${expected_status}
    RETURN    ${response}

Sleep Action
    [Documentation]    POST /api/gameplay/{uuidMatch}/action/sleep — voluntary sleep (Step 25).
    [Arguments]    ${token}    ${match_uuid}    ${expected_status}=any
    ${headers}=    Get Auth Headers    ${token}
    ${response}=    POST On Session    public_session    /api/gameplay/${match_uuid}/action/sleep
    ...    headers=${headers}    expected_status=${expected_status}
    RETURN    ${response}

Get Clock
    [Documentation]    GET /api/match/{uuidMatch}/clock — current clock & sleeping state (Step 25).
    [Arguments]    ${token}    ${match_uuid}    ${expected_status}=any
    ${headers}=    Get Auth Headers    ${token}
    ${response}=    GET On Session    public_session    /api/match/${match_uuid}/clock
    ...    headers=${headers}    expected_status=${expected_status}
    RETURN    ${response}

# ── Step 28 — movement system ──

Start Movement
    [Documentation]    POST /api/gameplay/{uuidMatch}/movements/start — move to an adjacent location.
    [Arguments]    ${token}    ${match_uuid}    ${target_location_uuid}    ${expected_status}=any
    ${headers}=    Get Auth Headers    ${token}
    &{body}=    Create Dictionary    targetLocationUuid=${target_location_uuid}
    ${response}=    POST On Session    public_session    /api/gameplay/${match_uuid}/movements/start
    ...    headers=${headers}    json=${body}    expected_status=${expected_status}
    RETURN    ${response}

Get Locations
    [Documentation]    GET /api/match/{uuidMatch}/locations — visited locations + total energy cost (Step 28).
    [Arguments]    ${token}    ${match_uuid}    ${expected_status}=any
    ${headers}=    Get Auth Headers    ${token}
    ${response}=    GET On Session    public_session    /api/match/${match_uuid}/locations
    ...    headers=${headers}    expected_status=${expected_status}
    RETURN    ${response}

Admin Get Locations
    [Documentation]    GET /api/admin/matches/{uuidMatch}/locations — admin visited-locations view (Step 28).
    [Arguments]    ${token}    ${match_uuid}    ${expected_status}=any
    ${headers}=    Get Auth Headers    ${token}
    ${response}=    GET On Session    admin_session    /api/admin/matches/${match_uuid}/locations
    ...    headers=${headers}    expected_status=${expected_status}
    RETURN    ${response}
