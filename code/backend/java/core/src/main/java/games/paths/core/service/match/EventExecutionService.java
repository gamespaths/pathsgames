package games.paths.core.service.match;

import games.paths.core.entity.story.ChoiceConditionEntity;
import games.paths.core.entity.story.ChoiceEffectEntity;
import games.paths.core.entity.story.ChoiceEntity;
import games.paths.core.entity.story.EventEffectEntity;
import games.paths.core.entity.story.EventEntity;
import games.paths.core.model.match.MatchStatuses;
import games.paths.core.model.story.CardInfo;
import games.paths.core.port.match.EdgeStateStorePort;
import games.paths.core.port.match.EventExecutionPort;
import games.paths.core.port.match.EventExecutionStorePort;
import games.paths.core.port.match.LocationEntryPort;
import games.paths.core.port.match.LocationEntryStorePort;
import games.paths.core.port.match.LocationEntryStorePort.LocationTriggerView;
import games.paths.core.port.match.TimeAdvancementPort;
import games.paths.core.port.match.EventExecutionStorePort.BackpackStats;
import games.paths.core.port.match.EventExecutionStorePort.CharacterStats;
import games.paths.core.port.match.EventExecutionStorePort.EventActorView;
import games.paths.core.port.match.EventExecutionStorePort.EventCheckContext;
import games.paths.core.port.match.EventExecutionStorePort.MatchEventView;
import games.paths.core.port.match.EventExecutionStorePort.ResourceDelta;
import games.paths.core.port.match.EventExecutionStorePort.TraitStats;
import games.paths.core.port.match.UserAccessPort;
import games.paths.core.port.story.ContentQueryPort;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * EventExecutionService - normal (player-triggered) events (Step 29).
 *
 * <p>Executes a NORMAL or ONCE event for the caller's character: the event is checked by
 * {@link EventAvailabilityChecker} (the same verdict {@code /info} publishes as
 * {@code available}), its energy and coin cost is paid once, then the whole
 * {@code id_event_next} chain applies its effects.</p>
 *
 * <p>Rules worth stating, because they are easy to get wrong:</p>
 * <ul>
 *   <li><b>Turns are untouched.</b> No turn is required and none is consumed — same as Step
 *       28 movement. {@code turnConsumed} is always false; Step 61 revisits this.</li>
 *   <li><b>Chained events are consequences, not choices.</b> They are not re-checked and
 *       cost nothing: the player already paid to start the chain. The single exception is
 *       the ONCE invariant, which is a data rule rather than an eligibility one.</li>
 *   <li><b>Coma short-circuits everything.</b> When life reaches zero the chain stops and
 *       {@code flag_end_time} does not fire. Step 30 added what happens next: the sadness
 *       and coma rules of {@link EdgeStateEvaluator}, and — once every character is down —
 *       the story's {@code id_event_all_player_coma} epilogue.</li>
 *   <li><b>{@code gameOver} is only a flag.</b> Moving the match to GAMEOVER is step 59,
 *       together with the rescue endpoints.</li>
 *   <li><b>Forced movement bypasses Step 28.</b> An effect's {@code id_location} (v0.29.3)
 *       moves its recipients with no neighbor, energy or availability check; only a cost-0
 *       movement log row is written per moved character.</li>
 * </ul>
 *
 * <p><b>Step 33</b> adds the other half of the engine: the events nobody asks for. This class
 * also implements {@link LocationEntryPort}, because the trigger resolution has to live next
 * to the chain runner — a forced move <em>is</em> an arrival, so applying an effect can fire
 * another automatic event, and splitting the two across services would only produce a
 * dependency cycle. Automatic events pay no cost, are never checked against the player-facing
 * availability verdict, and may never own choices.</p>
 *
 * <p>See {@code documentation_v0/Step29_NormalEvents.md} and
 * {@code documentation_v0/Step33_LocationEntryEvents.md}.</p>
 */
public class EventExecutionService implements EventExecutionPort, LocationEntryPort {

    private static final String DEFAULT_LANG = "en";
    private static final String ADD = "ADD";
    private static final String REMOVE = "REMOVE";
    /**
     * v0.35.1 — the third `action` an {@link ItemChange} can carry: the story wanted to
     * hand this item over and the character already holds max_per_character of it.
     *
     * <p>Reported, not thrown: the event runs, everything else it does still applies, and
     * the board is free to say "you already have as many as you can carry" — or, as
     * react-game does today, to say nothing and show the ordinary card.</p>
     */
    private static final String NOT_ADDED = "NOT_ADDED";
    private static final String TARGET_ONLY_ONE = "ONLY_ONE";

    /**
     * A chain longer than this is treated as broken and simply stops.
     *
     * <p>The Step 22 validator rejects cycles at import, but the admin CRUD path is lenient
     * and never sees the whole graph, so an authored {@code A → B → A} can reach the engine.
     * The visited set already breaks such a loop; this is the belt to its braces.</p>
     */
    private static final int MAX_CHAIN = 32;

    /**
     * How many arrivals one request may cascade through before the engine gives up
     * (Step 33).
     *
     * <p>An automatic event may move a character, and that move is itself an arrival, so
     * {@code A → move to B → move back to A} is a loop an author can write in two admin
     * form fields. Nothing else stops it: the {@link #MAX_CHAIN} visited set is per
     * {@code Exec} and a fresh arrival gets a fresh one. Without this cap such a story
     * would not merely misbehave — the request that triggered it would never return.</p>
     *
     * <p>Not creating the loop remains the author's responsibility; this only converts a
     * hung request into a logged abort.</p>
     */
    private static final int MAX_ENTRY_DEPTH = 8;

    private final EventExecutionStorePort store;
    private final EdgeStateStorePort edgeStore;
    private final UserAccessPort userAccessPort;
    private final ContentQueryPort contentQueryPort;
    private final TimeAdvancementService timeAdvancementService;
    /** Step 33. Null on the legacy constructor: no location store, no automatic events. */
    private final LocationEntryStorePort locationStore;

    /** Legacy constructor (pre-Step 33): automatic location events are disabled. */
    public EventExecutionService(EventExecutionStorePort store,
                                 EdgeStateStorePort edgeStore,
                                 UserAccessPort userAccessPort,
                                 ContentQueryPort contentQueryPort,
                                 TimeAdvancementService timeAdvancementService) {
        this(store, edgeStore, userAccessPort, contentQueryPort, timeAdvancementService, null);
    }

    public EventExecutionService(EventExecutionStorePort store,
                                 EdgeStateStorePort edgeStore,
                                 UserAccessPort userAccessPort,
                                 ContentQueryPort contentQueryPort,
                                 TimeAdvancementService timeAdvancementService,
                                 LocationEntryStorePort locationStore) {
        this.store = store;
        this.edgeStore = edgeStore;
        this.userAccessPort = userAccessPort;
        this.contentQueryPort = contentQueryPort;
        this.timeAdvancementService = timeAdvancementService;
        this.locationStore = locationStore;
    }

    @Override
    public EventExecutionResult executeEvent(String matchUuid, String userUuid,
                                             String eventUuid, String lang) {
        long userId = requireUser(userUuid);
        MatchEventView match = requireMatch(matchUuid);

        // The caller must own a character in this match (masked as not-found otherwise).
        EventActorView actor = store.findCharacterByMatchAndUser(match.id(), userId)
                .orElseThrow(EventExecutionService::notFound);

        if (!MatchStatuses.RUNNING.equals(match.status())) {
            throw new EventExecutionException(EventExecutionException.Code.MATCH_NOT_RUNNING,
                    "Match is not RUNNING");
        }

        EventEntity event = store.findEventByStoryAndUuid(match.idStory(), eventUuid)
                .orElseThrow(() -> new EventExecutionException(
                        EventExecutionException.Code.EVENT_NOT_FOUND,
                        "Event not found in this story"));

        EventCheckContext ctx = store.loadCheckContext(match.id(), actor.id());

        // Step 31: an event owning options presents them instead of applying anything.
        // The availability verdict moves inside the branch — an already-open cycle must
        // bypass it, having been paid for when it opened.
        List<ChoiceEntity> choices = store.findChoicesByEventId(match.idStory(),
                event.getId() == null ? 0L : event.getId());
        if (!choices.isEmpty()) {
            return executeChoiceEvent(match, actor, ctx, resolveLang(lang), event, choices);
        }

        EventAvailability verdict = EventAvailabilityChecker.check(event, ctx);
        if (!verdict.available()) {
            throw new EventExecutionException(verdict.reason(),
                    "Event cannot be executed: " + verdict.reasonName());
        }

        Exec x = new Exec(match, actor, ctx, resolveLang(lang), event);
        deductCosts(x, event);
        runChain(x, event);
        // Before the time-end branch, not after: forceTimeEnd flushes and latches x.flushed,
        // which would freeze the epilogue's own stat changes out of the database.
        resolveAllPlayerComa(x);
        if (x.endTime && !x.comaTriggered) {
            forceTimeEnd(x);
        }
        // Step 33 — an effect may have pushed somebody somewhere, and arriving is a trigger.
        drainArrivals(x, x.automaticEvents);
        return buildResult(x);
    }

    // ── costs ───────────────────────────────────────────────────────────────

    /**
     * Energy, coins, food and magic are paid once, by the actor, for the event they asked
     * for. The check procedure already proved they can afford it, so none can go negative.
     *
     * <p>v0.35.3 added the food and magic side. Only this method charges: an automatic
     * event, a chained one and a choice resolution all run through {@code applyEvent}
     * without ever reaching here, which is what makes "the engine never bills the player
     * for what the player did not ask" a property of the code rather than a convention.</p>
     */
    private void deductCosts(Exec x, EventEntity event) {
        x.energySpent = nz(event.getCostEnery());
        x.coinSpent = nz(event.getCostCoin());
        x.foodSpent = nz(event.getCostFood());
        x.magicSpent = nz(event.getCostMagic());
        x.costsPending = true;
        if (x.energySpent > 0) {
            Live actor = x.live(x.actor);
            actor.energy = TimeStartRecoveryService.clamp(actor.energy - x.energySpent, 0, actor.energyMax);
        }
        if (x.coinSpent > 0 || x.foodSpent > 0 || x.magicSpent > 0) {
            Live actor = x.live(x.actor);
            actor.coin = Math.max(0, actor.coin - x.coinSpent);
            actor.food = Math.max(0, actor.food - x.foodSpent);
            actor.magic = Math.max(0, actor.magic - x.magicSpent);
            actor.backpackDirty = true;
        }
    }

