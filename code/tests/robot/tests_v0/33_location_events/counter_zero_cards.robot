*** Settings ***
# ---------------------------------------------------------------------------
# counter_zero_cards.robot — v0.33.1, the three cards of a counter-zero notice.
#
# The contract under test:
#
#   Step 33 gave the sleep response a `counterZero[]` list, and each entry carried ONE
#   card: the LOCATION's (`list_locations.id_card`). The event's own card and the cards
#   of the effects it applied were already computed into AutomaticEventFired and then
#   thrown away by describeForRecipient — so the player woke up to the NAME OF A PLACE
#   instead of the news of what had happened in it.
#
#   v0.33.1 widens each entry to three:
#
#     card         -> the EVENT's card (this field changed meaning)
#     cardEffects  -> one AppliedEffect per list_events_effects row that ran, each with
#                     its OWN card, which is the narrative the board renders — the same
#                     shape execute-event returns
#     cardLocation -> the location's card, i.e. what `card` used to hold
#
#   trigger, idLocation, eventUuid, clock and visibility are unchanged. No new endpoint,
#   no new DB column. Before v0.33.1 the two new keys did not exist at all, so simply
#   asserting their presence is the regression guard.
#
# Fog of war is NOT re-tested here — location_events.robot owns it, and asserts that all
# three are absent/empty under ANONYMOUS. The seeded fuse sits on the START location, so
# every notice this suite sees is FULL.
#
# Note on the dev seed: the fuse event, its effect row and the location all point at the
# SAME authored card, so the three cards CANNOT be told apart by identity here. What is
# asserted instead is that each field is independently present and resolves against the
# content API — which is exactly what regressed.
#
# Backend-agnostic: the seed ids differ per backend, so everything is addressed by
# behaviour, never by hard-coded uuid.
#
# Tags: location-events, step33, counter-zero, cards
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource

Suite Setup       Suite Setup Counter Zero Cards


*** Test Cases ***

A Counter-Zero Notice Carries All Three Card Fields
    [Documentation]    The shape guard. Before v0.33.1 `cardEffects` and `cardLocation` did
    ...                not exist, and `card` meant something else. All three keys are always
    ...                present, so the board never has to tell "nothing happened" apart from
    ...                "old backend".
    [Tags]    location-events    step33    counter-zero    cards
    ${item}=    A Counter Zero Notice

    Dictionary Should Contain Key    ${item}    card
    Dictionary Should Contain Key    ${item}    cardLocation
    Dictionary Should Contain Key    ${item}    cardEffects
    # The fields that did not change meaning.
    Should Be Equal        ${item}[trigger]    COUNTER_ZERO
    Should Not Be Empty    ${item}[eventUuid]
    Should Be Equal        ${item}[visibility]    FULL

The Notice Carries The Event's Own Card
    [Documentation]    `card` is the event's narrative — what happened — and it is a real
    ...                resolved card, not a stub: it answers on the content API.
    [Tags]    location-events    step33    counter-zero    cards
    ${item}=    A Counter Zero Notice

    Card Should Be Resolved    ${item}[card]

The Notice Carries One Card Per Applied Effect
    [Documentation]    The heart of v0.33.1. Each effect row the event applied travels with
    ...                its OWN card — the sentence the player is meant to read — in the same
    ...                AppliedEffect shape execute-event returns. The seeded fuse authors one
    ...                effect row, so the list must not come back empty.
    [Tags]    location-events    step33    counter-zero    cards
    ${item}=    A Counter Zero Notice

    Should Not Be Empty    ${item}[cardEffects]
    FOR    ${effect}    IN    @{item}[cardEffects]
        Dictionary Should Contain Key    ${effect}    eventUuid
        Dictionary Should Contain Key    ${effect}    effectUuid
        Dictionary Should Contain Key    ${effect}    statistic
        Dictionary Should Contain Key    ${effect}    value
        Dictionary Should Contain Key    ${effect}    target
        Dictionary Should Contain Key    ${effect}    characterUuids
        Should Not Be Empty    ${effect}[effectUuid]
        # Every effect row of the fuse authors a card in the seed.
        Card Should Be Resolved    ${effect}[card]
    END

