package games.paths.core.service.match;

import games.paths.core.entity.story.MissionEntity;
import games.paths.core.entity.story.MissionStepEntity;
import games.paths.core.entity.story.TextEntity;
import games.paths.core.model.match.MatchMission;
import games.paths.core.port.match.MissionEventPort;
import games.paths.core.port.match.RegistryStorePort;
import games.paths.core.port.match.RegistryStorePort.MissionStateRow;
import games.paths.core.port.match.RegistryStorePort.RegistryRow;
import games.paths.core.port.story.StoryReadPort;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@DisplayName("MissionService (Step 37)")
class MissionServiceTest {

    private static final long MATCH = 7L;
    private static final Long STORY = 3L;

    private RegistryStorePort store;
    private StoryReadPort storyReadPort;
    private MissionService service;

    @BeforeEach
    void setUp() {
        store = mock(RegistryStorePort.class);
        storyReadPort = mock(StoryReadPort.class);
        service = new MissionService(store, storyReadPort, null);
        when(store.findStoryIdByMatch(MATCH)).thenReturn(STORY);
        when(store.findByMatch(MATCH)).thenReturn(List.of());
        when(store.findMissionStates(MATCH)).thenReturn(List.of());
        when(storyReadPort.findMissionsByStoryId(STORY)).thenReturn(List.of());
        when(storyReadPort.findMissionStepsByStoryId(STORY)).thenReturn(List.of());
    }

    // ── fixtures ───────────────────────────────────────────────────────────

    private static MissionEntity mission(long id, String key, String value, Integer event) {
        MissionEntity m = new MissionEntity();
        m.setId(id);
        m.setUuid("m-" + id);
        m.setConditionKey(key);
        m.setConditionValue(value);
        m.setIdEventCompleted(event);
        return m;
    }

    private static MissionStepEntity step(long id, long idMission, int order, String key,
                                          String value, Integer event) {
        MissionStepEntity s = new MissionStepEntity();
        s.setId(id);
        s.setUuid("s-" + id);
        s.setIdMission((int) idMission);
        s.setStep(order);
        s.setConditionKey(key);
        s.setConditionValue(value);
        s.setIdEventCompleted(event);
        return s;
    }

    private void story(List<MissionEntity> missions, List<MissionStepEntity> steps) {
        when(storyReadPort.findMissionsByStoryId(STORY)).thenReturn(missions);
        when(storyReadPort.findMissionStepsByStoryId(STORY)).thenReturn(steps);
    }

    private void registry(String... keyValuePairs) {
        List<RegistryRow> rows = new ArrayList<>();
        for (int i = 0; i < keyValuePairs.length; i += 2) {
            rows.add(RegistryService.parse(keyValuePairs[i], keyValuePairs[i + 1]));
        }
        when(store.findByMatch(MATCH)).thenReturn(rows);
    }

    private void states(MissionStateRow... rows) {
        when(store.findMissionStates(MATCH)).thenReturn(Arrays.asList(rows));
    }

    // ── conditions ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("reading a condition")
    class Conditions {

        @Test
        @DisplayName("a pipe list is split, trimmed, and its empty segments dropped")
        void pipeList() {
            assertEquals(List.of("a", "b", "c"),
                    MissionService.parseValues(null, " a | b ||  c |"));
        }

        @Test
        @DisplayName("conditionValues wins over conditionValue when it holds anything at all")
        void valuesWins() {
            assertEquals(List.of("x"), MissionService.parseValues("single", "x"));
            assertEquals(List.of("single"), MissionService.parseValues("single", "  |  "));
            assertEquals(List.of("single"), MissionService.parseValues(" single ", null));
        }

        @Test
        @DisplayName("nothing authored at all demands nothing, which is never satisfied")
        void nothingAuthored() {
            assertTrue(MissionService.parseValues(null, null).isEmpty());
            assertFalse(MissionService.satisfied(mission(1, "k", null, null), Map.of()));
        }