    /**
     * The {@code EVENT_EXECUTED} row, with the price on it exactly once and, since
     * v0.35.4, what this event alone gave back.
     *
     * <p>{@code applyEvent} runs for every event of a chain and the whole chain shares one
     * {@link Exec}, so the costs are stamped on the row of the event the player actually
     * asked for and every other row of the chain logs zeros — the sum over a match is then
     * what was really spent, not the top-level price repeated per chained event.</p>
     */
    private void logExecuted(Exec x, long eventId, String message, ResourceDelta gained) {
        boolean paid = x.costsPending && x.event != null && x.event.getId() != null
                && x.event.getId().longValue() == eventId;
        if (paid) {
            x.costsPending = false;
        }
        store.logEventExecuted(x.match.id(), x.actorId(), eventId, x.currentClock, message,
                paid ? new EventExecutionStorePort.SpentResources(
                        x.energySpent, x.foodSpent, x.magicSpent, x.coinSpent)
                     : EventExecutionStorePort.SpentResources.none(),
                gained);
    }

    // ── choices (Step 31) ───────────────────────────────────────────────────

    /**
     * A choice-event stops at its threshold: pay, mark, present — never apply. The whole
     * Step 29 tail (effects, {@code idEventNext} chain, {@code flag_end_time}, edge
     * states, epilogue, {@code gameOver}) belongs to the resolution, which is Step 32.
     *
     * <p>An OPEN cycle — {@code EVENT_EXECUTED} markers outnumbering
     * {@code CHOICE_SELECTED} markers — re-serves the options as a pure read: no verdict,
     * no cost, no marker. Bypassing the verdict is deliberate: the open already deducted
     * energy and consumed the ONCE, so re-checking would reject the very event the player
     * has paid for ({@code ONCE_ALREADY_CONSUMED}, or {@code NOT_ENOUGH_ENERGY} once the
     * cost brought them under it). Option availability, in contrast, is re-evaluated
     * fresh on every serve — the world may have changed since the open.</p>
     */
    private EventExecutionResult executeChoiceEvent(MatchEventView match, EventActorView actor,
                                                    EventCheckContext ctx, String lang,
                                                    EventEntity event, List<ChoiceEntity> choices) {
        long eventId = event.getId() == null ? 0L : event.getId();
        Exec x = new Exec(match, actor, ctx, lang, event);
        // The consumed set is already built from EVENT_EXECUTED markers, so the two count
        // queries run only for an event that was executed at least once.
        boolean openCycle = ctx.consumedEventIds().contains(eventId)
                && store.countLogMarkers(match.id(), eventId, EventExecutionStorePort.MSG_EVENT_EXECUTED)
                 > store.countLogMarkers(match.id(), eventId, EventExecutionStorePort.MSG_CHOICE_SELECTED);
        if (!openCycle) {
            EventAvailability verdict = EventAvailabilityChecker.check(event, ctx);
            if (!verdict.available()) {
                throw new EventExecutionException(verdict.reason(),
                        "Event cannot be executed: " + verdict.reasonName());
            }
            deductCosts(x, event);
            // The marker slice of applyEvent, without its effects: same message format,
            // so the ONCE accounting and the log timeline cannot tell the flows apart.
            x.visited.add(eventId);
            x.ctx.consumedEventIds().add(eventId);
            logExecuted(x, eventId, EventExecutionStorePort.MSG_EVENT_EXECUTED + " " + eventId,
                    ResourceDelta.none());
        }
        // Both paths: "index 0 is always the event" holds on a re-fetch too, so the
        // frontend cannot tell a page refresh from the first open (beside energySpent=0).
        x.executedEventUuids.add(event.getUuid());
        x.status = STATUS_CHOICES_PENDING;
        x.pendingChoices = buildPendingChoices(x, choices);
        return buildResult(x);
    }

    /** Evaluate and shape every option — sorted by priority then id, none dropped. */
    private List<PendingChoice> buildPendingChoices(Exec x, List<ChoiceEntity> choices) {
        Map<Long, List<ChoiceConditionEntity>> conditionsByChoice =
                store.findChoiceConditionsByChoiceId(x.match.idStory());
        ChoiceAvailabilityChecker.ChoiceCheckContext cctx =
                buildChoiceContext(x, choices, conditionsByChoice);
        List<ChoiceEntity> ordered = new ArrayList<>(choices);
        ordered.sort(Comparator
                .comparingInt((ChoiceEntity c) -> nz(c.getPriority()))
                .thenComparingLong(c -> c.getId() == null ? 0L : c.getId()));
        List<PendingChoice> out = new ArrayList<>();
        for (ChoiceEntity choice : ordered) {
            List<ChoiceConditionEntity> rows = choice.getId() == null
                    ? List.of()
                    : conditionsByChoice.getOrDefault(choice.getId(), List.of());
            ChoiceAvailabilityChecker.ChoiceAvailability availability =
                    ChoiceAvailabilityChecker.check(choice, rows, cctx);
            out.add(new PendingChoice(choice.getUuid(), choice.getPriority(),
                    store.resolveShortText(x.match.idStory(), choice.getIdTextName(), x.lang),
                    store.resolveShortText(x.match.idStory(), choice.getIdTextDescription(), x.lang),
                    resolveCard(x, choice.getIdCard()),
                    availability.available(), availability.reason()));
        }
        return out;
    }

    /**
     * One context for N options. The party reads (locations, stat sums) and the trait
     * read cost a query each, so they happen only when some condition needs them.
     */
    private ChoiceAvailabilityChecker.ChoiceCheckContext buildChoiceContext(
            Exec x, List<ChoiceEntity> choices,
            Map<Long, List<ChoiceConditionEntity>> conditionsByChoice) {
        boolean needsParty = false;
        boolean needsTraits = false;
        Set<String> sumKeys = new HashSet<>();
        for (ChoiceEntity choice : choices) {
            List<ChoiceConditionEntity> rows = choice.getId() == null
                    ? List.<ChoiceConditionEntity>of()
                    : conditionsByChoice.getOrDefault(choice.getId(), List.of());
            for (ChoiceConditionEntity row : rows) {
                String type = row.getType() == null ? "" : row.getType().trim().toUpperCase();
                switch (type) {
                    case "ALL_IN_SAME_LOC" -> needsParty = true;
                    case "TRAITS" -> needsTraits = true;
                    case "STATISTICS_SUM" -> {
                        needsParty = true;
                        if (row.getKey() != null && !row.getKey().isBlank()) {
                            sumKeys.add(row.getKey().trim().toLowerCase());
                        }
                    }
                    default -> { /* the other types read the actor-only context */ }
                }
            }
        }

        Map<String, Integer> actorStats = actorStatsOf(x);
        List<Long> partyLocations = new ArrayList<>();
        Map<String, Integer> partyStatSums = new HashMap<>();
        if (needsParty) {
            boolean sumsNeedBackpack = sumKeys.contains("food") || sumKeys.contains("magic")
                    || sumKeys.contains("coin");
            for (EventActorView member : x.allCharacters()) {
                partyLocations.add(x.locationOf(member));
                Map<String, Integer> memberStats = member.id() == x.actor.id()
                        ? actorStats
                        : viewStats(member, sumsNeedBackpack
                                ? store.findBackpack(x.match.id(), member.id())
                                        .orElse(new BackpackStats(0, 0, 0))
                                : null);
                for (String key : sumKeys) {
                    partyStatSums.merge(key, memberStats.getOrDefault(key, 0), Integer::sum);
                }
            }
        }
        return new ChoiceAvailabilityChecker.ChoiceCheckContext(
                actorStats, x.actor.idClass(), x.locationOf(x.actor),
                x.ctx.ownedItemIds(),
                needsTraits
                        ? store.findTraitIdsByCharacter(x.match.id(), x.actor.id())
                        : Set.of(),
                x.ctx.registry(),
                partyLocations, partyStatSums);
    }

    /**
     * The actor as the checker must see them: post-deduction when the open just paid.
     * The read-only path must NOT go through {@code x.live()} — that would enrol the
     * actor in the flush and write rows nothing has changed.
     */
    private Map<String, Integer> actorStatsOf(Exec x) {
        Live enrolled = x.living.get(x.actor.id());
        if (enrolled == null) {
            return viewStats(x.actor, store.findBackpack(x.match.id(), x.actor.id())
                    .orElse(new BackpackStats(0, 0, 0)));
        }
        Map<String, Integer> stats = new HashMap<>();
        stats.put("life", enrolled.life);
        stats.put("energy", enrolled.energy);
        stats.put("sad", enrolled.sad);
        stats.put("exp", enrolled.exp);
        stats.put("dex", enrolled.dexterity);
        stats.put("int", enrolled.intelligence);
        stats.put("cos", enrolled.constitution);
        stats.put("food", enrolled.food);
        stats.put("magic", enrolled.magic);
        stats.put("coin", enrolled.coin);
        return stats;
    }

    /** Backpack null when the caller does not need food/magic/coin for this member. */
    private static Map<String, Integer> viewStats(EventActorView v, BackpackStats backpack) {
        Map<String, Integer> stats = new HashMap<>();
        stats.put("life", v.life());
        stats.put("energy", v.energy());
        stats.put("sad", v.sad());
        stats.put("exp", v.exp());
        stats.put("dex", v.dexterity());
        stats.put("int", v.intelligence());
        stats.put("cos", v.constitution());
        if (backpack != null) {
            stats.put("food", backpack.food());
            stats.put("magic", backpack.magic());
            stats.put("coin", backpack.coin());
        }
        return stats;
    }

    // ── choice resolution (Step 32) ─────────────────────────────────────────

