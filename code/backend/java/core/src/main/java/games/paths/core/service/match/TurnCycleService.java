package games.paths.core.service.match;

import games.paths.core.model.match.MatchStatuses;
import games.paths.core.model.match.TurnStatuses;
import games.paths.core.port.match.TurnCyclePort;
import games.paths.core.port.match.TurnCycleStorePort;
import games.paths.core.port.match.TurnCycleStorePort.CharacterTurnView;
import games.paths.core.port.match.TurnCycleStorePort.MatchView;
import games.paths.core.port.match.TurnCycleStorePort.QueueRow;
import games.paths.core.port.match.UserAccessPort;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * TurnCycleService - single-player turn cycle engine (Step 24).
 * Pure-Java service; ports injected via constructor.
 *
 * <p>See {@code documentation_v0/Step24_TurnCycleEngine.md}.</p>
 */
public class TurnCycleService implements TurnCyclePort {

    private final TurnCycleStorePort store;
    private final UserAccessPort userAccessPort;
    private final WeatherSelectionService weatherService;

    public TurnCycleService(TurnCycleStorePort store, UserAccessPort userAccessPort) {
        this(store, userAccessPort, null);
    }

    /** Step 27 — overload wiring the weather selection engine (may be null in tests). */
    public TurnCycleService(TurnCycleStorePort store, UserAccessPort userAccessPort,
                            WeatherSelectionService weatherService) {
        this.store = store;
        this.userAccessPort = userAccessPort;
        this.weatherService = weatherService;
    }

    @Override
    public TurnSequenceResult startMatch(String matchUuid, String userUuid) {
        long userId = requireUser(userUuid);
        MatchView match = requireOwnedMatch(matchUuid, userId);

        if (!MatchStatuses.CREATED.equals(match.status())) {
            throw new TurnCycleException(TurnCycleException.Code.MATCH_NOT_STARTABLE,
                    "Match is not in CREATED state");
        }

        List<CharacterTurnView> characters = store.findCharactersByMatchId(match.id());
        if (characters == null || characters.isEmpty()) {
            throw new TurnCycleException(TurnCycleException.Code.NO_CHARACTERS_JOINED,
                    "No character has joined the match");
        }

        List<QueueRow> rows = new ArrayList<>();
        for (CharacterTurnView c : characters) {
            long priority = TurnPriorityCalculator.compute(
                    c.dexterity(), c.intelligence(), c.constitution(), c.life(), c.id());
            rows.add(new QueueRow(c.id(), null, match.currentClock(), priority,
                    TurnStatuses.WAITING, 0, null, null));
        }
        rows.sort(Comparator.comparingLong(QueueRow::priority).reversed());

        // Activate the highest-priority character. Timestamps are left null: the
        // explicit `status` column is the lifecycle source of truth (Step 24).
        QueueRow top = rows.get(0);
        rows.set(0, withStatus(top, TurnStatuses.ACTIVE, null, null));

        store.replaceQueue(match.id(), rows);
        store.updateMatchStatusAndTurn(match.id(), MatchStatuses.RUNNING, top.idCharacterMatch());

        // Step 27: select the initial weather for clock 0 when the match starts.
        if (weatherService != null) {
            weatherService.applyAtTimeStart(match.id());
        }

        return buildSequence(matchUuid, match.currentClock(), MatchStatuses.RUNNING,
                top.idCharacterMatch(), rows, characters);
    }

    @Override
    public PassResult passTurn(String matchUuid, String userUuid) {
        long userId = requireUser(userUuid);
        MatchView match = requireOwnedMatch(matchUuid, userId);

        if (!MatchStatuses.RUNNING.equals(match.status())) {
            throw new TurnCycleException(TurnCycleException.Code.MATCH_NOT_RUNNING,
                    "Match is not RUNNING");
        }

        List<CharacterTurnView> characters = store.findCharactersByMatchId(match.id());
        Map<Long, CharacterTurnView> byId = indexById(characters);
        List<QueueRow> rows = sortedQueue(store.findQueueByMatchId(match.id()));

        QueueRow active = rows.stream()
                .filter(r -> TurnStatuses.ACTIVE.equals(r.status()))
                .findFirst()
                .orElse(null);
        if (active == null && match.idCharacterCurrentTurn() != null) {
            active = rows.stream()
                    .filter(r -> r.idCharacterMatch() == match.idCharacterCurrentTurn())
                    .findFirst().orElse(null);
        }
        if (active == null) {
            throw new TurnCycleException(TurnCycleException.Code.MATCH_NOT_RUNNING,
                    "No active turn to pass");
        }

        CharacterTurnView activeChar = byId.get(active.idCharacterMatch());
        if (activeChar == null || activeChar.idUser() != userId) {
            throw new TurnCycleException(TurnCycleException.Code.NOT_YOUR_TURN,
                    "It is not your character's turn");
        }

        // Complete the current turn.
        QueueRow completed = new QueueRow(active.idCharacterMatch(), active.uuid(), active.clock(),
                active.priority(), TurnStatuses.COMPLETED, active.passCounter() + 1,
                null, null);
        store.saveQueueRow(match.id(), completed);
        replaceInList(rows, completed);

        // Find the next WAITING character; if none, start a new round (reset all to WAITING).
        QueueRow next = highestWaiting(rows);
        if (next == null) {
            for (int i = 0; i < rows.size(); i++) {
                QueueRow r = rows.get(i);
                QueueRow reset = new QueueRow(r.idCharacterMatch(), r.uuid(), r.clock(), r.priority(),
                        TurnStatuses.WAITING, r.passCounter(), null, null);
                store.saveQueueRow(match.id(), reset);
                rows.set(i, reset);
            }
            next = highestWaiting(rows);
        }

        QueueRow activated = withStatus(next, TurnStatuses.ACTIVE, null, null);
        store.saveQueueRow(match.id(), activated);
        replaceInList(rows, activated);
        store.updateMatchStatusAndTurn(match.id(), MatchStatuses.RUNNING, activated.idCharacterMatch());

        return new PassResult(matchUuid,
                charUuid(byId, active.idCharacterMatch()),
                charUuid(byId, activated.idCharacterMatch()),
                MatchStatuses.RUNNING);
    }

