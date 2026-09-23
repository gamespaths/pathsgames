package games.paths.core.service.match;

import games.paths.core.port.match.RandomEventStorePort;
import games.paths.core.port.match.RandomEventStorePort.RandomEventMatchContext;
import games.paths.core.port.match.RandomEventStorePort.RandomEventRuleView;
import games.paths.core.service.match.RandomEventSelectionService.RandomEventPick;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.Random;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@DisplayName("RandomEventSelectionService (Step 39)")
class RandomEventSelectionServiceTest {

    private static final long MATCH = 1L;
    private static final long STORY = 7L;

    private RandomEventStorePort store;
    private RegistryService registry;
    private RandomEventSelectionService service;

    private static RandomEventRuleView row(long id, int probability, Integer idEvent) {
        return new RandomEventRuleView(id, idEvent, probability, null, null, null, true, "AUTOMATIC", false);
    }

    private static RandomEventRuleView cond(long id, int probability, String key, String value, String op) {
        return new RandomEventRuleView(id, 50 + (int) id, probability, key, value, op, true, "AUTOMATIC", false);
    }

    private static RandomEventMatchContext running(int clock, Long seed) {
        return new RandomEventMatchContext(STORY, clock, seed, "RUNNING");
    }

    @BeforeEach
    void setUp() {
        store = mock(RandomEventStorePort.class);
        registry = mock(RegistryService.class);
        service = new RandomEventSelectionService(store, registry);
        when(store.findConsumedEventIds(MATCH)).thenReturn(Set.of());
    }

    @Nested
    @DisplayName("pickAtTimeStart guards")
    class Guards {
        @Test
        @DisplayName("unknown match picks nothing")
        void noContext() {
            when(store.loadContext(MATCH)).thenReturn(Optional.empty());
            assertTrue(service.pickAtTimeStart(MATCH).isEmpty());
        }

        @Test
        @DisplayName("a match that is not RUNNING picks nothing")
        void notRunning() {
            when(store.loadContext(MATCH)).thenReturn(Optional.of(
                    new RandomEventMatchContext(STORY, 3, 42L, "ENDED")));
            assertTrue(service.pickAtTimeStart(MATCH).isEmpty());
            verify(store, never()).findRandomEvents(anyLong());
        }

        @Test
        @DisplayName("clock 0 (match start) never fires")
        void clockZero() {
            when(store.loadContext(MATCH)).thenReturn(Optional.of(running(0, 42L)));
            assertTrue(service.pickAtTimeStart(MATCH).isEmpty());
        }

        @Test
        @DisplayName("a story without rows picks nothing")
        void noRows() {
            when(store.loadContext(MATCH)).thenReturn(Optional.of(running(2, 42L)));
            when(store.findRandomEvents(STORY)).thenReturn(List.of());
            assertTrue(service.pickAtTimeStart(MATCH).isEmpty());
            when(store.findRandomEvents(STORY)).thenReturn(null);
            assertTrue(service.pickAtTimeStart(MATCH).isEmpty());
        }
    }

    @Nested
    @DisplayName("pickAtTimeStart eligibility")
    class Eligibility {
        @BeforeEach
        void context() {
            when(store.loadContext(MATCH)).thenReturn(Optional.of(running(2, 42L)));
        }

        @Test
        @DisplayName("a row at 100 always fires")
        void hundredFires() {
            when(store.findRandomEvents(STORY)).thenReturn(List.of(row(1, 100, 11), row(2, 0, 12)));
            Optional<RandomEventPick> p = service.pickAtTimeStart(MATCH);
            assertTrue(p.isPresent());
            assertEquals(1L, p.get().idRandomEvent());
            assertEquals(11L, p.get().idEvent());
        }

        @Test
        @DisplayName("a row at 0 never fires")
        void zeroNeverFires() {
            when(store.findRandomEvents(STORY)).thenReturn(List.of(row(2, 0, 12)));
            assertTrue(service.pickAtTimeStart(MATCH).isEmpty());
        }

        @Test
        @DisplayName("a spent ONCE event is out, a spent NORMAL one stays in")
        void onceSpent() {
            RandomEventRuleView once = new RandomEventRuleView(1, 11, 100, null, null, null, true, "ONCE", false);
            RandomEventRuleView normal = new RandomEventRuleView(2, 12, 100, null, null, null, true, "NORMAL", false);
            when(store.findConsumedEventIds(MATCH)).thenReturn(Set.of(11L, 12L));
            when(store.findRandomEvents(STORY)).thenReturn(List.of(once, normal));
            assertEquals(12L, service.pickAtTimeStart(MATCH).orElseThrow().idEvent());
        }