    /**
     * Resolve one option of an open choice-event: apply its {@code list_choices_effects},
     * run the events they and {@code idEventTorun} point at, record the milestone, close
     * the cycle.
     *
     * <p><b>Nothing is charged.</b> The energy, the coins and the ONCE were all spent when
     * the event was opened (Step 31), which is what makes the open-cycle count — not the
     * Step 29 availability procedure — the right gate here: re-running that procedure would
     * reject the very event the player has already paid for. The count comparison doubles
     * as the cost-bypass guard, since it is false both for an event never opened and for one
     * already resolved.</p>
     */
    @Override
    public ChoiceResolutionResult selectChoice(String matchUuid, String userUuid,
                                               String choiceUuid, String lang) {
        long userId = requireUser(userUuid);
        MatchEventView match = requireMatch(matchUuid);
        EventActorView actor = store.findCharacterByMatchAndUser(match.id(), userId)
                .orElseThrow(EventExecutionService::notFound);

        if (!MatchStatuses.RUNNING.equals(match.status())) {
            throw new EventExecutionException(EventExecutionException.Code.MATCH_NOT_RUNNING,
                    "Match is not RUNNING");
        }

        ChoiceEntity choice = store.findChoiceByStoryAndUuid(match.idStory(), choiceUuid)
                .orElseThrow(() -> new EventExecutionException(
                        EventExecutionException.Code.CHOICE_NOT_FOUND,
                        "Choice not found in this story"));

        EventCheckContext ctx = store.loadCheckContext(match.id(), actor.id());
        // Coma outranks sleep, as everywhere else: a comatose character is also flagged
        // asleep, and the two are not the same news — one waits, the other needs a rescue.
        if (ctx.coma()) {
            throw new EventExecutionException(EventExecutionException.Code.COMA,
                    "Character is in a coma");
        }
        if (ctx.sleeping()) {
            throw new EventExecutionException(EventExecutionException.Code.SLEEPING,
                    "Character is sleeping");
        }

        // R8 (Step 31) makes idEvent mandatory on import, but the CRUD path is lenient, so
        // an orphan option can reach the engine — it resolves to no cycle and is rejected.
        long eventId = choice.getIdEvent() == null ? 0L : choice.getIdEvent().longValue();
        Map<Long, EventEntity> eventsById = store.findEventsById(match.idStory());
        EventEntity event = eventsById.get(eventId);
        if (event == null) {
            throw new EventExecutionException(EventExecutionException.Code.EVENT_NOT_FOUND,
                    "The event owning this choice does not exist");
        }
        if (store.countLogMarkers(match.id(), eventId, EventExecutionStorePort.MSG_EVENT_EXECUTED)
                <= store.countLogMarkers(match.id(), eventId,
                        EventExecutionStorePort.MSG_CHOICE_SELECTED)) {
            throw new EventExecutionException(EventExecutionException.Code.CHOICE_NOT_OPEN,
                    "No open choice cycle for this event: open it before resolving it");
        }

        Exec x = new Exec(match, actor, ctx, resolveLang(lang), event);
        x.eventsById = eventsById; // already read above — do not pay for the map twice

        requireStillAvailable(x, choice);

        long choiceId = choice.getId() == null ? 0L : choice.getId();
        applyChoiceEffects(x, choiceId, eventId, event);
        // The option's own outcome event, last: every effect row has set the stage (a key
        // written, an item granted) that the outcome event is authored to read.
        if (!x.comaTriggered && !STATUS_CHOICES_PENDING.equals(x.status)) {
            runLinkedEvent(x, choice.getIdEventTorun());
        }

        resolveAllPlayerComa(x);
        if (x.endTime && !x.comaTriggered) {
            forceTimeEnd(x);
        }

        writeResolutionMarkers(x, choice, eventId, choiceId);

        // Step 33 — a forced move inside an option's effects is an arrival like any other.
        drainArrivals(x, x.automaticEvents);

        return new ChoiceResolutionResult(buildResult(x), choice.getUuid(), event.getUuid(),
                store.resolveShortText(match.idStory(), choice.getIdTextNarrative(), x.lang),
                resolveCard(x, choice.getIdCard()),
                x.choiceEventUuid, x.choiceEventCard,
                x.progressRecorded);
    }

    /**
     * The option's verdict, re-evaluated now rather than trusted from the open: the world
     * may have moved since the options were served — an item spent, a stat drained, a key
     * flipped by another action — and an option that has become impossible must not resolve.
     */
    private void requireStillAvailable(Exec x, ChoiceEntity choice) {
        Map<Long, List<ChoiceConditionEntity>> conditionsByChoice =
                store.findChoiceConditionsByChoiceId(x.match.idStory());
        List<ChoiceConditionEntity> rows = choice.getId() == null
                ? List.of()
                : conditionsByChoice.getOrDefault(choice.getId(), List.of());
        ChoiceAvailabilityChecker.ChoiceAvailability verdict = ChoiceAvailabilityChecker.check(
                choice, rows, buildChoiceContext(x, List.of(choice), conditionsByChoice));
        if (!verdict.available()) {
            throw new EventExecutionException(EventExecutionException.Code.CHOICE_NOT_AVAILABLE,
                    "Choice cannot be selected: " + verdict.reason());
        }
    }

    /**
     * Every {@code list_choices_effects} row of the option, in authored (id) order, then the
     * events those rows link to.
     *
     * <p>The two phases mirror {@code applyEvent} exactly, and for the same reason. All the
     * rows land first, then the Step 30 rules get their single pass over whoever they
     * touched — so a lethal row does <b>not</b> silence its siblings, any more than a lethal
     * effect silences the other effects of its event. What a coma does stop is the
     * consequences: a character who can no longer act does not act out what follows.</p>
     *
     * <p>The links run after every row for the same reason the outcome event does: an event
     * authored to read a key the option writes must find it already written.</p>
     */
    private void applyChoiceEffects(Exec x, long choiceId, long eventId, EventEntity event) {
        List<Integer> linked = new ArrayList<>();
        for (ChoiceEffectEntity effect : store.findChoiceEffectsByChoiceId(x.match.idStory(), choiceId)) {
            applyChoiceEffect(x, effect, event);
            if (effect.getIdEvent() != null && effect.getIdEvent() > 0) {
                linked.add(effect.getIdEvent());
            }
        }
        // No applyEvent ran for these rows, so the edge pass has to be given here — once,
        // over everyone the rows touched, exactly where applyEvent would have run it.
        checkEdgeStates(x, eventId);
        for (Integer link : linked) {
            if (x.comaTriggered || STATUS_CHOICES_PENDING.equals(x.status)) {
                return; // down, or waiting on the player again: the rest is not ours to run
            }
            runLinkedEvent(x, link);
        }
    }

    /**
     * One {@code list_choices_effects} row. The vocabulary is the event effects' own — the
     * helpers are literally the same methods — with two differences that come from the
     * table rather than from the engine:
     *
     * <ul>
     *   <li>who it lands on is {@code flag_group}, not {@code target}/{@code target_class};</li>
     *   <li>the registry pair is {@code key}/{@code value_to_add} plus a
     *       {@code value_to_remove} that events have no equivalent of.</li>
     * </ul>
     *
     * <p>{@code id_event} is collected rather than run here — see
     * {@link #applyChoiceEffects} for why the links wait until every row has landed.</p>
     */
    private void applyChoiceEffect(Exec x, ChoiceEffectEntity effect, EventEntity event) {
        List<EventActorView> recipients = resolveChoiceRecipients(x, effect);

        // Weather belongs to the MATCH: once per row, however many characters it targets.
        if (effect.getIdWeather() != null && effect.getIdWeather() > 0) {
            store.setCurrentWeather(x.match.id(), effect.getIdWeather().longValue());
            x.weatherApplied = true;
        }

        List<String> touched = new ArrayList<>();
        for (EventActorView recipient : recipients) {
            touched.add(recipient.uuid());
            applyStat(x, recipient, effect.getStatistics(), nz(effect.getValue()));
            applyItem(x, recipient, effect.getIdItemTarget(), effect.getItemAction(),
                    event.getId());
            applyMove(x, recipient, effect.getIdLocation());
        }
        applyChoiceRegistryEffect(x, effect, event);

        // The row's OWN card is the narrative, exactly as for an event effect.
        x.effects.add(new AppliedEffect(event.getUuid(), effect.getUuid(),
                effect.getStatistics(), effect.getValue(),
                nz(effect.getFlagGroup()) == 1 ? "ALL" : TARGET_ONLY_ONE, null, touched,
                resolveCard(x, effect.getIdCard())));
    }

    /**
     * INV-46: {@code flag_group = 1} means every character standing in the actor's location
     * — the same set an event effect's {@code target=ALL} resolves (INV-27), never every
     * character of the match. Anything else is the acting character alone.
     */
    private List<EventActorView> resolveChoiceRecipients(Exec x, ChoiceEffectEntity effect) {
        Long actorLocation = x.locationOf(x.actor);
        if (nz(effect.getFlagGroup()) != 1 || actorLocation == null) {
            return List.of(x.actor);
        }
        List<EventActorView> group = new ArrayList<>();
        for (EventActorView c : x.allCharacters()) {
            if (actorLocation.equals(x.locationOf(c))) {
                group.add(c);
            }
        }
        return group;
    }

    /**
     * The registry pair of a choice effect. {@code value_to_add} sets the key;
     * {@code value_to_remove} clears it, but only when the stored value actually matches —
     * an option must not be able to wipe a key some other branch of the story has since
     * moved on. Written once per row by the actor: the registry is match-scoped.
     */
    private void applyChoiceRegistryEffect(Exec x, ChoiceEffectEntity effect, EventEntity event) {
        String key = effect.getKey();
        if (blank(key)) {
            return;
        }
        String old = x.ctx.registry().get(key);
        String add = effect.getValueToAdd();
        String remove = effect.getValueToRemove();
        String value;
        if (!blank(add)) {
            value = add;
        } else if (!blank(remove) && remove.equals(old)) {
            value = null; // clears both value columns — the key reads as unset afterwards
        } else {
            return;
        }
        store.upsertRegistry(x.match.id(), key, value, x.actor.id(), event.getId(), x.currentClock);
        x.ctx.registry().put(key, value);
        x.registryChanges.add(new RegistryChange(key, old, value));
    }

    /**
     * Run an event a choice points at — {@code idEventTorun} on the option, or
     * {@code id_event} on one of its effect rows.
     *
     * <p>A linked event is a <b>consequence</b>, so it is neither re-checked nor charged
     * (the Step 29 chain rule). If it is itself a choice-event the resolution does not
     * apply its effects — they are withheld by definition — but presents its options
     * instead, so a story that chains a choice onto a choice keeps working; the options are
     * served free, the open having already been paid for by the choice that led here.</p>
     */
    private void runLinkedEvent(Exec x, Integer idEvent) {
        if (idEvent == null || idEvent <= 0) {
            return;
        }
        long linkedId = idEvent.longValue();
        EventEntity linked = x.eventsById().get(linkedId);
        if (linked == null || x.visited.contains(linkedId)) {
            return; // dangling id, or already run in this resolution
        }
        if (EventAvailabilityChecker.TYPE_ONCE.equalsIgnoreCase(linked.getType())
                && x.ctx.consumedEventIds().contains(linkedId)) {
            return; // a spent ONCE stays spent, whoever points at it
        }
        List<ChoiceEntity> nested = store.findChoicesByEventId(x.match.idStory(), linkedId);
        if (!nested.isEmpty()) {
            x.visited.add(linkedId);
            x.ctx.consumedEventIds().add(linkedId);
            x.executedEventUuids.add(linked.getUuid());
            logExecuted(x, linkedId, EventExecutionStorePort.MSG_EVENT_EXECUTED + " " + linkedId,
                    ResourceDelta.none());
            x.status = STATUS_CHOICES_PENDING;
            x.pendingChoices = buildPendingChoices(x, nested);
            return;
        }
        if (x.choiceEventUuid == null) {
            x.choiceEventUuid = linked.getUuid();
            x.choiceEventCard = resolveCard(x, linked.getIdCard());
        }
        runChain(x, linked);
    }

