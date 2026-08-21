package games.paths.core.service.match;

import games.paths.core.entity.match.GamingInventoryItemsEntity;
import games.paths.core.entity.story.ItemEffectEntity;
import games.paths.core.entity.story.ItemEntity;
import games.paths.core.entity.story.TextEntity;
import games.paths.core.model.match.ItemEffectPreview;
import games.paths.core.model.match.ItemInstanceInfo;
import games.paths.core.model.story.CardInfo;
import games.paths.core.port.story.ContentQueryPort;
import games.paths.core.port.story.StoryReadPort;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link ItemInstanceMapper} (Step 34) — the mapper the match /info
 * endpoint and the inventory endpoint share, so that their items[] cannot drift.
 */
@DisplayName("ItemInstanceMapper (Step 34)")
class ItemInstanceMapperTest {

    private static final long STORY = 9001L;

    private StoryReadPort storyReadPort;
    private ContentQueryPort contentQueryPort;

    @BeforeEach
    void setUp() {
        storyReadPort = mock(StoryReadPort.class);
        contentQueryPort = mock(ContentQueryPort.class);
    }

    private static ItemEntity storyItem(long id, Integer weight, Integer consumable, Integer idCard) {
        ItemEntity i = new ItemEntity();
        i.setId(id);
        i.setUuid("item-" + id);
        i.setWeight(weight);
        i.setIsConsumabile(consumable);
        i.setIdCard(idCard);
        i.setIdTextName(400);
        return i;
    }

    private static GamingInventoryItemsEntity row(String uuid, Long idItem, Integer amount) {
        GamingInventoryItemsEntity r = new GamingInventoryItemsEntity();
        r.setUuid(uuid);
        r.setIdItem(idItem);
        r.setAmount(amount);
        r.setState("ACTIVE");
        return r;
    }

    private static CardInfo card(String uuid) {
        return new CardInfo(uuid, null, null, null, "fas fa-box", null, null,
                null, null, null, "A box", null, null, null, null);
    }

    private List<ItemInstanceInfo> build(List<GamingInventoryItemsEntity> rows,
                                         Map<Long, ItemEntity> itemById, String lang) {
        return ItemInstanceMapper.build(rows, itemById, storyReadPort, contentQueryPort,
                STORY, lang, new HashMap<>());
    }

    @Nested
    @DisplayName("row mapping")
    class RowMapping {

        @Test
        @DisplayName("a resolved item carries weight, consumability, idCard and the card object")
        void mapsResolvedItem() {
            when(contentQueryPort.getCardByStoryIdAndCardId(STORY, 77, "en")).thenReturn(card("card-77"));

            List<ItemInstanceInfo> items = build(List.of(row("row-1", 900L, 2)),
                    Map.of(900L, storyItem(900L, 3, 1, 77)), "en");

            ItemInstanceInfo i = items.get(0);
            assertEquals("row-1", i.getUuid());
            assertEquals("item-900", i.getItemUuid());
            assertEquals(3, i.getWeight());
            assertEquals(2, i.getAmount());
            assertEquals("ACTIVE", i.getState());
            assertEquals(77, i.getIdCard());
            assertEquals("card-77", i.getCard().uuid());
            assertEquals(Boolean.TRUE, i.getIsConsumabile());
        }

        @Test
        @DisplayName("is_consumabile of 0 or null reads as 'carried only'")
        void nonConsumable() {
            List<ItemInstanceInfo> items = build(
                    List.of(row("a", 900L, 1), row("b", 901L, 1)),
                    Map.of(900L, storyItem(900L, 1, 0, null),
                           901L, storyItem(901L, 1, null, null)), null);

            assertEquals(Boolean.FALSE, items.get(0).getIsConsumabile());
            assertEquals(Boolean.FALSE, items.get(1).getIsConsumabile());
        }

        @Test
        @DisplayName("an item the story does not define weighs nothing and resolves nothing")
        void unknownItem() {
            List<ItemInstanceInfo> items = build(List.of(row("row-1", 999L, 4)), Map.of(), "en");

            ItemInstanceInfo i = items.get(0);
            assertEquals(0, i.getWeight());
            assertNull(i.getItemUuid());
            assertNull(i.getCard());
            assertNull(i.getIsConsumabile());
        }

        @Test
        void nullInventoryIsAnEmptyList() {
            assertTrue(build(null, Map.of(), "en").isEmpty());
        }

        @Test
        @DisplayName("a null item map resolves nothing, rather than throwing")
        void nullItemMap() {
            List<ItemInstanceInfo> items = ItemInstanceMapper.build(
                    List.of(row("row-1", 900L, 1)), null, storyReadPort, contentQueryPort,
                    STORY, "en", new HashMap<>());

            assertEquals(0, items.get(0).getWeight());
            assertNull(items.get(0).getItemUuid());
        }

