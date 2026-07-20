package games.paths.core.service.match;

import games.paths.core.port.match.EdgeStateStorePort;
import games.paths.core.port.match.RecoveryStorePort;
import games.paths.core.port.match.RecoveryStorePort.ClassBonusView;
import games.paths.core.port.match.RecoveryStorePort.LocationSafety;
import games.paths.core.port.match.RecoveryStorePort.RecoveryCharacter;
import games.paths.core.port.match.RecoveryStorePort.RecoveryMatchContext;
import games.paths.core.port.match.RecoveryStorePort.StateLocationView;
import games.paths.core.service.match.TimeStartRecoveryService.RecoveryRecap;
import games.paths.core.service.match.TimeStartRecoveryService.StatTriple;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.*;

@DisplayName("TimeStartRecoveryService")
class TimeStartRecoveryServiceTest {

    // ── pure recovery math ──────────────────────────────────────────────────

    @Nested
    @DisplayName("computeRecovery")
    class Compute {

        @Test
        @DisplayName("safe location recovers energy, life and reduces sadness")
        void safe() {
            // dex=3 int=2 cos=4, current e=10 l=20 s=8, caps 100/100/100
            // secureParam=3, difficultyEnergy=2, p=5
            // energy += DEX+P=18; life += COS+secureParam=27; sad -= INT+secureParam=3
            StatTriple r = TimeStartRecoveryService.computeRecovery(
                    3, 2, 4, 10, 20, 8, 100, 100, 100, true, 5, 2, 0, 0, 0);
            assertEquals(10 + 3 + 5, r.energy()); // 18
            assertEquals(20 + 4 + 3, r.life());   // 27 (COS + secureParam, not P)
            assertEquals(8 - (2 + 3), r.sad());   // 3  (INT + secureParam, not P)
        }

        @Test
        @DisplayName("unsafe location recovers energy by difficulty.energy only (no DEX, no secure_param)")
        void unsafe() {
            // safe=false; energy += difficultyEnergy only (5); life and sad unchanged
            StatTriple r = TimeStartRecoveryService.computeRecovery(
                    3, 2, 4, 10, 20, 8, 100, 100, 100, false, 0, 5, 0, 0, 0);
            assertEquals(10 + 5, r.energy()); // 15
            assertEquals(20, r.life());        // unchanged
            assertEquals(8, r.sad());          // unchanged
        }

        @Test
        @DisplayName("clamps to the maximum caps and floors at zero")
        void clamps() {
            // huge recovery clamps energy/life to max; sadness floored at 0
            StatTriple r = TimeStartRecoveryService.computeRecovery(
                    50, 50, 50, 90, 90, 3, 100, 100, 100, true, 10, 10, 0, 0, 0);
            assertEquals(100, r.energy());
            assertEquals(100, r.life());
            assertEquals(0, r.sad()); // 3 - (50 + 10) floored at 0
        }

        @Test
        @DisplayName("class bonuses are added on top before clamping")
        void classBonus() {
            StatTriple r = TimeStartRecoveryService.computeRecovery(
                    1, 1, 1, 10, 10, 20, 100, 100, 100, true, 0, 0, 5, 7, -2);
            assertEquals(10 + 1 + 5, r.energy()); // 16
            assertEquals(10 + 1 + 7, r.life());   // 18
            assertEquals(20 - 1 - 2, r.sad());    // 17
        }
    }

    @Test
    @DisplayName("clamp returns min when max < min")
    void clampInverted() {
        assertEquals(0, TimeStartRecoveryService.clamp(5, 0, -1));
    }

    // ── Step 30 edge states during recovery ─────────────────────────────────

    @Nested
    @DisplayName("Edge states (Step 30)")
    class EdgeStates {

        private RecoveryStorePort store;
        private EdgeStateStorePort edgeStore;

        private List<RecoveryRecap> run(RecoveryCharacter c) {
            store = mock(RecoveryStorePort.class);
            edgeStore = mock(EdgeStateStorePort.class);
            when(store.loadContext(1L)).thenReturn(Optional.of(new RecoveryMatchContext(9L, 0, 4)));
            when(store.findCharacters(1L)).thenReturn(List.of(c));
            when(store.findLocationSafety(9L)).thenReturn(List.of(new LocationSafety(100L, 0, null, null)));
            when(store.findClassBonuses(9L)).thenReturn(List.of(new ClassBonusView(5L, "sad", 60)));
            when(store.findStateLocations(1L)).thenReturn(List.of());
            return new TimeStartRecoveryService(store, edgeStore).applyAtTimeStart(1L);
        }

