package games.paths.core.port.match;

import java.util.ArrayList;
import java.util.List;

import games.paths.core.port.match.EventExecutionPort.EdgeStateOutcome;
import games.paths.core.port.match.EventExecutionStorePort.ResourceDelta;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The two verdict records a REST answer is built from: what "nothing happened" means,
 * and how several passes over the rules become one answer.
 */
@DisplayName("EdgeStateOutcome and ResourceDelta")
class EdgeStateAndResourceDeltaTest {

    private static EdgeStateOutcome outcome(List<String> sadness, List<String> coma,
                                            boolean allDown, String epilogue) {
        return new EdgeStateOutcome(sadness, coma, allDown, epilogue, null,
                new ArrayList<>(), new ArrayList<>());
    }

    @Test
    @DisplayName("ResourceDelta.none() is empty and shared")
    void resourceDeltaNone() {
        assertAll(
                () -> assertFalse(ResourceDelta.none().anything()),
                () -> assertSame(ResourceDelta.none(), ResourceDelta.none()),
                () -> assertEquals(0, ResourceDelta.none().energy()));
    }

    @Test
    @DisplayName("ResourceDelta notices a change in any one of the four")
    void resourceDeltaAnything() {
        assertAll(
                () -> assertTrue(new ResourceDelta(-1, 0, 0, 0).anything()),
                () -> assertTrue(new ResourceDelta(0, 2, 0, 0).anything()),
                () -> assertTrue(new ResourceDelta(0, 0, 3, 0).anything()),
                () -> assertTrue(new ResourceDelta(0, 0, 0, 4).anything()),
                () -> assertFalse(new ResourceDelta(0, 0, 0, 0).anything()));
    }

    @Test
    @DisplayName("EdgeStateOutcome.none() says nothing happened")
    void edgeStateNone() {
        assertFalse(EdgeStateOutcome.none().anything());
    }

    @Test
    @DisplayName("Any of the three halves makes the verdict worth showing")
    void edgeStateAnything() {
        assertAll(
                () -> assertTrue(outcome(List.of("c1"), List.of(), false, null).anything()),
                () -> assertTrue(outcome(List.of(), List.of("c1"), false, null).anything()),
                () -> assertTrue(outcome(List.of(), List.of(), true, null).anything()));
    }

    @Test
    @DisplayName("Merging nothing, or only nulls, gives the empty verdict")
    void mergeNothing() {
        assertAll(
                () -> assertFalse(EdgeStateOutcome.merge(null).anything()),
                () -> assertFalse(EdgeStateOutcome.merge(List.of()).anything()),
                () -> assertFalse(EdgeStateOutcome.merge(java.util.Collections.singletonList(null)).anything()),
                () -> assertFalse(EdgeStateOutcome.merge(List.of(EdgeStateOutcome.none())).anything()));
    }

    @Test
    @DisplayName("A character caught twice is still one collapse")
    void mergeUnionsTheUuids() {
        EdgeStateOutcome merged = EdgeStateOutcome.merge(List.of(
                outcome(List.of("c1"), List.of("c2"), false, null),
                outcome(List.of("c1", "c3"), List.of("c2"), false, null)));

        assertAll(
                () -> assertEquals(List.of("c1", "c3"), merged.sadnessOverflowUuids()),
                () -> assertEquals(List.of("c2"), merged.comaUuids()),
                () -> assertFalse(merged.allPlayersInComa()));
    }

    @Test
    @DisplayName("One pass seeing the party down settles it for the whole request")
    void mergeLatchesAllPlayersInComa() {
        EdgeStateOutcome merged = EdgeStateOutcome.merge(List.of(
                outcome(List.of(), List.of("c1"), false, null),
                outcome(List.of(), List.of("c1"), true, null)));

        assertTrue(merged.allPlayersInComa());
    }

    @Test
    @DisplayName("The FIRST epilogue wins; a later one is ignored")
    void mergeKeepsTheFirstEpilogue() {
        EdgeStateOutcome merged = EdgeStateOutcome.merge(List.of(
                outcome(List.of(), List.of("c1"), true, "evt-first"),
                outcome(List.of(), List.of("c2"), true, "evt-second")));

        assertAll(
                () -> assertEquals("evt-first", merged.comaEventUuid()),
                () -> assertNull(merged.comaEventCard()));
    }
}
