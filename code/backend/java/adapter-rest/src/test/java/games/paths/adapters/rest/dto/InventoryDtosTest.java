package games.paths.adapters.rest.dto;

import games.paths.core.model.match.ItemInstanceInfo;
import games.paths.core.model.story.CardInfo;
import games.paths.core.port.match.InventoryPort.DropItemResult;
import games.paths.core.port.match.InventoryPort.InventoryView;
import games.paths.core.port.match.InventoryPort.ResourcesView;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

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

        assertEquals("u", r.getUuid());
        assertEquals("iu", r.getItemUuid());
        assertEquals("n", r.getName());
        assertEquals(1, r.getWeight());
        assertEquals(2, r.getAmount());
        assertEquals("s", r.getState());
        assertEquals(9, r.getIdCard());
        assertNotNull(r.getCard());
        assertEquals(Boolean.FALSE, r.getIsConsumabile());
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
