package games.paths.core.service.match;

import games.paths.core.entity.story.ChoiceConditionEntity;
import games.paths.core.entity.story.ChoiceEntity;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * ChoiceAvailabilityChecker - THE per-option verdict of Step 31.
 *
 * <p>One pure function, no ports, no I/O — the twin of {@link EventAvailabilityChecker},
 * answering "can this choice be selected?" for every option a choice-event presents.
 * Non-available options are still returned to the player (shown disabled), so the verdict
 * is a property of the option, never a reason to drop it.</p>
 *
 * <p>Evaluation contract, in order:</p>
 * <ol>
 *   <li>{@code otherwise_flag = 1} wins outright (INV-29): the fallback option is always
 *       selectable, its limits and conditions are not even read.</li>
 *   <li>The inline limits combine in AND, before the condition rows: {@code limit_dex},
 *       {@code limit_int} and {@code limit_cos} are minimum requirements (stat ≥ limit)
 *       while {@code limit_sad} is a maximum (sad ≤ limit) — a desperate character is
 *       barred, a capable one admitted. A null limit is no constraint.</li>
 *   <li>The {@code list_choices_conditions} rows combine under the choice's
 *       {@code logic_operator} (INV-31: all-AND or all-OR, never mixed). Under AND the
 *       first failing row names the reason; under OR a single passing row is enough and
 *       the aggregate {@link #CONDITIONS_NOT_MET} is reported when none passes. No rows
 *       at all means available — a bare choice must be selectable.</li>
 * </ol>
 *
 * <p>An unknown condition type, an unparseable value or a blank key make that condition
 * NOT met: a typo locks the option visibly rather than silently unlocking it. Same
 * doctrine as {@code EventAvailabilityChecker.registryMet} ("a condition that can never
 * be satisfied must not read as no condition") — and deliberately the opposite of the
 * effect engine, where authored noise is skipped, because skipping here would GRANT
 * something instead of doing nothing.</p>
 *
 * <p>The reasons are plain strings, not {@code EventExecutionException.Code} values: they
 * ride on each option of a 200 response, they are never thrown.</p>
 *
 * <p>See {@code documentation_v0/Roadmap.md} (step 31); the condition vocabulary is the
 * {@code list_choices_conditions} schema comment (V0.10.4).</p>
 */
public final class ChoiceAvailabilityChecker {

    // ── reason vocabulary (per-option, returned on the response) ────────────
    public static final String LIMIT_SAD_EXCEEDED = "LIMIT_SAD_EXCEEDED";
    public static final String LIMIT_DEX_NOT_MET = "LIMIT_DEX_NOT_MET";
    public static final String LIMIT_INT_NOT_MET = "LIMIT_INT_NOT_MET";
    public static final String LIMIT_COS_NOT_MET = "LIMIT_COS_NOT_MET";
    public static final String CONDITION_KEYS_NOT_MET = "CONDITION_KEYS_NOT_MET";
    public static final String CONDITION_ITEM_NOT_MET = "CONDITION_ITEM_NOT_MET";
    public static final String CONDITION_CLASS_NOT_MET = "CONDITION_CLASS_NOT_MET";
    public static final String CONDITION_LOCATION_NOT_MET = "CONDITION_LOCATION_NOT_MET";
    public static final String CONDITION_ALL_IN_SAME_LOC_NOT_MET = "CONDITION_ALL_IN_SAME_LOC_NOT_MET";
    public static final String CONDITION_TRAITS_NOT_MET = "CONDITION_TRAITS_NOT_MET";
    public static final String CONDITION_STATISTICS_NOT_MET = "CONDITION_STATISTICS_NOT_MET";
    public static final String CONDITION_STATISTICS_SUM_NOT_MET = "CONDITION_STATISTICS_SUM_NOT_MET";
    /** OR aggregate (no single row is "the" culprit) and unknown-type fallback. */
    public static final String CONDITIONS_NOT_MET = "CONDITIONS_NOT_MET";

    /** The only combiner beside the default AND. Anything else reads as AND. */
    public static final String LOGIC_OR = "OR";

    private ChoiceAvailabilityChecker() {
    }

    /**
     * Everything the verdict needs, pre-loaded once per execute-event: N options are
     * evaluated against a single context, so a choice-heavy event costs no more queries
     * than a bare one.
     *
     * <p>{@code actorStats} carries the full stat vocabulary of the effect engine
     * (life/energy/sad/exp/dex/int/cos/food/magic/coin), read AFTER the open-cost
     * deduction — the player chooses with the energy they actually have left.
     * {@code partyLocations} and {@code partyStatSums} cover every character of the
     * match; the service may leave them empty when no condition needs them.</p>
     */
    public record ChoiceCheckContext(Map<String, Integer> actorStats,
                                     Long idClass,
                                     Long idLocation,
                                     Set<Long> ownedItemIds,
                                     Set<Long> traitIds,
                                     Map<String, List<String>> registry,
                                     List<Long> partyLocations,
                                     Map<String, Integer> partyStatSums) {
    }

    /** The per-option verdict: {@code reason} is null exactly when {@code available}. */
    public record ChoiceAvailability(boolean available, String reason) {

        public static final ChoiceAvailability OK = new ChoiceAvailability(true, null);

        public static ChoiceAvailability no(String reason) {
            return new ChoiceAvailability(false, reason);
        }
    }

    /** The single verdict. Null inputs can never be selectable. */
    public static ChoiceAvailability check(ChoiceEntity choice,
                                           List<ChoiceConditionEntity> conditions,
                                           ChoiceCheckContext ctx) {
        if (choice == null || ctx == null) {
            return ChoiceAvailability.no(CONDITIONS_NOT_MET);
        }
        if (nz(choice.getOtherwiseFlag()) == 1) {
            return ChoiceAvailability.OK;
        }
        String limitReason = failedLimit(choice, ctx);
        if (limitReason != null) {
            return ChoiceAvailability.no(limitReason);
        }
        List<ChoiceConditionEntity> rows = conditions == null ? List.of() : conditions;
        if (rows.isEmpty()) {
            return ChoiceAvailability.OK;
        }
        if (LOGIC_OR.equalsIgnoreCase(trim(choice.getLogicOperator()))) {
            for (ChoiceConditionEntity row : rows) {
                if (conditionMet(row, ctx)) {
                    return ChoiceAvailability.OK;
                }
            }
            return ChoiceAvailability.no(CONDITIONS_NOT_MET);
        }
        for (ChoiceConditionEntity row : rows) {
            if (!conditionMet(row, ctx)) {
                return ChoiceAvailability.no(reasonFor(row));
            }
        }
        return ChoiceAvailability.OK;
    }

    // ── inline limits ───────────────────────────────────────────────────────

    private static String failedLimit(ChoiceEntity choice, ChoiceCheckContext ctx) {
        if (choice.getLimitSad() != null && stat(ctx.actorStats(), "sad") > choice.getLimitSad()) {
            return LIMIT_SAD_EXCEEDED;
        }
        if (choice.getLimitDex() != null && stat(ctx.actorStats(), "dex") < choice.getLimitDex()) {
            return LIMIT_DEX_NOT_MET;
        }
        if (choice.getLimitInt() != null && stat(ctx.actorStats(), "int") < choice.getLimitInt()) {
            return LIMIT_INT_NOT_MET;
        }
        if (choice.getLimitCos() != null && stat(ctx.actorStats(), "cos") < choice.getLimitCos()) {
            return LIMIT_COS_NOT_MET;
        }
        return null;
    }

    // ── condition rows ──────────────────────────────────────────────────────

    private static boolean conditionMet(ChoiceConditionEntity row, ChoiceCheckContext ctx) {
        return switch (type(row)) {
            case "KEYS" -> keysMet(row, ctx);
            case "ITEM" -> membershipMet(row, ctx.ownedItemIds());
            case "CLASS" -> identityMet(row, ctx.idClass());
            case "LOCATION" -> identityMet(row, ctx.idLocation());
            case "ALL_IN_SAME_LOC" -> allInSameLoc(ctx);
            case "TRAITS" -> membershipMet(row, ctx.traitIds());
            case "STATISTICS" -> statMet(row, ctx.actorStats());
            case "STATISTICS_SUM" -> statMet(row, ctx.partyStatSums());
            default -> false; // an unknown type locks the option, it never unlocks it
        };
    }

    /**
     * Registry comparison. Equality is textual ({@code loadCheckContext} renders every
     * registry value as a string); {@code >} and {@code <} require both sides numeric.
     * An absent key satisfies only {@code !=} — "the flag was never set" IS different.
     */
    private static boolean keysMet(ChoiceConditionEntity row, ChoiceCheckContext ctx) {
        String key = trim(row.getKey());
        if (key.isEmpty()) {
            return false;
        }
        return RegistryService.evaluate(operator(row), row.getValue(),
                ctx.registry().getOrDefault(key, List.of()));
    }

    /** ITEM / traits: the story-local id sits in {@code value} ({@code key} as fallback). */
    private static boolean membershipMet(ChoiceConditionEntity row, Set<Long> held) {
        Long id = idOf(row);
        if (id == null || held == null) {
            return false;
        }
        return switch (operator(row)) {
            case "=" -> held.contains(id);
            case "!=" -> !held.contains(id);
            default -> false; // an item is owned or not: ordering it is authored noise
        };
    }

    /** CLASS / LOCATION: the actor either matches the id or does not. */
    private static boolean identityMet(ChoiceConditionEntity row, Long actual) {
        Long expected = idOf(row);
        if (expected == null) {
            return false;
        }
        return switch (operator(row)) {
            case "=" -> expected.equals(actual);
            case "!=" -> !expected.equals(actual);
            default -> false;
        };
    }

    /**
     * Every character of the match stands where the actor stands. Key, value and operator
     * are ignored — the type IS the condition. An unplaced character (null location, actor
     * included) can never be "in the same location"; a solo party trivially is.
     */
    private static boolean allInSameLoc(ChoiceCheckContext ctx) {
        Long here = ctx.idLocation();
        if (here == null) {
            return false;
        }
        for (Long at : ctx.partyLocations()) {
            if (!here.equals(at)) {
                return false;
            }
        }
        return true;
    }

    /** STATISTICS / STATISTICS_SUM: {@code key} names the stat, {@code value} is numeric. */
    private static boolean statMet(ChoiceConditionEntity row, Map<String, Integer> stats) {
        if (stats == null) {
            return false;
        }
        Integer actual = stats.get(trim(row.getKey()).toLowerCase());
        Long expected = numeric(row.getValue());
        if (actual == null || expected == null) {
            return false;
        }
        return switch (operator(row)) {
            case "=" -> actual.longValue() == expected;
            case "!=" -> actual.longValue() != expected;
            case ">" -> actual.longValue() > expected;
            case "<" -> actual.longValue() < expected;
            default -> false;
        };
    }

    private static String reasonFor(ChoiceConditionEntity row) {
        return switch (type(row)) {
            case "KEYS" -> CONDITION_KEYS_NOT_MET;
            case "ITEM" -> CONDITION_ITEM_NOT_MET;
            case "CLASS" -> CONDITION_CLASS_NOT_MET;
            case "LOCATION" -> CONDITION_LOCATION_NOT_MET;
            case "ALL_IN_SAME_LOC" -> CONDITION_ALL_IN_SAME_LOC_NOT_MET;
            case "TRAITS" -> CONDITION_TRAITS_NOT_MET;
            case "STATISTICS" -> CONDITION_STATISTICS_NOT_MET;
            case "STATISTICS_SUM" -> CONDITION_STATISTICS_SUM_NOT_MET;
            default -> CONDITIONS_NOT_MET;
        };
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    /** The docs mix cases ({@code KEYS} but {@code traits}); the match is case-blind. */
    private static String type(ChoiceConditionEntity row) {
        return row.getType() == null ? "" : row.getType().trim().toUpperCase();
    }

    private static String operator(ChoiceConditionEntity row) {
        String op = trim(row.getOperator());
        return op.isEmpty() ? "=" : op;
    }

    private static Long idOf(ChoiceConditionEntity row) {
        Long fromValue = numeric(row.getValue());
        return fromValue != null ? fromValue : numeric(row.getKey());
    }

    private static Long numeric(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        try {
            return Long.valueOf(s.trim());
        } catch (NumberFormatException notNumeric) {
            return null;
        }
    }

    private static int stat(Map<String, Integer> stats, String name) {
        Integer v = stats == null ? null : stats.get(name);
        return v == null ? 0 : v;
    }

    private static String trim(String s) {
        return s == null ? "" : s.trim();
    }

    private static int nz(Integer v) {
        return v == null ? 0 : v;
    }
}