    /**
     * Close the cycle. Order matters only in that all three rows describe a resolution that
     * has already happened — the effects and the linked events ran first, so a failure
     * midway leaves no marker claiming otherwise.
     *
     * <p>The {@code CHOICE_SELECTED} marker carries the OWNING EVENT's id, never the
     * option's: {@link EventExecutionStorePort#countLogMarkers} pairs it against
     * {@code EVENT_EXECUTED} by event, and a row stamped with the choice id would leave the
     * cycle open for ever.</p>
     */
    private void writeResolutionMarkers(Exec x, ChoiceEntity choice, long eventId, long choiceId) {
        store.logEventExecuted(x.match.id(), x.actor.id(), eventId, x.currentClock,
                EventExecutionStorePort.MSG_CHOICE_SELECTED + " " + eventId,
                EventExecutionStorePort.SpentResources.none(), ResourceDelta.none());
        store.logChoiceExecuted(x.match.id(), eventId, choiceId, x.currentClock,
                EventExecutionStorePort.MSG_CHOICE_SELECTED + " " + choiceId);
        if (nz(choice.getIsProgress()) == 1) {
            store.insertStoryProgress(x.match.id(), eventId, choiceId, x.currentClock);
            x.progressRecorded = true;
        }
    }

    // ── the chain ───────────────────────────────────────────────────────────

    private void runChain(Exec x, EventEntity first) {
        EventEntity current = first;
        while (current != null) {
            applyEvent(x, current, x.effectsByEvent(), x.endGameId());
            // Coma stops the chain, and flag_end_time with it — but not the all-players-in-coma
            // epilogue, which by definition runs only once everyone is already down.
            if (x.comaTriggered && !x.epiloguePhase) {
                return;
            }
            Integer next = current.getIdEventNext();
            if (next == null || next <= 0) {
                return;
            }
            long nextId = next.longValue();
            if (x.visited.contains(nextId) || x.visited.size() >= MAX_CHAIN) {
                return; // authored loop, or a chain long enough to be a bug
            }
            EventEntity nextEvent = x.eventsById().get(nextId);
            if (nextEvent == null) {
                return; // dangling idEventNext
            }
            if (EventAvailabilityChecker.TYPE_ONCE.equalsIgnoreCase(nextEvent.getType())
                    && x.ctx.consumedEventIds().contains(nextId)) {
                return; // a spent ONCE event stays spent, even mid-chain
            }
            current = nextEvent;
        }
    }

    /** Apply one event of the chain: its effects, then the coma check, the flags and the log. */
    private void applyEvent(Exec x, EventEntity event,
                            Map<Long, List<EventEffectEntity>> effectsByEvent, Long endGameId) {
        long eventId = event.getId() == null ? 0L : event.getId();
        x.visited.add(eventId);
        x.ctx.consumedEventIds().add(eventId);
        x.executedEventUuids.add(event.getUuid());

        // v0.35.4 — the mark is taken before the effects run, so a chained event logs what
        // it gave and not what the events before it in the same chain already did.
        int[] gainsMark = x.gainsMark();
        for (EventEffectEntity effect : effectsByEvent.getOrDefault(eventId, List.of())) {
            applyEffect(x, event, effect);
        }

        x.endTime = x.endTime || nz(event.getFlagEndTime()) == 1;
        x.gameOver = x.gameOver || (endGameId != null && endGameId == eventId);

        checkEdgeStates(x, eventId);
        logExecuted(x, eventId, EventExecutionStorePort.MSG_EVENT_EXECUTED + " " + eventId,
                x.gainsSince(gainsMark));
    }

    // ── effects ─────────────────────────────────────────────────────────────

    private void applyEffect(Exec x, EventEntity event, EventEffectEntity effect) {
        List<EventActorView> recipients = resolveRecipients(x, effect);

        // Weather and the registry are properties of the MATCH, not of a character: each
        // applies once per effect row no matter how many (or how few) characters that row
        // targets — including none at all, which is what a counter-zero fuse in an empty
        // location resolves to (Step 33).
        if (effect.getIdWeather() != null && effect.getIdWeather() > 0) {
            store.setCurrentWeather(x.match.id(), effect.getIdWeather().longValue());
            x.weatherApplied = true;
        }
        applyRegistryEffect(x, effect, event);

        List<String> touched = new ArrayList<>();
        for (EventActorView recipient : recipients) {
            touched.add(recipient.uuid());
            applyStat(x, recipient, effect.getStatistics(), nz(effect.getValue()));
            applyItem(x, recipient, effect.getIdItemTarget(), effect.getItemAction(),
                    event.getId());
            applyTraitEffects(x, recipient, effect, event);
            applyCharacteristicEffects(x, recipient, effect);
            applyMove(x, recipient, effect.getIdLocation());
        }

        x.effects.add(new AppliedEffect(event.getUuid(), effect.getUuid(),
                effect.getStatistics(), effect.getValue(), effect.getTarget(),
                effect.getTargetClass(), touched,
                resolveCard(x, effect.getIdCard())));
    }

    /**
     * INV-27: {@code ALL} means every character standing in the actor's location, not every
     * character of the match. {@code target_class} then narrows that set; matching nobody is
     * legal and simply applies nothing.
     */
    private List<EventActorView> resolveRecipients(Exec x, EventEffectEntity effect) {
        String target = effect.getTarget() == null ? "ALL" : effect.getTarget().trim().toUpperCase();
        List<EventActorView> base = new ArrayList<>();
        // Locations come from the tracked map, not the views: a forced movement earlier in
        // the chain must be seen by the effects that follow it.
        // Step 33 — an automatic event may have no actor at all (a counter reaching zero in a
        // location nobody stands in). There is then nobody to be a recipient: the row's
        // match-scoped halves (weather, registry) have already been applied by the caller.
        if (x.actor == null) {
            return List.of();
        }
        Long actorLocation = x.locationOf(x.actor);
        if (TARGET_ONLY_ONE.equals(target) || actorLocation == null) {
            base.add(x.actor);
        } else {
            for (EventActorView c : x.allCharacters()) {
                if (actorLocation.equals(x.locationOf(c))) {
                    base.add(c);
                }
            }
        }
        Integer targetClass = effect.getTargetClass();
        if (targetClass == null || targetClass <= 0) {
            return base;
        }
        List<EventActorView> narrowed = new ArrayList<>();
        for (EventActorView c : base) {
            if (Long.valueOf(targetClass.longValue()).equals(c.idClass())) {
                narrowed.add(c);
            }
        }
        return narrowed;
    }

    /**
     * life/energy/sad/dex/int/cos/exp on the character; food/magic/coin on the backpack.
     *
     * <p>Takes the statistic and the delta rather than an effect row, so the Step 32 choice
     * effects — a different table, the same vocabulary — move a stat through exactly this
     * code and cannot drift from it.</p>
     */
    private void applyStat(Exec x, EventActorView recipient, String stat, int delta) {
        if (stat == null || stat.isBlank()) {
            return;
        }
        Live c = x.live(recipient);
        int before;
        int after;
        switch (stat.trim().toLowerCase()) {
            case "life" -> {
                before = c.life;
                c.life = TimeStartRecoveryService.clamp(c.life + delta, 0, c.lifeMax);
                after = c.life;
            }
            case "energy" -> {
                before = c.energy;
                c.energy = TimeStartRecoveryService.clamp(c.energy + delta, 0, c.energyMax);
                after = c.energy;
            }
            case "sad" -> {
                before = c.sad;
                c.setSad(c.sad + delta);
                after = c.sad;
            }
            case "exp" -> {
                before = c.exp;
                c.exp = Math.max(0, c.exp + delta);
                after = c.exp;
            }
            case "dex" -> {
                before = c.dexterity;
                c.dexterity = Math.max(0, c.dexterity + delta);
                after = c.dexterity;
            }
            case "int" -> {
                before = c.intelligence;
                c.intelligence = Math.max(0, c.intelligence + delta);
                after = c.intelligence;
            }
            case "cos" -> {
                before = c.constitution;
                c.constitution = Math.max(0, c.constitution + delta);
                after = c.constitution;
            }
            case "food" -> {
                before = c.food;
                c.food = Math.max(0, c.food + delta);
                after = c.food;
                c.backpackDirty = true;
            }
            case "magic" -> {
                before = c.magic;
                c.magic = Math.max(0, c.magic + delta);
                after = c.magic;
                c.backpackDirty = true;
            }
            case "coin" -> {
                before = c.coin;
                c.coin = Math.max(0, c.coin + delta);
                after = c.coin;
                c.backpackDirty = true;
            }
            default -> {
                return; // an unknown statistic is authored noise, not an error
            }
        }
        String normalized = stat.trim().toLowerCase();
        if (x.isActor(recipient.id())) {
            // The log row is character-scoped: only the actor's own resources ride on it.
            x.recordGain(normalized, after - before);
        }
        x.statChanges.add(new StatChange(recipient.uuid(), normalized,
                before, after, after - before));
    }

    /**
     * ADD one unit of {@code idItem}, or REMOVE every unit of it. Shared with the Step 32
     * choice effects.
     *
     * <p>v0.35.1 — an ADD past {@code max_per_character} is refused and reported as a
     * {@link #NOT_ADDED} change. The owned-items set is left alone in that case: the
     * character does hold the item, just not one more of it, so a later condition in this
     * same execution must keep reading "owned".</p>
     */
    private void applyItem(Exec x, EventActorView recipient, Integer idItem, String action,
                           Long idEvent) {
        if (idItem == null || idItem <= 0 || action == null) {
            return;
        }
        long itemId = idItem.longValue();
        String itemUuid = x.itemUuids().get(itemId);
        if (ADD.equalsIgnoreCase(action.trim())) {
            boolean added = store.addItem(x.match.id(), recipient.id(), itemId,
                    x.itemMaxPerCharacter().get(itemId));
            x.itemChanges.add(new ItemChange(recipient.uuid(), itemUuid, added ? ADD : NOT_ADDED));
            if (!added) {
                // Nothing changed in the bag, so nothing needs refreshing on its account.
                // Nothing is logged either: a refused ADD is not a thing that happened.
                return;
            }
            logItemAction(x, recipient, itemId,
                    EventExecutionStorePort.ITEM_ACTION_ADD, idEvent);
            x.itemAdded = true;
            if (x.isActor(recipient.id())) {
                x.ctx.ownedItemIds().add(itemId);
            }
        } else if (REMOVE.equalsIgnoreCase(action.trim())
                && store.removeItem(x.match.id(), recipient.id(), itemId)) {
            logItemAction(x, recipient, itemId,
                    EventExecutionStorePort.ITEM_ACTION_REMOVE, idEvent);
            x.itemRemoved = true;
            x.itemChanges.add(new ItemChange(recipient.uuid(), itemUuid, REMOVE));
            if (x.isActor(recipient.id())) {
                // Correct now that a REMOVE takes every unit: before v0.35.1 it took one
                // and cleared the flag anyway, so a later condition read "not owned" while
                // the bag still held two.
                x.ctx.ownedItemIds().remove(itemId);
            }
        }
    }

