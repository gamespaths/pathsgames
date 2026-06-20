package games.paths.core.service.match;

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
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
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

            when(store.loadContext(idMatch)).thenReturn(Optional.of(new RecoveryMatchContext(idStory, 2)));
            when(store.findCharacters(idMatch)).thenReturn(List.of(new RecoveryCharacter(
                    10L, "char-a", 5L, idLocation,
                    3, 2, 4, 10, 20, 8, 100, 100, 100)));
            when(store.findLocationSafety(idStory)).thenReturn(List.of(
                    new LocationSafety(idLocation, 1, 3, 777))); // secure_param=1 -> safe, counterTime=3
            when(store.findClassBonuses(idStory)).thenReturn(List.of(
                    new ClassBonusView(5L, "energy", 1)));
            // No existing state-location row -> must be seeded.
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
            when(store.loadContext(idMatch)).thenReturn(Optional.of(new RecoveryMatchContext(idStory, 0)));
            when(store.findCharacters(idMatch)).thenReturn(List.of(new RecoveryCharacter(
                    10L, "char-a", null, idLocation,
                    1, 1, 1, 10, 10, 10, 100, 100, 100)));
            when(store.findLocationSafety(idStory)).thenReturn(List.of(
                    new LocationSafety(idLocation, 0, 1, 777))); // unsafe, counter already at 1
            when(store.findClassBonuses(idStory)).thenReturn(List.of());
            when(store.findStateLocations(idMatch)).thenReturn(List.of(
                    new StateLocationView(idLocation, 1)));

            service(store).applyAtTimeStart(idMatch);

            verify(store).updateStateLocationCounter(idMatch, idLocation, 0);
            verify(store).logCounterZero(eq(idMatch), eq(idLocation), eq(777), anyString());
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
        return new TimeStartRecoveryService(store);
    }
}
