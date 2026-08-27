package games.paths.adapters.rest.dto;

import games.paths.core.model.match.ItemEffectPreview;
import games.paths.core.model.match.ItemInstanceInfo;
import games.paths.core.model.story.CardInfo;
import games.paths.core.port.match.InventoryPort.DropItemResult;
import games.paths.core.port.match.InventoryPort.InventoryView;
import games.paths.core.port.match.InventoryPort.ResourcesView;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** Projections of the Step 34 / 35 inventory and resources payloads. */
@DisplayName("Inventory DTOs (Steps 34 & 35)")
class InventoryDtosTest {

    private static CardInfo card() {
        return new CardInfo("card-77", "item", null, null, "fas fa-box",
                null, null, null, null, null, "A potion", "desc", null, null, null);
    }

    private static ItemInstanceInfo itemInfo(CardInfo c) {
        ItemInstanceInfo i = new ItemInstanceInfo();
        i.setUuid("row-1");
        i.setItemUuid("item-900");
        i.setName("Potion");
        i.setWeight(3);
        i.setAmount(2);
        i.setState("ACTIVE");
        i.setIdCard(c == null ? null : 77);
        i.setCard(c);
        i.setIsConsumabile(Boolean.TRUE);
        return i;
    }

    @Test
    @DisplayName("an item carries both its card id and the resolved card object")
    void itemInstanceResponse_projectsTheCard() {
        ItemInstanceResponse r = ItemInstanceResponse.fromModel(itemInfo(card()));

        assertEquals("row-1", r.getUuid());
        assertEquals("item-900", r.getItemUuid());
        assertEquals("Potion", r.getName());
        assertEquals(3, r.getWeight());
        assertEquals(2, r.getAmount());
        assertEquals("ACTIVE", r.getState());
        assertEquals(77, r.getIdCard());
        assertEquals("card-77", r.getCard().getUuid());
        assertEquals(Boolean.TRUE, r.getIsConsumabile());
    }

    @Test
    @DisplayName("an item without a card projects nulls, not an empty object")
    void itemInstanceResponse_withoutACard() {
        ItemInstanceResponse r = ItemInstanceResponse.fromModel(itemInfo(null));

        assertNull(r.getIdCard());
        assertNull(r.getCard());
    }

    @Test
    @DisplayName("Step 35 — the effect promise is projected row by row")
    void itemInstanceResponse_projectsTheEffectPromise() {
        ItemInstanceInfo info = itemInfo(card());
        info.setEffects(List.of(new ItemEffectPreview("life", 3),
                                new ItemEffectPreview("sad", -1)));

        ItemInstanceResponse r = ItemInstanceResponse.fromModel(info);

        assertEquals(2, r.getEffects().size());
        assertEquals("life", r.getEffects().get(0).getStatistic());
        assertEquals(3, r.getEffects().get(0).getValue());
        assertEquals(-1, r.getEffects().get(1).getValue());
    }

    @Test
    @DisplayName("Step 35 — an item with no effect projects an empty array, never null")
    void itemInstanceResponse_emptyEffectPromise() {
        assertNotNull(ItemInstanceResponse.fromModel(itemInfo(null)).getEffects());
        assertTrue(ItemInstanceResponse.fromModel(itemInfo(null)).getEffects().isEmpty());
        // A null list in, an empty list out — and a null row is skipped, not projected.
        assertTrue(ItemEffectPreviewResponse.fromModels(null).isEmpty());
        List<ItemEffectPreview> withHole = new ArrayList<>();
        withHole.add(null);
        withHole.add(new ItemEffectPreview("energy", -2));
        assertEquals(1, ItemEffectPreviewResponse.fromModels(withHole).size());
    }

    @Test
    void itemEffectPreviewResponse_setters() {
        ItemEffectPreviewResponse r = new ItemEffectPreviewResponse();
        r.setStatistic("coin");
        r.setValue(5);

        assertEquals("coin", r.getStatistic());
        assertEquals(5, r.getValue());

        ItemEffectPreview m = new ItemEffectPreview();
        m.setStatistic("magic");
        m.setValue(1);
        assertEquals("magic", ItemEffectPreviewResponse.fromModel(m).getStatistic());
    }

    @Test
    @DisplayName("v0.35.1 — the authored quantities are projected as they are")
    void itemInstanceResponse_projectsTheQuantities() {
        ItemInstanceInfo info = itemInfo(card());
        info.setMaxPerCharacter(3);
        info.setAmountDrop(2);
        info.setAmountUse(2);

        ItemInstanceResponse r = ItemInstanceResponse.fromModel(info);

        assertEquals(3, r.getMaxPerCharacter());
        assertEquals(2, r.getAmountDrop());
        assertEquals(2, r.getAmountUse());
        // Unset stays unset: the board reads null as "no cap" / "one unit" itself.
        ItemInstanceResponse bare = ItemInstanceResponse.fromModel(itemInfo(null));
        assertNull(bare.getMaxPerCharacter());
        assertNull(bare.getAmountDrop());
        assertNull(bare.getAmountUse());
    }