    /**
     * v0.35.4 — the {@code log_item_usage} row of an item an effect moved. The counter is 1
     * because an effect grants or takes one unit; a REMOVE that empties a stack of three
     * still describes one authored action, and the amount lives in the inventory, not here.
     */
    private void logItemAction(Exec x, EventActorView recipient, long itemId, String action,
                               Long idEvent) {
        store.logItemAction(x.match.id(), recipient.id(), itemId, action, 1, idEvent, null,
                ResourceDelta.none());
    }

    private void applyTraitEffects(Exec x, EventActorView recipient, EventEffectEntity effect,
                                   EventEntity event) {
        applyTraits(x, recipient, effect.getTraitsToAdd(), effect.getTraitsToRemove(), event.getId());
    }

    /**
     * Takes the two CSVs rather than an effect row, so a table that is not
     * {@code list_events_effects} — {@code list_items_effects} since Step 34 — flips
     * traits through exactly this code and cannot drift from it. Same rationale as
     * {@link #applyStat}.
     */
    private void applyTraits(Exec x, EventActorView recipient, String traitsToAdd,
                             String traitsToRemove, Long idEvent) {
        for (long idTrait : csvIds(traitsToAdd)) {
            if (store.addTrait(x.match.id(), recipient.id(), idTrait, idEvent)) {
                x.traitChanges.add(new TraitChange(recipient.uuid(), x.traitUuids().get(idTrait), ADD));
                applyTraitStats(x, recipient, idTrait, 1);
            }
        }
        for (long idTrait : csvIds(traitsToRemove)) {
            if (store.removeTrait(x.match.id(), recipient.id(), idTrait)) {
                x.traitChanges.add(new TraitChange(recipient.uuid(), x.traitUuids().get(idTrait), REMOVE));
                applyTraitStats(x, recipient, idTrait, -1);
            }
        }
    }

    /**
     * v0.35.2 — a trait carries stat deltas, and until this version they were applied only
     * at character creation: a trait handed over by an event or an item wrote its row and
     * changed nothing, while its card went on promising "+2 life" to a player whose life
     * bar never moved.
     *
     * <p>The maxima are a plain sum (template + class + difficulty + traits + class
     * bonuses), so adding the trait's own deltas gives exactly what recomputing the whole
     * formula would, without loading that graph again. {@code sign} is +1 on a grant and -1
     * on a removal, which makes the two directions the same code and keeps them exact
     * inverses.</p>
     *
     * <p>Current life and energy follow their ceiling, because a character is CREATED full:
     * a +2 life trait heals two, and losing it takes two back. Sadness does not follow its
     * ceiling, because a character is created at zero sadness — a trait raises the room
     * available, it does not make anyone sadder. Dexterity, intelligence and constitution
     * have no ceiling at all, so their delta lands directly. Every value is clamped, and
     * the clamp reads the ceiling AFTER it moved.</p>
     */
    private void applyTraitStats(Exec x, EventActorView recipient, long idTrait, int sign) {
        TraitStats t = x.traitStats().get(idTrait);
        if (t == null) {
            return; // a trait id no story row matches is authored noise, not an error
        }
        Live c = x.live(recipient);
        c.lifeMax = Math.max(0, c.lifeMax + sign * t.life());
        c.energyMax = Math.max(0, c.energyMax + sign * t.energy());
        c.sadMax = Math.max(0, c.sadMax + sign * t.sad());
        c.weightMax = Math.max(0, c.weightMax + sign * t.weight());

        moveStat(x, recipient, "life", sign * t.life());
        moveStat(x, recipient, "energy", sign * t.energy());
        moveStat(x, recipient, "dex", sign * t.dexterity());
        moveStat(x, recipient, "int", sign * t.intelligence());
        moveStat(x, recipient, "cos", sign * t.constitution());
        // The sadness ceiling moved above; the current value stays where it was, and the
        // clamp below is what keeps it inside a ceiling that may have come down.
        c.setSad(c.sad);
    }

    /** Moves one statistic through {@link #applyStat}, skipping the no-op deltas. */
    private void moveStat(Exec x, EventActorView recipient, String stat, int delta) {
        if (delta != 0) {
            applyStat(x, recipient, stat, delta);
        }
    }

    private void applyCharacteristicEffects(Exec x, EventActorView recipient, EventEffectEntity effect) {
        String add = effect.getCharacteristicToAdd();
        String remove = effect.getCharacteristicToRemove();
        if (blank(add) && blank(remove)) {
            return;
        }
        Live c = x.live(recipient);
        for (String v : csv(add)) {
            if (c.characteristics.add(v)) {
                x.characteristicChanges.add(new CharacteristicChange(recipient.uuid(), v, ADD));
                c.characteristicsDirty = true;
            }
        }
        for (String v : csv(remove)) {
            if (c.characteristics.remove(v)) {
                x.characteristicChanges.add(new CharacteristicChange(recipient.uuid(), v, REMOVE));
                c.characteristicsDirty = true;
            }
        }
    }

    /**
     * The registry is match-scoped, so it is written once per effect row — never once per
     * recipient, and never at all when the row names no key. The in-memory context is updated
     * too, so a later event in the same chain sees the value its predecessor just wrote.
     *
     * <p>Step 33 hoisted this out of the per-recipient loop where it used to sit behind an
     * {@code == actor} guard. The write is identical when an actor exists, and it now also
     * happens when there is none — an automatic event firing in an empty location still
     * changes the world, it just has nobody to change.</p>
     */
    private void applyRegistryEffect(Exec x, EventEffectEntity effect, EventEntity event) {
        String key = effect.getKeyToAdd();
        if (blank(key)) {
            return;
        }
        String value = effect.getKeyValueToAdd();
        String old = x.ctx.registry().get(key);
        store.upsertRegistry(x.match.id(), key, value, x.actorId(), event.getId(), x.currentClock);
        x.ctx.registry().put(key, value);
        x.registryChanges.add(new RegistryChange(key, old, value));
    }

    /**
     * v0.29.3 forced movement: the recipient is moved to {@code id_location}, skipping the
     * whole Step 28 procedure — no neighbor check, no energy cost, no availability verdict.
     * An id that matches no location of the story is authored noise and is skipped; so is a
     * move to the location the recipient already stands in. The tracked position is updated,
     * so a later effect of the same chain resolves {@code target=ALL} where the recipient
     * now stands.
     *
     * <p>Shared verbatim with the Step 32 choice effects: an option that relocates the party
     * relocates it by the same rules an event does.</p>
     */
    private void applyMove(Exec x, EventActorView recipient, Integer idLocation) {
        if (idLocation == null || idLocation <= 0) {
            return;
        }
        long target = idLocation.longValue();
        String targetUuid = x.locationUuids().get(target);
        if (targetUuid == null) {
            return; // authored noise, not an error
        }
        Long from = x.locationOf(recipient);
        if (from != null && from == target) {
            return; // already there: nothing to move, nothing to log
        }
        store.updateCharacterLocation(x.match.id(), recipient.id(), target);
        store.insertMovementLog(x.match.id(), recipient.id(), from, target, 0, 0, 0, 0);
        x.setLocation(recipient.id(), target);
        x.movementApplied = true;
        x.locationChanges.add(new LocationChange(recipient.uuid(),
                from == null ? null : x.locationUuids().get(from), targetUuid));
        // Step 33 — a forced move is an arrival like any other, so it can fire the
        // destination's entry triggers. It is queued rather than resolved here: the rest of
        // this event's effects must land (and be flushed) before another Exec reads the
        // character rows back, or the second event would work from stale stats.
        x.pendingArrivals.add(new long[]{recipient.id(), target});
    }

    // ── edge states & time-end ──────────────────────────────────────────────

    /**
     * Step 30: run the sadness-overflow and coma rules over every character this event
     * touched. Only touched characters can have changed, so {@code living} is the right set.
     *
     * <p>Resetting {@code sad} and latching {@code comaSet} here is what makes the rules
     * idempotent for the rest of the chain: the next event of the chain re-runs this method
     * and finds nothing left to fire.</p>
     */
    private void checkEdgeStates(Exec x, Long idEvent) {
        for (Live c : x.living.values()) {
            EdgeStateEvaluator.Verdict v = EdgeStateEvaluator.evaluate(
                    new EdgeStateEvaluator.CharacterState(
                            c.id, c.life, c.sadUnclamped, c.sadMax, c.constitution, c.comaSet));
            if (!v.anything()) {
                continue;
            }
            if (v.sadnessOverflow()) {
                x.statChanges.add(new StatChange(c.uuid, "life", c.life, v.lifeAfter(),
                        v.lifeAfter() - c.life));
                x.statChanges.add(new StatChange(c.uuid, "sad", c.sad, 0, -c.sad));
                c.life = v.lifeAfter();
                c.setSad(0);
                x.sadnessOverflowUuids.add(c.uuid);
            }
            if (v.comaTriggered()) {
                c.comaSet = true;
                x.comaUuids.add(c.uuid);
                if (x.isActor(c.id)) {
                    x.comaTriggered = true;
                }
            }
            if (v.forcedSleep() && x.isActor(c.id)) {
                x.forcedSleep = true;
            }
            EdgeStateEvaluator.persist(edgeStore, x.match.id(), v, x.currentClock, idEvent);
        }
    }

