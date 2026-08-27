package games.paths.core.service.match;

import games.paths.core.port.match.EdgeStateStorePort;
import games.paths.core.service.match.EdgeStateEvaluator.CharacterState;
import games.paths.core.service.match.EdgeStateEvaluator.Verdict;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * EdgeStateEvaluator (Step 30) — the sadness-overflow and coma rules, in isolation.
 */
@DisplayName("EdgeStateEvaluator (Step 30)")
class EdgeStateEvaluatorTest {

    private static final long ID = 7L;

    /** life, sad, sadMax, cos — the four numbers the rules actually read. */
    private static CharacterState state(int life, int sad, int sadMax, int cos, boolean coma) {
        return new CharacterState(ID, life, sad, sadMax, cos, coma);
    }

    @Nested
    @DisplayName("Sadness overflow")
    class Sadness {

        @Test
        @DisplayName("Below the cap nothing fires and sad keeps its value")
        void belowCapIsQuiet() {
            Verdict v = EdgeStateEvaluator.evaluate(state(30, 49, 50, 10, false));

            assertAll(
                    () -> assertFalse(v.anything()),
                    () -> assertFalse(v.sadnessOverflow()),
                    () -> assertEquals(30, v.lifeAfter()),
                    () -> assertEquals(49, v.sadAfter()));
        }

        @Test
        @DisplayName("Reaching the cap costs COS life, resets sad and forces sleep")
        void atCapOverflows() {
            Verdict v = EdgeStateEvaluator.evaluate(state(30, 50, 50, 10, false));

            assertAll(
                    () -> assertTrue(v.sadnessOverflow()),
                    () -> assertEquals(20, v.lifeAfter(), "life pays COS"),
                    () -> assertEquals(0, v.sadAfter(), "sadness discharges"),
                    () -> assertTrue(v.forcedSleep()),
                    () -> assertFalse(v.comaTriggered(), "life is still above zero"));
        }

        @Test
        @DisplayName("Overshooting the cap behaves exactly like reaching it")
        void aboveCapOverflows() {
            Verdict v = EdgeStateEvaluator.evaluate(state(30, 9999, 50, 10, false));

            assertTrue(v.sadnessOverflow());
            assertEquals(20, v.lifeAfter());
        }

        @Test
        @DisplayName("A non-positive cap disables the rule instead of firing it forever")
        void nonPositiveCapIsInert() {
            // clamp() returns min when max < min, so sad is 0 and 0 >= 0 would be true —
            // an unauthored sad_max would drain COS life on every single event.
            assertFalse(EdgeStateEvaluator.evaluate(state(30, 0, 0, 10, false)).sadnessOverflow());
            assertFalse(EdgeStateEvaluator.evaluate(state(30, 5, -3, 10, false)).sadnessOverflow());
        }
    }

    @Nested
    @DisplayName("Coma")
    class Coma {

        @Test
        @DisplayName("Life at zero triggers coma and forces sleep")
        void zeroLifeComas() {
            Verdict v = EdgeStateEvaluator.evaluate(state(0, 0, 50, 10, false));

            assertAll(
                    () -> assertTrue(v.comaTriggered()),
                    () -> assertTrue(v.forcedSleep()),
                    () -> assertFalse(v.sadnessOverflow()));
        }

        @Test
        @DisplayName("Negative life triggers coma too")
        void negativeLifeComas() {
            assertTrue(EdgeStateEvaluator.evaluate(state(-4, 0, 50, 10, false)).comaTriggered());
        }

        @Test
        @DisplayName("An already comatose character does not re-trigger")
        void alreadyComaIsSuppressed() {
            Verdict v = EdgeStateEvaluator.evaluate(state(0, 0, 50, 10, true));

            assertFalse(v.comaTriggered(), "the log row and clock_in_coma must be written once");
            assertFalse(v.anything());
        }

        @Test
        @DisplayName("alreadyComa suppresses the trigger but not the arithmetic")
        void alreadyComaStillTakesTheHit() {
            // A target=ALL sadness effect still reaches a comatose character.
            Verdict v = EdgeStateEvaluator.evaluate(state(4, 50, 50, 10, true));

            assertAll(
                    () -> assertTrue(v.sadnessOverflow()),
                    () -> assertEquals(0, v.lifeAfter(), "floored, never negative"),
                    () -> assertFalse(v.comaTriggered(), "already there"));
        }
    }