    @Test
    void itemInstanceResponse_setters() {
        ItemInstanceResponse r = new ItemInstanceResponse();
        r.setUuid("u");
        r.setItemUuid("iu");
        r.setName("n");
        r.setWeight(1);
        r.setAmount(2);
        r.setState("s");
        r.setIdCard(9);
        r.setCard(CardInfoResponse.fromModel(card()));
        r.setIsConsumabile(Boolean.FALSE);
        r.setEffects(List.of(ItemEffectPreviewResponse.fromModel(new ItemEffectPreview("exp", 5))));
        r.setMaxPerCharacter(9);
        r.setAmountDrop(8);
        r.setAmountUse(7);

        assertEquals("u", r.getUuid());
        assertEquals("iu", r.getItemUuid());
        assertEquals("n", r.getName());
        assertEquals(1, r.getWeight());
        assertEquals(2, r.getAmount());
        assertEquals("s", r.getState());
        assertEquals(9, r.getIdCard());
        assertNotNull(r.getCard());
        assertEquals(Boolean.FALSE, r.getIsConsumabile());
        assertEquals("exp", r.getEffects().get(0).getStatistic());
        assertEquals(9, r.getMaxPerCharacter());
        assertEquals(8, r.getAmountDrop());
        assertEquals(7, r.getAmountUse());
    }

    @Test
    void inventoryResponse_projectsEveryItem() {
        InventoryResponse r = InventoryResponse.fromModel(
                new InventoryView("m1", "char-1", List.of(itemInfo(card())), 6, 30));

        assertEquals("m1", r.getMatchUuid());
        assertEquals("char-1", r.getCharacterUuid());
        assertEquals(1, r.getItems().size());
        assertEquals(6, r.getWeight());
        assertEquals(30, r.getWeightMax());
    }

    @Test
    @DisplayName("an empty inventory projects an empty array, never null")
    void inventoryResponse_empty() {
        InventoryResponse r = InventoryResponse.fromModel(
                new InventoryView("m1", "char-1", List.of(), 0, 30));

        assertNotNull(r.getItems());
        assertTrue(r.getItems().isEmpty());
    }

    @Test
    void inventoryResponse_setters() {
        InventoryResponse r = new InventoryResponse();
        r.setMatchUuid("m");
        r.setCharacterUuid("c");
        r.setItems(List.of(ItemInstanceResponse.fromModel(itemInfo(null))));
        r.setWeight(2);
        r.setWeightMax(9);

        assertEquals("m", r.getMatchUuid());
        assertEquals("c", r.getCharacterUuid());
        assertEquals(1, r.getItems().size());
        assertEquals(2, r.getWeight());
        assertEquals(9, r.getWeightMax());
    }

    @Test
    @DisplayName("dropping always recommends a refresh: weight and inventory both changed")
    void dropItemResponse() {
        DropItemResponse r = DropItemResponse.fromModel(
                new DropItemResult("m1", "char-1", "row-1", "item-900", 3, 0, 30));

        assertEquals("m1", r.getMatchUuid());
        assertEquals("char-1", r.getCharacterUuid());
        assertEquals("row-1", r.getItemInstanceUuid());
        assertEquals("item-900", r.getItemUuid());
        assertEquals(3, r.getAmountDropped());
        assertEquals(0, r.getWeight());
        assertEquals(30, r.getWeightMax());
        assertTrue(r.isRefreshRecommended());
    }

    @Test
    void dropItemResponse_setters() {
        DropItemResponse r = new DropItemResponse();
        r.setMatchUuid("m");
        r.setCharacterUuid("c");
        r.setItemInstanceUuid("row");
        r.setItemUuid("item");
        r.setAmountDropped(1);
        r.setWeight(2);
        r.setWeightMax(3);
        r.setRefreshRecommended(false);

        assertEquals("m", r.getMatchUuid());
        assertEquals("c", r.getCharacterUuid());
        assertEquals("row", r.getItemInstanceUuid());
        assertEquals("item", r.getItemUuid());
        assertEquals(1, r.getAmountDropped());
        assertEquals(2, r.getWeight());
        assertEquals(3, r.getWeightMax());
        assertFalse(r.isRefreshRecommended());
    }

    @Test
    void resourcesResponse() {
        ResourcesResponse r = ResourcesResponse.fromModel(
                new ResourcesView("m1", "char-1", 4, 2, 9, 6, 30));

        assertEquals("m1", r.getMatchUuid());
        assertEquals("char-1", r.getCharacterUuid());
        assertEquals(4, r.getFood());
        assertEquals(2, r.getMagic());
        assertEquals(9, r.getCoin());
        assertEquals(6, r.getWeight());
        assertEquals(30, r.getWeightMax());
    }

    @Test
    void resourcesResponse_setters() {
        ResourcesResponse r = new ResourcesResponse();
        r.setMatchUuid("m");
        r.setCharacterUuid("c");
        r.setFood(1);
        r.setMagic(2);
        r.setCoin(3);
        r.setWeight(4);
        r.setWeightMax(5);

        assertEquals("m", r.getMatchUuid());
        assertEquals("c", r.getCharacterUuid());
        assertEquals(1, r.getFood());
        assertEquals(2, r.getMagic());
        assertEquals(3, r.getCoin());
        assertEquals(4, r.getWeight());
        assertEquals(5, r.getWeightMax());
    }

    @Test
    @DisplayName("the request bodies name the inventory ROW, not the story item")
    void requestBodies() {
        UseItemRequest use = new UseItemRequest();
        use.setItemInstanceUuid("row-1");
        assertEquals("row-1", use.getItemInstanceUuid());

        DropItemRequest drop = new DropItemRequest();
        drop.setItemInstanceUuid("row-2");
        assertEquals("row-2", drop.getItemInstanceUuid());
    }
}