        /** cos 10, sad 0/50, at an UNSAFE location so nothing heals. */
        private RecoveryCharacter frail(int life, boolean coma) {
            return new RecoveryCharacter(10L, "char-a", 5L, 100L,
                    3, 2, 10, 10, life, 0, 100, 100, 50, coma);
        }

        /** Run the roster at a SAFE location (secure_param=2) — recovery heals life. */
        private void runSafe(RecoveryCharacter... roster) {
            store = mock(RecoveryStorePort.class);
            edgeStore = mock(EdgeStateStorePort.class);
            when(store.loadContext(1L)).thenReturn(Optional.of(new RecoveryMatchContext(9L, 0, 4)));
            when(store.findCharacters(1L)).thenReturn(List.of(roster));
            when(store.findLocationSafety(9L)).thenReturn(List.of(new LocationSafety(100L, 2, null, null)));
            when(store.findClassBonuses(9L)).thenReturn(List.of());
            when(store.findStateLocations(1L)).thenReturn(List.of());
            new TimeStartRecoveryService(store, edgeStore).applyAtTimeStart(1L);
        }

        @Test
        @DisplayName("v0.30.1 — a comatose character resting in a safe location wakes")
        void safeSleepWakesFromComa() {
            // life 0, coma; safe recovery lifts life to 0 + cos(10) + secure(2) = 12.
            runSafe(frail(0, true));

            verify(edgeStore).clearComa(1L, 10L);
            verify(edgeStore).logEdgeState(eq(1L), eq(10L), eq(null), eq(4),
                    startsWith(EdgeStateStorePort.MSG_COMA_RECOVERED));
            // It woke, so the party is not all-in-coma and no collapse row is written.
            verify(edgeStore, never()).logEdgeState(anyLong(), any(), any(), anyInt(),
                    contains(EdgeStateStorePort.MSG_ALL_PLAYER_COMA));
        }

        @Test
        @DisplayName("v0.30.1 — waking is independent of the others still down")
        void oneWakesWhileAnotherStays() {
            RecoveryCharacter waker = frail(0, true);          // in the safe location 100
            RecoveryCharacter elsewhere = new RecoveryCharacter( // still comatose, no location
                    20L, "char-b", 5L, null, 3, 2, 10, 10, 0, 0, 100, 100, 50, true);
            runSafe(waker, elsewhere);

            verify(edgeStore).clearComa(1L, 10L);
            verify(edgeStore, never()).clearComa(1L, 20L);
            // One is up, so the party is NOT all-in-coma.
            verify(edgeStore, never()).logEdgeState(anyLong(), any(), any(), anyInt(),
                    contains(EdgeStateStorePort.MSG_ALL_PLAYER_COMA));
        }

        @Test
        @DisplayName("v0.30.1 — an unsafe location never wakes a comatose character")
        void unsafeSleepDoesNotWake() {
            run(frail(0, true));  // run() uses an UNSAFE location

            verify(edgeStore, never()).clearComa(anyLong(), anyLong());
        }

        @Test
        @DisplayName("A positive class sad bonus can overflow during what is nominally healing")
        void classBonusOverflowsSadness() {
            run(frail(30, false));

            // sad 0 + bonus 60 = 60 >= cap 50 → discharge: sad 0, life 30 - cos(10) = 20.
            verify(store).updateCharacterStats(1L, 10L, 10, 20, 0);
            verify(edgeStore).setSleeping(1L, 10L);
            verify(edgeStore).logEdgeState(eq(1L), eq(10L), eq(null), eq(4),
                    contains(EdgeStateStorePort.MSG_SADNESS_OVERFLOW));
        }

        @Test
        @DisplayName("An overflow that empties the life bar comas and stamps clock_in_coma")
        void overflowCascadesIntoComa() {
            run(frail(8, false));

            verify(edgeStore).setComa(1L, 10L, 4);
            verify(edgeStore).logEdgeState(eq(1L), eq(10L), eq(null), eq(4),
                    startsWith(EdgeStateStorePort.MSG_COMA));
            // Single player: that one coma is the whole party.
            verify(edgeStore).logEdgeState(eq(1L), eq(null), eq(null), eq(4),
                    contains(EdgeStateStorePort.MSG_ALL_PLAYER_COMA));
        }

