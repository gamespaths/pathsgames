package games.paths.core.service.match;

import games.paths.core.entity.story.EventEntity;
import games.paths.core.port.match.EventExecutionPort.EventAvailability;
import games.paths.core.port.match.EventExecutionPort.EventExecutionException.Code;
import games.paths.core.port.match.EventExecutionStorePort.EventCheckContext;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * EventAvailabilityChecker (Step 29) — the check procedure.
 *
 * <p>The checker is a pure function, so every branch is reachable directly: one test per
 * {@link Code} it can produce, plus the boundaries and the precedence order.</p>
 */
@DisplayName("EventAvailabilityChecker (Step 29)")
class EventAvailabilityCheckerTest {

    private static final long CHAR_ID = 7L;
    private static final long LOC = 100L;

    // ── fixtures ────────────────────────────────────────────────────────────

    /** An event with no condition at all: executable by anyone, anywhere, for free. */
    private static EventEntity event() {
        EventEntity e = new EventEntity();
        e.setId(1L);
        e.setType("NORMAL");
        e.setCostEnery(0);
        e.setCoinCost(0);
        return e;
    }

    /** A healthy actor standing at {@link #LOC} with 10 energy and 10 coins. */
    private static EventCheckContext ctx() {
        return new EventCheckContext(CHAR_ID, LOC, false, false, 10, 10, 50L,
                new HashSet<>(), null, new HashSet<>(), new HashMap<>());
    }

    private static EventCheckContext ctx(java.util.function.Consumer<Builder> tweak) {
        Builder b = new Builder();
        tweak.accept(b);
        return b.build();
    }

    /** Mutable view of the context so each test states only what it changes. */
    private static final class Builder {
        Long idCharacter = CHAR_ID;
        Long idLocation = LOC;
        boolean sleeping = false;
        boolean coma = false;
        int energy = 10;
        int coin = 10;
        Long idClass = 50L;
        Set<Long> items = new HashSet<>();
        Long weather = null;
        Set<Long> consumed = new HashSet<>();
        Map<String, String> registry = new HashMap<>();

        EventCheckContext build() {
            return new EventCheckContext(idCharacter, idLocation, sleeping, coma, energy, coin,
                    idClass, items, weather, consumed, registry);
        }
    }

    private static void assertUnavailable(EventAvailability a, Code expected) {
        assertFalse(a.available(), "expected the event to be unavailable");
        assertEquals(expected, a.reason());
        assertEquals(expected.name(), a.reasonName());
    }

    // ── the happy path ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("Available")
    class Available {

        @Test
        @DisplayName("A NORMAL event with no conditions is available")
        void plainNormal() {
            EventAvailability a = EventAvailabilityChecker.check(event(), ctx());
            assertTrue(a.available());
            assertNull(a.reason());
            assertNull(a.reasonName());
        }

        @Test
        @DisplayName("A ONCE event not yet consumed is available")
        void onceNotConsumed() {
            EventEntity e = event();
            e.setType("ONCE");
            assertTrue(EventAvailabilityChecker.check(e, ctx()).available());
        }

        @Test
        @DisplayName("A null id_specific_location means no location constraint")
        void globalEvent() {
            EventEntity e = event();
            e.setIdSpecificLocation(null);
            assertTrue(EventAvailabilityChecker.check(e, ctx(b -> b.idLocation = 999L)).available());
        }

        @Test
        @DisplayName("The type is matched case-insensitively")
        void typeCaseInsensitive() {
            EventEntity e = event();
            e.setType("once");
            assertTrue(EventAvailabilityChecker.check(e, ctx()).available());
        }

        @Test
        @DisplayName("Energy and coins exactly equal to the cost are enough (>=, not >)")
        void costBoundary() {
            EventEntity e = event();
            e.setCostEnery(10);
            e.setCoinCost(10);
            assertTrue(EventAvailabilityChecker.check(e, ctx()).available());
        }

        @Test
        @DisplayName("A null cost is treated as zero")
        void nullCost() {
            EventEntity e = event();
            e.setCostEnery(null);
            e.setCoinCost(null);
            assertTrue(EventAvailabilityChecker.check(e, ctx(b -> {
                b.energy = 0;
                b.coin = 0;
            })).available());
        }

        @Test
        @DisplayName("Each condition passes when it is satisfied")
        void conditionsSatisfied() {
            EventEntity e = event();
            e.setIdSpecificLocation((int) LOC);
            e.setRegistryKeyCondition("GATE");
            e.setRegistryValueCondition("OPEN");
            e.setIdWeather(3);
            e.setIdItemCondition(42);
            e.setIdClassCondition(50);

            EventAvailability a = EventAvailabilityChecker.check(e, ctx(b -> {
                b.registry.put("GATE", "OPEN");
                b.weather = 3L;
                b.items.add(42L);
                b.idClass = 50L;
            }));
            assertTrue(a.available(), "reason was " + a.reason());
        }
    }

