package games.paths.core.service.match;

import games.paths.core.model.match.MatchStatuses;
import games.paths.core.model.match.TurnStatuses;
import games.paths.core.model.match.event.TimeAdvanced;
import games.paths.core.port.event.DomainEventPublisher;
import games.paths.core.port.match.EventExecutionPort.EdgeStateOutcome;
import games.paths.core.port.match.LocationEntryPort;
import games.paths.core.port.match.TimeAdvancementPort;
import games.paths.core.port.match.TurnCyclePort.TurnCycleException;
import games.paths.core.port.match.TurnCycleStorePort;
import games.paths.core.port.match.TurnCycleStorePort.CharacterTurnView;
import games.paths.core.port.match.TurnCycleStorePort.ClockLabels;
import games.paths.core.port.match.TurnCycleStorePort.MatchView;
import games.paths.core.port.match.TurnCycleStorePort.QueueRow;
import games.paths.core.port.match.UserAccessPort;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * TimeAdvancementService - time advancement & clock cycle engine (Step 25).
 *
 * <p>Adds a voluntary sleep action and a clock query, and advances the match
 * clock when every active character is "done" (sleeping or out of energy — in
 * single-player the list is size 1). On time-end it logs the advance, wakes the
 * characters, rebuilds {@code gaming_turn_queue} reusing the Step 24
 * {@link TurnPriorityCalculator}, and publishes a {@link TimeAdvanced} event.</p>
 *
 * <p>See {@code documentation_v0/Step25_TimeAdvancementClockCycle.md}.</p>
 */
public class TimeAdvancementService implements TimeAdvancementPort {

    private static final String DEFAULT_LANG = "en";

    private final TurnCycleStorePort store;
    private final UserAccessPort userAccessPort;
    private final DomainEventPublisher eventPublisher;
    private final TimeStartRecoveryService recoveryService;
    private final WeatherSelectionService weatherService;
    /**
     * Step 33 — the engine that runs the automatic events a time-start collected.
     *
     * <p>Injected through a setter rather than the constructor, and deliberately so: the
     * runner is {@code EventExecutionService}, which already depends on this service for
     * {@code forceTimeEnd}. Constructor injection either way would be a cycle; the setter
     * closes the loop once, at wiring time. Null is a legal state — every test that builds
     * this service directly then behaves exactly as before Step 33.</p>
     */
    private LocationEntryPort automaticEventRunner;

    public TimeAdvancementService(TurnCycleStorePort store,
                                  UserAccessPort userAccessPort,
                                  DomainEventPublisher eventPublisher,
                                  TimeStartRecoveryService recoveryService) {
        this(store, userAccessPort, eventPublisher, recoveryService, null);
    }

    /** Step 27 — overload wiring the weather selection engine (may be null in tests). */
    public TimeAdvancementService(TurnCycleStorePort store,
                                  UserAccessPort userAccessPort,
                                  DomainEventPublisher eventPublisher,
                                  TimeStartRecoveryService recoveryService,
                                  WeatherSelectionService weatherService) {
        this.store = store;
        this.userAccessPort = userAccessPort;
        this.eventPublisher = eventPublisher;
        this.recoveryService = recoveryService;
        this.weatherService = weatherService;
    }

    /** Step 33 — see {@link #automaticEventRunner}. Called once, from the bean wiring. */
    public void setAutomaticEventRunner(LocationEntryPort automaticEventRunner) {
        this.automaticEventRunner = automaticEventRunner;
    }

    @Override
    public SleepResult sleep(String matchUuid, String userUuid) {
        long userId = requireUser(userUuid);
        MatchView match = requireMatch(matchUuid);

        // The caller must own a character in this match (mask as not-found otherwise).
        CharacterTurnView caller = store.findCharacterByMatchAndUser(match.id(), userId)
                .orElseThrow(() -> notFound());

        if (!MatchStatuses.RUNNING.equals(match.status())) {
            throw new TurnCycleException(TurnCycleException.Code.MATCH_NOT_RUNNING,
                    "Match is not RUNNING");
        }

        // Idempotent: setting sleeping on an already-sleeping character is a no-op effect.
        store.setCharacterSleeping(match.id(), caller.id(), true);
        // Step 28.7 — log the sleep action for the match logs timeline.
        store.logSleep(match.id(), caller.id(), match.currentClock());

        // Re-read the characters so the trigger sees the just-applied sleep flag.
        List<CharacterTurnView> characters = store.findCharactersByMatchId(match.id());
        boolean triggered = allCharactersDone(characters);

        int currentClock = match.currentClock();
        List<RecoveryItem> recovery = List.of();
        List<CounterZeroItem> counterZero = List.of();
        EdgeStateOutcome edgeState = EdgeStateOutcome.none();
        if (triggered) {
            AdvanceResult advanced = advanceTime(match);
            currentClock = advanced.newClock();
            recovery = advanced.recovery();
            // Step 33 — the same events, told to THIS player. The caller is the only
            // recipient with an open request; the rest learn about it over the WebSocket
            // once Steps 49-54 land, through this very method called once per player.
            counterZero = describeCounterZero(match.id(), caller.id(),
                    advanced.automaticEvents(), currentClock);
            // v0.35.6 — a time-start kills too: the recovery itself can empty a life bar, and
            // so can the events it sets off. Without this the sleeper woke up comatose with
            // nothing on screen to say why.
            edgeState = advanced.edgeState();
        }

        // After a time-end every character is awake again; otherwise the caller stays asleep.
        boolean finalSleeping = !triggered;
        return new SleepResult(matchUuid, caller.uuid(), finalSleeping, triggered, currentClock,
                recovery, counterZero, edgeState);
    }

