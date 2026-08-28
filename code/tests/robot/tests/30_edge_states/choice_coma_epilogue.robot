# =============================================================================
# Step 30 + Step 32 — the all-players-in-coma epilogue after a resolved OPTION.
#
# A lethal option puts the party down exactly as a lethal event does, so the story's
# id_event_all_player_coma is owed on select-choice too. Java and Python resolved it there
# from the start; AWS only did so on execute-event until v0.35.6, which meant a story whose
# killing blow was a choice simply went quiet — the flag on the character, and nothing else.
#
# The seeded stories author no epilogue (that field is nobody's business but the author's),
# so the suite AUTHORS one: it points id_event_all_player_coma at an event the seed already
# carries — one whose effect MOVES whoever it touches — and puts the field back as it found
# it in the teardown. That choice of event is what lets the last case assert the headline
# promise: the epilogue can carry the body somewhere else.
#
# Backend-agnostic: no seeded id or uuid is named. The choice-event, the option and the
# epilogue event are all discovered from the admin API's own answers.
# =============================================================================

*** Settings ***
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/auth.resource
Resource   ../../resources/matches.resource
Resource   ../../resources/stories.resource

Suite Setup       Suite Setup Choice Coma Epilogue
Suite Teardown    Set Story Epilogue    ${EPILOGUE_BEFORE}


*** Test Cases ***

A Lethal Option Runs The All-In-Coma Epilogue
    [Documentation]    THE acceptance test: the party goes down because of a CHOICE, and the
    ...                story's epilogue runs — reported as its own event, with its own card.
    [Tags]    events    step30    step32    edge    coma
    ${body}    ${token}    ${match}=    Party Brought Down By An Option

    Should Be True     ${body}[comaTriggered]
    ${edge}=    Set Variable    ${body}[edgeState]
    List Should Contain Value    ${edge}[comaUuids]    ${CHARACTER_MATCH_UUID}
    Should Be True     ${edge}[allPlayersInComa]
    Should Be Equal    ${edge}[comaEventUuid]    ${EPILOGUE_EVENT_UUID}
    ...    msg=the authored epilogue did not run after the option resolved
    Should Not Be Equal    ${edge}[comaEventCard]    ${None}
    ...    msg=the epilogue must carry its own card: it is what the board shows

The Epilogue Is Kept Out Of The Option's Own Chain
    [Documentation]    Two chains, two lists. What the player caused rides on
    ...                executedEventUuids/effects, what the collapse caused on the coma pair —
    ...                the board narrates them in different places.
    [Tags]    events    step30    step32    edge    coma
    ${body}    ${token}    ${match}=    Party Brought Down By An Option

    ${edge}=    Set Variable    ${body}[edgeState]
    List Should Contain Value    ${edge}[comaExecutedEventUuids]    ${EPILOGUE_EVENT_UUID}
    Should Not Contain    ${body}[executedEventUuids]    ${EPILOGUE_EVENT_UUID}
    Should Not Be Empty    ${edge}[comaEffects]
    ...    msg=the epilogue applied nothing, so nothing can be narrated of it

The Epilogue Carries The Body Where The Story Says
    [Documentation]    The reason an author writes one: the party wakes up somewhere else.
    ...                The epilogue this suite authored moves whoever it touches, so the
    ...                character must end the request in that location and not the old one.
    [Tags]    events    step30    step32    edge    coma
    ${body}    ${token}    ${match}=    Party Brought Down By An Option

    ${moved}=    Evaluate
    ...    [c for c in $body['locationChanges'] if c['characterUuid'] == '${CHARACTER_MATCH_UUID}']
    Should Not Be Empty    ${moved}    msg=the epilogue's move was not reported
    ${info}=    Get Match Info    ${token}    ${match}    200    lang=en
    Should Be Equal As Integers    ${info.json()}[currentLocationId]    ${EPILOGUE_LOCATION_ID}
    ...    msg=the character did not end up where the epilogue sends them

A Collapse With No Epilogue Authored Is Recorded All The Same
    [Documentation]    A story need not author an epilogue. The party is still reported as
    ...                down — that verdict is the engine's, not the author's — and the two
    ...                epilogue fields answer null and empty rather than being absent.
    [Tags]    events    step30    step32    edge    coma
    Set Story Epilogue    ${None}
    ${body}    ${token}    ${match}=    Party Brought Down By An Option

    ${edge}=    Set Variable    ${body}[edgeState]
    Should Be True     ${edge}[allPlayersInComa]
    Should Be Equal    ${edge}[comaEventUuid]    ${None}
    Should Be Empty    ${edge}[comaExecutedEventUuids]
    [Teardown]    Set Story Epilogue    ${EPILOGUE_EVENT_ID}