    /**
     * The all-players-in-coma epilogue: run the story's {@code id_event_all_player_coma} so
     * the frontend has something to show once nobody can act any more.
     *
     * <p>This cannot live inside the chain. {@code runChain} unwinds as soon as the actor
     * falls into a coma, and the actor is necessarily one of the comatose — a comatose
     * character is rejected by the availability check before an execution even starts. So by
     * the time everyone is down, the chain is already returning.</p>
     *
     * <p>Moving the match to {@code GAMEOVER} is deliberately NOT done here: that, and the
     * rescue endpoints, belong to step 59.</p>
     */
    private void resolveAllPlayerComa(Exec x) {
        if (x.allComaResolved) {
            return;
        }
        // Latched before any work, so a re-entry from inside the epilogue is a no-op.
        x.allComaResolved = true;

        List<Boolean> comaFlags = new ArrayList<>();
        for (EventActorView v : x.allCharacters()) {
            Live touched = x.living.get(v.id());
            // Deliberately not x.live(v): that would query the backpack of every character in
            // the match and enrol them all in the flush, writing rows nothing has changed.
            comaFlags.add(touched != null ? touched.comaSet : v.isComa());
        }
        if (!EdgeStateEvaluator.allInComa(comaFlags)) {
            return;
        }
        x.allPlayersInComa = true;
        edgeStore.logEdgeState(x.match.id(), x.actorId(), null, x.currentClock,
                EdgeStateStorePort.MSG_ALL_PLAYER_COMA + " " + x.match.id());

        Long comaEventId = store.findIdEventAllPlayerComa(x.match.idStory()).orElse(null);
        if (comaEventId == null) {
            return; // a story need not author an epilogue
        }
        EventEntity comaEvent = x.eventsById().get(comaEventId);
        if (comaEvent == null) {
            return; // dangling id_event_all_player_coma
        }
        if (EventAvailabilityChecker.TYPE_ONCE.equalsIgnoreCase(comaEvent.getType())
                && x.ctx.consumedEventIds().contains(comaEventId)) {
            return; // a ONCE epilogue fires once per match, not once per collapse
        }

        x.comaEventUuid = comaEvent.getUuid();
        x.comaEventCard = resolveCard(x, comaEvent.getIdCard());
        x.comaEventMark = x.executedEventUuids.size();
        x.comaEffectMark = x.effects.size();
        x.epiloguePhase = true;
        try {
            runChain(x, comaEvent);
        } finally {
            x.epiloguePhase = false;
        }
    }

    private void forceTimeEnd(Exec x) {
        if (timeAdvancementService == null) {
            return;
        }
        // The Step 26 recovery reads the character rows, so this event's effects must already
        // be on disk. flush() also latches x.flushed, which stops buildResult from writing the
        // now-stale in-memory copy back over what the recovery just computed.
        flush(x);
        TimeAdvancementService.TimeEndOutcome outcome =
                timeAdvancementService.forceTimeEnd(x.match.uuid());
        // v0.35.6 — the time-start this event forced runs a recovery, and a recovery can push
        // somebody over an edge: that verdict belongs in this response, not in the next reload.
        mergeEdgeState(x, outcome.edgeState());
        x.timeEnded = true;
        x.forcedSleep = true;
        x.currentClock = outcome.newClock();
        x.refreshActorAfterTimeEnd();
    }

    // ── Step 33: automatic location events ──────────────────────────────────

    @Override
    public List<AutomaticEventFired> onArrival(ArrivalContext arrival) {
        List<AutomaticEventFired> fired = new ArrayList<>();
        resolveArrival(arrival.idMatch(), arrival.idStory(), arrival.idCharacter(),
                arrival.idLocation(), arrival.currentClock(), arrival.lang(), 0, fired);
        return fired;
    }

    @Override
    public List<AutomaticEventFired> runPendingAutomaticEvents(long idMatch, int currentClock,
                                                               List<PendingAutomaticEvent> pending,
                                                               String lang) {
        List<AutomaticEventFired> fired = new ArrayList<>();
        if (locationStore == null || pending == null || pending.isEmpty()) {
            return fired;
        }
        for (PendingAutomaticEvent p : pending) {
            // allowTimeEnd = false: these run INSIDE the time-start pass, and a
            // flag_end_time here would advance the clock the pass is still working on.
            runAutomaticEvent(idMatch, p.idActorCharacter(), p.idEvent(), p.idLocation(),
                    p.trigger(), currentClock, lang, false, 0, fired);
        }
        return fired;
    }

    @Override
    public List<TimeAdvancementPort.CounterZeroItem> describeForRecipient(
            long idMatch, Long idRecipientCharacter, int clock,
            List<AutomaticEventFired> fired, String lang) {
        List<TimeAdvancementPort.CounterZeroItem> out = new ArrayList<>();
        if (locationStore == null || fired == null || fired.isEmpty()) {
            return out;
        }
        MatchEventView match = store.findMatchById(idMatch).orElse(null);
        if (match == null) {
            return out;
        }
        long idStory = match.idStory();
        Long here = idRecipientCharacter == null
                ? null
                : locationStore.findCharacterLocation(idMatch, idRecipientCharacter).orElse(null);
        Set<Long> visited = idRecipientCharacter == null
                ? Set.of()
                : new HashSet<>(locationStore.findVisitedLocationIds(idMatch));

        for (AutomaticEventFired f : fired) {
            String visibility;
            if (here != null && here == f.idLocation()) {
                visibility = TimeAdvancementPort.CounterZeroItem.VISIBILITY_FULL;
            } else if (visited.contains(f.idLocation())) {
                visibility = TimeAdvancementPort.CounterZeroItem.VISIBILITY_NAMED;
            } else {
                visibility = TimeAdvancementPort.CounterZeroItem.VISIBILITY_ANONYMOUS;
            }
            // The cards are resolved only when the recipient may see them: a name that never
            // leaves the server cannot leak. The event's card and its effect rows are already
            // on the fired event — no extra query, only the location card costs a lookup.
            CardInfo card = null;
            CardInfo cardLocation = null;
            List<AppliedEffect> cardEffects = List.of();
            if (!TimeAdvancementPort.CounterZeroItem.VISIBILITY_ANONYMOUS.equals(visibility)) {
                Integer idCard = locationStore.findLocationTriggers(idStory, f.idLocation())
                        .map(LocationTriggerView::idCard)
                        .orElse(null);
                cardLocation = idCard == null || contentQueryPort == null
                        ? null
                        : contentQueryPort.getCardByStoryIdAndCardId(idStory, idCard, resolveLang(lang));
                card = f.card();
                cardEffects = f.effects() == null ? List.of() : List.copyOf(f.effects());
            }
            out.add(new TimeAdvancementPort.CounterZeroItem(
                    f.trigger(), f.idLocation(), card, cardLocation, cardEffects,
                    f.eventUuid(), clock, visibility));
        }
        return out;
    }

    /**
     * The dispatch table of an arrival. The order is fixed rather than authored: the
     * history trigger (first or subsequent — never both) comes before the occupancy one,
     * which is orthogonal to it and may fire alongside either.
     *
     * <p>{@code flag_visited} is latched <b>after</b> the triggers have been read, so the
     * first arrival still evaluates as a first arrival; and it is latched even when the
     * location authors no trigger at all, because the flag describes the party's history,
     * not what happened to fire.</p>
     */
    private void resolveArrival(long idMatch, long idStory, long idCharacter, long idLocation,
                                int currentClock, String lang, int depth,
                                List<AutomaticEventFired> out) {
        if (locationStore == null) {
            return;
        }
        if (depth >= MAX_ENTRY_DEPTH) {
            locationStore.logAutomaticEvent(idMatch, idCharacter, idLocation, null, currentClock,
                    LocationEntryStorePort.MSG_AUTOMATIC_EVENT + " aborted: entry depth "
                            + MAX_ENTRY_DEPTH + " exceeded at location " + idLocation
                            + " — the story loops a forced movement back on itself");
            return;
        }
        LocationTriggerView triggers = locationStore.findLocationTriggers(idStory, idLocation)
                .orElse(null);
        boolean visited = locationStore.findFlagVisited(idMatch, idLocation) == 1;
        if (triggers != null) {
            Integer historyEvent = visited
                    ? triggers.idEventNotFirstTime()
                    : triggers.idEventIfFirstTime();
            String historyTrigger = visited ? TRIGGER_SUBSEQUENT_ENTRY : TRIGGER_FIRST_ENTRY;
            runAutomaticEventIfSet(idMatch, idCharacter, historyEvent, idLocation, historyTrigger,
                    currentClock, lang, true, depth, out);

            if (locationStore.countOtherCharactersAtLocation(idMatch, idLocation, idCharacter) == 0) {
                runAutomaticEventIfSet(idMatch, idCharacter,
                        triggers.idEventIfCharacterEnterEmptyLocation(), idLocation,
                        TRIGGER_MOVE_INTO_EMPTY_LOCATION, currentClock, lang, true, depth, out);
            }
        }
        locationStore.markStateLocationVisited(idMatch, idLocation);
    }

    /** Null-tolerant entry: a null or non-positive column is simply not a trigger. */
    private void runAutomaticEventIfSet(long idMatch, Long idActorCharacter, Integer idEvent,
                                        long idLocation, String trigger, int currentClock,
                                        String lang, boolean allowTimeEnd, int depth,
                                        List<AutomaticEventFired> out) {
        if (idEvent == null || idEvent <= 0) {
            return;
        }
        runAutomaticEvent(idMatch, idActorCharacter, idEvent.longValue(), idLocation, trigger,
                currentClock, lang, allowTimeEnd, depth, out);
    }

    /**
     * Run one automatic event and its whole {@code id_event_next} chain.
     *
     * <p>What makes it different from {@link #executeEvent}, and why it cannot simply call
     * it:</p>
     * <ul>
     *   <li><b>Nobody pays.</b> No energy, no coins — the player did not ask for this.</li>
     *   <li><b>No availability verdict.</b> The type gate would refuse it outright
     *       ({@code AUTOMATIC} is not in {@code EXECUTABLE_TYPES}), and the sleep/coma
     *       guards would refuse it on behalf of a character that never volunteered.</li>
     *   <li><b>The actor may be absent.</b> A counter-zero fuse belongs to a location, and
     *       the location may be empty. Effects that need a recipient are then skipped while
     *       registry, weather and the chain still run.</li>
     *   <li><b>It may not own choices.</b> There is no response to carry the options and no
     *       {@code select-choice} could ever close the cycle, so the event is refused and
     *       logged instead of wedging the match with a decision nobody can answer.</li>
     * </ul>
     */
    private void runAutomaticEvent(long idMatch, Long idActorCharacter, long idEvent,
                                   long idLocation, String trigger, int currentClock, String lang,
                                   boolean allowTimeEnd, int depth, List<AutomaticEventFired> out) {
        if (locationStore == null) {
            return;
        }
        MatchEventView match = store.findMatchById(idMatch).orElse(null);
        if (match == null || !MatchStatuses.RUNNING.equals(match.status())) {
            return;
        }
        EventEntity event = store.findEventsById(match.idStory()).get(idEvent);
        if (event == null) {
            return; // dangling id: authored noise, not an error
        }
        if (!store.findChoicesByEventId(match.idStory(), idEvent).isEmpty()) {
            locationStore.logAutomaticEvent(idMatch, idActorCharacter, idLocation, idEvent,
                    currentClock, LocationEntryStorePort.MSG_AUTOMATIC_EVENT + " skipped " + idEvent
                            + " (" + trigger + "): an automatic event may not own choices");
            return;
        }

        EventActorView actor = idActorCharacter == null
                ? null
                : store.findCharacterByMatchAndId(idMatch, idActorCharacter).orElse(null);
        EventCheckContext ctx = store.loadCheckContext(idMatch,
                actor == null ? null : actor.id());

        Exec x = new Exec(match, actor, ctx, resolveLang(lang), event);
        x.entryDepth = depth;
        runChain(x, event);
        resolveAllPlayerComa(x);
        if (x.endTime && !x.comaTriggered && allowTimeEnd) {
            forceTimeEnd(x);
        }
        flush(x);
        locationStore.logAutomaticEvent(idMatch, idActorCharacter, idLocation, idEvent,
                x.currentClock, LocationEntryStorePort.MSG_AUTOMATIC_EVENT + " " + idEvent
                        + " (" + trigger + ") at location " + idLocation);
        // v0.35.6 — the epilogue is sliced off the tail here too: what the arrival did and
        // what the collapse answered are two chains, and the board narrates them apart.
        out.add(new AutomaticEventFired(trigger, idLocation, event.getUuid(),
                resolveCard(x, event.getIdCard()),
                new ArrayList<>(chainEffects(x)), new ArrayList<>(x.statChanges),
                new ArrayList<>(x.locationChanges), x.gameOver, buildEdgeState(x)));

        // The events this one caused by pushing somebody somewhere.
        drainArrivals(x, out);
    }

