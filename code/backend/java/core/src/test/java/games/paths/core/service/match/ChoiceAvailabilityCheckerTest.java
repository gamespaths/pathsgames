package games.paths.core.service.match;

import games.paths.core.entity.story.ChoiceConditionEntity;
import games.paths.core.entity.story.ChoiceEntity;
import games.paths.core.service.match.ChoiceAvailabilityChecker.ChoiceAvailability;
import games.paths.core.service.match.ChoiceAvailabilityChecker.ChoiceCheckContext;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static games.paths.core.service.match.ChoiceAvailabilityChecker.*;
import static org.junit.jupiter.api.Assertions.*;

/**
 * ChoiceAvailabilityChecker (Step 31) — the per-option verdict.
 *
 * <p>Pure function, so every branch is reachable directly: one group per condition type,
 * the inline limits, the AND/OR combination, and the "authored noise locks, never
 * unlocks" doctrine.</p>
 */
@DisplayName("ChoiceAvailabilityChecker (Step 31)")
class ChoiceAvailabilityCheckerTest {

    private static final Long CLASS_ID = 50L;
    private static final Long LOC = 100L;

    // ── fixtures ────────────────────────────────────────────────────────────

    /** A bare AND choice: no limits, no otherwise — availability rides on the conditions. */
    private static ChoiceEntity choice() {
        ChoiceEntity c = new ChoiceEntity();
        c.setId(1L);
        c.setOtherwiseFlag(0);
        c.setLogicOperator("AND");
        return c;
    }

    private static ChoiceConditionEntity cond(String type, String key, String value, String op) {
        ChoiceConditionEntity c = new ChoiceConditionEntity();
        c.setType(type);
        c.setKey(key);
        c.setValue(value);
        c.setOperator(op);
        return c;
    }

    /**
     * A healthy solo actor: life 10, energy 10, sad 2, exp 5, dex 3, int 3, cos 3,
     * food 1, magic 1, coin 10 — standing alone at {@link #LOC} with class 50.
     */
    private static ChoiceCheckContext ctx() {
        return ctx(b -> { });
    }

    private static ChoiceCheckContext ctx(java.util.function.Consumer<Builder> tweak) {
        Builder b = new Builder();
        tweak.accept(b);
        return b.build();
    }

    /** Mutable view of the context so each test states only what it changes. */
    private static final class Builder {
        Map<String, Integer> stats = new HashMap<>(Map.of(
                "life", 10, "energy", 10, "sad", 2, "exp", 5,
                "dex", 3, "int", 3, "cos", 3, "food", 1, "magic", 1, "coin", 10));
        Long idClass = CLASS_ID;
        Long idLocation = LOC;
        Set<Long> items = new HashSet<>();
        Set<Long> traits = new HashSet<>();
        Map<String, String> registry = new HashMap<>();
        List<Long> partyLocations = List.of(LOC);
        Map<String, Integer> partySums = new HashMap<>();

        ChoiceCheckContext build() {
            return new ChoiceCheckContext(stats, idClass, idLocation, items, traits,
                    registry, partyLocations, partySums);
        }
    }

    private static void assertBlocked(ChoiceAvailability a, String expectedReason) {
        assertFalse(a.available(), "expected the option to be unavailable");
        assertEquals(expectedReason, a.reason());
    }

    private static ChoiceAvailability check(ChoiceEntity c, ChoiceCheckContext ctx,
                                            ChoiceConditionEntity... conds) {
        return ChoiceAvailabilityChecker.check(c, List.of(conds), ctx);
    }

    // ── the happy path ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("Available")
    class Available {

        @Test
        @DisplayName("A bare choice (no limits, no conditions) is available")
        void bare() {
            ChoiceAvailability a = check(choice(), ctx());
            assertTrue(a.available());
            assertNull(a.reason());
        }

        @Test
        @DisplayName("Zero condition rows are available under OR too")
        void bareUnderOr() {
            ChoiceEntity c = choice();
            c.setLogicOperator("OR");
            assertTrue(check(c, ctx()).available());
        }

