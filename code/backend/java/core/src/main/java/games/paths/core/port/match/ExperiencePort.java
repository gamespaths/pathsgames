package games.paths.core.port.match;

import java.util.List;
import java.util.Map;

/**
 * ExperiencePort - Inbound port of Step 38: spend experience on a +1 of DEX/INT/COS.
 * Zero energy, the turn does not pass; allowed awake, on the own turn, in a safe location.
 */
public interface ExperiencePort {

    /** Buys one point of {@code stat} ({@code dex|int|cos}) for the caller's character. */
    UseExpResult useExp(String matchUuid, String userUuid, String stat);

    /** One stat moved by {@code delta}; the same shape {@code execute-event} answers with. */
    record StatChange(String characterUuid, String statistic, int before, int after, int delta) {
    }

    /**
     * The purchase: the stat before/after, the exp before/after, what it cost, the refreshed
     * price list and the two {@link StatChange}s (the stat, then the exp) for the frontend.
     */
    record UseExpResult(String matchUuid, String characterUuid, String stat,
                        int statBefore, int statAfter, int expBefore, int expAfter, int expCost,
                        Map<String, Integer> expCosts, List<StatChange> statChanges) {
    }

    /** Failure of a use-exp; the code drives the HTTP status in the controller. */
    class ExperienceException extends RuntimeException {

        public enum Code {
            /** Unknown match, unknown user, or the caller owns no character in it. */
            MATCH_NOT_FOUND,
            MATCH_NOT_RUNNING,
            NOT_YOUR_TURN,
            COMA,
            SLEEPING,
            /** The body's stat is not one of dex / int / cos. */
            INVALID_STAT,
            /** The character's location has {@code secure_param <= 0}. */
            LOCATION_NOT_SAFE,
            /** The stat already sits at the difficulty's {@code max_stat_value}. */
            MAX_STAT_VALUE,
            NOT_ENOUGH_EXP
        }

        private final Code code;

        public ExperienceException(Code code, String message) {
            super(message);
            this.code = code;
        }

        public Code getCode() {
            return code;
        }
    }
}