        @Test
        @DisplayName("A character already in coma is not re-stamped every time-start")
        void alreadyComaIsNotRestamped() {
            run(frail(0, true));

            verify(edgeStore, never()).setComa(anyLong(), anyLong(), anyInt());
            verify(edgeStore, never()).logEdgeState(anyLong(), any(), any(), anyInt(),
                    startsWith(EdgeStateStorePort.MSG_COMA));
            // Still counted as down, so the party row is written.
            verify(edgeStore).logEdgeState(eq(1L), eq(null), eq(null), eq(4),
                    contains(EdgeStateStorePort.MSG_ALL_PLAYER_COMA));
        }

        @Test
        @DisplayName("A healthy recovery touches the edge store not at all")
        void healthyRecoveryIsQuiet() {
            store = mock(RecoveryStorePort.class);
            edgeStore = mock(EdgeStateStorePort.class);
            when(store.loadContext(1L)).thenReturn(Optional.of(new RecoveryMatchContext(9L, 0, 4)));
            when(store.findCharacters(1L)).thenReturn(List.of(frail(30, false)));
            when(store.findLocationSafety(9L)).thenReturn(List.of(new LocationSafety(100L, 0, null, null)));
            when(store.findClassBonuses(9L)).thenReturn(List.of());
            when(store.findStateLocations(1L)).thenReturn(List.of());

            new TimeStartRecoveryService(store, edgeStore).applyAtTimeStart(1L);

            verifyNoInteractions(edgeStore);
        }
    }

    // ── full time-start flow ────────────────────────────────────────────────

    @Nested
    @DisplayName("applyAtTimeStart")
    class Flow {

        @Test
        @DisplayName("seeds a missing state-location row, recovers stats and decrements counters")
        void fullFlow() {
            RecoveryStorePort store = mock(RecoveryStorePort.class);
            long idMatch = 1L;
            long idStory = 9L;
            long idLocation = 100L;

            when(store.loadContext(idMatch)).thenReturn(Optional.of(new RecoveryMatchContext(idStory, 2, 0)));
            when(store.findCharacters(idMatch)).thenReturn(List.of(new RecoveryCharacter(
                    10L, "char-a", 5L, idLocation,
                    3, 2, 4, 10, 20, 8, 100, 100, 100, false)));
            when(store.findLocationSafety(idStory)).thenReturn(List.of(
                    new LocationSafety(idLocation, 1, 3, 777))); // secure_param=1 -> safe, counterTime=3
            when(store.findClassBonuses(idStory)).thenReturn(List.of(
                    new ClassBonusView(5L, "energy", 1)));
            // No existing state-location row → must be seeded (1b path).
            when(store.findStateLocations(idMatch)).thenReturn(List.of());

            List<RecoveryRecap> recaps = service(store).applyAtTimeStart(idMatch);

            // p = secure_param(1) + difficultyEnergy(2) = 3 ; secureParam=1 ; safe.
            // energy = 10 + dex(3) + p(3) + bonus(1)        = 17 -> delta +7
            // life   = 20 + cos(4) + secureParam(1)         = 25 -> delta +5
            // sad    = 8 - (int(2) + secureParam(1))        = 5  -> delta -3
            verify(store).insertStateLocation(idMatch, idLocation, 3);
            verify(store).updateCharacterStats(idMatch, 10L, 17, 25, 5);
            // counter decremented from 3 -> 2
            verify(store).updateStateLocationCounter(idMatch, idLocation, 2);
            verify(store, never()).logCounterZero(anyLong(), anyLong(), any(), anyString());
            assertEquals(1, recaps.size());
            assertEquals(7, recaps.get(0).energyDelta());
            assertEquals(5, recaps.get(0).lifeDelta());
            assertEquals(-3, recaps.get(0).sadDelta());
        }