        @Test
        @DisplayName("Null conditions list reads as no conditions")
        void nullConditions() {
            assertTrue(ChoiceAvailabilityChecker.check(choice(), null, ctx()).available());
        }
    }

    // ── null inputs ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Null inputs")
    class NullInputs {

        @Test
        @DisplayName("A null choice can never be selected")
        void nullChoice() {
            assertBlocked(ChoiceAvailabilityChecker.check(null, List.of(), ctx()),
                    CONDITIONS_NOT_MET);
        }

        @Test
        @DisplayName("A null context can never select")
        void nullContext() {
            assertBlocked(ChoiceAvailabilityChecker.check(choice(), List.of(), null),
                    CONDITIONS_NOT_MET);
        }
    }

    // ── otherwise ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Otherwise bypass (INV-29)")
    class Otherwise {

        @Test
        @DisplayName("otherwise_flag=1 wins outright — failing limits and conditions are not read")
        void otherwiseBeatsEverything() {
            ChoiceEntity c = choice();
            c.setOtherwiseFlag(1);
            c.setLimitDex(99); // would fail
            ChoiceAvailability a = check(c, ctx(),
                    cond("statistics", "int", "99", ">")); // would fail too
            assertTrue(a.available());
            assertNull(a.reason());
        }
    }

    // ── inline limits ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("Inline limits")
    class Limits {

        @Test
        @DisplayName("limit_sad is a maximum: sad above it blocks")
        void sadExceeded() {
            ChoiceEntity c = choice();
            c.setLimitSad(1); // actor sad = 2
            assertBlocked(check(c, ctx()), LIMIT_SAD_EXCEEDED);
        }

        @Test
        @DisplayName("sad exactly at the limit passes (<=, not <)")
        void sadBoundary() {
            ChoiceEntity c = choice();
            c.setLimitSad(2);
            assertTrue(check(c, ctx()).available());
        }

        @Test
        @DisplayName("limit_dex is a minimum: dex below it blocks")
        void dexNotMet() {
            ChoiceEntity c = choice();
            c.setLimitDex(4); // actor dex = 3
            assertBlocked(check(c, ctx()), LIMIT_DEX_NOT_MET);
        }

        @Test
        @DisplayName("dex exactly at the limit passes (>=, not >)")
        void dexBoundary() {
            ChoiceEntity c = choice();
            c.setLimitDex(3);
            assertTrue(check(c, ctx()).available());
        }

        @Test
        @DisplayName("limit_int is a minimum")
        void intNotMet() {
            ChoiceEntity c = choice();
            c.setLimitInt(4);
            assertBlocked(check(c, ctx()), LIMIT_INT_NOT_MET);
        }

        @Test
        @DisplayName("limit_cos is a minimum")
        void cosNotMet() {
            ChoiceEntity c = choice();
            c.setLimitCos(4);
            assertBlocked(check(c, ctx()), LIMIT_COS_NOT_MET);
        }

        @Test
        @DisplayName("Null limits constrain nothing")
        void nullLimits() {
            ChoiceEntity c = choice();
            c.setLimitSad(null);
            c.setLimitDex(null);
            c.setLimitInt(null);
            c.setLimitCos(null);
            assertTrue(check(c, ctx()).available());
        }

        @Test
        @DisplayName("Limits are checked sad, dex, int, cos — the first failure names the reason")
        void limitOrder() {
            ChoiceEntity c = choice();
            c.setLimitSad(0);
            c.setLimitDex(99);
            assertBlocked(check(c, ctx()), LIMIT_SAD_EXCEEDED);
        }

        @Test
        @DisplayName("Limits fail before any condition is read")
        void limitsBeforeConditions() {
            ChoiceEntity c = choice();
            c.setLimitDex(99);
            assertBlocked(check(c, ctx(), cond("statistics", "life", "0", ">")),
                    LIMIT_DEX_NOT_MET);
        }
    }

