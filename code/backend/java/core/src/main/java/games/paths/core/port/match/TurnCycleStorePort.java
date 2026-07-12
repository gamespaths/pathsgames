package games.paths.core.port.match;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * TurnCycleStorePort - outbound port used by {@code TurnCycleService} to read
 * the match / character state and persist the turn queue (Step 24).
 */
public interface TurnCycleStorePort {

    Optional<MatchView> findMatchByUuid(String uuid);

    /** Character instances of a match (stats used for the priority formula). */
    List<CharacterTurnView> findCharactersByMatchId(long idMatch);

    /** Replace the whole turn queue of a match (delete + insert). */
    void replaceQueue(long idMatch, List<QueueRow> rows);

    /** Current turn queue, highest priority first. */
    List<QueueRow> findQueueByMatchId(long idMatch);

    /** Persist status / timestamps / pass counter of a single queue row. */
    void saveQueueRow(long idMatch, QueueRow row);

    /** Update gaming_match.status and gaming_match.id_character_current_turn. */
    void updateMatchStatusAndTurn(long idMatch, String status, Long idCharacterCurrentTurn);

    // ── Step 25: time advancement & clock cycle ─────────────────────────────

    /** The character instance owned by {@code idUser} in {@code idMatch}, if any. */
    Optional<CharacterTurnView> findCharacterByMatchAndUser(long idMatch, long idUser);

    /** Set/clear {@code is_sleeping} on a single character of the match. */
    void setCharacterSleeping(long idMatch, long idCharacter, boolean sleeping);

    /** Clear {@code is_sleeping} on every character of the match (wake at time start). */
    void wakeAllCharacters(long idMatch);

    /** Advance {@code gaming_match.current_clock} by one and return the new value. */
    int incrementMatchClock(long idMatch);

    /** Insert a {@code log_clock_history} row for the given (new) clock. */
    void insertClockHistory(long idMatch, int clock);

    /**
     * Insert a {@code log_events} row recording a voluntary sleep action (Step 28.7).
     * The {@code clock} column stores the match clock at the time of the sleep.
     */
    void logSleep(long idMatch, long idCharacter, int clock);

    /** Resolve the story's singular/plural clock labels for the match's story. */
    ClockLabels findStoryClockLabels(long idMatch, String lang);

    record ClockLabels(String singular, String plural) {
    }

    record MatchView(long id,
                     String uuid,
                     String status,
                     int currentClock,
                     long idUserCreator,
                     Long idCharacterCurrentTurn) {
    }

    record CharacterTurnView(long id,
                             String uuid,
                             long idUser,
                             int dexterity,
                             int intelligence,
                             int constitution,
                             int life,
                             int energy,
                             boolean isSleeping) {
    }

    record QueueRow(long idCharacterMatch,
                    String uuid,
                    int clock,
                    long priority,
                    String status,
                    int passCounter,
                    LocalDateTime timestampStart,
                    LocalDateTime timestampEnd) {
    }
}