    /**
     * Resolve the arrivals a chain queued. Called after the chain has finished and been
     * flushed, so the next {@code Exec} reads what this one actually wrote.
     */
    private void drainArrivals(Exec x, List<AutomaticEventFired> out) {
        if (locationStore == null || x.pendingArrivals.isEmpty()) {
            return;
        }
        List<long[]> arrivals = new ArrayList<>(x.pendingArrivals);
        x.pendingArrivals.clear();
        flush(x);
        for (long[] a : arrivals) {
            resolveArrival(x.match.id(), x.match.idStory(), a[0], a[1],
                    x.currentClock, x.lang, x.entryDepth + 1, out);
        }
    }

    // ── persistence & result ────────────────────────────────────────────────

    /** Write back every character the event touched. Called once, at the end. */
    private void flush(Exec x) {
        if (x.flushed) {
            return;
        }
        x.flushed = true;
        for (Live c : x.living.values()) {
            store.updateCharacterStats(x.match.id(), c.id, new CharacterStats(
                    c.dexterity, c.intelligence, c.constitution, c.energy, c.life, c.sad, c.exp,
                    c.lifeMax, c.energyMax, c.sadMax, c.weightMax));
            if (c.backpackDirty) {
                store.updateBackpack(x.match.id(), c.id, new BackpackStats(c.food, c.magic, c.coin));
            }
            if (c.characteristicsDirty) {
                store.setCharacterCharacteristics(x.match.id(), c.id,
                        games.paths.core.model.match.MatchTraitCodec.join(new ArrayList<>(c.characteristics)));
            }
        }
    }

    private EventExecutionResult buildResult(Exec x) {
        flush(x);
        Live actor = x.live(x.actor);
        EdgeStateOutcome edgeState = buildEdgeState(x);
        boolean changed = x.timeEnded || x.itemAdded || x.itemRemoved || x.weatherApplied
                || x.movementApplied || x.forcedSleep || x.comaTriggered || x.gameOver
                || edgeState.anything()
                || !x.statChanges.isEmpty() || !x.registryChanges.isEmpty()
                || !x.traitChanges.isEmpty() || !x.characteristicChanges.isEmpty()
                || !x.automaticEvents.isEmpty();

        // Step 34 — an item usage has no owning event: uuid and type stay null and the
        // narrative card is the item's own, not an event's.
        String eventUuid = x.event == null ? null : x.event.getUuid();
        String eventType = x.event == null ? null : x.event.getType();
        CardInfo card = x.event == null ? x.standaloneCard : resolveCard(x, x.event.getIdCard());

        return new EventExecutionResult(
                x.match.uuid(), eventUuid, eventType, x.status,
                card,
                chainEventUuids(x),
                x.energySpent, x.coinSpent, x.foodSpent, x.magicSpent,
                actor.energy, actor.coin, actor.food, actor.magic, x.currentClock,
                false, // turnConsumed — v0.29.0 never touches the turn queue
                x.timeEnded, x.itemAdded, x.itemRemoved, x.weatherApplied, x.movementApplied,
                x.forcedSleep, x.comaTriggered, x.gameOver, changed,
                x.statChanges, x.registryChanges, x.traitChanges, x.itemChanges,
                x.characteristicChanges, x.locationChanges, chainEffects(x), x.pendingChoices,
                edgeState, new ArrayList<>(x.automaticEvents));
    }

    /** The events the player's own chain ran — the epilogue's are sliced off the tail. */
    private static List<String> chainEventUuids(Exec x) {
        List<String> all = new ArrayList<>(x.executedEventUuids);
        return x.comaEventUuid == null ? all : new ArrayList<>(all.subList(0, x.comaEventMark));
    }

    private static List<AppliedEffect> chainEffects(Exec x) {
        return x.comaEventUuid == null
                ? x.effects
                : new ArrayList<>(x.effects.subList(0, x.comaEffectMark));
    }

    /** Folds an edge state produced elsewhere — a forced time end — into this execution. */
    private static void mergeEdgeState(Exec x, EdgeStateOutcome other) {
        if (other == null) {
            return;
        }
        for (String uuid : other.sadnessOverflowUuids()) {
            if (!x.sadnessOverflowUuids.contains(uuid)) {
                x.sadnessOverflowUuids.add(uuid);
            }
        }
        for (String uuid : other.comaUuids()) {
            if (!x.comaUuids.contains(uuid)) {
                x.comaUuids.add(uuid);
            }
        }
        x.allPlayersInComa = x.allPlayersInComa || other.allPlayersInComa();
    }

    private static EdgeStateOutcome buildEdgeState(Exec x) {
        if (x.sadnessOverflowUuids.isEmpty() && x.comaUuids.isEmpty() && !x.allPlayersInComa) {
            return EdgeStateOutcome.none();
        }
        List<String> all = new ArrayList<>(x.executedEventUuids);
        List<String> comaEvents = x.comaEventUuid == null
                ? List.of()
                : new ArrayList<>(all.subList(x.comaEventMark, all.size()));
        List<AppliedEffect> comaEffects = x.comaEventUuid == null
                ? List.of()
                : new ArrayList<>(x.effects.subList(x.comaEffectMark, x.effects.size()));
        return new EdgeStateOutcome(
                new ArrayList<>(x.sadnessOverflowUuids),
                new ArrayList<>(x.comaUuids),
                x.allPlayersInComa,
                x.comaEventUuid,
                x.comaEventCard,
                comaEvents,
                comaEffects);
    }

    // ── Step 34: effects that come from something other than an event ───────

