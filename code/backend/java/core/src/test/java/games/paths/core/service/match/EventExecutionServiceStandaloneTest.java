package games.paths.core.service.match;

import games.paths.core.model.story.CardInfo;
import games.paths.core.port.match.EdgeStateStorePort;
import games.paths.core.port.match.EventExecutionPort.EventExecutionResult;
import games.paths.core.port.match.EventExecutionPort.StandaloneEffect;
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
 * EventExecutionService — {@code applyStandaloneEffects} (Step 34): the door through
 * which an item moves a statistic using the very code an event effect uses.
 *
 * <p>What is under test here is that an execution with NO owning event still produces
 * a well-formed execute-event payload, and still reaches the Step 30 verdict.</p>
 */
@DisplayName("EventExecutionService standalone effects (Step 34)")
class EventExecutionServiceStandaloneTest {

    private static final long MATCH_ID = 1L;
    private static final long USER_ID = 2L;
    private static final long CHAR_ID = 3L;
    private static final long STORY_ID = 4L;
    private static final long LOC = 100L;

    private EventExecutionStorePort store;
    private RegistryService registryService;
    private EdgeStateStorePort edgeStore;
    private ContentQueryPort contentQueryPort;
    private EventExecutionService service;

    @BeforeEach
    void setUp() {
        store = mock(EventExecutionStorePort.class);
        registryService = mock(RegistryService.class);
        edgeStore = mock(EdgeStateStorePort.class);
        UserAccessPort userAccessPort = mock(UserAccessPort.class);
        contentQueryPort = mock(ContentQueryPort.class);
        TimeAdvancementService timeAdvancementService = mock(TimeAdvancementService.class);
        service = new EventExecutionService(store, edgeStore, userAccessPort,
                contentQueryPort, timeAdvancementService, registryService);

        when(store.findMatchById(MATCH_ID)).thenReturn(Optional.of(
                new MatchEventView(MATCH_ID, "match-uuid", "RUNNING", 7, STORY_ID, USER_ID, null)));
        when(store.findCharacterByMatchAndId(MATCH_ID, CHAR_ID)).thenReturn(Optional.of(actor(30, 0)));
        when(store.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of(actor(30, 0)));
        when(store.loadCheckContext(MATCH_ID, CHAR_ID)).thenReturn(ctx());
        when(store.findBackpack(anyLong(), anyLong())).thenReturn(Optional.of(new BackpackStats(5, 5, 10)));
        when(store.findTraitUuidsById(STORY_ID)).thenReturn(Map.of(7L, "trait-7", 8L, "trait-8"));
        when(store.addTrait(anyLong(), anyLong(), anyLong(), any())).thenReturn(true);
        when(store.removeTrait(anyLong(), anyLong(), anyLong())).thenReturn(true);
        when(store.findIdEventAllPlayerComa(STORY_ID)).thenReturn(Optional.empty());
    }

    /** life/sad configurable; dex/int/cos 10, energy 20/100, sadMax 50. */
    private static EventActorView actor(int life, int sad) {
        return new EventActorView(CHAR_ID, "char-uuid", USER_ID, 50L, LOC,
                10, 10, 10, 20, life, sad, 0, 100, 100, 50, 30, false, false, null);
    }

    private static EventCheckContext ctx() {
        return new EventCheckContext(CHAR_ID, LOC, false, false, 20, 10, 50L,
                new HashSet<>(), null, new HashSet<>(), new HashMap<>());
    }

    private static CardInfo card(String uuid) {
        return new CardInfo(uuid, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null);
    }

    private static StandaloneEffect stat(String statistic, int value) {
        return new StandaloneEffect("effect-1", statistic, value, null, null, null);
    }

    @Test
    @DisplayName("no owning event: eventUuid and eventType are null, the card is the item's own")
    void noOwningEvent() {
        CardInfo itemCard = card("card-item");

        EventExecutionResult r = service.applyStandaloneEffects(
                MATCH_ID, CHAR_ID, List.of(stat("life", 3)), itemCard, "en", true);

        assertNull(r.eventUuid());
        assertNull(r.eventType());
        assertSame(itemCard, r.card());
        assertEquals("match-uuid", r.matchUuid());
        assertEquals("APPLIED", r.status());
        assertTrue(r.executedEventUuids().isEmpty());
        assertTrue(r.pendingChoices().isEmpty(), "an item owns no choices");
        assertFalse(r.gameOver());
        assertEquals(0, r.energySpent());
        assertEquals(0, r.coinSpent());
    }