    @Override
    public ClockResult clock(String matchUuid, String userUuid) {
        long userId = requireUser(userUuid);
        MatchView match = requireOwnedMatch(matchUuid, userId);
        return buildClock(matchUuid, match);
    }

    @Override
    public ClockResult clockForAdmin(String matchUuid) {
        MatchView match = requireMatch(matchUuid);
        return buildClock(matchUuid, match);
    }

    /** Build the clock payload (labels + per-character sleeping/energy) for a match. */
    private ClockResult buildClock(String matchUuid, MatchView match) {
        List<CharacterTurnView> characters = store.findCharactersByMatchId(match.id());
        ClockLabels labels = store.findStoryClockLabels(match.id(), DEFAULT_LANG);

        List<ClockCharacter> chars = new ArrayList<>();
        boolean anySleeping = false;
        for (CharacterTurnView c : characters) {
            anySleeping = anySleeping || c.isSleeping();
            chars.add(new ClockCharacter(c.uuid(), c.isSleeping(), c.energy()));
        }
        return new ClockResult(matchUuid, match.currentClock(),
                labels == null ? null : labels.singular(),
                labels == null ? null : labels.plural(),
                anySleeping, chars);
    }

    // ── time-end ────────────────────────────────────────────────────────────

    /**
     * Step 29 — force a time-end: put every character to sleep, then advance.
     *
     * <p>Called by {@code EventExecutionService} when an executed event carries
     * {@code flag_end_time}. It is exposed on the class and deliberately NOT on
     * {@link TimeAdvancementPort}: nothing over REST should be able to skip a time unit,
     * only the engine.</p>
     *
     * <p>Note that {@link #advanceTime} wakes everybody right after, so the net observable
     * state is "awake at clock+1". The {@code forcedSleep} flag the event returns records
     * the transition, exactly like {@code SleepResult.isSleeping = !triggered} does.</p>
     */
    public TimeEndOutcome forceTimeEnd(String matchUuid) {
        return forceTimeEnd(matchUuid, null);
    }

    /**
     * Step 33 — the same, told to a specific recipient. The event that carried
     * {@code flag_end_time} was executed by somebody, and that somebody is the one player
     * with an open request when the clock moves, so they are the one who gets to hear what
     * the time-start set off.
     */
    public TimeEndOutcome forceTimeEnd(String matchUuid, Long idRecipientCharacter) {
        MatchView match = requireMatch(matchUuid);
        store.setAllCharactersSleeping(match.id());
        AdvanceResult advanced = advanceTime(match);
        return new TimeEndOutcome(advanced.newClock(), advanced.recovery(), advanced.edgeState(),
                describeCounterZero(match.id(), idRecipientCharacter,
                        advanced.automaticEvents(), advanced.newClock()));
    }

    /**
     * Apply the per-recipient fog-of-war rule to an already-run list of automatic events.
     * Null runner (a unit test that built this service directly) means no automatic events
     * ran in the first place, so the list is empty either way.
     */
    private List<CounterZeroItem> describeCounterZero(long idMatch, Long idRecipientCharacter,
                                                      List<LocationEntryPort.AutomaticEventFired> fired,
                                                      int clock) {
        if (automaticEventRunner == null || fired == null || fired.isEmpty()) {
            return List.of();
        }
        return automaticEventRunner.describeForRecipient(idMatch, idRecipientCharacter, clock,
                fired, DEFAULT_LANG);
    }

    /** Outcome of {@link #forceTimeEnd(String)}. */
    public record TimeEndOutcome(int newClock,
                                 List<RecoveryItem> recovery,
                                 /** v0.35.6 — the edges the time-start pushed anyone over. */
                                 EdgeStateOutcome edgeState,
                                 List<CounterZeroItem> counterZero) {

        /** A time end that moved no edge. */
        public TimeEndOutcome(int newClock, List<RecoveryItem> recovery,
                              List<CounterZeroItem> counterZero) {
            this(newClock, recovery, EdgeStateOutcome.none(), counterZero);
        }
    }