*** Keywords ***

Suite Setup Choice Coma Epilogue
    [Documentation]    The story loadout every case builds its match from, plus the epilogue
    ...                this suite authors on the seeded story (and restores in the teardown).
    Create Admin Session
    ${story}    ${difficulty}    ${character}    ${class}    ${trait}=    Pick Story Loadout
    Set Suite Variable    ${STORY_UUID}    ${story}
    Set Suite Variable    ${DIFFICULTY}    ${difficulty}
    Set Suite Variable    ${CHARACTER}    ${character}
    Set Suite Variable    ${CLASS}    ${class}
    Set Suite Variable    ${TRAIT}    ${trait}

    ${detail}=    Get Admin Story By UUID    ${STORY_UUID}
    Status Should Be    ${detail}    200
    Set Suite Variable    ${EPILOGUE_BEFORE}    ${detail.json().get('idEventAllPlayerComa')}

    ${event}    ${location}=    A Moving Event
    Set Suite Variable    ${EPILOGUE_EVENT_ID}       ${event}[id]
    Set Suite Variable    ${EPILOGUE_EVENT_UUID}     ${event}[uuid]
    Set Suite Variable    ${EPILOGUE_LOCATION_ID}    ${location}
    Set Story Epilogue    ${EPILOGUE_EVENT_ID}

Set Story Epilogue
    [Documentation]    PUT /api/admin/stories/{uuid} with the one field this suite owns.
    ...                ${None} writes a null, which is how the seed was found.
    [Arguments]    ${event_id}
    ${body}=    Create Dictionary    idEventAllPlayerComa=${event_id}
    ${response}=    PUT On Session    admin_session    /api/admin/stories/${STORY_UUID}
    ...    json=${body}    expected_status=200
    RETURN    ${response}

Party Brought Down By An Option
    [Documentation]    (body, token, match) after an option resolved on a character whose life
    ...                the admin endpoint had already emptied.
    ...
    ...                Life is driven to zero AFTER the options are served and BEFORE one is
    ...                picked: the Step 30 pass runs over everyone the option's effect rows
    ...                touched, so the option must carry a stat row — and then a life already
    ...                at zero is a coma, whatever that row was worth.
    ${token}    ${match}=    Fresh Epilogue Match
    ${event}=    Resolution Event Uuid
    ${opened}=    Execute Event    ${token}    ${match}    ${event}    200
    Should Be Equal    ${opened.json()}[status]    CHOICES_PENDING
    ${option}=    Option With A Stat Effect    ${opened.json()}[pendingChoices]

    Empty The Life Bar    ${token}    ${match}

    ${resolved}=    Select Choice    ${token}    ${match}    ${option}    200
    RETURN    ${resolved.json()}    ${token}    ${match}

Fresh Epilogue Match
    [Documentation]    A fresh running single-player match on its own guest: one coma IS the
    ...                whole party going down, and a spent choice cycle cannot be reused.
    ${token}=    New Guest Token
    ${match}=    Create Match    ${token}    ${STORY_UUID}    ${DIFFICULTY}    robottest_step30coma
    Status Should Be    ${match}    201
    ${uuid}=    Set Variable    ${match.json()}[uuid]
    ${trait_list}=    Create List
    IF    '${TRAIT}' != ''
        Append To List    ${trait_list}    ${TRAIT}
    END
    ${join}=    Join Match    ${token}    ${uuid}    ${CHARACTER}    ${CLASS}    ${trait_list}
    Status Should Be    ${join}    201
    Set Suite Variable    ${CHARACTER_MATCH_UUID}    ${join.json()}[uuid]
    Start Match    ${token}    ${uuid}    200
    RETURN    ${token}    ${uuid}

