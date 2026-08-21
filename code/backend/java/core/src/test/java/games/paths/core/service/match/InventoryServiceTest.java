package games.paths.core.service.match;

import games.paths.core.entity.match.GamingInventoryItemsEntity;
import games.paths.core.entity.story.ItemEffectEntity;
import games.paths.core.entity.story.ItemEntity;
import games.paths.core.model.story.CardInfo;
import games.paths.core.port.match.EventExecutionPort.EdgeStateOutcome;
import games.paths.core.port.match.EventExecutionPort.EventExecutionResult;
import games.paths.core.port.match.EventExecutionPort.StandaloneEffect;
import games.paths.core.port.match.EventExecutionPort.StatChange;
import games.paths.core.port.match.EventExecutionPort.TraitChange;
import games.paths.core.port.match.EventExecutionStorePort.BackpackStats;
import games.paths.core.port.match.InventoryPort.DropItemResult;
import games.paths.core.port.match.InventoryPort.InventoryException;
import games.paths.core.port.match.InventoryPort.InventoryException.Code;
import games.paths.core.port.match.InventoryPort.InventoryView;
import games.paths.core.port.match.InventoryPort.ResourcesView;
import games.paths.core.port.match.InventoryStorePort;
import games.paths.core.port.match.InventoryStorePort.InventoryCharacterView;
import games.paths.core.port.match.InventoryStorePort.MatchInventoryView;
import games.paths.core.port.match.UserAccessPort;
import games.paths.core.port.story.ContentQueryPort;
import games.paths.core.port.story.StoryReadPort;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link InventoryService} — Step 34 inventory and Step 35 resources.
 */
@DisplayName("InventoryService (Steps 34 & 35)")
class InventoryServiceTest {

    private static final String MATCH = "match-uuid";
    private static final String USER = "user-uuid";
    private static final long MATCH_ID = 1L;
    private static final long USER_ID = 100L;
    private static final long CHAR_ID = 50L;
    private static final long STORY_ID = 9001L;
    private static final long WARRIOR = 7L;
    private static final long MAGE = 8L;

    private InventoryStorePort store;
    private UserAccessPort userAccessPort;
    private ContentQueryPort contentQueryPort;
    private StoryReadPort storyReadPort;
    private EventExecutionService effectEngine;
    private InventoryService service;

