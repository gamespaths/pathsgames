package games.paths.core.service.match;

import games.paths.core.port.match.WeatherStorePort;
import games.paths.core.port.match.WeatherStorePort.CurrentWeatherView;
import games.paths.core.port.match.WeatherStorePort.WeatherCharacter;
import games.paths.core.port.match.WeatherStorePort.WeatherLogView;
import games.paths.core.port.match.WeatherStorePort.WeatherMatchContext;
import games.paths.core.port.match.WeatherStorePort.WeatherRuleView;
import games.paths.core.service.match.WeatherSelectionService.WeatherSelection;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@DisplayName("WeatherSelectionService")
class WeatherSelectionServiceTest {

    private static WeatherRuleView rule(long id, int probability, int priority,
                                        Integer from, Integer to,
                                        String condKey, String condVal,
                                        Integer deltaEnergy, Integer idEvent) {
        return new WeatherRuleView(id, "w-" + id, probability, priority, from, to,
                condKey, condVal, null, deltaEnergy, idEvent, 1, 2, 100 + (int) id);
    }

    // ── pure helpers ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("timeMatches")
    class TimeMatches {
        @Test
        @DisplayName("open bounds always match")
        void openBounds() {
            assertTrue(WeatherSelectionService.timeMatches(
                    rule(1, 1, 0, null, null, null, null, 0, null), 5));
        }

        @Test
        @DisplayName("clock below time_from does not match")
        void belowFrom() {
            assertFalse(WeatherSelectionService.timeMatches(
                    rule(1, 1, 0, 3, 9, null, null, 0, null), 2));
        }

        @Test
        @DisplayName("clock above time_to does not match")
        void aboveTo() {
            assertFalse(WeatherSelectionService.timeMatches(
                    rule(1, 1, 0, 3, 9, null, null, 0, null), 10));
        }

        @Test
        @DisplayName("clock inside the inclusive range matches")
        void inside() {
            assertTrue(WeatherSelectionService.timeMatches(
                    rule(1, 1, 0, 3, 9, null, null, 0, null), 9));
        }
    }

    @Nested
    @DisplayName("weightedPick")
    class WeightedPick {
        @Test
        @DisplayName("falls back to highest-priority rule when all weights are zero")
        void zeroWeights() {
            WeatherRuleView a = rule(1, 0, 1, null, null, null, null, 0, null);
            WeatherRuleView b = rule(2, 0, 5, null, null, null, null, 0, null);
            WeatherRuleView picked = WeatherSelectionService.weightedPick(List.of(a, b), 42L);
            assertEquals(2L, picked.id()); // priority 5 wins
        }

        @Test
        @DisplayName("is deterministic for a fixed seed")
        void deterministic() {
            WeatherRuleView a = rule(1, 50, 0, null, null, null, null, 0, null);
            WeatherRuleView b = rule(2, 50, 0, null, null, null, null, 0, null);
            WeatherRuleView first = WeatherSelectionService.weightedPick(List.of(a, b), 42L);
            WeatherRuleView second = WeatherSelectionService.weightedPick(List.of(a, b), 42L);
            assertEquals(first.id(), second.id());
        }

        @Test
        @DisplayName("a dominating weight is always selected")
        void dominating() {
            WeatherRuleView a = rule(1, 1, 0, null, null, null, null, 0, null);
            WeatherRuleView b = rule(2, 999, 0, null, null, null, null, 0, null);
            for (long seed = 0; seed < 20; seed++) {
                assertEquals(2L, WeatherSelectionService.weightedPick(List.of(a, b), seed).id());
            }
        }
    }

    // ── applyAtTimeStart ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("applyAtTimeStart")
    class Apply {

        @Test
        @DisplayName("empty context returns a 'none' selection and writes nothing")
        void emptyContext() {
            WeatherStorePort store = mock(WeatherStorePort.class);
            RegistryService registryService = mock(RegistryService.class);
            when(store.loadContext(1L)).thenReturn(Optional.empty());

            WeatherSelection sel = new WeatherSelectionService(store, registryService).applyAtTimeStart(1L);

            assertFalse(sel.selected());
            verify(store, never()).setCurrentWeather(anyLong(), any());
            verify(store, never()).insertLogWeather(anyLong(), anyInt(), any());
        }

