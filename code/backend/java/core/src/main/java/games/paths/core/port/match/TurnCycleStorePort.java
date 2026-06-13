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
                             int life) {
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