The Effects Belong To The Event The Notice Names
    [Documentation]    An entry is one event's news, not a mixed bag: every effect row it
    ...                carries was produced by the event `eventUuid` names.
    [Tags]    location-events    step33    counter-zero    cards
    ${item}=    A Counter Zero Notice

    FOR    ${effect}    IN    @{item}[cardEffects]
        Should Be Equal    ${effect}[eventUuid]    ${item}[eventUuid]
    END

The Location Card Still Travels, Under Its Own Name
    [Documentation]    Nothing was lost in the move: what `card` used to hold is now
    ...                `cardLocation`, still resolved, still there — the board simply does not
    ...                render it yet.
    [Tags]    location-events    step33    counter-zero    cards
    ${item}=    A Counter Zero Notice

    Card Should Be Resolved    ${item}[cardLocation]

The Sleep That Fires Nothing Carries No Cards Either
    [Documentation]    The ordinary case stays ordinary: an empty list, not entries with null
    ...                cards. The new fields must not have turned "nothing happened" into a
    ...                notice about nothing.
    [Tags]    location-events    step33    counter-zero    cards
    ${token}    ${match}=    Fresh Counter Zero Match
    ${resp}=    Sleep Action    ${token}    ${match}    200
    Should Be Empty    ${resp.json()}[counterZero]


*** Keywords ***

Suite Setup Counter Zero Cards
    [Documentation]    An admin session (to read the seed) plus the story loadout every case
    ...                builds its own match from.
    Create Admin Session
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}    ${story}
    Set Suite Variable    ${DIFFICULTY}    ${difficulty}
    Set Suite Variable    ${CHARACTER}    ${character}
    Set Suite Variable    ${CLASS}    ${class}
    Set Suite Variable    ${TRAIT}    ${trait}

Fresh Counter Zero Match
    [Documentation]    A fresh running single-player match on its own guest. Every case needs
    ...                one: a counter is a one-shot fuse, per match. The fresh guest is the
    ...                v0.32.1 duplicate-match guard (one active match per user and story).
    ${token}=    New Guest Token
    ${match}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY}    robottest_step331
    Status Should Be    ${match}    201
    ${uuid}=    Set Variable    ${match.json()}[uuid]
    ${trait_list}=    Create List
    IF    '${TRAIT}' != ''
        Append To List    ${trait_list}    ${TRAIT}
    END
    ${join}=    Join Match    ${token}    ${uuid}    ${CHARACTER}    ${CLASS}    ${trait_list}
    Status Should Be    ${join}    201
    Start Match    ${token}    ${uuid}    200
    RETURN    ${token}    ${uuid}

A Counter Zero Notice
    [Documentation]    A fresh match slept forward until its counter runs out; returns the
    ...                first notice of that time-start. Fails loudly rather than passing
    ...                vacuously when the seed carries no fuse.
    ${token}    ${match}=    Fresh Counter Zero Match
    ${fired}=    Sleep Until Counter Zero    ${token}    ${match}
    Should Not Be Empty    ${fired}    msg=The seed carries no counter-zero fuse to test
    RETURN    ${fired}[0]

Sleep Until Counter Zero
    [Documentation]    Sleeps the match forward until a counter runs out, and returns the
    ...                counterZero list of the time-start that fired it. The seeded start
    ...                location carries counter_time = 2, so it takes at most a few
    ...                time-starts; an empty result means the seed carries no fuse.
    [Arguments]    ${token}    ${match_uuid}    ${max_sleeps}=6
    FOR    ${i}    IN RANGE    ${max_sleeps}
        ${resp}=    Sleep Action    ${token}    ${match_uuid}    200
        ${fired}=    Set Variable    ${resp.json()}[counterZero]
        IF    len($fired) > 0    RETURN    ${fired}
    END
    ${empty}=    Create List
    RETURN    ${empty}

Card Should Be Resolved
    [Documentation]    A card object is present, has a uuid, and resolves via the content API
    ...                — the check that tells a real card apart from an empty shell.
    [Arguments]    ${card}
    Should Not Be Equal    ${card}    ${None}
    Dictionary Should Contain Key    ${card}    uuid
    Should Not Be Empty    ${card}[uuid]
    ${detail}=    Get Card Info    ${STORY_UUID}    ${card}[uuid]
    Status Should Be    ${detail}    200