    // ── KEYS ────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("KEYS — registry conditions")
    class Keys {

        @Test
        @DisplayName("= matches the registry value textually")
        void equalsMet() {
            assertTrue(check(choice(), ctx(b -> b.registry.put("gate", "OPEN")),
                    cond("KEYS", "gate", "OPEN", "=")).available());
        }

        @Test
        @DisplayName("= with a different value blocks")
        void equalsNotMet() {
            assertBlocked(check(choice(), ctx(b -> b.registry.put("gate", "SHUT")),
                    cond("KEYS", "gate", "OPEN", "=")), CONDITION_KEYS_NOT_MET);
        }

        @Test
        @DisplayName("An absent key satisfies only != — never having set the flag IS different")
        void absentKey() {
            assertBlocked(check(choice(), ctx(), cond("KEYS", "gate", "OPEN", "=")),
                    CONDITION_KEYS_NOT_MET);
            assertTrue(check(choice(), ctx(), cond("KEYS", "gate", "OPEN", "!=")).available());
        }

        @Test
        @DisplayName("> and < compare numerically when both sides parse")
        void numericComparison() {
            ChoiceCheckContext ctx = ctx(b -> b.registry.put("day", "5"));
            assertTrue(check(choice(), ctx, cond("KEYS", "day", "3", ">")).available());
            assertBlocked(check(choice(), ctx, cond("KEYS", "day", "5", ">")),
                    CONDITION_KEYS_NOT_MET);
            assertTrue(check(choice(), ctx, cond("KEYS", "day", "9", "<")).available());
        }

        @Test
        @DisplayName("> with a non-numeric registry value is never met")
        void numericAgainstText() {
            assertBlocked(check(choice(), ctx(b -> b.registry.put("day", "many")),
                    cond("KEYS", "day", "3", ">")), CONDITION_KEYS_NOT_MET);
        }

        @Test
        @DisplayName("A blank key or a null expected value can never be satisfied")
        void malformed() {
            assertBlocked(check(choice(), ctx(), cond("KEYS", " ", "OPEN", "=")),
                    CONDITION_KEYS_NOT_MET);
            assertBlocked(check(choice(), ctx(b -> b.registry.put("gate", "OPEN")),
                    cond("KEYS", "gate", null, "!=")), CONDITION_KEYS_NOT_MET);
        }

        @Test
        @DisplayName("An unknown operator is never met")
        void unknownOperator() {
            assertBlocked(check(choice(), ctx(b -> b.registry.put("gate", "OPEN")),
                    cond("KEYS", "gate", "OPEN", ">=")), CONDITION_KEYS_NOT_MET);
        }
    }

    // ── ITEM / traits (membership) ──────────────────────────────────────────

    @Nested
    @DisplayName("ITEM and traits — membership conditions")
    class Membership {

        @Test
        @DisplayName("ITEM = requires owning the item id in `value`")
        void itemOwned() {
            assertTrue(check(choice(), ctx(b -> b.items.add(42L)),
                    cond("ITEM", null, "42", "=")).available());
            assertBlocked(check(choice(), ctx(), cond("ITEM", null, "42", "=")),
                    CONDITION_ITEM_NOT_MET);
        }

        @Test
        @DisplayName("ITEM != requires NOT owning it")
        void itemNotOwned() {
            assertTrue(check(choice(), ctx(), cond("ITEM", null, "42", "!=")).available());
            assertBlocked(check(choice(), ctx(b -> b.items.add(42L)),
                    cond("ITEM", null, "42", "!=")), CONDITION_ITEM_NOT_MET);
        }

        @Test
        @DisplayName("The id falls back to `key` when `value` is not numeric")
        void itemIdFromKey() {
            assertTrue(check(choice(), ctx(b -> b.items.add(42L)),
                    cond("ITEM", "42", null, "=")).available());
        }

        @Test
        @DisplayName("Ordering an item (>) is authored noise: never met")
        void itemOrdered() {
            assertBlocked(check(choice(), ctx(b -> b.items.add(42L)),
                    cond("ITEM", null, "42", ">")), CONDITION_ITEM_NOT_MET);
        }