    // ── one test per rejection code ─────────────────────────────────────────

    @Nested
    @DisplayName("Unavailable")
    class Unavailable {

        @Test
        @DisplayName("EVENT_NOT_FOUND when the event is null")
        void nullEvent() {
            assertUnavailable(EventAvailabilityChecker.check(null, ctx()), Code.EVENT_NOT_FOUND);
        }

        @Test
        @DisplayName("CHARACTER_CANNOT_ACT when the context is null")
        void nullContext() {
            assertUnavailable(EventAvailabilityChecker.check(event(), null), Code.CHARACTER_CANNOT_ACT);
        }

        @Test
        @DisplayName("CHARACTER_CANNOT_ACT when the caller owns no character")
        void noCharacter() {
            assertUnavailable(EventAvailabilityChecker.check(event(), EventCheckContext.noCharacter()),
                    Code.CHARACTER_CANNOT_ACT);
        }

        @Test
        @DisplayName("SLEEPING while sleeping")
        void sleeping() {
            assertUnavailable(EventAvailabilityChecker.check(event(), ctx(b -> b.sleeping = true)),
                    Code.SLEEPING);
        }

        @Test
        @DisplayName("COMA while in coma")
        void coma() {
            assertUnavailable(EventAvailabilityChecker.check(event(), ctx(b -> b.coma = true)),
                    Code.COMA);
        }

        @Test
        @DisplayName("COMA outranks SLEEPING: a comatose character is also asleep")
        void comaOutranksSleeping() {
            assertUnavailable(EventAvailabilityChecker.check(event(), ctx(b -> {
                b.sleeping = true;
                b.coma = true;
            })), Code.COMA);
        }

        @Test
        @DisplayName("EVENT_NOT_EXECUTABLE_TYPE for AUTOMATIC and FIRST")
        void notExecutableType() {
            EventEntity automatic = event();
            automatic.setType("AUTOMATIC");
            assertUnavailable(EventAvailabilityChecker.check(automatic, ctx()),
                    Code.EVENT_NOT_EXECUTABLE_TYPE);

            EventEntity first = event();
            first.setType("FIRST");
            assertUnavailable(EventAvailabilityChecker.check(first, ctx()),
                    Code.EVENT_NOT_EXECUTABLE_TYPE);
        }

        @Test
        @DisplayName("EVENT_NOT_EXECUTABLE_TYPE when the type is null")
        void nullType() {
            EventEntity e = event();
            e.setType(null);
            assertUnavailable(EventAvailabilityChecker.check(e, ctx()), Code.EVENT_NOT_EXECUTABLE_TYPE);
        }

        @Test
        @DisplayName("ONCE_ALREADY_CONSUMED once the event is in the consumed set")
        void onceConsumed() {
            EventEntity e = event();
            e.setType("ONCE");
            assertUnavailable(EventAvailabilityChecker.check(e, ctx(b -> b.consumed.add(1L))),
                    Code.ONCE_ALREADY_CONSUMED);
        }

        @Test
        @DisplayName("A consumed NORMAL event stays available — ONCE is what makes it single-use")
        void normalIsNotConsumable() {
            assertTrue(EventAvailabilityChecker.check(event(), ctx(b -> b.consumed.add(1L))).available());
        }

        @Test
        @DisplayName("WRONG_LOCATION when the character stands elsewhere")
        void wrongLocation() {
            EventEntity e = event();
            e.setIdSpecificLocation(999);
            assertUnavailable(EventAvailabilityChecker.check(e, ctx()), Code.WRONG_LOCATION);
        }

        @Test
        @DisplayName("WRONG_LOCATION when the character has no location at all")
        void noLocation() {
            EventEntity e = event();
            e.setIdSpecificLocation((int) LOC);
            assertUnavailable(EventAvailabilityChecker.check(e, ctx(b -> b.idLocation = null)),
                    Code.WRONG_LOCATION);
        }

        @Test
        @DisplayName("NOT_ENOUGH_ENERGY one point short")
        void notEnoughEnergy() {
            EventEntity e = event();
            e.setCostEnery(11);
            assertUnavailable(EventAvailabilityChecker.check(e, ctx()), Code.NOT_ENOUGH_ENERGY);
        }

        @Test
        @DisplayName("NOT_ENOUGH_COINS one coin short")
        void notEnoughCoins() {
            EventEntity e = event();
            e.setCoinCost(11);
            assertUnavailable(EventAvailabilityChecker.check(e, ctx()), Code.NOT_ENOUGH_COINS);
        }

        @Test
        @DisplayName("REGISTRY_CONDITION_NOT_MET when the key is absent")
        void registryKeyAbsent() {
            EventEntity e = event();
            e.setRegistryKeyCondition("GATE");
            e.setRegistryValueCondition("OPEN");
            assertUnavailable(EventAvailabilityChecker.check(e, ctx()), Code.REGISTRY_CONDITION_NOT_MET);
        }