    /**
     * Applies a list of {@link StandaloneEffect} rows to one character and returns the
     * very same payload {@code execute-event} returns.
     *
     * <p>Package-private on purpose: {@code InventoryService} lives in this package, so
     * item usage reuses the engine — {@code Live}'s clamping, the single-UPDATE
     * {@link #flush}, the Step 30 verdict and the all-players-in-coma epilogue — without
     * a second engine growing beside it. {@code Live.setSad} exists precisely so that no
     * future effect type can bypass the overflow check; a duplicated engine would be
     * exactly that effect type.</p>
     *
     * <p>{@code CHOICES_PENDING} and the end-game branch never apply here: an item owns
     * no choices and cannot be the story's end-game event.</p>
     *
     * @param sourceConsumed the caller already removed what produced these effects (Step 34
     *                       deletes the inventory row before the effects run), so the result
     *                       must report {@code itemRemoved} and recommend a refresh even when
     *                       the item carried no effect at all — the bag changed regardless.
     */
    EventExecutionResult applyStandaloneEffects(long idMatch, long idCharacter,
                                                List<StandaloneEffect> effects,
                                                CardInfo card, String lang,
                                                boolean sourceConsumed) {
        MatchEventView match = store.findMatchById(idMatch).orElseThrow(EventExecutionService::notFound);
        EventActorView actor = store.findCharacterByMatchAndId(idMatch, idCharacter)
                .orElseThrow(EventExecutionService::notFound);
        EventCheckContext ctx = store.loadCheckContext(idMatch, idCharacter);

        Exec x = new Exec(match, actor, ctx, resolveLang(lang), null);
        x.standaloneCard = card;
        x.itemRemoved = sourceConsumed;
        for (StandaloneEffect e : (effects == null ? List.<StandaloneEffect>of() : effects)) {
            applyStat(x, actor, e.statistic(), nz(e.value()));
            applyTraits(x, actor, e.traitsToAdd(), e.traitsToRemove(), null);
            x.effects.add(new AppliedEffect(null, e.effectUuid(), e.statistic(), e.value(),
                    TARGET_ONLY_ONE, null, List.of(actor.uuid()), resolveCard(x, e.idCard())));
        }
        checkEdgeStates(x, null);
        resolveAllPlayerComa(x);
        return buildResult(x);
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private CardInfo resolveCard(Exec x, Integer idCard) {
        if (contentQueryPort == null || idCard == null) {
            return null;
        }
        return x.cardCache.computeIfAbsent(idCard,
                id -> contentQueryPort.getCardByStoryIdAndCardId(x.match.idStory(), id, x.lang));
    }

    private static String resolveLang(String lang) {
        return (lang == null || lang.isBlank()) ? DEFAULT_LANG : lang;
    }

    private long requireUser(String userUuid) {
        return userAccessPort.findByUuid(userUuid)
                .map(UserAccessPort.UserView::id)
                .orElseThrow(EventExecutionService::notFound);
    }

    private MatchEventView requireMatch(String matchUuid) {
        return store.findMatchByUuid(matchUuid).orElseThrow(EventExecutionService::notFound);
    }

    /** Masks an unknown match AND a caller who is not in it: neither leaks the other's existence. */
    private static EventExecutionException notFound() {
        return new EventExecutionException(EventExecutionException.Code.MATCH_NOT_FOUND,
                "Match not found or not accessible");
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    private static List<String> csv(String s) {
        return games.paths.core.model.match.MatchTraitCodec.split(s);
    }

    /** CSV of story-local trait ids; anything non-numeric is skipped rather than throwing. */
    private static List<Long> csvIds(String s) {
        List<Long> out = new ArrayList<>();
        for (String part : csv(s)) {
            try {
                out.add(Long.valueOf(part.trim()));
            } catch (NumberFormatException notAnId) {
                // authored noise
            }
        }
        return out;
    }

    private static int nz(Integer v) {
        return v == null ? 0 : v;
    }

    // ── execution state ─────────────────────────────────────────────────────

    /**
     * The mutable accumulator of one execution. Character stats are edited in memory
     * ({@link Live}) and written once at the end, so a chain of effects on the same character
     * costs one UPDATE rather than one per effect — and each effect sees what the previous
     * one did.
     */
    private final class Exec {
        final MatchEventView match;
        final EventActorView actor;
        final EventCheckContext ctx;
        final String lang;
        /** Null when the effects come from something that is not an event — Step 34 items. */
        final EventEntity event;
        /** The card an event-less execution narrates with: the item's own card. */
        CardInfo standaloneCard;

        final Map<Long, Live> living = new HashMap<>();
        final Set<Long> visited = new HashSet<>();
        final Set<String> executedEventUuids = new LinkedHashSet<>();
        final Map<Integer, CardInfo> cardCache = new HashMap<>();

        final List<StatChange> statChanges = new ArrayList<>();
        final List<RegistryChange> registryChanges = new ArrayList<>();
        final List<TraitChange> traitChanges = new ArrayList<>();
        final List<ItemChange> itemChanges = new ArrayList<>();
        final List<CharacteristicChange> characteristicChanges = new ArrayList<>();
        final List<LocationChange> locationChanges = new ArrayList<>();
        final List<AppliedEffect> effects = new ArrayList<>();

        /** Current location per character: seeded from the views, rewritten by forced movement. */
        final Map<Long, Long> locationByCharacter = new HashMap<>();

        // ── Step 33 automatic location events ──
        /** {characterId, locationId} pairs a forced move produced, resolved after the chain. */
        final List<long[]> pendingArrivals = new ArrayList<>();
        /** What the automatic events this execution fired did, for the response payload. */
        final List<AutomaticEventFired> automaticEvents = new ArrayList<>();
        /** How many arrivals deep this execution already is — the runaway-loop guard. */
        int entryDepth;

        int currentClock;
        int energySpent;
        int coinSpent;
        int foodSpent;
        int magicSpent;
        /** True between deductCosts and the log row that carries the price (v0.35.3). */
        boolean costsPending;
        /**
         * v0.35.4 — running totals of what the ACTOR gained, never reset. Each event row
         * logs the difference across its own effects, so a chain does not repeat them.
         */
        int energyGained;
        int foodGained;
        int magicGained;
        int coinGained;

        int[] gainsMark() {
            return new int[] {energyGained, foodGained, magicGained, coinGained};
        }

        ResourceDelta gainsSince(int[] mark) {
            return new ResourceDelta(energyGained - mark[0], foodGained - mark[1],
                    magicGained - mark[2], coinGained - mark[3]);
        }

        /** Only what a statistic ADDED counts as a gain; a drain is the effect's own business. */
        void recordGain(String stat, int delta) {
            if (delta <= 0) {
                return;
            }
            switch (stat) {
                case "energy" -> energyGained += delta;
                case "food" -> foodGained += delta;
                case "magic" -> magicGained += delta;
                case "coin" -> coinGained += delta;
                default -> { /* only the four resources ride on a log row */ }
            }
        }
        // ── Step 31 choices ──
        String status = STATUS_APPLIED;
        List<PendingChoice> pendingChoices = List.of();
        // ── Step 32 resolution ──
        /** The event an effect's {@code id_event} ran: the card the board narrates with. */
        String choiceEventUuid;
        CardInfo choiceEventCard;
        boolean progressRecorded;
        boolean endTime;
        boolean timeEnded;
        boolean itemAdded;
        boolean itemRemoved;
        boolean weatherApplied;
        boolean movementApplied;
        boolean forcedSleep;
        boolean comaTriggered;
        boolean gameOver;
        boolean flushed;

        // ── Step 30 edge states ──
        final List<String> sadnessOverflowUuids = new ArrayList<>();
        final List<String> comaUuids = new ArrayList<>();
        boolean allPlayersInComa;
        /** The epilogue has been decided — set before any work, so re-entry is a no-op. */
        boolean allComaResolved;
        /** True while the all-players-in-coma chain runs, relaxing the coma guard in runChain. */
        boolean epiloguePhase;
        String comaEventUuid;
        CardInfo comaEventCard;
        /** Where the epilogue's own events and effects start, so buildResult can slice them out. */
        int comaEventMark;
        int comaEffectMark;

        private List<EventActorView> allCharacters;
        private Map<Long, String> itemUuids;
        private Map<Long, Integer> itemMaxPerCharacter;
        private Map<Long, String> traitUuids;
        private Map<Long, TraitStats> traitStats;
        private Map<Long, String> locationUuids;
        private Map<Long, EventEntity> eventsById;
        private Map<Long, List<EventEffectEntity>> effectsByEvent;
        private Long endGameId;
        private boolean endGameIdLoaded;

        Exec(MatchEventView match, EventActorView actor, EventCheckContext ctx,
             String lang, EventEntity event) {
            this.match = match;
            this.actor = actor;
            this.ctx = ctx;
            this.lang = lang;
            this.event = event;
            this.currentClock = match.currentClock();
        }

        /**
         * The story's events and effects, loaded once and shared by the main chain and the
         * all-players-in-coma epilogue — so the epilogue costs no extra query.
         */
        Map<Long, EventEntity> eventsById() {
            if (eventsById == null) {
                eventsById = store.findEventsById(match.idStory());
            }
            return eventsById;
        }

        Map<Long, List<EventEffectEntity>> effectsByEvent() {
            if (effectsByEvent == null) {
                effectsByEvent = store.findEffectsByEventId(match.idStory());
            }
            return effectsByEvent;
        }

        /** Null is a legal value here, hence the separate loaded flag. */
        Long endGameId() {
            if (!endGameIdLoaded) {
                endGameId = store.findIdEventEndGame(match.idStory()).orElse(null);
                endGameIdLoaded = true;
            }
            return endGameId;
        }

        /** Lazily loaded: only a target=ALL effect needs the other characters. */
        List<EventActorView> allCharacters() {
            if (allCharacters == null) {
                allCharacters = store.findCharactersByMatchId(match.id());
            }
            return allCharacters;
        }

        Map<Long, String> itemUuids() {
            if (itemUuids == null) {
                itemUuids = store.findItemUuidsById(match.idStory());
            }
            return itemUuids;
        }

        /** v0.35.1 — the caps, read once per execution however many ADDs it carries. */
        Map<Long, Integer> itemMaxPerCharacter() {
            if (itemMaxPerCharacter == null) {
                itemMaxPerCharacter = store.findItemMaxPerCharacterById(match.idStory());
            }
            return itemMaxPerCharacter;
        }

        /** v0.35.2 — the trait deltas, read once per execution however many traits change. */
        Map<Long, TraitStats> traitStats() {
            if (traitStats == null) {
                traitStats = store.findTraitStatsById(match.idStory());
            }
            return traitStats;
        }

        Map<Long, String> traitUuids() {
            if (traitUuids == null) {
                traitUuids = store.findTraitUuidsById(match.idStory());
            }
            return traitUuids;
        }

        /** Lazily loaded: only a forced-movement effect needs the story's locations. */
        Map<Long, String> locationUuids() {
            if (locationUuids == null) {
                locationUuids = store.findLocationUuidsById(match.idStory());
            }
            return locationUuids;
        }

        /**
         * The actor's id, or null when there is no actor — a Step 33 automatic event whose
         * location holds nobody. Every {@code Long idCharacter} parameter downstream already
         * accepts null and means "the match, not a character" by it.
         */
        Long actorId() {
            return actor == null ? null : actor.id();
        }

        /** False for every character when there is no actor. */
        boolean isActor(long idCharacter) {
            return actor != null && actor.id() == idCharacter;
        }

        /** The tracked position wins over the (possibly stale) view. */
        Long locationOf(EventActorView v) {
            if (!locationByCharacter.containsKey(v.id())) {
                locationByCharacter.put(v.id(), v.idLocation());
            }
            return locationByCharacter.get(v.id());
        }

        void setLocation(long idCharacter, long idLocation) {
            locationByCharacter.put(idCharacter, idLocation);
        }

        Live live(EventActorView view) {
            return living.computeIfAbsent(view.id(), id -> new Live(view,
                    store.findBackpack(match.id(), view.id())
                            .orElse(new BackpackStats(0, 0, 0))));
        }

        /**
         * After a time-end the Step 26 recovery rewrote the character rows, so the in-memory
         * copy is stale. Re-read the actor's stats to report what the database now holds.
         */
        void refreshActorAfterTimeEnd() {
            store.findCharacterByMatchAndUser(match.id(), actor.idUser()).ifPresent(fresh -> {
                Live a = live(actor);
                a.energy = fresh.energy();
                a.life = fresh.life();
                a.setSad(fresh.sad());
            });
        }
    }

    /** In-memory, mutable view of one character for the duration of an execution. */
    private static final class Live {
        final long id;
        final String uuid;
        int dexterity;
        int intelligence;
        int constitution;
        int energy;
        int life;
        int sad;
        /** The raw sadness before the cap, so the Step 30 overflow rule reads what the
         *  effect really added rather than what the column can hold. */
        int sadUnclamped;
        int exp;
        // v0.35.2 — no longer final: a trait granted mid-game moves them, and the clamps
        // below have to read the new ceiling in the same execution.
        int energyMax;
        int lifeMax;
        int sadMax;
        int weightMax;
        int food;
        int magic;
        int coin;
        final Set<String> characteristics;
        boolean backpackDirty;
        boolean characteristicsDirty;
        boolean comaSet;

        Live(EventActorView v, BackpackStats backpack) {
            this.id = v.id();
            this.uuid = v.uuid();
            this.dexterity = v.dexterity();
            this.intelligence = v.intelligence();
            this.constitution = v.constitution();
            this.energy = v.energy();
            this.life = v.life();
            this.exp = v.exp();
            this.energyMax = v.energyMax();
            this.lifeMax = v.lifeMax();
            this.sadMax = v.sadMax();
            this.weightMax = v.weightMax();
            this.food = backpack.food();
            this.magic = backpack.magic();
            this.coin = backpack.coin();
            this.characteristics = new LinkedHashSet<>(
                    games.paths.core.model.match.MatchTraitCodec.split(v.characteristics()));
            this.comaSet = v.isComa();
            setSad(v.sad());
        }

        /**
         * The only door to {@code sad}: it keeps the raw and the capped value in step, so no
         * future effect type can bypass the Step 30 overflow check by writing the field.
         */
        void setSad(int raw) {
            this.sadUnclamped = raw;
            this.sad = TimeStartRecoveryService.clamp(raw, 0, sadMax);
        }
    }
}