        @Test
        @DisplayName("no eligible rule clears the current weather")
        void noEligibleClears() {
            WeatherStorePort store = mock(WeatherStorePort.class);
            RegistryService registryService = mock(RegistryService.class);
            when(store.loadContext(1L)).thenReturn(Optional.of(new WeatherMatchContext(7L, 5, 42L)));
            // rule only valid for clock 0..2, current clock is 5 → not eligible
            when(store.findActiveWeatherRules(7L)).thenReturn(List.of(
                    rule(1, 100, 0, 0, 2, null, null, -3, null)));

            WeatherSelection sel = new WeatherSelectionService(store, registryService).applyAtTimeStart(1L);

            assertFalse(sel.selected());
            verify(store).setCurrentWeather(1L, null);
            verify(store, never()).insertLogWeather(anyLong(), anyInt(), any());
        }

        @Test
        @DisplayName("selects a weather, logs it and applies the clamped energy delta")
        void selectsAndAppliesDelta() {
            WeatherStorePort store = mock(WeatherStorePort.class);
            RegistryService registryService = mock(RegistryService.class);
            when(store.loadContext(1L)).thenReturn(Optional.of(new WeatherMatchContext(7L, 0, 42L)));
            when(store.findActiveWeatherRules(7L)).thenReturn(List.of(
                    rule(9, 100, 0, null, null, null, null, -5, null)));
            when(store.findCharacters(1L)).thenReturn(List.of(
                    new WeatherCharacter(100L, 3, 50),    // 3-5 → clamp to 0 (applied -3)
                    new WeatherCharacter(101L, 20, 50))); // 20-5 = 15 (applied -5)

            WeatherSelection sel = new WeatherSelectionService(store, registryService).applyAtTimeStart(1L);

            assertTrue(sel.selected());
            assertEquals(9L, sel.idWeather());
            assertEquals(-5, sel.deltaEnergy());
            verify(store).setCurrentWeather(1L, 9L);
            verify(store).insertLogWeather(1L, 0, 9L);
            verify(store).updateCharacterEnergy(1L, 100L, 0);
            verify(store).updateCharacterEnergy(1L, 101L, 15);
        }

        @Test
        @DisplayName("zero delta applies no energy change but still logs the weather")
        void zeroDelta() {
            WeatherStorePort store = mock(WeatherStorePort.class);
            RegistryService registryService = mock(RegistryService.class);
            when(store.loadContext(1L)).thenReturn(Optional.of(new WeatherMatchContext(7L, 0, 42L)));
            when(store.findActiveWeatherRules(7L)).thenReturn(List.of(
                    rule(9, 100, 0, null, null, null, null, 0, null)));

            WeatherSelection sel = new WeatherSelectionService(store, registryService).applyAtTimeStart(1L);

            assertTrue(sel.selected());
            verify(store, never()).findCharacters(anyLong());
            verify(store, never()).updateCharacterEnergy(anyLong(), anyLong(), anyInt());
            verify(store).insertLogWeather(1L, 0, 9L);
        }

        @Test
        @DisplayName("registry condition filters out non-matching rules")
        void conditionFilters() {
            WeatherStorePort store = mock(WeatherStorePort.class);
            RegistryService registryService = mock(RegistryService.class);
            when(store.loadContext(1L)).thenReturn(Optional.of(new WeatherMatchContext(7L, 0, 42L)));
            when(store.findActiveWeatherRules(7L)).thenReturn(List.of(
                    rule(1, 100, 0, null, null, "SEASON", "WINTER", 0, null),
                    rule(2, 100, 0, null, null, "SEASON", "SUMMER", 0, null)));
            when(registryService.find(1L, "SEASON")).thenReturn(List.of("SUMMER"));

            WeatherSelection sel = new WeatherSelectionService(store, registryService).applyAtTimeStart(1L);

            assertEquals(2L, sel.idWeather());
        }

        @Test
        @DisplayName("Step 36: a condition key with no value no longer matches an unset key")
        void nullExpectedValueIsNeverMet() {
            WeatherStorePort store = mock(WeatherStorePort.class);
            RegistryService registryService = mock(RegistryService.class);
            when(store.loadContext(1L)).thenReturn(Optional.of(new WeatherMatchContext(7L, 0, 42L)));
            when(store.findActiveWeatherRules(7L)).thenReturn(List.of(
                    rule(1, 100, 0, null, null, "SEASON", null, 0, null),
                    rule(2, 100, 0, null, null, null, null, 0, null)));
            when(registryService.find(1L, "SEASON")).thenReturn(List.of());

            WeatherSelection sel = new WeatherSelectionService(store, registryService)
                    .applyAtTimeStart(1L);

            // Before Step 36 rule 1 would have won: a null expected value read as "must be unset".
            assertEquals(2L, sel.idWeather());
        }