        @Test
        @DisplayName("traits = requires holding the trait (case-insensitive type)")
        void traitHeld() {
            assertTrue(check(choice(), ctx(b -> b.traits.add(9L)),
                    cond("traits", null, "9", "=")).available());
            assertBlocked(check(choice(), ctx(), cond("TRAITS", null, "9", "=")),
                    CONDITION_TRAITS_NOT_MET);
        }

        @Test
        @DisplayName("A non-numeric id can never be satisfied")
        void malformedId() {
            assertBlocked(check(choice(), ctx(), cond("ITEM", null, "the-sword", "=")),
                    CONDITION_ITEM_NOT_MET);
        }
    }

    // ── CLASS / LOCATION (identity) ─────────────────────────────────────────

    @Nested
    @DisplayName("CLASS and LOCATION — identity conditions")
    class Identity {

        @Test
        @DisplayName("CLASS = matches the actor's class id")
        void classMatch() {
            assertTrue(check(choice(), ctx(), cond("CLASS", null, "50", "=")).available());
            assertBlocked(check(choice(), ctx(), cond("CLASS", null, "51", "=")),
                    CONDITION_CLASS_NOT_MET);
        }

        @Test
        @DisplayName("CLASS != excludes one class")
        void classExclude() {
            assertTrue(check(choice(), ctx(), cond("CLASS", null, "51", "!=")).available());
        }

        @Test
        @DisplayName("A classless actor fails = and passes !=")
        void classless() {
            assertBlocked(check(choice(), ctx(b -> b.idClass = null),
                    cond("CLASS", null, "50", "=")), CONDITION_CLASS_NOT_MET);
            assertTrue(check(choice(), ctx(b -> b.idClass = null),
                    cond("CLASS", null, "50", "!=")).available());
        }

        @Test
        @DisplayName("LOCATION = matches where the actor stands")
        void locationMatch() {
            assertTrue(check(choice(), ctx(), cond("LOCATION", null, "100", "=")).available());
            assertBlocked(check(choice(), ctx(), cond("LOCATION", null, "101", "=")),
                    CONDITION_LOCATION_NOT_MET);
        }
    }

    // ── ALL_IN_SAME_LOC ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("ALL_IN_SAME_LOC — the whole party stands together")
    class AllInSameLoc {

        @Test
        @DisplayName("Everyone in the actor's location is met (solo trivially so)")
        void gathered() {
            assertTrue(check(choice(), ctx(b -> b.partyLocations = List.of(LOC, LOC, LOC)),
                    cond("ALL_IN_SAME_LOC", null, null, null)).available());
            assertTrue(check(choice(), ctx(), // solo party
                    cond("ALL_IN_SAME_LOC", null, null, null)).available());
        }

        @Test
        @DisplayName("One straggler blocks")
        void scattered() {
            assertBlocked(check(choice(), ctx(b -> b.partyLocations = List.of(LOC, 999L)),
                    cond("ALL_IN_SAME_LOC", null, null, null)),
                    CONDITION_ALL_IN_SAME_LOC_NOT_MET);
        }

        @Test
        @DisplayName("An unplaced member (null location) blocks")
        void unplacedMember() {
            java.util.List<Long> party = new java.util.ArrayList<>();
            party.add(LOC);
            party.add(null);
            assertBlocked(check(choice(), ctx(b -> b.partyLocations = party),
                    cond("ALL_IN_SAME_LOC", null, null, null)),
                    CONDITION_ALL_IN_SAME_LOC_NOT_MET);
        }

        @Test
        @DisplayName("An unplaced actor can never gather anyone")
        void unplacedActor() {
            assertBlocked(check(choice(), ctx(b -> b.idLocation = null),
                    cond("ALL_IN_SAME_LOC", null, null, null)),
                    CONDITION_ALL_IN_SAME_LOC_NOT_MET);
        }
    }

