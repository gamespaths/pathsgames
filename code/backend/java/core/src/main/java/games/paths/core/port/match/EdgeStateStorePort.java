package games.paths.core.port.match;

/**
 * EdgeStateStorePort - outbound port for the Step 30 edge states: sadness overflow and coma.
 *
 * <p>A port of its own rather than three more methods on {@code EventExecutionStorePort},
 * because three unrelated services write these same rows: event execution, the Step 26
 * time-start recovery, and the admin change-stats command. Each of them already owns a
 * store port of its own, and none of them should have to grow a copy of these writes.</p>
 *
 * <p>This port replaces {@code EventExecutionStorePort.setCharacterComa}, which raised the
 * flags but never recorded {@code clock_in_coma}. That method was deleted rather than
 * deprecated so the incomplete write cannot survive anywhere.</p>
 *
 * <p>See {@code documentation_v0/Step30_EdgeStates.md}.</p>
 */
public interface EdgeStateStorePort {

    /**
     * Sadness reached its cap: the character lost COS life and its sadness was reset.
     *
     * <p>None of the three constants below may start with
     * {@link EventExecutionStorePort#MSG_EVENT_EXECUTED}: {@code consumedEventIds} is built
     * by scanning {@code log_events} for that prefix, so an edge-state row bearing it would
     * silently consume a ONCE event the player never triggered.</p>
     */
    String MSG_SADNESS_OVERFLOW = "SADNESS_OVERFLOW";

    /** Life hit zero: the character entered coma. */
    String MSG_COMA = "COMA";

    /**
     * Every character of the match is now comatose.
     *
     * <p>Note that this value <em>contains</em> {@link #MSG_COMA}: match these messages with
     * {@code startsWith}, never {@code contains}, or a party row reads as a personal one.</p>
     */
    String MSG_ALL_PLAYER_COMA = "ALL_PLAYER_COMA";

    /**
     * Enter coma: {@code is_coma = true}, {@code is_sleeping = true} and
     * {@code clock_in_coma = clockInComa}.
     *
     * <p>Callers must not invoke this for a character already in coma, or the clock of the
     * original collapse is overwritten and the value stops meaning anything.</p>
     */
    void setComa(long idMatch, long idCharacter, int clockInComa);

    /** Raise {@code is_sleeping} alone — a sadness overflow forces sleep without coma. */
    void setSleeping(long idMatch, long idCharacter);

    /**
     * Append a {@code log_events} row. {@code idCharacter} and {@code idEvent} are both
     * nullable: the recovery path has no triggering event, and the all-players-in-coma row
     * belongs to the match rather than to any one character.
     */
    void logEdgeState(long idMatch, Long idCharacter, Long idEvent, int clock, String message);
}
