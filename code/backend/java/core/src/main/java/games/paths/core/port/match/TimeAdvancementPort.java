package games.paths.core.port.match;

import java.util.List;

/**
 * TimeAdvancementPort - inbound port for the time advancement & clock cycle
 * engine (Step 25). Implemented by {@code TimeAdvancementService}.
 *
 * <ul>
 *   <li>{@link #sleep(String, String)} — voluntary sleep, then evaluate time-end.</li>
 *   <li>{@link #clock(String, String)} — read the current clock / sleeping state.</li>
 * </ul>
 *
 * <p>Errors are signalled with {@link TurnCyclePort.TurnCycleException} so the
 * REST controller can reuse the Step 24 status mapping.</p>
 */
public interface TimeAdvancementPort {

    /**
     * Mark the caller's character as sleeping (idempotent), then evaluate the
     * time-end trigger; advance the clock if every character is sleeping or out
     * of energy.
     */
    SleepResult sleep(String matchUuid, String userUuid);

    /** Read the current clock, labels and per-character sleeping/energy state. */
    ClockResult clock(String matchUuid, String userUuid);

    /**
     * Admin-scoped clock read: same payload as {@link #clock(String, String)} but
     * without the per-user participation check, for the admin console (port 8044).
     * Only throws {@code MATCH_NOT_FOUND}.
     */
    ClockResult clockForAdmin(String matchUuid);

    record SleepResult(String matchUuid,
                       String characterUuid,
                       boolean isSleeping,
                       boolean timeEndTriggered,
                       int currentClock,
                       List<RecoveryItem> recovery,
                       /**
                        * Step 33 — what happened in the world while the party slept: the
                        * location counters that ran out, and the events they set off. A
                        * <b>list</b>, because several counters can expire on one time-start,
                        * and empty in the ordinary case.
                        */
                       List<CounterZeroItem> counterZero) {
    }

    /**
     * One automatic event a time-start fired, as told to <b>one</b> recipient.
     *
     * <p>{@code visibility} is per player and decided in the delivery layer, never while the
     * engine builds the list — every player has their own visited set, so the same event is
     * described differently to each of them:</p>
     * <ul>
     *   <li>{@code FULL} — the recipient is standing there;</li>
     *   <li>{@code NAMED} — they have been there before;</li>
     *   <li>{@code ANONYMOUS} — they never have, and all three cards are <b>omitted</b> rather
     *       than merely hidden. A counter runs down even where nobody has ever set foot, and
     *       naming that place would hand the player the map. A name that never leaves the
     *       server cannot leak.</li>
     * </ul>
     *
     * <p>Three cards, because the player wakes up to a piece of news with three sides:
     * {@code card} is the <b>event's</b> card — what happened; {@code cardEffects} are the
     * effect rows it applied, each with its own card, which is the narrative the board
     * actually renders (same shape {@code execute-event} returns); {@code cardLocation} is
     * the <b>place</b>, since v0.28.5 named by {@code list_locations.id_card} rather than by
     * a name string (v0.28.6 removed the synthetic {@code locationName} fields).</p>
     */
    record CounterZeroItem(String trigger,
                           long idLocation,
                           games.paths.core.model.story.CardInfo card,
                           games.paths.core.model.story.CardInfo cardLocation,
                           List<EventExecutionPort.AppliedEffect> cardEffects,
                           String eventUuid,
                           int clock,
                           String visibility) {

        public static final String VISIBILITY_FULL = "FULL";
        public static final String VISIBILITY_NAMED = "NAMED";
        public static final String VISIBILITY_ANONYMOUS = "ANONYMOUS";
    }

    /**
     * Per-character recovery summary (Step 26): the energy/life/sad deltas applied
     * at time-start. Empty when the sleep action did not trigger a time-end.
     */
    record RecoveryItem(String characterUuid,
                        int energyDelta,
                        int lifeDelta,
                        int sadDelta) {
    }

    record ClockResult(String matchUuid,
                       int currentClock,
                       String clockLabelSingular,
                       String clockLabelPlural,
                       boolean anyCharacterSleeping,
                       List<ClockCharacter> characters) {
    }

    record ClockCharacter(String characterUuid,
                          boolean isSleeping,
                          int energy) {
    }
}