Empty The Life Bar
    [Documentation]    Life to zero and NOTHING else: the collapse has to be the option's
    ...                doing, not the admin endpoint's, or the test would prove nothing about
    ...                select-choice.
    ...
    ...                `coma` is deliberately not sent. Clearing it is the "pull them out of a
    ...                coma" gesture, which lifts a life left at 0 back to 1 — the character
    ...                would then survive the option and the case would silently pass nothing.
    [Arguments]    ${token}    ${match_uuid}
    ${body}=    Create Dictionary    life=${0}
    ${response}=    POST On Session    admin_session
    ...    /api/admin/matches/${match_uuid}/player/${CHARACTER_MATCH_UUID}/changeStatistics
    ...    json=${body}    expected_status=200
    ${state}=    Get Character Detail    ${token}    ${match_uuid}    ${CHARACTER_MATCH_UUID}    200
    Should Not Be True    ${state.json()}[isComa]
    ...    msg=setup failed: the character was already comatose before the option resolved

# ── addressing the seeded fixtures by behaviour ──────────────────────────────

Admin Events
    ${response}=    GET On Session    admin_session    /api/admin/stories/${STORY_UUID}/events
    Status Should Be    ${response}    200
    RETURN    ${response.json()}

Admin Event Effects
    ${response}=    GET On Session    admin_session    /api/admin/stories/${STORY_UUID}/event-effects
    Status Should Be    ${response}    200
    RETURN    ${response.json()}

Admin Choices
    ${response}=    GET On Session    admin_session    /api/admin/stories/${STORY_UUID}/choices
    Status Should Be    ${response}    200
    RETURN    ${response.json()}

Admin Choice Effects
    [Documentation]    The key naming differs by backend (Java/AWS expose idChoices, Python
    ...                idChoice), so both spellings are read — same as the Step 32 suite.
    ${response}=    GET On Session    admin_session    /api/admin/stories/${STORY_UUID}/choice-effects
    Status Should Be    ${response}    200
    RETURN    ${response.json()}

A Moving Event
    [Documentation]    (event, idLocation) of a NORMAL event whose effect moves its recipients,
    ...                and which owns no options of its own — an epilogue that asked a question
    ...                would be skipped, and one that moves nobody could not prove the move.
    ${events}=     Admin Events
    ${effects}=    Admin Event Effects
    ${choices}=    Admin Choices
    ${found}=    Evaluate
    ...    next(((e, f['idLocation']) for f in sorted(effects, key=lambda x: x['id']) for e in events if e['id'] == f.get('idEvent') and f.get('idLocation') and (e.get('type') or '').upper() == 'NORMAL' and e['id'] not in owners), None)
    ...    namespace=${{ {'events': $events, 'effects': $effects, 'owners': {c['idEvent'] for c in $choices if c.get('idEvent')}} }}
    Should Not Be Equal    ${found}    ${None}
    ...    msg=the seed authors no NORMAL event that moves anyone — the epilogue cannot be exercised
    RETURN    ${found}[0]    ${found}[1]

Resolution Event Uuid
    [Documentation]    The location-bound NORMAL choice-event with narrated options — the same
    ...                test-bed the Step 32 suite resolves on. A story event keeps its uuid
    ...                inside a match, so the admin uuid is the very uuid execute-event takes.
    ${choices}=    Admin Choices
    ${events}=     Admin Events
    ${uuid}=    Evaluate
    ...    next((e['uuid'] for e in sorted(events, key=lambda x: x['id']) if e['type'] == 'NORMAL' and e['id'] in owners and e.get('idSpecificLocation') and e.get('costEnery')), None)
    ...    namespace=${{ {'events': $events, 'owners': {c['idEvent'] for c in $choices if c.get('idEvent') and c.get('idTextNarrative')}} }}
    Should Not Be Equal    ${uuid}    ${None}
    ...    msg=no NORMAL location-bound choice-event with narrated options is seeded
    RETURN    ${uuid}

Option With A Stat Effect
    [Documentation]    An AVAILABLE option carrying a STAT effect row: the Step 30 pass only
    ...                sees characters an effect touched, so an option that moves no statistic
    ...                would leave a character at zero life standing.
    [Arguments]    ${options}
    ${rows}=       Admin Choices
    ${effects}=    Admin Choice Effects
    ${uuid}=    Evaluate
    ...    next((o['uuid'] for o in options if o['available'] and o['uuid'] in touching), None)
    ...    namespace=${{ {'options': $options, 'touching': {r['uuid'] for r in $rows if r['id'] in {e.get('idChoices', e.get('idChoice')) for e in $effects if e.get('statistics')}}} }}
    Should Not Be Equal    ${uuid}    ${None}
    ...    msg=no available option carries a stat effect — the coma rules would never see the actor
    RETURN    ${uuid}