    /**
     * Time-end trigger: fires when every character is sleeping OR out of energy.
     * In single-player the list is size 1. An empty list never triggers.
     */
    static boolean allCharactersDone(List<CharacterTurnView> characters) {
        if (characters == null || characters.isEmpty()) {
            return false;
        }
        for (CharacterTurnView c : characters) {
            boolean done = c.isSleeping() || c.energy() <= 0;
            if (!done) {
                return false;
            }
        }
        return true;
    }

    private AdvanceResult advanceTime(MatchView match) {
        int newClock = store.incrementMatchClock(match.id());
        store.insertClockHistory(match.id(), newClock);
        store.wakeAllCharacters(match.id());
        // Step 26: per-character recovery, class bonuses and location counters.
        TimeStartRecoveryService.TimeStartOutcome outcome =
                recoveryService.applyAtTimeStart(match.id());
        // Step 33: the events that pass collected — counters that reached zero, and the
        // locations whose id_event_if_character_start_time fires because a time unit began
        // with somebody standing there. Run here rather than inside the recovery service:
        // the event engine sits above it in the wiring, and an event can force a time end.
        List<LocationEntryPort.AutomaticEventFired> fired = automaticEventRunner == null
                ? List.of()
                : automaticEventRunner.runPendingAutomaticEvents(
                        match.id(), newClock, outcome.pending(), DEFAULT_LANG);
        // Step 27: select the weather for the new time unit and apply its energy delta.
        if (weatherService != null) {
            weatherService.applyAtTimeStart(match.id());
        }
        rebuildQueue(match.id(), newClock);
        eventPublisher.publish(new TimeAdvanced(match.uuid(), newClock));
        List<RecoveryItem> recovery = new ArrayList<>();
        for (TimeStartRecoveryService.RecoveryRecap r : outcome.recovery()) {
            recovery.add(new RecoveryItem(r.characterUuid(), r.energyDelta(), r.lifeDelta(), r.sadDelta()));
        }
        // The recovery's own verdict first, then whatever its events did: one edge state.
        List<EdgeStateOutcome> parts = new ArrayList<>();
        parts.add(outcome.edgeState());
        for (LocationEntryPort.AutomaticEventFired f : fired) {
            parts.add(f.edgeState());
        }
        return new AdvanceResult(newClock, recovery, fired, EdgeStateOutcome.merge(parts));
    }

    private record AdvanceResult(int newClock,
                                 List<RecoveryItem> recovery,
                                 List<LocationEntryPort.AutomaticEventFired> automaticEvents,
                                 EdgeStateOutcome edgeState) {
    }

    /** Rebuild the turn queue for a new clock: all WAITING, highest priority ACTIVE. */
    private void rebuildQueue(long idMatch, int clock) {
        List<CharacterTurnView> characters = store.findCharactersByMatchId(idMatch);
        if (characters.isEmpty()) {
            store.replaceQueue(idMatch, List.of());
            store.updateMatchStatusAndTurn(idMatch, MatchStatuses.RUNNING, null);
            return;
        }
        List<QueueRow> rows = new ArrayList<>();
        for (CharacterTurnView c : characters) {
            long priority = TurnPriorityCalculator.compute(
                    c.dexterity(), c.intelligence(), c.constitution(), c.life(), c.id());
            rows.add(new QueueRow(c.id(), null, clock, priority, TurnStatuses.WAITING, 0, null, null));
        }
        rows.sort(Comparator.comparingLong(QueueRow::priority).reversed());

        QueueRow top = rows.get(0);
        rows.set(0, new QueueRow(top.idCharacterMatch(), top.uuid(), top.clock(), top.priority(),
                TurnStatuses.ACTIVE, top.passCounter(), null, null));

        store.replaceQueue(idMatch, rows);
        store.updateMatchStatusAndTurn(idMatch, MatchStatuses.RUNNING, top.idCharacterMatch());
    }

    // ── helpers ───────────────────────────────────────────────────────────

    private long requireUser(String userUuid) {
        return userAccessPort.findByUuid(userUuid)
                .map(UserAccessPort.UserView::id)
                .orElseThrow(() -> notFound());
    }

    private MatchView requireMatch(String matchUuid) {
        return store.findMatchByUuid(matchUuid).orElseThrow(() -> notFound());
    }

    private MatchView requireOwnedMatch(String matchUuid, long userId) {
        MatchView match = requireMatch(matchUuid);
        if (match.idUserCreator() != userId) {
            throw notFound();
        }
        return match;
    }

    private static TurnCycleException notFound() {
        return new TurnCycleException(TurnCycleException.Code.MATCH_NOT_FOUND,
                "Match not found or not accessible");
    }
}