        @Test
        @DisplayName("a blank condition key is never satisfied - the opposite of the registry rule")
        void blankKey() {
            assertFalse(MissionService.satisfied(mission(1, null, "1", null), Map.of("k", List.of("1"))));
            assertFalse(MissionService.satisfied(mission(1, "  ", "1", null), Map.of("k", List.of("1"))));
            assertFalse(MissionService.satisfied(null, Map.of()));
        }

        @Test
        @DisplayName("a single key compares equal, blind to case and padding")
        void singleKey() {
            Map<String, List<String>> reg = Map.of("k", List.of("Gold"));
            assertTrue(MissionService.satisfied(mission(1, "k", " gold ", null), reg));
            assertFalse(MissionService.satisfied(mission(1, "k", "silver", null), reg));
        }

        @Test
        @DisplayName("on a set key one value means CONTAINED IN")
        void setContains() {
            Map<String, List<String>> reg = Map.of("k", List.of("ledger", "letter"));
            assertTrue(MissionService.satisfied(mission(1, "k", "letter", null), reg));
            assertFalse(MissionService.satisfied(mission(1, "k", "map", null), reg));
        }

        @Test
        @DisplayName("conditionValues is an AND: every listed value must be present")
        void andOverSet() {
            MissionEntity m = mission(1, "k", null, null);
            m.setConditionValues("ledger|letter");
            assertTrue(MissionService.satisfied(m, Map.of("k", List.of("letter", "ledger", "map"))));
            assertFalse(MissionService.satisfied(m, Map.of("k", List.of("ledger"))));
        }

        @Test
        @DisplayName("a key the match has never written satisfies nothing")
        void absentKey() {
            assertFalse(MissionService.satisfied(mission(1, "k", "1", null), Map.of()));
        }
    }

    // ── the status machine ─────────────────────────────────────────────────

    @Nested
    @DisplayName("the status machine")
    class Machine {

        @Test
        @DisplayName("a mission whose condition is met becomes AVAILABLE")
        void becomesAvailable() {
            story(List.of(mission(1, "k", "1", null)),
                    List.of(step(10, 1, 1, "s1", "1", null), step(11, 1, 2, "s2", "1", null)));
            registry("k", "1");

            service.onRegistryChange(MATCH, STORY, 4);

            verify(store).upsertMissionState(MATCH, "mission:m-1", MissionService.STATUS_AVAILABLE,
                    1L, null, 4);
        }