        @Test
        @DisplayName("REGISTRY_CONDITION_NOT_MET when the value differs")
        void registryValueDiffers() {
            EventEntity e = event();
            e.setRegistryKeyCondition("GATE");
            e.setRegistryValueCondition("OPEN");
            assertUnavailable(EventAvailabilityChecker.check(e, ctx(b -> b.registry.put("GATE", "SHUT"))),
                    Code.REGISTRY_CONDITION_NOT_MET);
        }

        @Test
        @DisplayName("A registry key with no expected value can never be met")
        void registryValueMissing() {
            EventEntity e = event();
            e.setRegistryKeyCondition("GATE");
            e.setRegistryValueCondition(null);
            assertUnavailable(EventAvailabilityChecker.check(e, ctx(b -> b.registry.put("GATE", "OPEN"))),
                    Code.REGISTRY_CONDITION_NOT_MET);
        }

        @Test
        @DisplayName("A blank registry key is no condition at all")
        void registryKeyBlank() {
            EventEntity e = event();
            e.setRegistryKeyCondition("   ");
            assertTrue(EventAvailabilityChecker.check(e, ctx()).available());
        }

        @Test
        @DisplayName("WEATHER_CONDITION_NOT_MET when the current weather differs")
        void weatherDiffers() {
            EventEntity e = event();
            e.setIdWeather(3);
            assertUnavailable(EventAvailabilityChecker.check(e, ctx(b -> b.weather = 4L)),
                    Code.WEATHER_CONDITION_NOT_MET);
        }

        @Test
        @DisplayName("WEATHER_CONDITION_NOT_MET when no weather is selected yet")
        void weatherUnset() {
            EventEntity e = event();
            e.setIdWeather(3);
            assertUnavailable(EventAvailabilityChecker.check(e, ctx()), Code.WEATHER_CONDITION_NOT_MET);
        }

        @Test
        @DisplayName("ITEM_CONDITION_NOT_MET when the item is not carried")
        void itemMissing() {
            EventEntity e = event();
            e.setIdItemCondition(42);
            assertUnavailable(EventAvailabilityChecker.check(e, ctx(b -> b.items.add(43L))),
                    Code.ITEM_CONDITION_NOT_MET);
        }

        @Test
        @DisplayName("CLASS_CONDITION_NOT_MET when the class differs")
        void classDiffers() {
            EventEntity e = event();
            e.setIdClassCondition(50);
            assertUnavailable(EventAvailabilityChecker.check(e, ctx(b -> b.idClass = 51L)),
                    Code.CLASS_CONDITION_NOT_MET);
        }

        @Test
        @DisplayName("CLASS_CONDITION_NOT_MET when the character has no class")
        void classUnset() {
            EventEntity e = event();
            e.setIdClassCondition(50);
            assertUnavailable(EventAvailabilityChecker.check(e, ctx(b -> b.idClass = null)),
                    Code.CLASS_CONDITION_NOT_MET);
        }
    }

    // ── precedence ──────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Check order")
    class Order {

        @Test
        @DisplayName("Actor state wins over every other failing condition")
        void actorStateFirst() {
            EventEntity e = event();
            e.setIdSpecificLocation(999);
            e.setCostEnery(999);
            e.setCoinCost(999);
            assertUnavailable(EventAvailabilityChecker.check(e, ctx(b -> b.sleeping = true)),
                    Code.SLEEPING);
        }

        @Test
        @DisplayName("ONCE_ALREADY_CONSUMED wins over the location and cost checks")
        void consumedBeforeLocation() {
            EventEntity e = event();
            e.setType("ONCE");
            e.setIdSpecificLocation(999);
            e.setCostEnery(999);
            assertUnavailable(EventAvailabilityChecker.check(e, ctx(b -> b.consumed.add(1L))),
                    Code.ONCE_ALREADY_CONSUMED);
        }

        @Test
        @DisplayName("Location wins over the cost checks")
        void locationBeforeCost() {
            EventEntity e = event();
            e.setIdSpecificLocation(999);
            e.setCostEnery(999);
            assertUnavailable(EventAvailabilityChecker.check(e, ctx()), Code.WRONG_LOCATION);
        }

        @Test
        @DisplayName("Energy wins over coins")
        void energyBeforeCoins() {
            EventEntity e = event();
            e.setCostEnery(999);
            e.setCoinCost(999);
            assertUnavailable(EventAvailabilityChecker.check(e, ctx()), Code.NOT_ENOUGH_ENERGY);
        }

        @Test
        @DisplayName("Registry wins over weather, item and class")
        void registryBeforeTheRest() {
            EventEntity e = event();
            e.setRegistryKeyCondition("GATE");
            e.setRegistryValueCondition("OPEN");
            e.setIdWeather(3);
            e.setIdItemCondition(42);
            e.setIdClassCondition(51);
            assertUnavailable(EventAvailabilityChecker.check(e, ctx()), Code.REGISTRY_CONDITION_NOT_MET);
        }
    }
}