        @Test
        @DisplayName("without a story read port the name is simply not resolved")
        void noStoryReadPort() {
            List<ItemInstanceInfo> items = ItemInstanceMapper.build(
                    List.of(row("row-1", 900L, 1)), Map.of(900L, storyItem(900L, 3, 1, null)),
                    null, contentQueryPort, STORY, "en", new HashMap<>());

            assertEquals(3, items.get(0).getWeight());
            assertNull(items.get(0).getName());
        }

        @Test
        @DisplayName("a storyless match resolves neither name nor card")
        void nullStoryId() {
            List<ItemInstanceInfo> items = ItemInstanceMapper.build(
                    List.of(row("row-1", 900L, 1)), Map.of(900L, storyItem(900L, 3, 1, 77)),
                    storyReadPort, contentQueryPort, null, "en", new HashMap<>());

            assertEquals(77, items.get(0).getIdCard());
            assertNull(items.get(0).getCard());
            assertNull(items.get(0).getName());
            verifyNoInteractions(contentQueryPort, storyReadPort);
        }

        @Test
        @DisplayName("an item with no name text resolves no name")
        void itemWithoutANameText() {
            ItemEntity nameless = storyItem(900L, 3, 1, null);
            nameless.setIdTextName(null);

            List<ItemInstanceInfo> items = build(List.of(row("row-1", 900L, 1)),
                    Map.of(900L, nameless), "en");

            assertNull(items.get(0).getName());
            verifyNoInteractions(storyReadPort);
        }

        @Test
        @DisplayName("a null id_item cannot resolve an item")
        void nullIdItem() {
            assertEquals(0, build(List.of(row("row-1", null, 1)), Map.of(), "en").get(0).getWeight());
        }
    }

    @Nested
    @DisplayName("localisation")
    class Localisation {

        @Test
        @DisplayName("the requested language reaches both the name and the card")
        void requestedLanguageIsUsed() {
            TextEntity t = new TextEntity();
            t.setShortText("Pozione");
            when(storyReadPort.findTextByStoryIdTextAndLang(STORY, 400, "it")).thenReturn(Optional.of(t));

            List<ItemInstanceInfo> items = build(List.of(row("row-1", 900L, 1)),
                    Map.of(900L, storyItem(900L, 1, 1, 77)), "it");

            assertEquals("Pozione", items.get(0).getName());
            verify(contentQueryPort).getCardByStoryIdAndCardId(STORY, 77, "it");
        }

        @Test
        @DisplayName("a null or blank language falls back to English")
        void blankLanguageFallsBackToEnglish() {
            build(List.of(row("row-1", 900L, 1)), Map.of(900L, storyItem(900L, 1, 1, 77)), "  ");

            verify(contentQueryPort).getCardByStoryIdAndCardId(STORY, 77, "en");
            verify(storyReadPort).findTextByStoryIdTextAndLang(STORY, 400, "en");
        }
    }

    @Nested
    @DisplayName("card resolution")
    class CardResolution {

        @Test
        @DisplayName("items sharing a card cost a single lookup")
        void cardCacheIsShared() {
            when(contentQueryPort.getCardByStoryIdAndCardId(STORY, 77, "en")).thenReturn(card("card-77"));

            List<ItemInstanceInfo> items = build(
                    List.of(row("a", 900L, 1), row("b", 901L, 1)),
                    Map.of(900L, storyItem(900L, 1, 1, 77), 901L, storyItem(901L, 1, 1, 77)), "en");

            assertEquals("card-77", items.get(0).getCard().uuid());
            assertEquals("card-77", items.get(1).getCard().uuid());
            verify(contentQueryPort, times(1)).getCardByStoryIdAndCardId(STORY, 77, "en");
        }

        @Test
        @DisplayName("without a content port the id is still reported, the object is not")
        void noContentPortLeavesTheCardNull() {
            List<ItemInstanceInfo> items = ItemInstanceMapper.build(
                    List.of(row("row-1", 900L, 1)), Map.of(900L, storyItem(900L, 1, 1, 77)),
                    storyReadPort, null, STORY, "en", null);

            assertEquals(77, items.get(0).getIdCard());
            assertNull(items.get(0).getCard());
        }

        @Test
        @DisplayName("an item without a card resolves nothing")
        void noIdCard() {
            List<ItemInstanceInfo> items = build(List.of(row("row-1", 900L, 1)),
                    Map.of(900L, storyItem(900L, 1, 1, null)), "en");

            assertNull(items.get(0).getIdCard());
            assertNull(items.get(0).getCard());
            verifyNoInteractions(contentQueryPort);
        }
    }

    private static ItemEffectEntity effect(long id, Long idItem, String code, Integer value) {
        ItemEffectEntity e = new ItemEffectEntity();
        e.setId(id);
        e.setIdItem(idItem == null ? null : idItem.intValue());
        e.setEffectCode(code);
        e.setEffectValue(value);
        return e;
    }

    @Nested
    @DisplayName("effect preview (Step 35)")
    class EffectPreview {

        private List<ItemInstanceInfo> buildWith(List<ItemEffectEntity> effects) {
            return ItemInstanceMapper.build(
                    List.of(row("a", 900L, 1)),
                    Map.of(900L, storyItem(900L, 3, 1, null)),
                    storyReadPort, contentQueryPort, STORY, "en", new HashMap<>(),
                    ItemInstanceMapper.groupEffectsByItem(effects));
        }

