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
                       List<RecoveryItem> recovery) {
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
