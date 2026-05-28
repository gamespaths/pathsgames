*** Settings ***
# ---------------------------------------------------------------------------
# turnstile.robot — Step 20 Cloudflare Turnstile server-side validation.
#
# These tests verify the API contract for the Turnstile token field added to
# POST /api/matches. Two distinct behaviours are tested:
#
#   DEV BYPASS (TURNSTILE_SECRET_KEY not configured on the server):
#     - turnstileToken field is accepted but not validated.
#     - Absent, null or any arbitrary string token all produce 201.
#     - This is the default behaviour in local dev / CI environments.
#
#   REJECTION (TURNSTILE_SECRET_KEY configured):
#     - A missing or invalid token returns 400 TURNSTILE_VALIDATION_FAILED.
#     - A valid Cloudflare token (from the widget) produces 201.
#     - This behaviour CANNOT be exercised here because it requires a live
#       Cloudflare secret key; it is covered by unit tests in every backend.
#
# Tags: website, turnstile, step20
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource

Suite Setup    Suite Setup Turnstile


*** Variables ***
# Cloudflare public test token — always passes on the siteverify API when the
# matching test secret key (1x0000000000000000000000000000000AA) is configured.
# Under dev bypass (empty secret) any string is accepted, including this one.
${CF_TEST_TOKEN}    CF_TEST_TOKEN_PLACEHOLDER


*** Test Cases ***

# ── Dev bypass: TURNSTILE_SECRET_KEY not set on the server ───────────────────

Create Match Without Turnstile Token Succeeds In Dev Bypass
    [Documentation]    POST /api/matches without the turnstileToken field returns 201
    ...                when the server has no secret key configured (dev bypass active).
    ...                This is the default for local development and CI.
    [Tags]    website    turnstile    step20    bypass
    ${response}=    Create Match    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}
    Status Should Be    ${response}    201
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    uuid
    Should Be Equal As Strings    ${body}[status]    CREATED

Create Match With Null Turnstile Token Succeeds In Dev Bypass
    [Documentation]    POST /api/matches with turnstileToken: null returns 201 in dev bypass.
    ...                The frontend sends null when VITE_CF_TURNSTILE_KEY is not set.
    [Tags]    website    turnstile    step20    bypass
    ${response}=    Create Match With Turnstile Token
    ...    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}
    ...    turnstile_token=${NONE}
    Status Should Be    ${response}    201
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    uuid

Create Match With Arbitrary Turnstile Token Succeeds In Dev Bypass
    [Documentation]    POST /api/matches with any non-empty string in turnstileToken
    ...                returns 201 when the server has no secret key (bypass active).
    ...                In production the same request would be rejected with 400.
    [Tags]    website    turnstile    step20    bypass
    ${response}=    Create Match With Turnstile Token
    ...    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}
    ...    turnstile_token=dev-bypass-any-value-is-accepted
    Status Should Be    ${response}    201
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    uuid

Create Match With Cloudflare Test Token Succeeds In Dev Bypass
    [Documentation]    POST /api/matches with the Cloudflare "always pass" test token
    ...                returns 201 in dev bypass. With a properly configured test
    ...                secret (1x0000000000000000000000000000000AA) this would also
    ...                pass live validation against the Cloudflare siteverify API.
    [Tags]    website    turnstile    step20    bypass
    ${response}=    Create Match With Turnstile Token
    ...    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}
    ...    turnstile_token=${CF_TEST_TOKEN}
    Status Should Be    ${response}    201

# ── API contract: turnstileToken is not echoed in the response ───────────────

Turnstile Token Is Not Included In Match Response
    [Documentation]    The turnstileToken field must never appear in any match response
    ...                body — it is consumed server-side only.
    [Tags]    website    turnstile    step20
    ${cf_token}=    Get Variable Value    ${CF_TURNSTILE_TOKEN}    check-not-echoed
    ${response}=    Create Match With Turnstile Token
    ...    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}
    ...    turnstile_token=${cf_token}
    Status Should Be    ${response}    201
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Not Contain Key    ${body}    turnstileToken

Match Summary Has All Required Fields After Turnstile Creation
    [Documentation]    A match created with a turnstileToken still returns the full
    ...                MatchSummary structure: uuid, storyUuid, difficultyUuid,
    ...                status, currentClock, expCost, userCreatorUuid, tsInsert.
    [Tags]    website    turnstile    step20
    ${cf_token}=    Get Variable Value    ${CF_TURNSTILE_TOKEN}    check-fields
    ${response}=    Create Match With Turnstile Token
    ...    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}
    ...    turnstile_token=${cf_token}
    Status Should Be    ${response}    201
    ${body}=    Set Variable    ${response.json()}
    FOR    ${field}    IN    uuid    storyUuid    difficultyUuid    status
    ...                       currentClock    expCost    userCreatorUuid    tsInsert
        Dictionary Should Contain Key    ${body}    ${field}
    END
    Should Be Equal As Strings    ${body}[status]    CREATED

# ── Auth still required even with a valid Turnstile token ───────────────────

Create Match With Turnstile Token But No Auth Returns 401
    [Documentation]    Providing a turnstileToken does not bypass JWT authentication.
    ...                POST /api/matches without Authorization header → 401.
    [Tags]    website    turnstile    step20
    Create Public Session
    &{body}=    Create Dictionary
    ...    storyUuid=${STORY_UUID}
    ...    difficultyUuid=${DIFFICULTY_UUID}
    ...    turnstileToken=some-cf-token
    ${response}=    POST On Session    public_session    /api/matches
    ...    json=${body}
    ...    expected_status=any
    Status Should Be    ${response}    401

# ── Match info for a Turnstile-created match is fully accessible ─────────────

Get Match Info For Turnstile Created Match Returns 200
    [Documentation]    A match created via the Turnstile flow can be retrieved with
    ...                GET /api/match/{uuid}/info and exposes the full runtime state.
    [Tags]    website    turnstile    step20
    ${cf_token}=    Get Variable Value    ${CF_TURNSTILE_TOKEN}    info-check
    ${create}=    Create Match With Turnstile Token
    ...    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}
    ...    turnstile_token=${cf_token}
    Status Should Be    ${create}    201
    ${match_uuid}=    Set Variable    ${create.json()}[uuid]
    ${info}=    Get Match Info    ${TOKEN}    ${match_uuid}
    Status Should Be    ${info}    200
    ${body}=    Set Variable    ${info.json()}
    Dictionary Should Contain Key    ${body}    match
    Dictionary Should Contain Key    ${body}    locations
    Dictionary Should Contain Key    ${body}    registry
    Should Be Equal As Strings    ${body}[match][uuid]    ${match_uuid}


*** Keywords ***

Suite Setup Turnstile
    [Documentation]    Creates a guest session and picks the first available story
    ...                and difficulty for use across all Turnstile test cases.
    Create Public Session
    ${response}=    POST On Session    public_session    /api/auth/guest
    Status Should Be    ${response}    201
    ${body}=    Set Variable    ${response.json()}
    Set Suite Variable    ${TOKEN}    ${body}[accessToken]
    ${story_uuid}    ${difficulty_uuid}=    Pick First Public Story With Difficulty
    Set Suite Variable    ${STORY_UUID}        ${story_uuid}
    Set Suite Variable    ${DIFFICULTY_UUID}   ${difficulty_uuid}