        @Test
        @DisplayName("reports statistic and value, normalised, in id order")
        void reportsEffects() {
            List<ItemEffectPreview> effects = buildWith(List.of(
                    effect(2L, 900L, "SADNESS", -1),
                    effect(1L, 900L, "LIFE", 3))).get(0).getEffects();

            assertEquals(2, effects.size());
            // id order, not insertion order: the promise lists them as the usage applies them.
            assertEquals("life", effects.get(0).getStatistic());
            assertEquals(3, effects.get(0).getValue());
            // The one documented alias reaches the client already translated.
            assertEquals("sad", effects.get(1).getStatistic());
            assertEquals(-1, effects.get(1).getValue());
        }

        @Test
        @DisplayName("drops a code the engine would drop, and reads a null value as 0")
        void dropsUnknownCodes() {
            List<ItemEffectPreview> effects = buildWith(List.of(
                    effect(1L, 900L, "WISDOM", 5),
                    effect(2L, 900L, "energy", null))).get(0).getEffects();

            assertEquals(1, effects.size());
            assertEquals("energy", effects.get(0).getStatistic());
            assertEquals(0, effects.get(0).getValue());
        }

        @Test
        @DisplayName("v0.35.0 — flag_show_effects = 0 keeps the promise secret")
        void secretItemPromisesNothing() {
            ItemEntity secret = storyItem(900L, 3, 1, null);
            secret.setFlagShowEffects(0);
            List<ItemInstanceInfo> items = ItemInstanceMapper.build(
                    List.of(row("a", 900L, 1)), Map.of(900L, secret),
                    storyReadPort, contentQueryPort, STORY, "en", new HashMap<>(),
                    ItemInstanceMapper.groupEffectsByItem(List.of(effect(1L, 900L, "LIFE", 3))));

            // Empty, never null: the board reads effects[] without a null check, and an
            // empty promise must not read as "this item does nothing".
            assertNotNull(items.get(0).getEffects());
            assertTrue(items.get(0).getEffects().isEmpty());
        }

        @Test
        @DisplayName("an unset flag reads as shown — a pre-v0.35.0 story keeps its promise")
        void nullFlagStillPromises() {
            ItemEntity legacy = storyItem(900L, 3, 1, null);
            assertNull(legacy.getFlagShowEffects());
            List<ItemInstanceInfo> items = ItemInstanceMapper.build(
                    List.of(row("a", 900L, 1)), Map.of(900L, legacy),
                    storyReadPort, contentQueryPort, STORY, "en", new HashMap<>(),
                    ItemInstanceMapper.groupEffectsByItem(List.of(effect(1L, 900L, "LIFE", 3))));

            assertEquals(1, items.get(0).getEffects().size());
        }

        @Test
        @DisplayName("another item's rows are not this item's promise")
        void ignoresOtherItems() {
            assertTrue(buildWith(List.of(effect(1L, 901L, "LIFE", 3))).get(0).getEffects().isEmpty());
        }

        @Test
        @DisplayName("an effect row with no item is skipped rather than grouped under null")
        void skipsOrphanRows() {
            assertTrue(ItemInstanceMapper.groupEffectsByItem(
                    List.of(effect(1L, null, "LIFE", 3))).isEmpty());
            assertTrue(ItemInstanceMapper.groupEffectsByItem(null).isEmpty());
        }

        @Test
        @DisplayName("the pre-Step-35 overload leaves the promise empty, never null")
        void legacyOverloadStaysEmpty() {
            List<ItemInstanceInfo> items = build(List.of(row("a", 900L, 1)),
                    Map.of(900L, storyItem(900L, 3, 1, null)), "en");
            assertNotNull(items.get(0).getEffects());
            assertTrue(items.get(0).getEffects().isEmpty());
        }
    }

    @Nested
    @DisplayName("carried weight")
    class CarriedWeight {

        @Test
        @DisplayName("Sigma (weight x amount)")
        void sums() {
            List<ItemInstanceInfo> items = build(
                    List.of(row("a", 900L, 2), row("b", 901L, 1)),
                    Map.of(900L, storyItem(900L, 3, 1, null), 901L, storyItem(901L, 5, 1, null)), "en");

            assertEquals(11, ItemInstanceMapper.totalWeight(items));
        }

        @Test
        @DisplayName("a null weight is 0 and a null amount is 1 — the movement gate agrees")
        void nullDefaults() {
            assertEquals(0, ItemInstanceMapper.unitWeight(null));
            assertEquals(7, ItemInstanceMapper.unitWeight(7));
            assertEquals(1, ItemInstanceMapper.unitAmount(null));
            assertEquals(4, ItemInstanceMapper.unitAmount(4));
            assertEquals(0, ItemInstanceMapper.totalWeight(null));
            assertEquals(0, ItemInstanceMapper.totalWeight(List.of()));
        }
    }
}