    // ── statistics ──────────────────────────────────────────────────────────

    @Nested
    @DisplayName("statistics — the actor's own stats")
    class Statistics {

        @Test
        @DisplayName("All four operators compare the named stat numerically")
        void operators() {
            assertTrue(check(choice(), ctx(), cond("statistics", "int", "3", "=")).available());
            assertTrue(check(choice(), ctx(), cond("statistics", "int", "4", "!=")).available());
            assertTrue(check(choice(), ctx(), cond("statistics", "int", "2", ">")).available());
            assertTrue(check(choice(), ctx(), cond("statistics", "int", "4", "<")).available());
            assertBlocked(check(choice(), ctx(), cond("statistics", "int", "99", ">")),
                    CONDITION_STATISTICS_NOT_MET);
        }

        @Test
        @DisplayName("The stat name is matched case-insensitively")
        void statCase() {
            assertTrue(check(choice(), ctx(), cond("STATISTICS", "INT", "2", ">")).available());
        }

        @Test
        @DisplayName("Backpack stats (food/magic/coin) are part of the vocabulary")
        void backpackStats() {
            assertTrue(check(choice(), ctx(), cond("statistics", "coin", "9", ">")).available());
        }

        @Test
        @DisplayName("An unknown stat or non-numeric value is never met")
        void malformed() {
            assertBlocked(check(choice(), ctx(), cond("statistics", "charisma", "1", ">")),
                    CONDITION_STATISTICS_NOT_MET);
            assertBlocked(check(choice(), ctx(), cond("statistics", "int", "lots", ">")),
                    CONDITION_STATISTICS_NOT_MET);
        }
    }

    // ── statistics_SUM ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("statistics_SUM — the party's pooled stats")
    class StatisticsSum {

        @Test
        @DisplayName("Compares the pre-computed party sum, not the actor's value")
        void sums() {
            ChoiceCheckContext ctx = ctx(b -> b.partySums.put("int", 12));
            assertTrue(check(choice(), ctx, cond("statistics_SUM", "int", "10", ">")).available());
            assertBlocked(check(choice(), ctx, cond("statistics_SUM", "int", "12", ">")),
                    CONDITION_STATISTICS_SUM_NOT_MET);
        }

        @Test
        @DisplayName("A stat with no computed sum is never met")
        void missingSum() {
            assertBlocked(check(choice(), ctx(), cond("statistics_SUM", "int", "1", ">")),
                    CONDITION_STATISTICS_SUM_NOT_MET);
        }
    }

    // ── logic operator ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("logic_operator (INV-31)")
    class LogicOperator {

        @Test
        @DisplayName("AND: the FIRST failing row names the reason")
        void andFirstFailure() {
            assertBlocked(check(choice(), ctx(),
                    cond("KEYS", "gate", "OPEN", "="),           // fails first
                    cond("statistics", "int", "99", ">")),        // would fail too
                    CONDITION_KEYS_NOT_MET);
        }

        @Test
        @DisplayName("AND: every row must pass")
        void andAllPass() {
            assertTrue(check(choice(), ctx(b -> b.registry.put("gate", "OPEN")),
                    cond("KEYS", "gate", "OPEN", "="),
                    cond("statistics", "int", "2", ">")).available());
        }

        @Test
        @DisplayName("OR over two CLASS rows: class 1 OR class 2 — the real use case")
        void orTwoClasses() {
            // logicOperator is per-choice, all-OR: available when the actor's class is
            // EITHER of the two. This is the only way to say "one class or the other",
            // since a character has a single class, so AND (class=1 AND class=2) is
            // impossible — see andTwoClassesIsImpossible below.
            ChoiceEntity c = choice();
            c.setLogicOperator("OR");
            ChoiceConditionEntity classOne = cond("CLASS", null, "1", "=");
            ChoiceConditionEntity classTwo = cond("CLASS", null, "2", "=");

            assertTrue(check(c, ctx(b -> b.idClass = 1L), classOne, classTwo).available(),
                    "class 1 satisfies the first row");
            assertTrue(check(c, ctx(b -> b.idClass = 2L), classOne, classTwo).available(),
                    "class 2 satisfies the second row");
            assertBlocked(check(c, ctx(b -> b.idClass = 3L), classOne, classTwo),
                    CONDITIONS_NOT_MET);
        }

