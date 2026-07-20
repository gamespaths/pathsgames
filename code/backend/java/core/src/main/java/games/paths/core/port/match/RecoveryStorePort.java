package games.paths.core.port.match;

import java.util.List;
import java.util.Optional;

/**
 * RecoveryStorePort - outbound port used by {@code TimeStartRecoveryService}
 * (Step 26) to read the data needed for time-start recovery and to persist the
 * recovered character stats and the location time-counter changes.
 *
 * <p>It is intentionally read-then-write: the service computes the pure recovery
 * math and asks the adapter to persist the results, so the domain logic stays
 * framework-free and unit-testable.</p>
 */
public interface RecoveryStorePort {

    /** Story / difficulty context for a match (story id + difficulty energy). */
    Optional<RecoveryMatchContext> loadContext(long idMatch);

    /** Per-character recovery inputs (stats, caps, class, location). */
    List<RecoveryCharacter> findCharacters(long idMatch);

    /** Location safety + counter config for the story, keyed by location id. */
    List<LocationSafety> findLocationSafety(long idStory);

    /** Class-bonus rows for the story (filtered by class id in the service). */
    List<ClassBonusView> findClassBonuses(long idStory);

    /** Existing gaming_state_locations rows for the match. */
    List<StateLocationView> findStateLocations(long idMatch);

    /** Persist the recovered current stats of a single character. */
    void updateCharacterStats(long idMatch, long idCharacter, int energy, int life, int sad);

    /** Insert a gaming_state_locations row seeded with the given counter. */
    void insertStateLocation(long idMatch, long idLocation, int clockCounter);

    /** Update gaming_state_locations.clock_counter for a location. */
    void updateStateLocationCounter(long idMatch, long idLocation, int newClockCounter);

    /** Set gaming_state_locations.flag_already_actived = 1 when the counter reaches zero. */
    void markStateLocationActivated(long idMatch, long idLocation);

    /** Audit a per-character recovery summary into log_events. */
    void logRecovery(long idMatch, long idCharacter, String message);

    /** Audit a counter-zero event (pending execution; wired in Step 29). */
    void logCounterZero(long idMatch, long idLocation, Integer idEventIfCounterZero, String message);

    /** {@code currentClock} is what a Step 30 coma stamps into {@code clock_in_coma}. */
    record RecoveryMatchContext(long idStory, int difficultyEnergy, int currentClock) {
    }

    /**
     * {@code isComa} is load-bearing for Step 30: recovery runs over every character at every
     * time-start, comatose ones included, so without it each pass would re-stamp
     * {@code clock_in_coma} and the clock of the original collapse would be lost.
     */
    record RecoveryCharacter(long id,
                             String uuid,
                             Long idClass,
                             Long idLocation,
                             int dexterity,
                             int intelligence,
                             int constitution,
                             int energy,
                             int life,
                             int sad,
                             int energyMax,
                             int lifeMax,
                             int sadMax,
                             boolean isComa) {
    }

    record LocationSafety(long idLocation,
                          int secureParam,
                          Integer counterTime,
                          Integer idEventIfCounterZero) {
    }

    record ClassBonusView(long idClass, String statistic, int value) {
    }

    record StateLocationView(long idLocation, int clockCounter, int flagAlreadyActived) {
    }
}