    @BeforeEach
    void setUp() {
        store = mock(InventoryStorePort.class);
        userAccessPort = mock(UserAccessPort.class);
        contentQueryPort = mock(ContentQueryPort.class);
        storyReadPort = mock(StoryReadPort.class);
        effectEngine = mock(EventExecutionService.class);
        service = new InventoryService(store, userAccessPort, contentQueryPort, storyReadPort, effectEngine);

        when(userAccessPort.findByUuid(USER))
                .thenReturn(Optional.of(new UserAccessPort.UserView(USER_ID, USER, "guest", "GUEST", 6)));
        when(store.findMatchByUuid(MATCH))
                .thenReturn(Optional.of(new MatchInventoryView(MATCH_ID, MATCH, "RUNNING", STORY_ID)));
        when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID))
                .thenReturn(Optional.of(character(WARRIOR, false, false)));
        when(store.findItemEffectsByItemId(STORY_ID)).thenReturn(Map.of());
        when(effectEngine.applyStandaloneEffects(anyLong(), anyLong(), any(), any(), any(), anyBoolean()))
                .thenReturn(result(List.of(), List.of(), EdgeStateOutcome.none(), false));
    }

    // ── fixtures ────────────────────────────────────────────────────────────

    private static InventoryCharacterView character(Long idClass, boolean sleeping, boolean coma) {
        return new InventoryCharacterView(CHAR_ID, "char-uuid", idClass, sleeping, coma, 30);
    }

    private static GamingInventoryItemsEntity row(long id, String uuid, Long idItem, Integer amount) {
        GamingInventoryItemsEntity r = new GamingInventoryItemsEntity();
        r.setId(id);
        r.setIdMatch(MATCH_ID);
        r.setUuid(uuid);
        r.setIdItem(idItem);
        r.setAmount(amount);
        r.setState("ACTIVE");
        return r;
    }

    private static ItemEntity item(long id, int weight, Integer consumable) {
        ItemEntity i = new ItemEntity();
        i.setId(id);
        i.setUuid("item-" + id);
        i.setWeight(weight);
        i.setIsConsumabile(consumable);
        return i;
    }

    private static ItemEffectEntity effect(long id, String code, int value, String add, String remove) {
        ItemEffectEntity e = new ItemEffectEntity();
        e.setId(id);
        e.setUuid("effect-" + id);
        e.setIdItem(900);
        e.setEffectCode(code);
        e.setEffectValue(value);
        e.setTraitsToAdd(add);
        e.setTraitsToRemove(remove);
        return e;
    }

    private static EventExecutionResult result(List<StatChange> stats, List<TraitChange> traits,
                                               EdgeStateOutcome edge, boolean comaTriggered) {
        return new EventExecutionResult(MATCH, null, null, "APPLIED", null, List.of(),
                0, 0, 5, 0, 3, false, false, false, false, false, false, false,
                comaTriggered, false, true,
                stats, List.of(), traits, List.of(), List.of(), List.of(), List.of(), List.of(),
                edge, List.of());
    }

    /** One consumable potion, unrestricted, in the caller's inventory. */
    private void givenPotion() {
        when(store.findInventory(MATCH_ID, CHAR_ID)).thenReturn(List.of(row(1L, "row-1", 900L, 1)));
        when(store.findItemsById(STORY_ID)).thenReturn(Map.of(900L, item(900L, 3, 1)));
    }

    // ── listing ─────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("listInventory")
    class Listing {

        @Test
        @DisplayName("reports the rows, the carried weight and the capacity")
        void listsAndWeighs() {
            when(store.findInventory(MATCH_ID, CHAR_ID))
                    .thenReturn(List.of(row(1L, "row-1", 900L, 2), row(2L, "row-2", 901L, 1)));
            when(store.findItemsById(STORY_ID))
                    .thenReturn(Map.of(900L, item(900L, 3, 1), 901L, item(901L, 5, 0)));

            InventoryView view = service.listInventory(MATCH, USER, "en");

            assertEquals(MATCH, view.matchUuid());
            assertEquals("char-uuid", view.characterUuid());
            assertEquals(2, view.items().size());
            assertEquals(11, view.weight());
            assertEquals(30, view.weightMax());
        }

        @Test
        @DisplayName("an empty inventory is an empty list, never null")
        void emptyInventory() {
            when(store.findInventory(MATCH_ID, CHAR_ID)).thenReturn(List.of());
            when(store.findItemsById(STORY_ID)).thenReturn(Map.of());

            InventoryView view = service.listInventory(MATCH, USER, "en");

            assertNotNull(view.items());
            assertTrue(view.items().isEmpty());
            assertEquals(0, view.weight());
        }

        @Test
        @DisplayName("a read is legal on a match that is not running")
        void readingDoesNotRequireRunning() {
            when(store.findMatchByUuid(MATCH))
                    .thenReturn(Optional.of(new MatchInventoryView(MATCH_ID, MATCH, "PAUSED", STORY_ID)));
            when(store.findInventory(MATCH_ID, CHAR_ID)).thenReturn(List.of());
            when(store.findItemsById(STORY_ID)).thenReturn(Map.of());

            assertDoesNotThrow(() -> service.listInventory(MATCH, USER, "en"));
        }

        @Test
        @DisplayName("a storyless match resolves no story item")
        void storylessMatch() {
            when(store.findMatchByUuid(MATCH))
                    .thenReturn(Optional.of(new MatchInventoryView(MATCH_ID, MATCH, "RUNNING", null)));
            when(store.findInventory(MATCH_ID, CHAR_ID)).thenReturn(List.of(row(1L, "row-1", 900L, 2)));

            assertEquals(0, service.listInventory(MATCH, USER, "en").weight());
            verify(store, never()).findItemsById(anyLong());
        }
    }

    // ── resources ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getResources (Step 35)")
    class Resources {

        @Test
        void reportsBackpackAndWeight() {
            givenPotion();
            when(store.findBackpack(MATCH_ID, CHAR_ID)).thenReturn(Optional.of(new BackpackStats(4, 2, 9)));

            ResourcesView view = service.getResources(MATCH, USER);

            assertEquals(4, view.food());
            assertEquals(2, view.magic());
            assertEquals(9, view.coin());
            assertEquals(3, view.weight());
            assertEquals(30, view.weightMax());
        }

        @Test
        @DisplayName("a character whose backpack row was never written reads as zeros")
        void missingBackpackRow() {
            when(store.findInventory(MATCH_ID, CHAR_ID)).thenReturn(List.of());
            when(store.findItemsById(STORY_ID)).thenReturn(Map.of());
            when(store.findBackpack(MATCH_ID, CHAR_ID)).thenReturn(Optional.empty());

            ResourcesView view = service.getResources(MATCH, USER);

            assertEquals(0, view.food());
            assertEquals(0, view.magic());
            assertEquals(0, view.coin());
        }
    }

    // ── use-item ────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("useItem")
    class UseItem {

        @Test
        @DisplayName("the row is REMOVED, not decremented — and before the effects run")
        void removesTheWholeRow() {
            when(store.findInventory(MATCH_ID, CHAR_ID)).thenReturn(List.of(row(1L, "row-1", 900L, 5)));
            when(store.findItemsById(STORY_ID)).thenReturn(Map.of(900L, item(900L, 3, 1)));

            service.useItem(MATCH, USER, "row-1", "en");

            InOrder order = inOrder(store, effectEngine);
            order.verify(store).deleteInventoryRow(MATCH_ID, 1L);
            order.verify(effectEngine).applyStandaloneEffects(eq(MATCH_ID), eq(CHAR_ID), any(), any(), eq("en"), eq(true));
        }

        @Test
        @DisplayName("effect codes are normalised, and the trait CSVs travel untouched")
        void mapsEffectsThroughTheCodec() {
            givenPotion();
            when(store.findItemEffectsByItemId(STORY_ID)).thenReturn(Map.of(900L, List.of(
                    effect(1L, "SADNESS", -2, null, null),
                    effect(2L, "LIFE", 3, "90001,90002", "90004"))));

            service.useItem(MATCH, USER, "row-1", "en");

            ArgumentCaptor<List<StandaloneEffect>> captor = ArgumentCaptor.forClass(List.class);
            verify(effectEngine).applyStandaloneEffects(anyLong(), anyLong(), captor.capture(), any(), any(), anyBoolean());
            List<StandaloneEffect> effects = captor.getValue();
            assertEquals("sad", effects.get(0).statistic());
            assertEquals(-2, effects.get(0).value());
            assertEquals("life", effects.get(1).statistic());
            assertEquals("90001,90002", effects.get(1).traitsToAdd());
            assertEquals("90004", effects.get(1).traitsToRemove());
            assertEquals("effect-2", effects.get(1).effectUuid());
        }

        @Test
        @DisplayName("an item with no effect row is still consumed")
        void itemWithoutEffects() {
            givenPotion();

            service.useItem(MATCH, USER, "row-1", "en");

            verify(store).deleteInventoryRow(MATCH_ID, 1L);
            verify(effectEngine).applyStandaloneEffects(anyLong(), anyLong(), eq(List.of()), any(), any(), eq(true));
        }

        @Test
        @DisplayName("the item's own card is what the response narrates with")
        void resolvesTheItemCard() {
            ItemEntity potion = item(900L, 3, 1);
            potion.setIdCard(77);
            when(store.findInventory(MATCH_ID, CHAR_ID)).thenReturn(List.of(row(1L, "row-1", 900L, 1)));
            when(store.findItemsById(STORY_ID)).thenReturn(Map.of(900L, potion));
            CardInfo card = new CardInfo("card-77", null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null);
            when(contentQueryPort.getCardByStoryIdAndCardId(STORY_ID, 77, "it")).thenReturn(card);

            service.useItem(MATCH, USER, "row-1", "it");

            verify(effectEngine).applyStandaloneEffects(anyLong(), anyLong(), any(), eq(card), eq("it"), eq(true));
        }

        @Test
        @DisplayName("a null language falls back to English when resolving the item card")
        void nullLanguageFallsBackToEnglish() {
            ItemEntity potion = item(900L, 3, 1);
            potion.setIdCard(77);
            when(store.findInventory(MATCH_ID, CHAR_ID)).thenReturn(List.of(row(1L, "row-1", 900L, 1)));
            when(store.findItemsById(STORY_ID)).thenReturn(Map.of(900L, potion));

            service.useItem(MATCH, USER, "row-1", null);

            verify(contentQueryPort).getCardByStoryIdAndCardId(STORY_ID, 77, "en");
        }

        @Test
        @DisplayName("an item without a card resolves none, and never asks the content port")
        void itemWithoutACard() {
            givenPotion();

            service.useItem(MATCH, USER, "row-1", "en");

            verifyNoInteractions(contentQueryPort);
            verify(effectEngine).applyStandaloneEffects(anyLong(), anyLong(), any(), isNull(), eq("en"), eq(true));
        }

        @Test
        @DisplayName("a SADNESS item effect trips the very same Step 30 edge state an event would")
        void edgeStateFlowsThrough() {
            givenPotion();
            EdgeStateOutcome overflow = new EdgeStateOutcome(
                    List.of("char-uuid"), List.of("char-uuid"), false, null, null, List.of(), List.of());
            when(effectEngine.applyStandaloneEffects(anyLong(), anyLong(), any(), any(), any(), anyBoolean()))
                    .thenReturn(result(List.of(), List.of(), overflow, true));

            EventExecutionResult r = service.useItem(MATCH, USER, "row-1", "en");

            assertTrue(r.comaTriggered());
            assertEquals(List.of("char-uuid"), r.edgeState().sadnessOverflowUuids());
            assertNull(r.eventUuid(), "an item usage owns no event");
        }

        @Test
        @DisplayName("every usage writes one log_item_usage row, with the applied effects")
        void writesTheUsageLog() {
            givenPotion();
            when(effectEngine.applyStandaloneEffects(anyLong(), anyLong(), any(), any(), any(), anyBoolean()))
                    .thenReturn(result(
                            List.of(new StatChange("char-uuid", "life", 4, 7, 3)),
                            List.of(new TraitChange("char-uuid", "trait-1", "ADD")),
                            EdgeStateOutcome.none(), false));

            service.useItem(MATCH, USER, "row-1", "en");

            ArgumentCaptor<String> json = ArgumentCaptor.forClass(String.class);
            verify(store).logItemUsage(eq(MATCH_ID), eq(CHAR_ID), eq(900L), json.capture());
            assertEquals("{\"statChanges\":[{\"characterUuid\":\"char-uuid\",\"statistic\":\"life\","
                            + "\"before\":4,\"after\":7,\"delta\":3}],"
                            + "\"traitChanges\":[{\"characterUuid\":\"char-uuid\",\"traitUuid\":\"trait-1\","
                            + "\"action\":\"ADD\"}],"
                            + "\"sadnessOverflow\":false,\"comaTriggered\":false}",
                    json.getValue());
        }
    }

    // ── drop-item ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("dropItem")
    class DropItem {

        @Test
        @DisplayName("a NON-consumable item is droppable — that is the point of carrying one")
        void nonConsumableIsDroppable() {
            when(store.findInventory(MATCH_ID, CHAR_ID)).thenReturn(List.of(row(1L, "row-1", 900L, 3)));
            when(store.findItemsById(STORY_ID)).thenReturn(Map.of(900L, item(900L, 2, 0)));

            DropItemResult r = service.dropItem(MATCH, USER, "row-1");

            assertEquals("row-1", r.itemInstanceUuid());
            assertEquals("item-900", r.itemUuid());
            assertEquals(3, r.amountDropped(), "the whole row goes, it is not decremented");
            verify(store).deleteInventoryRow(MATCH_ID, 1L);
        }

        @Test
        @DisplayName("a class-restricted item is droppable too: the gate is on use, not on discard")
        void classRestrictedIsDroppable() {
            ItemEntity mageOnly = item(900L, 2, 1);
            mageOnly.setIdClassPermitted((int) MAGE);
            when(store.findInventory(MATCH_ID, CHAR_ID)).thenReturn(List.of(row(1L, "row-1", 900L, 1)));
            when(store.findItemsById(STORY_ID)).thenReturn(Map.of(900L, mageOnly));

            assertDoesNotThrow(() -> service.dropItem(MATCH, USER, "row-1"));
        }

        @Test
        @DisplayName("a null amount counts as one")
        void nullAmountIsOne() {
            when(store.findInventory(MATCH_ID, CHAR_ID)).thenReturn(List.of(row(1L, "row-1", 900L, null)));
            when(store.findItemsById(STORY_ID)).thenReturn(Map.of(900L, item(900L, 2, 1)));

            assertEquals(1, service.dropItem(MATCH, USER, "row-1").amountDropped());
        }

        @Test
        @DisplayName("dropping a row whose story item is gone reports a null itemUuid")
        void danglingItemHasNoItemUuid() {
            when(store.findInventory(MATCH_ID, CHAR_ID)).thenReturn(List.of(row(1L, "row-1", 999L, 1)));
            when(store.findItemsById(STORY_ID)).thenReturn(Map.of());

            DropItemResult r = service.dropItem(MATCH, USER, "row-1");

            assertNull(r.itemUuid());
            assertEquals(1, r.amountDropped());
            verify(store).deleteInventoryRow(MATCH_ID, 1L);
        }

        @Test
        @DisplayName("the reported weight is the one AFTER the drop, not before it")
        void weightIsRecomputedAfterTheDeletion() {
            GamingInventoryItemsEntity dropped = row(1L, "row-1", 900L, 1);
            GamingInventoryItemsEntity kept = row(2L, "row-2", 901L, 1);
            // The store answers the pre-delete list first, then the post-delete one — the
            // service must ask again instead of reusing what it already had.
            when(store.findInventory(MATCH_ID, CHAR_ID))
                    .thenReturn(List.of(dropped, kept))
                    .thenReturn(List.of(kept));
            when(store.findItemsById(STORY_ID))
                    .thenReturn(Map.of(900L, item(900L, 3, 1), 901L, item(901L, 5, 1)));

            DropItemResult r = service.dropItem(MATCH, USER, "row-1");

            assertEquals(5, r.weight(), "the dropped item must not still be weighed");
            verify(store, times(2)).findInventory(MATCH_ID, CHAR_ID);
        }

        @Test
        @DisplayName("dropping never writes a usage log")
        void noUsageLog() {
            givenPotion();

            service.dropItem(MATCH, USER, "row-1");

            verify(store, never()).logItemUsage(anyLong(), anyLong(), anyLong(), anyString());
            verifyNoInteractions(effectEngine);
        }
    }

    // ── validation ──────────────────────────────────────────────────────────

    @Nested
    @DisplayName("validation")
    class Validation {

        private Code codeOf(Runnable r) {
            return assertThrows(InventoryException.class, r::run).getCode();
        }

        @Test
        void unknownUser() {
            when(userAccessPort.findByUuid("ghost")).thenReturn(Optional.empty());
            assertEquals(Code.MATCH_NOT_FOUND, codeOf(() -> service.listInventory(MATCH, "ghost", "en")));
        }

        @Test
        void missingUserUuid() {
            assertEquals(Code.MATCH_NOT_FOUND, codeOf(() -> service.listInventory(MATCH, null, "en")));
        }

        @Test
        void unknownMatch() {
            when(store.findMatchByUuid("nope")).thenReturn(Optional.empty());
            assertEquals(Code.MATCH_NOT_FOUND, codeOf(() -> service.listInventory("nope", USER, "en")));
        }

        @Test
        @DisplayName("a user with no character in the match is a not-found, not a leak")
        void callerHasNoCharacter() {
            when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID)).thenReturn(Optional.empty());
            assertEquals(Code.MATCH_NOT_FOUND, codeOf(() -> service.listInventory(MATCH, USER, "en")));
        }

        @Test
        void matchNotRunning() {
            when(store.findMatchByUuid(MATCH))
                    .thenReturn(Optional.of(new MatchInventoryView(MATCH_ID, MATCH, "PAUSED", STORY_ID)));
            givenPotion();
            assertEquals(Code.MATCH_NOT_RUNNING, codeOf(() -> service.useItem(MATCH, USER, "row-1", "en")));
            assertEquals(Code.MATCH_NOT_RUNNING, codeOf(() -> service.dropItem(MATCH, USER, "row-1")));
        }

        @Test
        @DisplayName("coma is checked before sleeping, as in the event availability check")
        void comaBeatsSleeping() {
            when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID))
                    .thenReturn(Optional.of(character(WARRIOR, true, true)));
            givenPotion();
            assertEquals(Code.COMA, codeOf(() -> service.useItem(MATCH, USER, "row-1", "en")));
        }

        @Test
        void sleeping() {
            when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID))
                    .thenReturn(Optional.of(character(WARRIOR, true, false)));
            givenPotion();
            assertEquals(Code.SLEEPING, codeOf(() -> service.useItem(MATCH, USER, "row-1", "en")));
        }

        @Test
        @DisplayName("another character's row is indistinguishable from one that does not exist")
        void anotherCharactersRowIsMasked() {
            // findInventory is only ever asked for the caller's own rows.
            when(store.findInventory(MATCH_ID, CHAR_ID)).thenReturn(List.of(row(1L, "mine", 900L, 1)));
            when(store.findItemsById(STORY_ID)).thenReturn(Map.of(900L, item(900L, 3, 1)));

            assertEquals(Code.ITEM_NOT_FOUND, codeOf(() -> service.useItem(MATCH, USER, "theirs", "en")));
            verify(store).findInventory(MATCH_ID, CHAR_ID);
            verify(store, never()).deleteInventoryRow(anyLong(), anyLong());
        }

        @Test
        void blankItemUuid() {
            givenPotion();
            assertEquals(Code.ITEM_NOT_FOUND, codeOf(() -> service.useItem(MATCH, USER, "  ", "en")));
            assertEquals(Code.ITEM_NOT_FOUND, codeOf(() -> service.useItem(MATCH, USER, null, "en")));
        }

        @Test
        @DisplayName("a row that names no item at all")
        void rowWithoutAnItemId() {
            when(store.findInventory(MATCH_ID, CHAR_ID)).thenReturn(List.of(row(1L, "row-1", null, 1)));
            when(store.findItemsById(STORY_ID)).thenReturn(Map.of());
            assertEquals(Code.ITEM_NOT_FOUND, codeOf(() -> service.useItem(MATCH, USER, "row-1", "en")));
        }

        @Test
        @DisplayName("a story item authored without an id cannot be keyed by anything downstream")
        void itemWithoutAnId() {
            ItemEntity idless = item(900L, 3, 1);
            idless.setId(null);
            java.util.Map<Long, ItemEntity> byId = new java.util.HashMap<>();
            byId.put(900L, idless);
            when(store.findInventory(MATCH_ID, CHAR_ID)).thenReturn(List.of(row(1L, "row-1", 900L, 1)));
            when(store.findItemsById(STORY_ID)).thenReturn(byId);

            assertEquals(Code.ITEM_NOT_FOUND, codeOf(() -> service.useItem(MATCH, USER, "row-1", "en")));
            verify(store, never()).deleteInventoryRow(anyLong(), anyLong());
        }

        @Test
        @DisplayName("an inventory row pointing at an item the story dropped")
        void danglingItemReference() {
            when(store.findInventory(MATCH_ID, CHAR_ID)).thenReturn(List.of(row(1L, "row-1", 999L, 1)));
            when(store.findItemsById(STORY_ID)).thenReturn(Map.of());
            assertEquals(Code.ITEM_NOT_FOUND, codeOf(() -> service.useItem(MATCH, USER, "row-1", "en")));
        }

        @Test
        @DisplayName("only a consumable item can be used")
        void nonConsumableRefused() {
            when(store.findInventory(MATCH_ID, CHAR_ID)).thenReturn(List.of(row(1L, "row-1", 900L, 1)));
            when(store.findItemsById(STORY_ID)).thenReturn(Map.of(900L, item(900L, 3, 0)));

            assertEquals(Code.ITEM_NOT_CONSUMABLE, codeOf(() -> service.useItem(MATCH, USER, "row-1", "en")));
            verify(store, never()).deleteInventoryRow(anyLong(), anyLong());
        }

        @Test
        void nullConsumableFlagRefused() {
            when(store.findInventory(MATCH_ID, CHAR_ID)).thenReturn(List.of(row(1L, "row-1", 900L, 1)));
            when(store.findItemsById(STORY_ID)).thenReturn(Map.of(900L, item(900L, 3, null)));
            assertEquals(Code.ITEM_NOT_CONSUMABLE, codeOf(() -> service.useItem(MATCH, USER, "row-1", "en")));
        }

        private void givenRestricted(Integer permitted, Integer prohibited) {
            ItemEntity restricted = item(900L, 3, 1);
            restricted.setIdClassPermitted(permitted);
            restricted.setIdClassProhibited(prohibited);
            when(store.findInventory(MATCH_ID, CHAR_ID)).thenReturn(List.of(row(1L, "row-1", 900L, 1)));
            when(store.findItemsById(STORY_ID)).thenReturn(Map.of(900L, restricted));
        }

        @Test
        void classNotPermitted() {
            givenRestricted((int) MAGE, null);
            assertEquals(Code.ITEM_CLASS_NOT_PERMITTED, codeOf(() -> service.useItem(MATCH, USER, "row-1", "en")));
        }

        @Test
        @DisplayName("a classless character cannot satisfy a permitted-class gate")
        void classNotPermittedForClasslessCharacter() {
            when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID))
                    .thenReturn(Optional.of(character(null, false, false)));
            givenRestricted((int) MAGE, null);
            assertEquals(Code.ITEM_CLASS_NOT_PERMITTED, codeOf(() -> service.useItem(MATCH, USER, "row-1", "en")));
        }

        @Test
        void classProhibited() {
            givenRestricted(null, (int) WARRIOR);
            assertEquals(Code.ITEM_CLASS_PROHIBITED, codeOf(() -> service.useItem(MATCH, USER, "row-1", "en")));
        }

        @Test
        @DisplayName("the matching permitted class passes")
        void permittedClassPasses() {
            givenRestricted((int) WARRIOR, null);
            assertDoesNotThrow(() -> service.useItem(MATCH, USER, "row-1", "en"));
        }

        @Test
        @DisplayName("0 means unset: the CRUD writes 0 where the importer writes null")
        void zeroMeansNoRestriction() {
            givenRestricted(0, 0);
            assertDoesNotThrow(() -> service.useItem(MATCH, USER, "row-1", "en"));
        }

        @Test
        @DisplayName("a classless character is untouched by a prohibited-class gate")
        void prohibitedIgnoredForClasslessCharacter() {
            when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID))
                    .thenReturn(Optional.of(character(null, false, false)));
            givenRestricted(null, (int) WARRIOR);
            assertDoesNotThrow(() -> service.useItem(MATCH, USER, "row-1", "en"));
        }
    }

    // ── effects_json ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("effects_json")
    class EffectsJson {

        @Test
        @DisplayName("quotes and backslashes are escaped, control characters dropped")
        void escaping() {
            String json = InventoryService.toEffectsJson(result(
                    List.of(new StatChange("a\"b\\c\nd", "life", 0, 1, 1)), List.of(),
                    EdgeStateOutcome.none(), false));

            assertTrue(json.contains("\"characterUuid\":\"a\\\"b\\\\cd\""), json);
        }

        @Test
        @DisplayName("a null uuid serialises as JSON null, not as the text \"null\"")
        void nullValue() {
            String json = InventoryService.toEffectsJson(result(
                    List.of(new StatChange(null, "life", 0, 1, 1)), List.of(),
                    EdgeStateOutcome.none(), false));

            assertTrue(json.contains("\"characterUuid\":null"), json);
        }

        @Test
        @DisplayName("several changes of a kind are comma-separated")
        void multipleChanges() {
            String json = InventoryService.toEffectsJson(result(
                    List.of(new StatChange("c", "life", 0, 1, 1), new StatChange("c", "sad", 5, 3, -2)),
                    List.of(new TraitChange("c", "t1", "ADD"), new TraitChange("c", "t2", "REMOVE")),
                    EdgeStateOutcome.none(), false));

            assertEquals("{\"statChanges\":["
                    + "{\"characterUuid\":\"c\",\"statistic\":\"life\",\"before\":0,\"after\":1,\"delta\":1},"
                    + "{\"characterUuid\":\"c\",\"statistic\":\"sad\",\"before\":5,\"after\":3,\"delta\":-2}],"
                    + "\"traitChanges\":["
                    + "{\"characterUuid\":\"c\",\"traitUuid\":\"t1\",\"action\":\"ADD\"},"
                    + "{\"characterUuid\":\"c\",\"traitUuid\":\"t2\",\"action\":\"REMOVE\"}],"
                    + "\"sadnessOverflow\":false,\"comaTriggered\":false}", json);
        }

        @Test
        void reportsTheEdgeState() {
            EdgeStateOutcome overflow = new EdgeStateOutcome(
                    List.of("char-uuid"), List.of(), false, null, null, List.of(), List.of());

            String json = InventoryService.toEffectsJson(result(List.of(), List.of(), overflow, true));

            assertTrue(json.contains("\"sadnessOverflow\":true"), json);
            assertTrue(json.contains("\"comaTriggered\":true"), json);
        }
    }
}