        @Test
        @DisplayName("a mission whose condition is not met is not even written")
        void staysLocked() {
            story(List.of(mission(1, "k", "1", null)), List.of());
            registry("k", "other");

            service.onRegistryChange(MATCH, STORY, null);

            verify(store, never()).upsertMissionState(anyLong(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("a mission with no steps completes on its own condition")
        void noSteps() {
            story(List.of(mission(1, "k", "1", null)), List.of());
            registry("k", "1");

            service.onRegistryChange(MATCH, STORY, null);

            verify(store).upsertMissionState(MATCH, "mission:m-1", MissionService.STATUS_COMPLETED,
                    1L, null, null);
        }

        @Test
        @DisplayName("a single-step mission goes AVAILABLE to COMPLETED, skipping ACTIVE")
        void singleStepSkipsActive() {
            story(List.of(mission(1, "k", "1", null)), List.of(step(10, 1, 1, "s1", "1", null)));
            registry("k", "1", "s1", "1");

            service.onRegistryChange(MATCH, STORY, null);

            verify(store).upsertMissionState(MATCH, "mission:m-1", MissionService.STATUS_COMPLETED,
                    1L, 10L, null);
        }

        @Test
        @DisplayName("the first step of a longer mission moves it to ACTIVE")
        void firstStepActivates() {
            story(List.of(mission(1, "k", "1", null)),
                    List.of(step(10, 1, 1, "s1", "1", null), step(11, 1, 2, "s2", "1", null)));
            registry("k", "1", "s1", "1");
            states(new MissionStateRow(1L, null, MissionService.STATUS_AVAILABLE));

            service.onRegistryChange(MATCH, STORY, null);

            verify(store).upsertMissionState(MATCH, "mission:m-1", MissionService.STATUS_ACTIVE,
                    1L, 10L, null);
        }

        @Test
        @DisplayName("an intermediate step closing does not move the status, only the step")
        void intermediateStepKeepsActive() {
            story(List.of(mission(1, "k", "1", null)),
                    List.of(step(10, 1, 1, "s1", "1", null), step(11, 1, 2, "s2", "1", null),
                            step(12, 1, 3, "s3", "1", null)));
            registry("k", "1", "s1", "1", "s2", "1");
            states(new MissionStateRow(1L, 10L, MissionService.STATUS_ACTIVE));

            service.onRegistryChange(MATCH, STORY, null);

            verify(store).upsertMissionState(MATCH, "mission:m-1", MissionService.STATUS_ACTIVE,
                    1L, 11L, null);
        }

        @Test
        @DisplayName("one write may close several steps and the mission with them")
        void oneWriteClosesEverything() {
            story(List.of(mission(1, "k", "1", null)),
                    List.of(step(10, 1, 1, "s1", "1", null), step(11, 1, 2, "s2", "1", null),
                            step(12, 1, 3, "s3", "1", null)));
            registry("k", "1", "s1", "1", "s2", "1", "s3", "1");

            service.onRegistryChange(MATCH, STORY, null);

            verify(store).upsertMissionState(MATCH, "mission:m-1", MissionService.STATUS_COMPLETED,
                    1L, 12L, null);
        }

        @Test
        @DisplayName("the walk stops at the first step not yet met, however far ahead others are")
        void stopsAtTheFirstGap() {
            story(List.of(mission(1, "k", "1", null)),
                    List.of(step(10, 1, 1, "s1", "1", null), step(11, 1, 2, "s2", "1", null),
                            step(12, 1, 3, "s3", "1", null)));
            registry("k", "1", "s1", "1", "s3", "1");

            service.onRegistryChange(MATCH, STORY, null);

            verify(store).upsertMissionState(MATCH, "mission:m-1", MissionService.STATUS_ACTIVE,
                    1L, 10L, null);
        }

        @Test
        @DisplayName("a step whose condition key is blank is invalid and blocks the walk")
        void blankStepKeyBlocks() {
            story(List.of(mission(1, "k", "1", null)),
                    List.of(step(10, 1, 1, "", "1", null), step(11, 1, 2, "s2", "1", null)));
            registry("k", "1", "s2", "1");

            service.onRegistryChange(MATCH, STORY, null);

            verify(store).upsertMissionState(MATCH, "mission:m-1", MissionService.STATUS_AVAILABLE,
                    1L, null, null);
        }

        @Test
        @DisplayName("nothing is written when nothing moved")
        void nothingMoved() {
            story(List.of(mission(1, "k", "1", null)),
                    List.of(step(10, 1, 1, "s1", "1", null), step(11, 1, 2, "s2", "1", null)));
            registry("k", "1", "s1", "1");
            states(new MissionStateRow(1L, 10L, MissionService.STATUS_ACTIVE));

            service.onRegistryChange(MATCH, STORY, null);

            verify(store, never()).upsertMissionState(anyLong(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("a state already terminal is never revisited")
        void terminalIsFinal() {
            story(List.of(mission(1, "k", "1", null)), List.of(step(10, 1, 1, "s1", "1", null)));
            registry("k", "1", "s1", "1");
            states(new MissionStateRow(1L, 10L, MissionService.STATUS_COMPLETED));

            service.onRegistryChange(MATCH, STORY, null);

            verify(store, never()).upsertMissionState(anyLong(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("a status is never lost when the condition that produced it stops holding")
        void notReversible() {
            story(List.of(mission(1, "k", "1", null)),
                    List.of(step(10, 1, 1, "s1", "1", null), step(11, 1, 2, "s2", "1", null)));
            registry("k", "other");
            states(new MissionStateRow(1L, 10L, MissionService.STATUS_ACTIVE));

            service.onRegistryChange(MATCH, STORY, null);

            verify(store, never()).upsertMissionState(anyLong(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("the story id is resolved from the match when the caller does not hold it")
        void resolvesStory() {
            story(List.of(mission(1, "k", "1", null)), List.of());
            registry("k", "1");

            service.onRegistryChange(MATCH, 2);

            verify(store).findStoryIdByMatch(MATCH);
            verify(store).upsertMissionState(MATCH, "mission:m-1", MissionService.STATUS_COMPLETED,
                    1L, null, 2);
        }

        @Test
        @DisplayName("a story with no missions, or none at all, does nothing")
        void noMissions() {
            service.onRegistryChange(MATCH, STORY, null);
            service.onRegistryChange(MATCH, null, null);
            verify(store, never()).upsertMissionState(anyLong(), any(), any(), any(), any(), any());
        }
    }

    // ── completion events ──────────────────────────────────────────────────

    @Nested
    @DisplayName("completion events")
    class Events {

        private MissionEventPort port;

        @BeforeEach
        void wire() {
            port = mock(MissionEventPort.class);
            service.setEventPort(port);
        }

        @Test
        @DisplayName("a step's event runs when that step closes, not only at the end")
        void stepEvent() {
            story(List.of(mission(1, "k", "1", 99)),
                    List.of(step(10, 1, 1, "s1", "1", 50), step(11, 1, 2, "s2", "1", 51)));
            registry("k", "1", "s1", "1");

            service.onRegistryChange(MATCH, STORY, null);

            verify(port).runMissionEvent(MATCH, 50L, 1);
            verify(port, never()).runMissionEvent(MATCH, 99L, 1);
        }

        @Test
        @DisplayName("steps fire in order and the mission's own event fires last")
        void orderOfFiring() {
            story(List.of(mission(1, "k", "1", 99)),
                    List.of(step(10, 1, 1, "s1", "1", 50), step(11, 1, 2, "s2", "1", 51)));
            registry("k", "1", "s1", "1", "s2", "1");

            service.onRegistryChange(MATCH, STORY, null);

            InOrderHelper.assertOrder(port, 50L, 51L, 99L);
        }

        @Test
        @DisplayName("a null or non-positive event id is authored noise, not a trigger")
        void noEvent() {
            story(List.of(mission(1, "k", "1", 0)), List.of(step(10, 1, 1, "s1", "1", null)));
            registry("k", "1", "s1", "1");

            service.onRegistryChange(MATCH, STORY, null);

            verify(port, never()).runMissionEvent(anyLong(), anyLong(), anyInt());
        }

        @Test
        @DisplayName("while an execution holds the engine back, events wait for it to finish")
        void deferral() {
            story(List.of(mission(1, "k", "1", 99)), List.of());
            registry("k", "1");

            service.beginDeferral();
            service.onRegistryChange(MATCH, STORY, null);
            verify(port, never()).runMissionEvent(anyLong(), anyLong(), anyInt());

            service.endDeferral();
            verify(port).runMissionEvent(MATCH, 99L, 1);
        }

        @Test
        @DisplayName("nested holds release only on the outermost one")
        void nestedDeferral() {
            story(List.of(mission(1, "k", "1", 99)), List.of());
            registry("k", "1");

            service.beginDeferral();
            service.beginDeferral();
            service.onRegistryChange(MATCH, STORY, null);
            service.endDeferral();
            verify(port, never()).runMissionEvent(anyLong(), anyLong(), anyInt());

            service.endDeferral();
            verify(port).runMissionEvent(MATCH, 99L, 1);
            // One release too many is harmless: the counter never goes below zero.
            service.endDeferral();
        }

        @Test
        @DisplayName("with no event port wired the queue is emptied, not left to grow")
        void noPort() {
            service.setEventPort(null);
            story(List.of(mission(1, "k", "1", 99)), List.of());
            registry("k", "1");

            assertDoesNotThrow(() -> service.onRegistryChange(MATCH, STORY, null));
        }
    }

    /** Small helper so the ordering assertion reads as one line in the test above. */
    static final class InOrderHelper {
        private InOrderHelper() { }

        static void assertOrder(MissionEventPort port, long... events) {
            org.mockito.InOrder inOrder = inOrder(port);
            for (long e : events) {
                inOrder.verify(port).runMissionEvent(anyLong(), eq(e), anyInt());
            }
            inOrder.verifyNoMoreInteractions();
        }
    }

    // ── end of story ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("when the story ends")
    class StoryEnd {

        @Test
        @DisplayName("what opened and never closed fails; what closed is left alone")
        void failsWhatIsOpen() {
            states(new MissionStateRow(1L, null, MissionService.STATUS_AVAILABLE),
                    new MissionStateRow(2L, 20L, MissionService.STATUS_ACTIVE),
                    new MissionStateRow(3L, 30L, MissionService.STATUS_COMPLETED));

            service.onStoryEnd(MATCH);

            verify(store).upsertMissionState(MATCH, "mission:1", MissionService.STATUS_FAILED,
                    1L, null, null);
            verify(store).upsertMissionState(MATCH, "mission:2", MissionService.STATUS_FAILED,
                    2L, 20L, null);
            verify(store, never()).upsertMissionState(anyLong(), any(),
                    eq(MissionService.STATUS_FAILED), eq(3L), any(), any());
        }
    }

    // ── the API reads ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("listing and detail")
    class Reads {

        @BeforeEach
        void content() {
            when(storyReadPort.findTextByStoryIdTextAndLang(eq(STORY), eq(900), any()))
                    .thenReturn(Optional.of(text("Tutorial", "The long one")));
        }

        private TextEntity text(String shortText, String longText) {
            TextEntity t = new TextEntity();
            t.setShortText(shortText);
            t.setLongText(longText);
            return t;
        }

        @Test
        @DisplayName("only missions the match has reached are listed")
        void onlyReached() {
            story(List.of(mission(1, "k", "1", null), mission(2, "k2", "1", null)), List.of());
            states(new MissionStateRow(1L, null, MissionService.STATUS_AVAILABLE));

            List<MatchMission> out = service.list(MATCH, STORY, null, "en");

            assertEquals(1, out.size());
            assertEquals("m-1", out.get(0).getUuid());
            assertEquals(MissionService.STATUS_AVAILABLE, out.get(0).getStatus());
        }

        @Test
        @DisplayName("the status filter is read whatever case it is asked in")
        void statusFilter() {
            story(List.of(mission(1, "k", "1", null), mission(2, "k2", "1", null)), List.of());
            states(new MissionStateRow(1L, null, MissionService.STATUS_AVAILABLE),
                    new MissionStateRow(2L, null, MissionService.STATUS_COMPLETED));

            assertEquals(1, service.list(MATCH, STORY, " completed ", "en").size());
            assertEquals(2, service.list(MATCH, STORY, "  ", "en").size());
            assertTrue(service.list(MATCH, STORY, "NONSENSE", "en").isEmpty());
        }

        @Test
        @DisplayName("steps report done up to the one reached, and all of them once completed")
        void stepFlags() {
            story(List.of(mission(1, "k", "1", null)),
                    List.of(step(10, 1, 1, "s1", "1", null), step(11, 1, 2, "s2", "1", null),
                            step(12, 1, 3, "s3", "1", null)));
            states(new MissionStateRow(1L, 11L, MissionService.STATUS_ACTIVE));

            MatchMission m = service.list(MATCH, STORY, null, "en").get(0);

            assertEquals(3, m.getStepsTotal());
            assertEquals(2, m.getStepReached());
            assertEquals(List.of(true, true, false),
                    m.getSteps().stream().map(s -> s.isDone()).toList());
        }

        @Test
        @DisplayName("a completed mission reports every step done")
        void completedMarksAll() {
            story(List.of(mission(1, "k", "1", null)),
                    List.of(step(10, 1, 1, "s1", "1", null), step(11, 1, 2, "s2", "1", null)));
            states(new MissionStateRow(1L, 11L, MissionService.STATUS_COMPLETED));

            MatchMission m = service.list(MATCH, STORY, null, "en").get(0);

            assertTrue(m.getSteps().stream().allMatch(s -> s.isDone()));
        }

        @Test
        @DisplayName("an untouched mission reports no step reached and nothing done")
        void nothingReached() {
            story(List.of(mission(1, "k", "1", null)), List.of(step(10, 1, 1, "s1", "1", null)));
            states(new MissionStateRow(1L, null, MissionService.STATUS_AVAILABLE));

            MatchMission m = service.list(MATCH, STORY, null, "en").get(0);

            assertNull(m.getStepReached());
            assertFalse(m.getSteps().get(0).isDone());
        }

        @Test
        @DisplayName("texts resolve in the language asked for, falling back to English")
        void texts() {
            MissionEntity m = mission(1, "k", "1", null);
            m.setIdTextName(900);
            m.setIdTextDescription(900);
            story(List.of(m), List.of());
            states(new MissionStateRow(1L, null, MissionService.STATUS_AVAILABLE));
            when(storyReadPort.findTextByStoryIdTextAndLang(STORY, 900, "it"))
                    .thenReturn(Optional.empty());

            MatchMission out = service.list(MATCH, STORY, null, "it").get(0);

            assertEquals("Tutorial", out.getName());
            assertEquals("The long one", out.getDescription());
        }

        @Test
        @DisplayName("detail answers for a mission reached, and null for anything else")
        void detail() {
            MissionEntity m = mission(1, "k", "1", null);
            story(List.of(m), List.of(step(10, 1, 1, "s1", "1", null)));
            states(new MissionStateRow(1L, null, MissionService.STATUS_AVAILABLE));
            when(storyReadPort.findMissionByStoryIdAndUuid(STORY, "m-1")).thenReturn(Optional.of(m));
            when(storyReadPort.findMissionByStoryIdAndUuid(STORY, "nope")).thenReturn(Optional.empty());

            assertNotNull(service.detail(MATCH, STORY, "m-1", "en"));
            assertNull(service.detail(MATCH, STORY, "nope", "en"));
            assertNull(service.detail(MATCH, STORY, "  ", "en"));
            assertNull(service.detail(MATCH, null, "m-1", "en"));
        }

        @Test
        @DisplayName("a mission the story has but the match has not reached is not found either")
        void detailNotReached() {
            MissionEntity m = mission(1, "k", "1", null);
            story(List.of(m), List.of());
            when(storyReadPort.findMissionByStoryIdAndUuid(STORY, "m-1")).thenReturn(Optional.of(m));

            assertNull(service.detail(MATCH, STORY, "m-1", "en"));
        }

        @Test
        @DisplayName("with no state at all, and with no story, the list is simply empty")
        void empties() {
            assertTrue(service.list(MATCH, STORY, null, "en").isEmpty());
            assertTrue(service.list(MATCH, null, null, "en").isEmpty());
            assertTrue(new MissionService(store).list(MATCH, STORY, null, "en").isEmpty());
        }

        @Test
        @DisplayName("null collections from the read port are read as empty ones")
        void nullCollections() {
            when(storyReadPort.findMissionsByStoryId(STORY)).thenReturn(null);
            when(storyReadPort.findMissionStepsByStoryId(STORY)).thenReturn(null);
            states(new MissionStateRow(1L, null, MissionService.STATUS_AVAILABLE));

            assertTrue(service.list(MATCH, STORY, null, "en").isEmpty());
            assertDoesNotThrow(() -> service.onRegistryChange(MATCH, STORY, null));
        }
    }
}