        @Test
        @DisplayName("an event owning choices, a dangling event and a missing idEvent are out")
        void unrunnable() {
            when(store.findRandomEvents(STORY)).thenReturn(List.of(
                    new RandomEventRuleView(1, 11, 100, null, null, null, true, "AUTOMATIC", true),
                    new RandomEventRuleView(2, 12, 100, null, null, null, false, null, false),
                    new RandomEventRuleView(3, null, 100, null, null, null, false, null, false),
                    new RandomEventRuleView(4, 0, 100, null, null, null, false, null, false)));
            assertTrue(service.pickAtTimeStart(MATCH).isEmpty());
        }

        @Test
        @DisplayName("the registry condition filters with its operator")
        void conditionOperator() {
            when(store.findRandomEvents(STORY)).thenReturn(List.of(
                    cond(1, 100, "storm", "yes", "!="),
                    cond(2, 100, "storm", "yes", null)));
            when(registry.find(MATCH, "storm")).thenReturn(List.of("yes"));
            assertEquals(2L, service.pickAtTimeStart(MATCH).orElseThrow().idRandomEvent());
        }

        @Test
        @DisplayName("a condition that is not met leaves nothing to fire")
        void conditionNotMet() {
            when(store.findRandomEvents(STORY)).thenReturn(List.of(cond(1, 100, "level", "3", ">")));
            when(registry.find(MATCH, "level")).thenReturn(List.of("2"));
            assertTrue(service.pickAtTimeStart(MATCH).isEmpty());
        }

        @Test
        @DisplayName("a blank key is no condition")
        void blankKey() {
            when(store.findRandomEvents(STORY)).thenReturn(List.of(cond(1, 100, " ", null, null)));
            assertTrue(service.pickAtTimeStart(MATCH).isPresent());
            verifyNoInteractions(registry);
        }
    }

    @Nested
    @DisplayName("the absolute-percentage pick")
    class Pick {
        @Test
        @DisplayName("order: probability DESC, then id ASC")
        void order() {
            List<RandomEventRuleView> ordered = RandomEventSelectionService.order(
                    List.of(row(3, 10, 1), row(1, 30, 1), row(2, 10, 1)));
            assertEquals(List.of(1L, 2L, 3L), ordered.stream().map(RandomEventRuleView::id).toList());
        }

        @Test
        @DisplayName("walk: roll below the total picks its range, roll at the total picks nothing")
        void walk() {
            List<RandomEventRuleView> ordered = List.of(row(1, 30, 1), row(2, 10, 2));
            assertEquals(1L, RandomEventSelectionService.walk(ordered, 0).orElseThrow().id());
            assertEquals(1L, RandomEventSelectionService.walk(ordered, 29).orElseThrow().id());
            assertEquals(2L, RandomEventSelectionService.walk(ordered, 39).orElseThrow().id());
            assertTrue(RandomEventSelectionService.walk(ordered, 40).isEmpty());
            assertTrue(RandomEventSelectionService.walk(ordered, 99).isEmpty());
        }

        @Test
        @DisplayName("pick rolls over max(100, total) with the seeded generator")
        void pickMatchesSeededRoll() {
            List<RandomEventRuleView> eligible = List.of(row(1, 10, 1), row(2, 30, 2));
            for (long seed = 0; seed < 50; seed++) {
                int roll = new Random(seed).nextInt(100);
                Optional<RandomEventRuleView> expected = RandomEventSelectionService.walk(
                        RandomEventSelectionService.order(eligible), roll);
                assertEquals(expected, RandomEventSelectionService.pick(eligible, seed));
            }
        }

        @Test
        @DisplayName("a total above 100 scales the rows and one always fires")
        void totalAboveHundred() {
            List<RandomEventRuleView> eligible = List.of(row(1, 70, 1), row(2, 60, 2));
            assertEquals(130, RandomEventSelectionService.total(eligible));
            for (long seed = 0; seed < 200; seed++) {
                assertTrue(RandomEventSelectionService.pick(eligible, seed).isPresent());
            }
        }

        @Test
        @DisplayName("nothing eligible picks nothing")
        void emptyPick() {
            assertTrue(RandomEventSelectionService.pick(List.of(), 1L).isEmpty());
            assertTrue(RandomEventSelectionService.pick(null, 1L).isEmpty());
        }

        @Test
        @DisplayName("seed = (rngSeed ?? idStory) + clock + salt")
        void seed() {
            assertEquals(42L + 3 + RandomEventSelectionService.SEED_SALT,
                    RandomEventSelectionService.seedFor(running(3, 42L)));
            assertEquals(STORY + 3 + RandomEventSelectionService.SEED_SALT,
                    RandomEventSelectionService.seedFor(running(3, null)));
        }

        @Test
        @DisplayName("isRunnable tolerates a null consumed set")
        void nullConsumed() {
            RandomEventRuleView once = new RandomEventRuleView(1, 11, 5, null, null, null, true, "ONCE", false);
            assertTrue(RandomEventSelectionService.isRunnable(once, null));
        }
    }
}
