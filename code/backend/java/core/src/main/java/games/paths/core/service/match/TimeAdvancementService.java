package games.paths.core.service.match;

import games.paths.core.model.match.MatchStatuses;
import games.paths.core.model.match.TurnStatuses;
import games.paths.core.model.match.event.TimeAdvanced;
import games.paths.core.port.event.DomainEventPublisher;
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

        // Re-read the characters so the trigger sees the just-applied sleep flag.
        List<CharacterTurnView> characters = store.findCharactersByMatchId(match.id());
        boolean triggered = allCharactersDone(characters);

        int currentClock = match.currentClock();
        List<RecoveryItem> recovery = List.of();
        if (triggered) {
            AdvanceResult advanced = advanceTime(match);
            currentClock = advanced.newClock();
            recovery = advanced.recovery();
        }

        // After a time-end every character is awake again; otherwise the caller stays asleep.
        boolean finalSleeping = !triggered;
        return new SleepResult(matchUuid, caller.uuid(), finalSleeping, triggered, currentClock, recovery);
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
        List<TimeStartRecoveryService.RecoveryRecap> recaps =
                recoveryService.applyAtTimeStart(match.id());
        // Step 27: select the weather for the new time unit and apply its energy delta.
        if (weatherService != null) {
            weatherService.applyAtTimeStart(match.id());
        }
        rebuildQueue(match.id(), newClock);
        eventPublisher.publish(new TimeAdvanced(match.uuid(), newClock));
        List<RecoveryItem> recovery = new ArrayList<>();
        for (TimeStartRecoveryService.RecoveryRecap r : recaps) {
            recovery.add(new RecoveryItem(r.characterUuid(), r.energyDelta(), r.lifeDelta(), r.sadDelta()));
        }
        return new AdvanceResult(newClock, recovery);
    }

    private record AdvanceResult(int newClock, List<RecoveryItem> recovery) {
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