        @Test
        @DisplayName("AND over two CLASS rows can never pass — a character has one class")
        void andTwoClassesIsImpossible() {
            ChoiceEntity c = choice(); // AND by default
            assertBlocked(check(c, ctx(b -> b.idClass = 1L),
                    cond("CLASS", null, "1", "="), cond("CLASS", null, "2", "=")),
                    CONDITION_CLASS_NOT_MET);
            assertBlocked(check(c, ctx(b -> b.idClass = 2L),
                    cond("CLASS", null, "1", "="), cond("CLASS", null, "2", "=")),
                    CONDITION_CLASS_NOT_MET);
        }

        @Test
        @DisplayName("OR: a single passing row is enough")
        void orOneTrue() {
            ChoiceEntity c = choice();
            c.setLogicOperator("OR");
            assertTrue(check(c, ctx(),
                    cond("KEYS", "gate", "OPEN", "="),            // fails
                    cond("statistics", "life", "0", ">"))         // passes
                    .available());
        }

        @Test
        @DisplayName("OR: all rows failing reports the aggregate, no single culprit")
        void orAllFalse() {
            ChoiceEntity c = choice();
            c.setLogicOperator("OR");
            assertBlocked(check(c, ctx(),
                    cond("KEYS", "gate", "OPEN", "="),
                    cond("statistics", "int", "99", ">")),
                    CONDITIONS_NOT_MET);
        }

        @Test
        @DisplayName("The combiner is case-insensitive, anything not OR reads as AND")
        void combinerNormalization() {
            ChoiceEntity or = choice();
            or.setLogicOperator("or");
            assertTrue(check(or, ctx(),
                    cond("KEYS", "gate", "OPEN", "="),
                    cond("statistics", "life", "0", ">")).available());

            ChoiceEntity weird = choice();
            weird.setLogicOperator("XOR");
            assertBlocked(check(weird, ctx(),
                    cond("KEYS", "gate", "OPEN", "="),
                    cond("statistics", "life", "0", ">")), CONDITION_KEYS_NOT_MET);
        }

        @Test
        @DisplayName("A null combiner is AND")
        void nullCombiner() {
            ChoiceEntity c = choice();
            c.setLogicOperator(null);
            assertBlocked(check(c, ctx(), cond("KEYS", "gate", "OPEN", "=")),
                    CONDITION_KEYS_NOT_MET);
        }
    }

    // ── unknown types ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("Unknown condition types")
    class UnknownTypes {

        @Test
        @DisplayName("A typo'd type locks the option — it never unlocks it")
        void unknownType() {
            assertBlocked(check(choice(), ctx(), cond("KEYZ", "gate", "OPEN", "=")),
                    CONDITIONS_NOT_MET);
        }

        @Test
        @DisplayName("A null type is unknown")
        void nullType() {
            assertBlocked(check(choice(), ctx(), cond(null, "gate", "OPEN", "=")),
                    CONDITIONS_NOT_MET);
        }

        @Test
        @DisplayName("Under OR an unknown row does not pass, but a later valid row can")
        void unknownUnderOr() {
            ChoiceEntity c = choice();
            c.setLogicOperator("OR");
            assertTrue(check(c, ctx(),
                    cond("KEYZ", "gate", "OPEN", "="),
                    cond("statistics", "life", "0", ">")).available());
        }

        @Test
        @DisplayName("A null operator defaults to =")
        void nullOperatorDefaultsToEquals() {
            assertTrue(check(choice(), ctx(b -> b.registry.put("gate", "OPEN")),
                    cond("KEYS", "gate", "OPEN", null)).available());
        }
    }
}
