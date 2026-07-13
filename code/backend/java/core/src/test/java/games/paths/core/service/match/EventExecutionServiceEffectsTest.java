package games.paths.core.service.match;

import games.paths.core.entity.story.EventEffectEntity;
import games.paths.core.entity.story.EventEntity;
import games.paths.core.model.story.CardInfo;
import games.paths.core.port.match.EventExecutionPort.AppliedEffect;
import games.paths.core.port.match.EventExecutionPort.EventExecutionResult;
import games.paths.core.port.match.EventExecutionPort.StatChange;
import games.paths.core.port.match.EventExecutionStorePort;
import games.paths.core.port.match.EventExecutionStorePort.BackpackStats;
import games.paths.core.port.match.EventExecutionStorePort.CharacterStats;
import games.paths.core.port.match.EventExecutionStorePort.EventActorView;
import games.paths.core.port.match.EventExecutionStorePort.EventCheckContext;
import games.paths.core.port.match.EventExecutionStorePort.MatchEventView;
import games.paths.core.port.match.UserAccessPort;
import games.paths.core.port.story.ContentQueryPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * EventExecutionService (Step 29) — the effect matrix: every statistic, every target mode,
 * items, traits, characteristics, the registry, the weather and the coma short-circuit.
 */
@DisplayName("EventExecutionService effects (Step 29)")
class EventExecutionServiceEffectsTest {

    private static final String MATCH_UUID = "match-uuid";
    private static final String USER_UUID = "user-uuid";
    private static final String EVENT_UUID = "event-uuid";
    private static final long MATCH_ID = 1L;
    private static final long USER_ID = 2L;
    private static final long CHAR_ID = 3L;
    private static final long STORY_ID = 4L;
    private static final long LOC = 100L;

    /** A second character in the SAME location as the actor — the INV-27 "ALL" set. */
    private static final long MATE_ID = 30L;
    /** A third character ELSEWHERE — "ALL" must never reach them. */
    private static final long FAR_ID = 40L;

    private EventExecutionStorePort store;
    private TimeAdvancementService timeAdvancementService;
    private EventExecutionService service;

