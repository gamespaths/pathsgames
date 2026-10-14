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
#   ENFORCED (TURNSTILE_SECRET_KEY configured, e.g. the AWS test stack):
#     - A missing, null or invalid token returns 400 TURNSTILE_VALIDATION_FAILED.
#     - Only the deployed bypass token (CF_TURNSTILE_TOKEN) produces 201; a real
#       Cloudflare widget token does too, but no browser runs here.
#
# The suite tells the two apart from CF_TURNSTILE_TOKEN: set (variables/aws.yaml)
# means the server enforces Turnstile, empty means dev bypass. Enforced mode
# assumes a REAL secret key — Cloudflare's "always passes" test secret
# (1x0000000000000000000000000000000AA) accepts any string and would keep the
# arbitrary-token cases at 201.
#
# Tags: website, turnstile, step20
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource

Suite Setup    Suite Setup Turnstile
Test Setup     Fresh Guest For This Test


*** Variables ***
# Cloudflare public test token — always passes on the siteverify API when the
# matching test secret key (1x0000000000000000000000000000000AA) is configured.
# Under dev bypass (empty secret) any string is accepted, including this one.
${CF_TEST_TOKEN}    CF_TEST_TOKEN_PLACEHOLDER


*** Test Cases ***

# ── Token validation: the outcome follows the server's Turnstile mode ────────

Create Match Without Explicit Turnstile Token Succeeds
    [Documentation]    POST /api/matches through the shared Create Match keyword: it
    ...                sends no turnstileToken under dev bypass, and the deployed
    ...                bypass token when the server enforces Turnstile. Both give 201.
    [Tags]    website    turnstile    step20    bypass
    ${response}=    Create Match    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}
    Status Should Be    ${response}    201
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    uuid
    Should Be Equal As Strings    ${body}[status]    CREATED

Create Match With Null Turnstile Token Follows The Server Mode
    [Documentation]    POST /api/matches with turnstileToken: null — 201 under dev
    ...                bypass, 400 TURNSTILE_VALIDATION_FAILED when enforced. The
    ...                frontend sends null when VITE_CF_TURNSTILE_KEY is not set, so
    ...                this is exactly the "site built without the site key" failure.
    [Tags]    website    turnstile    step20    bypass
    ${response}=    Create Match With Turnstile Token
    ...    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}
    ...    turnstile_token=${NONE}
    Match Creation Should Follow Turnstile Mode    ${response}

Create Match With Arbitrary Turnstile Token Follows The Server Mode
    [Documentation]    POST /api/matches with any non-empty string in turnstileToken —
    ...                201 under dev bypass, 400 when the server verifies the token
    ...                against the Cloudflare siteverify API.
    [Tags]    website    turnstile    step20    bypass
    ${response}=    Create Match With Turnstile Token
    ...    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}
    ...    turnstile_token=dev-bypass-any-value-is-accepted
    Match Creation Should Follow Turnstile Mode    ${response}

Create Match With Cloudflare Test Token Follows The Server Mode
    [Documentation]    POST /api/matches with the Cloudflare "always pass" test token —
    ...                201 under dev bypass. When enforced with a real secret key the
    ...                token belongs to another site and is refused with 400.
    [Tags]    website    turnstile    step20    bypass
    ${response}=    Create Match With Turnstile Token
    ...    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}
    ...    turnstile_token=${CF_TEST_TOKEN}
    Match Creation Should Follow Turnstile Mode    ${response}

Create Match With The Deployed Bypass Token Succeeds When Enforced
    [Documentation]    The token deployed as TURNSTILE_BYPASS_TOKEN skips the Cloudflare
    ...                call on every non-prod environment, which is what lets Robot run
    ...                against a stack that also serves real users. Skipped in dev bypass,
    ...                where there is no token to send.
    [Tags]    website    turnstile    step20
    IF    not ${TURNSTILE_ENFORCED}
        Skip    Dev bypass: no CF_TURNSTILE_TOKEN deployed on this server
    END
    ${response}=    Create Match With Turnstile Token
    ...    ${TOKEN}    ${STORY_UUID}    ${DIFFICULTY_UUID}
    ...    turnstile_token=${CF_TURNSTILE_TOKEN}
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

Fresh Guest For This Test
    [Documentation]    v0.32.1 — nearly every test here creates a match on the same
    ...                story, and one user may own only one active match per story
    ...                (409 ACTIVE_MATCH_ALREADY_EXISTS). Each test therefore starts
    ...                from its own guest.
    ${token}=    Use A Fresh Guest Token

Match Creation Should Follow Turnstile Mode
    [Documentation]    Asserts the POST /api/matches outcome for a token the server
    ...                cannot verify: refused when Turnstile is enforced, accepted
    ...                when the server runs without a secret key (dev bypass).
    [Arguments]    ${response}
    IF    ${TURNSTILE_ENFORCED}
        Status Should Be    ${response}    400
        Should Be Equal As Strings    ${response.json()}[error]    TURNSTILE_VALIDATION_FAILED
    ELSE
        Status Should Be    ${response}    201
        Dictionary Should Contain Key    ${response.json()}    uuid
    END

Suite Setup Turnstile
    [Documentation]    Creates a guest session and picks the first available story
    ...                and difficulty for use across all Turnstile test cases.
    ...                A deployed CF_TURNSTILE_TOKEN means the server enforces Turnstile.
    ${cf_token}=    Get Variable Value    ${CF_TURNSTILE_TOKEN}    ${EMPTY}
    ${enforced}=    Set Variable If    '${cf_token}' != '${EMPTY}'    ${TRUE}    ${FALSE}
    Set Suite Variable    ${TURNSTILE_ENFORCED}    ${enforced}
    Create Public Session
    ${response}=    POST On Session    public_session    /api/auth/guest
    Status Should Be    ${response}    201
    ${body}=    Set Variable    ${response.json()}
    Set Suite Variable    ${TOKEN}    ${body}[accessToken]
    ${story_uuid}    ${difficulty_uuid}=    Pick First Public Story With Difficulty
    Set Suite Variable    ${STORY_UUID}        ${story_uuid}
    Set Suite Variable    ${DIFFICULTY_UUID}   ${difficulty_uuid}