        @Test
        @DisplayName("logs a pending event when a counter reaches zero")
        void counterZero() {
            RecoveryStorePort store = mock(RecoveryStorePort.class);
            long idMatch = 1L;
            long idStory = 9L;
            long idLocation = 100L;
            when(store.loadContext(idMatch)).thenReturn(Optional.of(new RecoveryMatchContext(idStory, 0, 0)));
            when(store.findCharacters(idMatch)).thenReturn(List.of(new RecoveryCharacter(
                    10L, "char-a", null, idLocation,
                    1, 1, 1, 10, 10, 10, 100, 100, 100, false)));
            when(store.findLocationSafety(idStory)).thenReturn(List.of(
                    new LocationSafety(idLocation, 0, 1, 777))); // unsafe, counter already at 1
            when(store.findClassBonuses(idStory)).thenReturn(List.of());
            when(store.findStateLocations(idMatch)).thenReturn(List.of(
                    new StateLocationView(idLocation, 1, 0)));

            service(store).applyAtTimeStart(idMatch);

            verify(store).updateStateLocationCounter(idMatch, idLocation, 0);
            verify(store).logCounterZero(eq(idMatch), eq(idLocation), eq(777), anyString());
            verify(store).markStateLocationActivated(idMatch, idLocation);
        }

        @Test
        @DisplayName("re-seeds an occupied location whose counter was pre-seeded with 0 but definition now has counterTime > 0")
        void reseedsZeroCounterForOccupiedLocation() {
            RecoveryStorePort store = mock(RecoveryStorePort.class);
            long idMatch = 1L;
            long idStory = 9L;
            long idLocation = 100L;
            when(store.loadContext(idMatch)).thenReturn(Optional.of(new RecoveryMatchContext(idStory, 0, 0)));
            when(store.findCharacters(idMatch)).thenReturn(List.of(new RecoveryCharacter(
                    10L, "char-a", null, idLocation,
                    1, 1, 1, 10, 10, 10, 100, 100, 100, false)));
            when(store.findLocationSafety(idStory)).thenReturn(List.of(
                    new LocationSafety(idLocation, 0, 5, null))); // counterTime=5
            when(store.findClassBonuses(idStory)).thenReturn(List.of());
            // Row exists with clockCounter=0 and flagAlreadyActived=0 (pre-seeded before counter was added)
            when(store.findStateLocations(idMatch)).thenReturn(List.of(
                    new StateLocationView(idLocation, 0, 0)));

            service(store).applyAtTimeStart(idMatch);

            // Must re-seed to counterTime=5, then immediately decrement to 4
            verify(store).updateStateLocationCounter(idMatch, idLocation, 5);
            verify(store).updateStateLocationCounter(idMatch, idLocation, 4);
            verify(store, never()).markStateLocationActivated(anyLong(), anyLong());
        }

        @Test
        @DisplayName("does not re-seed an occupied location whose counter legitimately reached 0 (flagAlreadyActived=1)")
        void noReseedWhenAlreadyActivated() {
            RecoveryStorePort store = mock(RecoveryStorePort.class);
            long idMatch = 1L;
            long idStory = 9L;
            long idLocation = 100L;
            when(store.loadContext(idMatch)).thenReturn(Optional.of(new RecoveryMatchContext(idStory, 0, 0)));
            when(store.findCharacters(idMatch)).thenReturn(List.of(new RecoveryCharacter(
                    10L, "char-a", null, idLocation,
                    1, 1, 1, 10, 10, 10, 100, 100, 100, false)));
            when(store.findLocationSafety(idStory)).thenReturn(List.of(
                    new LocationSafety(idLocation, 0, 5, null)));
            when(store.findClassBonuses(idStory)).thenReturn(List.of());
            // Row has clockCounter=0 but flagAlreadyActived=1 (counter already fired)
            when(store.findStateLocations(idMatch)).thenReturn(List.of(
                    new StateLocationView(idLocation, 0, 1)));

            service(store).applyAtTimeStart(idMatch);

            // Must NOT update the counter (already activated)
            verify(store, never()).updateStateLocationCounter(anyLong(), anyLong(), anyInt());
            verify(store, never()).markStateLocationActivated(anyLong(), anyLong());
        }

        @Test
        @DisplayName("returns empty when the match has no story context")
        void noContext() {
            RecoveryStorePort store = mock(RecoveryStorePort.class);
            when(store.loadContext(1L)).thenReturn(Optional.empty());
            assertTrue(service(store).applyAtTimeStart(1L).isEmpty());
        }
    }

    private static TimeStartRecoveryService service(RecoveryStorePort store) {
        return new TimeStartRecoveryService(store, mock(EdgeStateStorePort.class));
    }
}