    @Nested
    @DisplayName("The cascade")
    class Cascade {

        @Test
        @DisplayName("An overflow whose COS hit empties the life bar also comas, in one pass")
        void overflowCascadesIntoComa() {
            // life 8, COS 10 → 8 - 10 = -2 → floored to 0 → coma.
            Verdict v = EdgeStateEvaluator.evaluate(state(8, 50, 50, 10, false));

            assertAll(
                    () -> assertTrue(v.sadnessOverflow()),
                    () -> assertTrue(v.comaTriggered(), "the coma rule reads the post-hit life"),
                    () -> assertEquals(0, v.lifeAfter()),
                    () -> assertEquals(0, v.sadAfter()),
                    () -> assertTrue(v.forcedSleep()));
        }

        @Test
        @DisplayName("Surviving the COS hit by one point avoids the coma")
        void surviveByOne() {
            Verdict v = EdgeStateEvaluator.evaluate(state(11, 50, 50, 10, false));

            assertTrue(v.sadnessOverflow());
            assertFalse(v.comaTriggered());
            assertEquals(1, v.lifeAfter());
        }
    }

    @Nested
    @DisplayName("allInComa")
    class AllInComa {

        @Test
        @DisplayName("An empty roster is not all-in-coma")
        void emptyIsFalse() {
            assertFalse(EdgeStateEvaluator.allInComa(List.of()));
            assertFalse(EdgeStateEvaluator.allInComa(null));
        }

        @Test
        @DisplayName("Every flag must be true")
        void allTrue() {
            assertTrue(EdgeStateEvaluator.allInComa(List.of(true, true)));
            assertFalse(EdgeStateEvaluator.allInComa(List.of(true, false)));
            assertFalse(EdgeStateEvaluator.allInComa(Arrays.asList(true, (Boolean) null)));
        }
    }

    @Nested
    @DisplayName("persist")
    class Persist {

        @Test
        @DisplayName("A coma writes the flags, the clock and one log row")
        void comaWritesFlagsAndLog() {
            EdgeStateStorePort store = mock(EdgeStateStorePort.class);
            Verdict v = EdgeStateEvaluator.evaluate(state(0, 0, 50, 10, false));

            EdgeStateEvaluator.persist(store, 1L, v, 9, 42L);

            verify(store).setComa(1L, ID, 9);
            verify(store).logEdgeState(eq(1L), eq(ID), eq(42L), eq(9),
                    org.mockito.ArgumentMatchers.contains(EdgeStateStorePort.MSG_COMA));
            verify(store, never()).setSleeping(anyLong(), anyLong());
        }

        @Test
        @DisplayName("An overflow without coma only raises sleep")
        void overflowRaisesSleepOnly() {
            EdgeStateStorePort store = mock(EdgeStateStorePort.class);
            Verdict v = EdgeStateEvaluator.evaluate(state(30, 50, 50, 10, false));

            EdgeStateEvaluator.persist(store, 1L, v, 9, null);

            verify(store).setSleeping(1L, ID);
            verify(store).logEdgeState(eq(1L), eq(ID), eq(null), eq(9),
                    org.mockito.ArgumentMatchers.contains(EdgeStateStorePort.MSG_SADNESS_OVERFLOW));
            verify(store, never()).setComa(anyLong(), anyLong(), anyInt());
        }

        @Test
        @DisplayName("A cascade writes both rows but never sleeps twice")
        void cascadeWritesBoth() {
            EdgeStateStorePort store = mock(EdgeStateStorePort.class);
            Verdict v = EdgeStateEvaluator.evaluate(state(8, 50, 50, 10, false));

            EdgeStateEvaluator.persist(store, 1L, v, 3, 42L);

            verify(store).setComa(1L, ID, 3);
            verify(store, never()).setSleeping(anyLong(), anyLong());
            verify(store, org.mockito.Mockito.times(2))
                    .logEdgeState(anyLong(), anyLong(), anyLong(), anyInt(), org.mockito.ArgumentMatchers.anyString());
        }

        @Test
        @DisplayName("A quiet verdict writes nothing at all")
        void quietWritesNothing() {
            EdgeStateStorePort store = mock(EdgeStateStorePort.class);
            Verdict v = EdgeStateEvaluator.evaluate(state(30, 1, 50, 10, false));

            EdgeStateEvaluator.persist(store, 1L, v, 3, 42L);

            org.mockito.Mockito.verifyNoInteractions(store);
        }
    }
}