        @Test
        @DisplayName("a weather-linked event is recorded as pending")
        void logsEvent() {
            WeatherStorePort store = mock(WeatherStorePort.class);
            RegistryService registryService = mock(RegistryService.class);
            when(store.loadContext(1L)).thenReturn(Optional.of(new WeatherMatchContext(7L, 0, 42L)));
            when(store.findActiveWeatherRules(7L)).thenReturn(List.of(
                    rule(9, 100, 0, null, null, null, null, 0, 55)));

            new WeatherSelectionService(store, registryService).applyAtTimeStart(1L);

            verify(store).logWeatherEvent(eq(1L), eq(55), anyString());
        }

        @Test
        @DisplayName("a null rng seed falls back to the story id and still selects")
        void nullSeedFallback() {
            WeatherStorePort store = mock(WeatherStorePort.class);
            RegistryService registryService = mock(RegistryService.class);
            when(store.loadContext(1L)).thenReturn(Optional.of(new WeatherMatchContext(7L, 0, null)));
            when(store.findActiveWeatherRules(7L)).thenReturn(List.of(
                    rule(9, 100, 0, null, null, null, null, 0, null)));

            WeatherSelection sel = new WeatherSelectionService(store, registryService).applyAtTimeStart(1L);
            assertTrue(sel.selected());
        }
    }

    // ── query delegates ───────────────────────────────────────────────────────

    @Test
    @DisplayName("currentWeather delegates to the store by uuid")
    void currentWeatherDelegates() {
        WeatherStorePort store = mock(WeatherStorePort.class);
        RegistryService registryService = mock(RegistryService.class);
        CurrentWeatherView view = new CurrentWeatherView(9L, "w-9", 7L, 55, 109, -5, 1, 2, 0);
        when(store.findCurrentWeatherByMatchUuid("m-1")).thenReturn(Optional.of(view));

        Optional<CurrentWeatherView> got = new WeatherSelectionService(store, registryService).currentWeather("m-1");
        assertTrue(got.isPresent());
        assertEquals(9L, got.get().idWeather());
        assertEquals(55, got.get().idCard());
    }

    @Test
    @DisplayName("weatherAdmin aggregates seed, current weather, rules and log")
    void weatherAdminAggregates() {
        WeatherStorePort store = mock(WeatherStorePort.class);
        RegistryService registryService = mock(RegistryService.class);
        when(store.findRngSeed("m-1")).thenReturn(Optional.of(42L));
        CurrentWeatherView view = new CurrentWeatherView(9L, "w-9", 7L, 55, 109, -5, 1, 2, 3);
        when(store.findCurrentWeatherByMatchUuid("m-1")).thenReturn(Optional.of(view));
        when(store.findWeatherRulesForMatch("m-1")).thenReturn(List.of(
                // v0.36.2 — the storm is gated on a key the registry does not hold; the
                // admin view must say so instead of silently listing it as available.
                new WeatherStorePort.WeatherRuleSummary(9L, "w-9", 109, "Storm", 30, -5, 1, 3,
                        true, true, "gate", "OPEN", "=", false),
                new WeatherStorePort.WeatherRuleSummary(8L, "w-8", 108, "Clear", 70, 0, 0, 1,
                        true, false, null, null, null, false)));
        when(store.findWeatherLog("m-1")).thenReturn(List.of(
                new WeatherLogView(1L, "l-1", 0, 9L, "w-9", 109, "2026-06-24T00:00:00Z")));

        var admin = new WeatherSelectionService(store, registryService).weatherAdmin("m-1");
        assertEquals(42L, admin.rngSeed());
        assertEquals(9L, admin.current().idWeather());
        assertEquals(2, admin.rules().size());
        assertTrue(admin.rules().get(0).current());
        // The gated rule is refused (the registry holds nothing); the unconditional one passes.
        assertFalse(admin.rules().get(0).registryMet());
        assertTrue(admin.rules().get(1).registryMet());
        assertEquals(1, admin.log().size());
    }
}