    @Test
    @DisplayName("a character statistic is clamped and flushed exactly as an event effect would")
    void appliesCharacterStat() {
        EventExecutionResult r = service.applyStandaloneEffects(
                MATCH_ID, CHAR_ID, List.of(stat("life", 5)), null, "en", false);

        assertEquals(1, r.statChanges().size());
        assertEquals("life", r.statChanges().get(0).statistic());
        assertEquals(30, r.statChanges().get(0).before());
        assertEquals(35, r.statChanges().get(0).after());
        assertTrue(r.refreshRecommended());

        ArgumentCaptor<CharacterStats> stats = ArgumentCaptor.forClass(CharacterStats.class);
        verify(store).updateCharacterStats(eq(MATCH_ID), eq(CHAR_ID), stats.capture());
        assertEquals(35, stats.getValue().life());
    }

    @Test
    @DisplayName("a backpack statistic writes the backpack, not the character row")
    void appliesBackpackStat() {
        service.applyStandaloneEffects(MATCH_ID, CHAR_ID, List.of(stat("food", 3)), null, "en", false);

        ArgumentCaptor<BackpackStats> backpack = ArgumentCaptor.forClass(BackpackStats.class);
        verify(store).updateBackpack(eq(MATCH_ID), eq(CHAR_ID), backpack.capture());
        assertEquals(8, backpack.getValue().food());
        assertEquals(5, backpack.getValue().magic());
    }

    @Test
    @DisplayName("the trait CSVs are flipped through the shared helper")
    void appliesTraits() {
        EventExecutionResult r = service.applyStandaloneEffects(MATCH_ID, CHAR_ID,
                List.of(new StandaloneEffect("effect-1", null, 0, "7", "8", null)), null, "en", false);

        verify(store).addTrait(MATCH_ID, CHAR_ID, 7L, null);
        verify(store).removeTrait(MATCH_ID, CHAR_ID, 8L);
        assertEquals(2, r.traitChanges().size());
        assertEquals("trait-7", r.traitChanges().get(0).traitUuid());
        assertEquals("ADD", r.traitChanges().get(0).action());
    }

    @Test
    @DisplayName("each effect row reports itself, with its own card, targeting only the user")
    void reportsAppliedEffects() {
        when(contentQueryPort.getCardByStoryIdAndCardId(STORY_ID, 55, "en")).thenReturn(card("card-55"));

        EventExecutionResult r = service.applyStandaloneEffects(MATCH_ID, CHAR_ID,
                List.of(new StandaloneEffect("effect-9", "life", 2, null, null, 55)), null, "en", false);

        assertEquals(1, r.effects().size());
        assertNull(r.effects().get(0).eventUuid());
        assertEquals("effect-9", r.effects().get(0).effectUuid());
        assertEquals("ONLY_ONE", r.effects().get(0).target());
        assertEquals(List.of("char-uuid"), r.effects().get(0).characterUuids());
        assertEquals("card-55", r.effects().get(0).card().uuid());
    }

    @Test
    @DisplayName("a SADNESS effect reaches the Step 30 verdict — the whole point of the reuse")
    void tripsTheEdgeState() {
        // sad 48 of 50: +5 overflows.
        when(store.findCharacterByMatchAndId(MATCH_ID, CHAR_ID)).thenReturn(Optional.of(actor(30, 48)));
        when(store.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of(actor(30, 48)));

        EventExecutionResult r = service.applyStandaloneEffects(
                MATCH_ID, CHAR_ID, List.of(stat("sad", 5)), null, "en", false);

        assertTrue(r.edgeState().anything(), "the overflow must be reported");
        assertEquals(List.of("char-uuid"), r.edgeState().sadnessOverflowUuids());
    }

    @Test
    @DisplayName("an empty effect list is a no-op that still answers a well-formed payload")
    void emptyEffects() {
        EventExecutionResult r = service.applyStandaloneEffects(MATCH_ID, CHAR_ID, List.of(), null, "en", false);

        assertEquals("APPLIED", r.status());
        assertTrue(r.statChanges().isEmpty());
        assertFalse(r.refreshRecommended());
        assertFalse(r.edgeState().anything());
    }

    @Test
    @DisplayName("a null effect list is treated as an empty one")
    void nullEffects() {
        assertDoesNotThrow(() -> service.applyStandaloneEffects(MATCH_ID, CHAR_ID, null, null, "en", false));
    }

    @Test
    @DisplayName("an unknown statistic is authored noise, silently skipped")
    void unknownStatistic() {
        EventExecutionResult r = service.applyStandaloneEffects(
                MATCH_ID, CHAR_ID, List.of(stat("health", 5)), null, "en", false);

        assertTrue(r.statChanges().isEmpty());
    }

    @Test
    void unknownMatchOrCharacter() {
        when(store.findMatchById(99L)).thenReturn(Optional.empty());
        assertThrows(RuntimeException.class,
                () -> service.applyStandaloneEffects(99L, CHAR_ID, List.of(), null, "en", false));

        when(store.findCharacterByMatchAndId(MATCH_ID, 88L)).thenReturn(Optional.empty());
        assertThrows(RuntimeException.class,
                () -> service.applyStandaloneEffects(MATCH_ID, 88L, List.of(), null, "en", false));
    }
}