    @Override
    public TurnSequenceResult getTurnSequence(String matchUuid, String userUuid) {
        long userId = requireUser(userUuid);
        MatchView match = requireOwnedMatch(matchUuid, userId);

        List<CharacterTurnView> characters = store.findCharactersByMatchId(match.id());
        List<QueueRow> rows = sortedQueue(store.findQueueByMatchId(match.id()));
        return buildSequence(matchUuid, match.currentClock(), match.status(),
                match.idCharacterCurrentTurn(), rows, characters);
    }

    // ── helpers ────────────────────────────────────────────────────────────

    private long requireUser(String userUuid) {
        return userAccessPort.findByUuid(userUuid)
                .map(UserAccessPort.UserView::id)
                .orElseThrow(() -> new TurnCycleException(TurnCycleException.Code.MATCH_NOT_FOUND,
                        "Match not found or not accessible"));
    }

    private MatchView requireOwnedMatch(String matchUuid, long userId) {
        MatchView match = store.findMatchByUuid(matchUuid)
                .orElseThrow(() -> new TurnCycleException(TurnCycleException.Code.MATCH_NOT_FOUND,
                        "Match not found or not accessible"));
        if (match.idUserCreator() != userId) {
            throw new TurnCycleException(TurnCycleException.Code.MATCH_NOT_FOUND,
                    "Match not found or not accessible");
        }
        return match;
    }

    private TurnSequenceResult buildSequence(String matchUuid, int clock, String status,
                                             Long activeId, List<QueueRow> rows,
                                             List<CharacterTurnView> characters) {
        Map<Long, CharacterTurnView> byId = indexById(characters);
        List<TurnEntry> entries = new ArrayList<>();
        for (QueueRow r : sortedQueue(rows)) {
            entries.add(new TurnEntry(
                    charUuid(byId, r.idCharacterMatch()),
                    r.idCharacterMatch(),
                    null,
                    r.priority(),
                    r.clock(),
                    r.status(),
                    r.passCounter(),
                    iso(r.timestampStart()),
                    iso(r.timestampEnd())));
        }
        return new TurnSequenceResult(matchUuid, clock, status,
                activeId == null ? null : charUuid(byId, activeId), entries);
    }

    private static Map<Long, CharacterTurnView> indexById(List<CharacterTurnView> characters) {
        Map<Long, CharacterTurnView> map = new LinkedHashMap<>();
        if (characters != null) {
            for (CharacterTurnView c : characters) map.put(c.id(), c);
        }
        return map;
    }

    private static String charUuid(Map<Long, CharacterTurnView> byId, long id) {
        CharacterTurnView c = byId.get(id);
        return c == null ? null : c.uuid();
    }

    private static List<QueueRow> sortedQueue(List<QueueRow> rows) {
        List<QueueRow> copy = new ArrayList<>(rows == null ? List.of() : rows);
        copy.sort(Comparator.comparingLong(QueueRow::priority).reversed());
        return copy;
    }

    private static QueueRow highestWaiting(List<QueueRow> rows) {
        return sortedQueue(rows).stream()
                .filter(r -> TurnStatuses.WAITING.equals(r.status()))
                .findFirst().orElse(null);
    }

    private static QueueRow withStatus(QueueRow r, String status, LocalDateTime start, LocalDateTime end) {
        return new QueueRow(r.idCharacterMatch(), r.uuid(), r.clock(), r.priority(),
                status, r.passCounter(), start, end);
    }

    private static void replaceInList(List<QueueRow> rows, QueueRow updated) {
        for (int i = 0; i < rows.size(); i++) {
            if (rows.get(i).idCharacterMatch() == updated.idCharacterMatch()) {
                rows.set(i, updated);
                return;
            }
        }
    }

    private static String iso(LocalDateTime ts) {
        return ts == null ? null : ts.toString();
    }
}
