package games.paths.adapters.rest.dto;

import games.paths.core.model.match.ItemInstanceInfo;
import games.paths.core.model.story.CardInfo;
import games.paths.core.port.match.WeatherStorePort.CurrentWeatherView;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link ItemInstanceResponse}, {@link PagedMatchesResponse} and
 * {@link WeatherResponse} — the projections added by Steps 27 / v0.28.1.
 */
class ItemPagedWeatherDtosTest {

    private static CardInfo card() {
        return new CardInfo("card-uuid", "weather", "http://img/storm.png", null, null,
                null, null, null, null, null, "Storm", "A storm", null, null, null);
    }

    // ── ItemInstanceResponse ─────────────────────────────────────────────────

    @Test
    void itemInstanceResponse_fromModel_mapsAllFields() {
        ItemInstanceInfo m = new ItemInstanceInfo();
        m.setUuid("inv-1");
        m.setItemUuid("item-1");
        m.setName("Rope");
        m.setWeight(3);
        m.setAmount(2);
        m.setState("ACTIVE");

        ItemInstanceResponse r = ItemInstanceResponse.fromModel(m);
        assertEquals("inv-1", r.getUuid());
        assertEquals("item-1", r.getItemUuid());
        assertEquals("Rope", r.getName());
        assertEquals(3, r.getWeight());
        assertEquals(2, r.getAmount());
        assertEquals("ACTIVE", r.getState());
    }

    @Test
    void itemInstanceResponse_fromModel_keepsNullOptionalFields() {
        ItemInstanceResponse r = ItemInstanceResponse.fromModel(new ItemInstanceInfo());
        assertNull(r.getUuid());
        assertNull(r.getName());
        assertNull(r.getWeight());
        assertNull(r.getAmount());
        assertNull(r.getState());
    }

    @Test
    void itemInstanceResponse_setters() {
        ItemInstanceResponse r = new ItemInstanceResponse();
        r.setUuid("u");
        r.setItemUuid("i");
        r.setName("Torch");
        r.setWeight(1);
        r.setAmount(5);
        r.setState("BROKEN");

        assertEquals("u", r.getUuid());
        assertEquals("i", r.getItemUuid());
        assertEquals("Torch", r.getName());
        assertEquals(1, r.getWeight());
        assertEquals(5, r.getAmount());
        assertEquals("BROKEN", r.getState());
    }

    // ── PagedMatchesResponse ─────────────────────────────────────────────────

    @Test
    void pagedMatchesResponse_constructorMapsFields() {
        MatchSummaryResponse item = new MatchSummaryResponse();
        item.setUuid("m1");

        PagedMatchesResponse r = new PagedMatchesResponse(List.of(item), "next-tok", 50);
        assertEquals(1, r.getItems().size());
        assertEquals("m1", r.getItems().get(0).getUuid());
        assertEquals("next-tok", r.getNextCursor());
        assertEquals(50, r.getLimit());
    }

    @Test
    void pagedMatchesResponse_lastPageHasNullCursor() {
        PagedMatchesResponse r = new PagedMatchesResponse(List.of(), null, 25);
        assertTrue(r.getItems().isEmpty());
        assertNull(r.getNextCursor());
        assertEquals(25, r.getLimit());
    }

    @Test
    void pagedMatchesResponse_setters() {
        PagedMatchesResponse r = new PagedMatchesResponse();
        r.setItems(List.of(new MatchSummaryResponse()));
        r.setNextCursor("cur");
        r.setLimit(10);

        assertEquals(1, r.getItems().size());
        assertEquals("cur", r.getNextCursor());
        assertEquals(10, r.getLimit());
    }

    // ── WeatherResponse ──────────────────────────────────────────────────────

    @Test
    void weatherResponse_fromModel_mapsViewAndCard() {
        CurrentWeatherView v = new CurrentWeatherView(9L, "w-9", 7L, 55, 123, -5, 1, 3, 4);

        WeatherResponse r = WeatherResponse.fromModel(v, card());
        assertEquals(9L, r.getIdWeather());
        assertEquals("w-9", r.getUuid());
        assertEquals(123, r.getIdTextName());
        assertEquals(55, r.getIdCard());
        assertEquals("Storm", r.getCard().title());
        assertEquals(-5, r.getDeltaEnergy());
        assertEquals(1, r.getCostMoveSafeLocation());
        assertEquals(3, r.getCostMoveNotSafeLocation());
        assertEquals(4, r.getCurrentClock());
    }

    @Test
    void weatherResponse_fromModel_allowsNullCard() {
        CurrentWeatherView v = new CurrentWeatherView(9L, "w-9", 7L, 55, 123, 0, 0, 0, 0);
        assertNull(WeatherResponse.fromModel(v, null).getCard());
    }

    @Test
    void weatherResponse_setters() {
        WeatherResponse r = new WeatherResponse();
        r.setIdWeather(2L);
        r.setUuid("w-2");
        r.setIdTextName(11);
        r.setIdCard(22);
        r.setCard(card());
        r.setDeltaEnergy(-1);
        r.setCostMoveSafeLocation(2);
        r.setCostMoveNotSafeLocation(6);
        r.setCurrentClock(8);

        assertEquals(2L, r.getIdWeather());
        assertEquals("w-2", r.getUuid());
        assertEquals(11, r.getIdTextName());
        assertEquals(22, r.getIdCard());
        assertEquals("card-uuid", r.getCard().uuid());
        assertEquals(-1, r.getDeltaEnergy());
        assertEquals(2, r.getCostMoveSafeLocation());
        assertEquals(6, r.getCostMoveNotSafeLocation());
        assertEquals(8, r.getCurrentClock());
    }
}