    @BeforeEach
    void setUp() {
        store = mock(EventExecutionStorePort.class);
        UserAccessPort userAccessPort = mock(UserAccessPort.class);
        ContentQueryPort contentQueryPort = mock(ContentQueryPort.class);
        timeAdvancementService = mock(TimeAdvancementService.class);
        service = new EventExecutionService(store, userAccessPort, contentQueryPort, timeAdvancementService);

        when(userAccessPort.findByUuid(USER_UUID)).thenReturn(Optional.of(
                new UserAccessPort.UserView(USER_ID, USER_UUID, "player", "USER", 2)));
        when(store.findMatchByUuid(MATCH_UUID)).thenReturn(Optional.of(
                new MatchEventView(MATCH_ID, MATCH_UUID, "RUNNING", 7, STORY_ID, USER_ID, null)));
        when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID)).thenReturn(Optional.of(actor()));
        when(store.findCharactersByMatchId(MATCH_ID))
                .thenReturn(List.of(actor(), mate(), far()));
        when(store.findBackpack(anyLong(), anyLong()))
                .thenReturn(Optional.of(new BackpackStats(5, 5, 10)));
        when(store.findEventByStoryAndUuid(STORY_ID, EVENT_UUID)).thenReturn(Optional.of(event()));
        when(store.findEventsById(STORY_ID)).thenReturn(Map.of(1L, event()));
        when(store.findIdEventEndGame(STORY_ID)).thenReturn(Optional.empty());
        when(store.findItemUuidsById(STORY_ID)).thenReturn(Map.of(42L, "item-uuid"));
        when(store.findTraitUuidsById(STORY_ID)).thenReturn(Map.of(7L, "trait-uuid", 8L, "trait-8"));
        when(store.loadCheckContext(MATCH_ID, CHAR_ID)).thenReturn(ctx());
        when(contentQueryPort.getCardByStoryIdAndCardId(eq(STORY_ID), anyInt(), anyString()))
                .thenAnswer(i -> card("card-" + i.getArgument(1)));
        when(store.removeItem(anyLong(), anyLong(), anyLong())).thenReturn(true);
        when(store.addTrait(anyLong(), anyLong(), anyLong(), any())).thenReturn(true);
        when(store.removeTrait(anyLong(), anyLong(), anyLong())).thenReturn(true);
    }

    // ── fixtures ────────────────────────────────────────────────────────────

    /** dex/int/cos 10, energy 20/100, life 30/100, sad 0/50, exp 0. */
    private static EventActorView actor() {
        return new EventActorView(CHAR_ID, "char-uuid", USER_ID, 50L, LOC,
                10, 10, 10, 20, 30, 0, 0, 100, 100, 50, false, false, null);
    }

    private static EventActorView mate() {
        return new EventActorView(MATE_ID, "mate-uuid", 20L, 51L, LOC,
                10, 10, 10, 20, 30, 0, 0, 100, 100, 50, false, false, null);
    }

    private static EventActorView far() {
        return new EventActorView(FAR_ID, "far-uuid", 21L, 50L, 999L,
                10, 10, 10, 20, 30, 0, 0, 100, 100, 50, false, false, null);
    }

    private static EventEntity event() {
        EventEntity e = new EventEntity();
        e.setId(1L);
        e.setUuid(EVENT_UUID);
        e.setType("NORMAL");
        e.setCostEnery(0);
        e.setCoinCost(0);
        e.setFlagEndTime(0);
        return e;
    }

    private static EventCheckContext ctx() {
        return new EventCheckContext(CHAR_ID, LOC, false, false, 20, 10, 50L,
                new HashSet<>(), null, new HashSet<>(), new HashMap<>());
    }

    private static CardInfo card(String title) {
        return new CardInfo(title, null, null, null, null, null, null, null, null, null,
                title, null, null, null, null);
    }

    private static EventEffectEntity effect() {
        EventEffectEntity e = new EventEffectEntity();
        e.setId(1L);
        e.setUuid("effect-uuid");
        e.setIdEvent(1);
        e.setValue(0);
        e.setTarget("ONLY_ONE");
        return e;
    }

    private static EventEffectEntity stat(String statistic, int value, String target) {
        EventEffectEntity e = effect();
        e.setStatistics(statistic);
        e.setValue(value);
        e.setTarget(target);
        return e;
    }

    private void withEffects(EventEffectEntity... effects) {
        when(store.findEffectsByEventId(STORY_ID)).thenReturn(Map.of(1L, List.of(effects)));
    }

    private EventExecutionResult execute() {
        return service.executeEvent(MATCH_UUID, USER_UUID, EVENT_UUID, "en");
    }

    private CharacterStats writtenStats(long idCharacter) {
        ArgumentCaptor<CharacterStats> c = ArgumentCaptor.forClass(CharacterStats.class);
        verify(store).updateCharacterStats(eq(MATCH_ID), eq(idCharacter), c.capture());
        return c.getValue();
    }

    private BackpackStats writtenBackpack(long idCharacter) {
        ArgumentCaptor<BackpackStats> c = ArgumentCaptor.forClass(BackpackStats.class);
        verify(store).updateBackpack(eq(MATCH_ID), eq(idCharacter), c.capture());
        return c.getValue();
    }

    private static StatChange only(EventExecutionResult r) {
        assertEquals(1, r.statChanges().size(), "expected exactly one stat change");
        return r.statChanges().get(0);
    }

    // ── statistics ──────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Statistics")
    class Statistics {

        @Test
        @DisplayName("Each character statistic is applied and reported")
        void characterStats() {
            withEffects(stat("life", -5, "ONLY_ONE"));
            assertEquals(25, writtenAfter(execute(), "life"));

            reset();
            withEffects(stat("energy", -5, "ONLY_ONE"));
            assertEquals(15, writtenAfter(execute(), "energy"));

            reset();
            withEffects(stat("sad", 4, "ONLY_ONE"));
            assertEquals(4, writtenAfter(execute(), "sad"));

            reset();
            withEffects(stat("exp", 7, "ONLY_ONE"));
            assertEquals(7, writtenAfter(execute(), "exp"));

            reset();
            withEffects(stat("dex", 2, "ONLY_ONE"));
            assertEquals(12, writtenAfter(execute(), "dex"));

            reset();
            withEffects(stat("int", 2, "ONLY_ONE"));
            assertEquals(12, writtenAfter(execute(), "int"));

            reset();
            withEffects(stat("cos", 2, "ONLY_ONE"));
            assertEquals(12, writtenAfter(execute(), "cos"));
        }

        @Test
        @DisplayName("Each backpack resource is applied and reported")
        void backpackStats() {
            withEffects(stat("food", 3, "ONLY_ONE"));
            execute();
            assertEquals(8, writtenBackpack(CHAR_ID).food());

            reset();
            withEffects(stat("magic", -2, "ONLY_ONE"));
            execute();
            assertEquals(3, writtenBackpack(CHAR_ID).magic());

            reset();
            withEffects(stat("coin", 5, "ONLY_ONE"));
            execute();
            assertEquals(15, writtenBackpack(CHAR_ID).coin());
        }

        @Test
        @DisplayName("Life, energy and sadness clamp at their max")
        void clampAtMax() {
            withEffects(stat("life", 9999, "ONLY_ONE"));
            assertEquals(100, writtenAfter(execute(), "life"));

            reset();
            withEffects(stat("energy", 9999, "ONLY_ONE"));
            assertEquals(100, writtenAfter(execute(), "energy"));

            reset();
            withEffects(stat("sad", 9999, "ONLY_ONE"));
            assertEquals(50, writtenAfter(execute(), "sad"));
        }

        @Test
        @DisplayName("Nothing goes below zero")
        void clampAtZero() {
            withEffects(stat("energy", -9999, "ONLY_ONE"));
            assertEquals(0, writtenAfter(execute(), "energy"));

            reset();
            withEffects(stat("food", -9999, "ONLY_ONE"));
            execute();
            assertEquals(0, writtenBackpack(CHAR_ID).food());

            reset();
            withEffects(stat("dex", -9999, "ONLY_ONE"));
            assertEquals(0, writtenAfter(execute(), "dex"));
        }

        @Test
        @DisplayName("An unknown or blank statistic is ignored, not an error")
        void unknownStatistic() {
            withEffects(stat("charisma", 5, "ONLY_ONE"), stat("", 5, "ONLY_ONE"));
            EventExecutionResult r = execute();
            assertTrue(r.statChanges().isEmpty());
            assertEquals(2, r.effects().size(), "the effect rows are still reported");
        }

        @Test
        @DisplayName("Two effects on the same statistic compound")
        void compound() {
            withEffects(stat("exp", 3, "ONLY_ONE"), stat("exp", 4, "ONLY_ONE"));
            execute();
            assertEquals(7, writtenStats(CHAR_ID).exp());
        }

        private int writtenAfter(EventExecutionResult r, String statistic) {
            StatChange c = only(r);
            assertEquals(statistic, c.statistic());
            assertEquals("char-uuid", c.characterUuid());
            return c.after();
        }

        /** Fresh mocks and a fresh service, so one test can walk the whole statistic table. */
        private void reset() {
            setUp();
        }
    }

    // ── target resolution (INV-27) ──────────────────────────────────────────

    @Nested
    @DisplayName("Target")
    class Target {

        @Test
        @DisplayName("ONLY_ONE reaches the actor alone")
        void onlyOne() {
            withEffects(stat("exp", 1, "ONLY_ONE"));
            EventExecutionResult r = execute();
            assertEquals(List.of("char-uuid"), r.effects().get(0).characterUuids());
            verify(store, never()).updateCharacterStats(eq(MATCH_ID), eq(MATE_ID), any());
        }

        @Test
        @DisplayName("ALL reaches every character in the actor's location — and nobody else")
        void allInLocation() {
            withEffects(stat("exp", 1, "ALL"));
            EventExecutionResult r = execute();

            assertEquals(List.of("char-uuid", "mate-uuid"), r.effects().get(0).characterUuids());
            verify(store).updateCharacterStats(eq(MATCH_ID), eq(CHAR_ID), any());
            verify(store).updateCharacterStats(eq(MATCH_ID), eq(MATE_ID), any());
            verify(store, never()).updateCharacterStats(eq(MATCH_ID), eq(FAR_ID), any());
        }

        @Test
        @DisplayName("A null target defaults to ALL")
        void nullTargetIsAll() {
            withEffects(stat("exp", 1, null));
            assertEquals(2, execute().effects().get(0).characterUuids().size());
        }

        @Test
        @DisplayName("target_class narrows the recipients")
        void targetClass() {
            EventEffectEntity e = stat("exp", 1, "ALL");
            e.setTargetClass(51); // only the mate has class 51
            withEffects(e);

            EventExecutionResult r = execute();

            assertEquals(List.of("mate-uuid"), r.effects().get(0).characterUuids());
            verify(store, never()).updateCharacterStats(eq(MATCH_ID), eq(CHAR_ID), any());
            verify(store).updateCharacterStats(eq(MATCH_ID), eq(MATE_ID), any());
        }

        @Test
        @DisplayName("A target_class matching nobody applies nothing, and is not an error")
        void targetClassMatchesNobody() {
            EventEffectEntity e = stat("exp", 1, "ALL");
            e.setTargetClass(999);
            withEffects(e);

            EventExecutionResult r = execute();

            assertTrue(r.effects().get(0).characterUuids().isEmpty());
            assertTrue(r.statChanges().isEmpty());
            verify(store, never()).updateCharacterStats(anyLong(), anyLong(), any());
        }
    }

    // ── items / traits / characteristics / registry / weather ───────────────

    @Nested
    @DisplayName("Items")
    class Items {

        @Test
        @DisplayName("ADD grants the item and flags itemAdded")
        void add() {
            EventEffectEntity e = effect();
            e.setIdItemTarget(42);
            e.setItemAction("ADD");
            withEffects(e);

            EventExecutionResult r = execute();

            verify(store).addItem(MATCH_ID, CHAR_ID, 42L);
            assertTrue(r.itemAdded());
            assertFalse(r.itemRemoved());
            assertEquals(1, r.itemChanges().size());
            assertEquals("item-uuid", r.itemChanges().get(0).itemUuid());
            assertEquals("ADD", r.itemChanges().get(0).action());
        }

        @Test
        @DisplayName("REMOVE takes the item and flags itemRemoved")
        void remove() {
            EventEffectEntity e = effect();
            e.setIdItemTarget(42);
            e.setItemAction("REMOVE");
            withEffects(e);

            EventExecutionResult r = execute();

            verify(store).removeItem(MATCH_ID, CHAR_ID, 42L);
            assertTrue(r.itemRemoved());
            assertEquals("REMOVE", r.itemChanges().get(0).action());
        }

        @Test
        @DisplayName("REMOVE of an item the character does not carry changes nothing")
        void removeMissing() {
            when(store.removeItem(anyLong(), anyLong(), anyLong())).thenReturn(false);
            EventEffectEntity e = effect();
            e.setIdItemTarget(42);
            e.setItemAction("REMOVE");
            withEffects(e);

            EventExecutionResult r = execute();

            assertFalse(r.itemRemoved());
            assertTrue(r.itemChanges().isEmpty());
        }

        @Test
        @DisplayName("An unknown item_action is ignored")
        void unknownAction() {
            EventEffectEntity e = effect();
            e.setIdItemTarget(42);
            e.setItemAction("EAT");
            withEffects(e);

            EventExecutionResult r = execute();

            verify(store, never()).addItem(anyLong(), anyLong(), anyLong());
            verify(store, never()).removeItem(anyLong(), anyLong(), anyLong());
            assertFalse(r.itemAdded());
        }
    }

    @Nested
    @DisplayName("Traits")
    class Traits {

        @Test
        @DisplayName("Traits are added and removed from a CSV of ids")
        void addAndRemove() {
            EventEffectEntity e = effect();
            e.setTraitsToAdd("7,8");
            e.setTraitsToRemove("7");
            withEffects(e);

            EventExecutionResult r = execute();

            verify(store).addTrait(MATCH_ID, CHAR_ID, 7L, 1L);
            verify(store).addTrait(MATCH_ID, CHAR_ID, 8L, 1L);
            verify(store).removeTrait(MATCH_ID, CHAR_ID, 7L);
            assertEquals(3, r.traitChanges().size());
            assertEquals("trait-uuid", r.traitChanges().get(0).traitUuid());
        }

        @Test
        @DisplayName("A trait already held is not reported as added")
        void alreadyHeld() {
            when(store.addTrait(anyLong(), anyLong(), anyLong(), any())).thenReturn(false);
            EventEffectEntity e = effect();
            e.setTraitsToAdd("7");
            withEffects(e);

            assertTrue(execute().traitChanges().isEmpty());
        }

        @Test
        @DisplayName("Non-numeric noise in the CSV is skipped, not thrown")
        void csvNoise() {
            EventEffectEntity e = effect();
            e.setTraitsToAdd("7,brave,");
            withEffects(e);

            assertDoesNotThrow(EventExecutionServiceEffectsTest.this::execute);
            verify(store).addTrait(MATCH_ID, CHAR_ID, 7L, 1L);
        }
    }

    @Nested
    @DisplayName("Characteristics")
    class Characteristics {

        @Test
        @DisplayName("Characteristics are added to the CSV column")
        void add() {
            EventEffectEntity e = effect();
            e.setCharacteristicToAdd("BRAVE,CURSED");
            withEffects(e);

            EventExecutionResult r = execute();

            ArgumentCaptor<String> csv = ArgumentCaptor.forClass(String.class);
            verify(store).setCharacterCharacteristics(eq(MATCH_ID), eq(CHAR_ID), csv.capture());
            assertEquals("BRAVE,CURSED", csv.getValue());
            assertEquals(2, r.characteristicChanges().size());
        }

        @Test
        @DisplayName("Removing a characteristic the character does not have changes nothing")
        void removeMissing() {
            EventEffectEntity e = effect();
            e.setCharacteristicToRemove("BRAVE");
            withEffects(e);

            EventExecutionResult r = execute();

            assertTrue(r.characteristicChanges().isEmpty());
            verify(store, never()).setCharacterCharacteristics(anyLong(), anyLong(), any());
        }
    }

    @Nested
    @DisplayName("Registry")
    class Registry {

        @Test
        @DisplayName("A key is upserted once, by the actor, and reported with its old value")
        void upsert() {
            EventEffectEntity e = effect();
            e.setTarget("ALL"); // even so, the registry is match-scoped: written once
            e.setKeyToAdd("GATE");
            e.setKeyValueToAdd("OPEN");
            withEffects(e);

            EventExecutionResult r = execute();

            verify(store, times(1)).upsertRegistry(MATCH_ID, "GATE", "OPEN", CHAR_ID, 1L, 7);
            assertEquals(1, r.registryChanges().size());
            assertNull(r.registryChanges().get(0).oldValue());
            assertEquals("OPEN", r.registryChanges().get(0).newValue());
        }

        @Test
        @DisplayName("A later effect sees the value the previous one wrote")
        void visibleToTheNextEffect() {
            EventEffectEntity first = effect();
            first.setKeyToAdd("GATE");
            first.setKeyValueToAdd("OPEN");
            EventEffectEntity second = effect();
            second.setId(2L);
            second.setKeyToAdd("GATE");
            second.setKeyValueToAdd("SHUT");
            withEffects(first, second);

            EventExecutionResult r = execute();

            assertEquals(2, r.registryChanges().size());
            assertEquals("OPEN", r.registryChanges().get(1).oldValue());
            assertEquals("SHUT", r.registryChanges().get(1).newValue());
        }
    }

    @Nested
    @DisplayName("Weather")
    class Weather {

        @Test
        @DisplayName("id_weather on an effect SETS the match weather, once per row")
        void setsWeather() {
            EventEffectEntity e = effect();
            e.setTarget("ALL"); // two recipients, but the weather is a match property
            e.setIdWeather(3);
            withEffects(e);

            EventExecutionResult r = execute();

            verify(store, times(1)).setCurrentWeather(MATCH_ID, 3L);
            assertTrue(r.weatherApplied());
        }
    }

    // ── the effect's own card is the narrative ──────────────────────────────

    @Nested
    @DisplayName("Cards")
    class Cards {

        @Test
        @DisplayName("Each applied effect carries ITS OWN card, not the event's")
        void effectCard() {
            EventEntity e = event();
            e.setIdCard(1);
            when(store.findEventByStoryAndUuid(STORY_ID, EVENT_UUID)).thenReturn(Optional.of(e));
            when(store.findEventsById(STORY_ID)).thenReturn(Map.of(1L, e));

            EventEffectEntity ef = stat("exp", 1, "ONLY_ONE");
            ef.setIdCard(2);
            withEffects(ef);

            EventExecutionResult r = execute();

            AppliedEffect applied = r.effects().get(0);
            assertEquals("card-2", applied.card().title(), "the effect's card is the narrative");
            assertEquals("card-1", r.card().title(), "the event keeps its own card");
        }
    }

    // ── coma short-circuits ─────────────────────────────────────────────────

    @Nested
    @DisplayName("Coma")
    class Coma {

        @Test
        @DisplayName("Life at zero sets the coma flags and stops everything")
        void comaShortCircuits() {
            EventEntity first = event();
            first.setIdEventNext(2);
            first.setFlagEndTime(1); // must NOT fire: coma wins
            EventEntity second = event();
            second.setId(2L);
            second.setUuid("event-2");

            when(store.findEventByStoryAndUuid(STORY_ID, EVENT_UUID)).thenReturn(Optional.of(first));
            when(store.findEventsById(STORY_ID)).thenReturn(Map.of(1L, first, 2L, second));
            withEffects(stat("life", -9999, "ONLY_ONE"));

            EventExecutionResult r = execute();

            assertAll(
                    () -> assertTrue(r.comaTriggered()),
                    () -> assertTrue(r.forcedSleep()),
                    () -> assertFalse(r.timeEnded(), "flag_end_time must not fire on coma"),
                    () -> assertEquals(List.of(EVENT_UUID), r.executedEventUuids(),
                            "the chain must stop at the coma"));
            verify(store).setCharacterComa(MATCH_ID, CHAR_ID);
            verify(timeAdvancementService, never()).forceTimeEnd(anyString());
        }

        @Test
        @DisplayName("A recipient other than the actor comas without short-circuiting")
        void mateComa() {
            EventEffectEntity e = stat("life", -9999, "ALL");
            e.setTargetClass(51); // hits the mate only
            withEffects(e);

            EventExecutionResult r = execute();

            verify(store).setCharacterComa(MATCH_ID, MATE_ID);
            verify(store, never()).setCharacterComa(MATCH_ID, CHAR_ID);
            assertFalse(r.comaTriggered(), "only the actor's coma short-circuits");
        }
    }
}
