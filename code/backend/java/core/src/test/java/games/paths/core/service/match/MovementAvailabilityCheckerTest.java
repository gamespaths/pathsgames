package games.paths.core.service.match;

import games.paths.core.port.match.MovementPort.MovementAvailability;
import games.paths.core.port.match.MovementPort.MovementException.Code;
import games.paths.core.service.match.MovementAvailabilityChecker.MoveCheckContext;
import games.paths.core.service.match.MovementAvailabilityChecker.MoveEdgeCheck;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The one verdict shared by /info (which reports it) and action/move (which enforces it).
 * The tests pin the ORDER of the reasons as much as the reasons themselves: the order is the
 * contract — a comatose, exhausted character must be told about the coma.
 */
class MovementAvailabilityCheckerTest {

    /** An awake, well-fed mover in a running match. */
    private static MoveCheckContext ok() {
        return new MoveCheckContext(true, true, false, false, 100, 0, 50);
    }

    /** A free, empty, condition-less edge that costs 10. */
    private static MoveEdgeCheck edge() {
        return new MoveEdgeCheck(true, 10, 0, 0);
    }

    @Test
    @DisplayName("everything in order → available, no reason")
    void available() {
        MovementAvailability av = MovementAvailabilityChecker.check(ok(), edge());
        assertTrue(av.available());
        assertNull(av.reason());
        assertNull(av.reasonName());
    }

    @Nested
    @DisplayName("the mover's own state")
    class MoverState {

        @Test
        @DisplayName("no character → CHARACTER_CANNOT_ACT")
        void noCharacter() {
            assertEquals(Code.CHARACTER_CANNOT_ACT, MovementAvailabilityChecker
                    .check(MoveCheckContext.noCharacter(), edge()).reason());
        }

        @Test
        @DisplayName("null context → CHARACTER_CANNOT_ACT (never a crash, never an accidental yes)")
        void nullContext() {
            MovementAvailability av = MovementAvailabilityChecker.check(null, edge());
            assertFalse(av.available());
            assertEquals(Code.CHARACTER_CANNOT_ACT, av.reason());
        }

        @Test
        @DisplayName("match not RUNNING → MATCH_NOT_RUNNING")
        void matchNotRunning() {
            MoveCheckContext ctx = new MoveCheckContext(false, true, false, false, 100, 0, 50);
            assertEquals(Code.MATCH_NOT_RUNNING,
                    MovementAvailabilityChecker.check(ctx, edge()).reason());
        }

        @Test
        @DisplayName("coma → COMA")
        void coma() {
            MoveCheckContext ctx = new MoveCheckContext(true, true, true, false, 100, 0, 50);
            assertEquals(Code.COMA, MovementAvailabilityChecker.check(ctx, edge()).reason());
        }

        @Test
        @DisplayName("sleeping → SLEEPING")
        void sleeping() {
            MoveCheckContext ctx = new MoveCheckContext(true, true, false, true, 100, 0, 50);
            assertEquals(Code.SLEEPING, MovementAvailabilityChecker.check(ctx, edge()).reason());
        }

        @Test
        @DisplayName("comatose AND asleep → COMA (a coma needs a rescue, sleep only needs time)")
        void comaOutranksSleep() {
            MoveCheckContext ctx = new MoveCheckContext(true, true, true, true, 100, 0, 50);
            assertEquals(Code.COMA, MovementAvailabilityChecker.check(ctx, edge()).reason());
        }

        @Test
        @DisplayName("comatose AND broke → COMA (state outranks the edge's cost)")
        void comaOutranksEnergy() {
            MoveCheckContext ctx = new MoveCheckContext(true, true, true, false, 0, 0, 50);
            assertEquals(Code.COMA, MovementAvailabilityChecker.check(ctx, edge()).reason());
        }
    }

    @Nested
    @DisplayName("the edge")
    class Edge {

        @Test
        @DisplayName("no edge, mover fine → NOT_A_NEIGHBOR (the caller resolves the edge, not us)")
        void nullEdge() {
            assertEquals(Code.NOT_A_NEIGHBOR,
                    MovementAvailabilityChecker.check(ok(), null).reason());
        }

        @Test
        @DisplayName("registry condition unmet → MOVEMENT_CONDITION_NOT_MET")
        void conditionNotMet() {
            MoveEdgeCheck e = new MoveEdgeCheck(false, 10, 0, 0);
            assertEquals(Code.MOVEMENT_CONDITION_NOT_MET,
                    MovementAvailabilityChecker.check(ok(), e).reason());
        }

        @Test
        @DisplayName("carrying more than capacity → OVERWEIGHT")
        void overweight() {
            MoveCheckContext ctx = new MoveCheckContext(true, true, false, false, 100, 51, 50);
            assertEquals(Code.OVERWEIGHT, MovementAvailabilityChecker.check(ctx, edge()).reason());
        }

        @Test
        @DisplayName("energy below the total cost → INSUFFICIENT_ENERGY")
        void insufficientEnergy() {
            MoveCheckContext ctx = new MoveCheckContext(true, true, false, false, 9, 0, 50);
            assertEquals(Code.INSUFFICIENT_ENERGY,
                    MovementAvailabilityChecker.check(ctx, edge()).reason());
        }

        @Test
        @DisplayName("energy exactly the total cost → allowed (the cost is affordable, not forbidden)")
        void energyExactlyEnough() {
            MoveCheckContext ctx = new MoveCheckContext(true, true, false, false, 10, 0, 50);
            assertTrue(MovementAvailabilityChecker.check(ctx, edge()).available());
        }

        @Test
        @DisplayName("destination at capacity → LOCATION_FULL")
        void locationFull() {
            MoveEdgeCheck e = new MoveEdgeCheck(true, 10, 2, 2);
            assertEquals(Code.LOCATION_FULL, MovementAvailabilityChecker.check(ok(), e).reason());
        }

        @Test
        @DisplayName("maxCharacters <= 0 means no capacity limit, however crowded")
        void noCapacityLimit() {
            MoveEdgeCheck e = new MoveEdgeCheck(true, 10, 0, 99);
            assertTrue(MovementAvailabilityChecker.check(ok(), e).available());
        }

        @Test
        @DisplayName("reasonName is the wire code, null when available")
        void reasonName() {
            assertEquals("LOCATION_FULL", MovementAvailabilityChecker
                    .check(ok(), new MoveEdgeCheck(true, 10, 1, 1)).reasonName());
            assertNull(MovementAvailabilityChecker.check(ok(), edge()).reasonName());
        }
    }
}
