package games.paths.adapters.rest.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import games.paths.core.model.story.CardInfo;
import games.paths.core.port.match.EventExecutionPort.AppliedEffect;
import games.paths.core.port.match.EventExecutionPort.ChoiceResolutionResult;
import games.paths.core.port.match.EventExecutionPort.EdgeStateOutcome;
import games.paths.core.port.match.EventExecutionPort.EventExecutionResult;
import games.paths.core.port.match.MovementPort.MovementResult;
import games.paths.core.port.match.TimeAdvancementPort.CounterZeroItem;
import games.paths.core.port.match.TimeAdvancementPort.TimeEndNews;
import games.paths.core.port.match.TimeAdvancementPort.TimeStartWeather;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** Step 40 - weather and counterZero[] on the answers of an action that ended the time early. */
@DisplayName("TimeStartWeatherResponse and the Step 40 answer blocks")
class TimeStartWeatherResponseTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    private static CardInfo card(String title) {
        return new CardInfo("c-" + title, "weather", null, null, null, null, null, null, null, null,
                title, null, null, null, null);
    }

    private static TimeEndNews news() {
        CounterZeroItem item = new CounterZeroItem("COUNTER_ZERO", 5L, card("Well"), card("Square"),
                List.of(new AppliedEffect("e", "eff", "food", 1, "ALL", null, List.of("c"), card("Bread"))),
                "evt-cz", 3, "FULL");
        return new TimeEndNews(3, List.of(item),
                new TimeStartWeather(2L, "w-rain", 30, card("Rain"), -1, 2, 4, true));
    }

    private static EventExecutionResult result(TimeEndNews news) {
        return new EventExecutionResult("m", "evt", "NORMAL", "APPLIED", null, List.of("evt"),
                0, 0, 0, 0, 1, 2, 3, 4, 3, false, news != null, false, false, false, false, false,
                false, false, true, List.of(), List.of(), List.of(), List.of(), List.of(), List.of(),
                List.of(), List.of(), EdgeStateOutcome.none(), List.of(), news);
    }

    @Test
    @DisplayName("execute-event: weather (with changed) and counterZero[] from a forced time-end")
    void executeEventWithNews() throws Exception {
        ExecuteEventResponse d = ExecuteEventResponse.fromModel(result(news()));

        TimeStartWeatherResponse w = d.getWeather();
        assertEquals(2L, w.getIdWeather());
        assertEquals("w-rain", w.getUuid());
        assertEquals("Rain", w.getCard().getTitle());
        assertEquals(-1, w.getDeltaEnergy());
        assertEquals(2, w.getCostMoveSafeLocation());
        assertEquals(4, w.getCostMoveNotSafeLocation());
        assertTrue(w.isChanged());
        assertEquals(1, d.getCounterZero().size());
        assertEquals("evt-cz", d.getCounterZero().get(0).getEventUuid());
        assertEquals("Bread", d.getCounterZero().get(0).getCardEffects().get(0).getCard().getTitle());
        JsonNode body = JSON.readTree(JSON.writeValueAsString(d));
        assertTrue(body.get("weather").get("changed").asBoolean());
    }

    @Test
    @DisplayName("execute-event without a time-end: weather null and counterZero [], both on the wire")
    void executeEventWithoutNews() throws Exception {
        ExecuteEventResponse d = ExecuteEventResponse.fromModel(result(null));

        assertNull(d.getWeather());
        assertTrue(d.getCounterZero().isEmpty());
        JsonNode body = JSON.readTree(JSON.writeValueAsString(d));
        assertTrue(body.has("weather"));
        assertTrue(body.get("weather").isNull());
        assertTrue(body.get("counterZero").isArray());
    }

    @Test
    @DisplayName("a time-end with no eligible weather answers weather null and keeps counterZero")
    void newsWithoutWeather() {
        TimeEndNews n = new TimeEndNews(3, news().counterZero(), null);
        ExecuteEventResponse d = ExecuteEventResponse.fromModel(result(n));
        assertNull(d.getWeather());
        assertEquals(1, d.getCounterZero().size());
    }

    @Test
    @DisplayName("select-choice copies weather and counterZero from the shared block")
    void selectChoiceCopies() {
        SelectChoiceResponse d = SelectChoiceResponse.fromModel(new ChoiceResolutionResult(
                result(news()), "ch", "evt", null, null, null, null, false));
        assertTrue(d.getWeather().isChanged());
        assertEquals(1, d.getCounterZero().size());
        d.setWeather(null);
        d.setCounterZero(List.of());
        assertNull(d.getWeather());
    }

    @Test
    @DisplayName("movement: timeEnded, weather and counterZero from the arrival that ended the time")
    void movementWithAndWithoutNews() {
        MovementStartResponse with = MovementStartResponse.fromModel(new MovementResult("m", "c", 1L,
                null, 2L, "l2", 1, 0, 0, 0, 5, 0, 0, 0, 3, List.of(), EdgeStateOutcome.none(), news()));
        assertTrue(with.isTimeEnded());
        assertEquals("w-rain", with.getWeather().getUuid());
        assertEquals(1, with.getCounterZero().size());

        MovementStartResponse without = MovementStartResponse.fromModel(new MovementResult("m", "c", 1L,
                null, 2L, "l2", 1, 0, 0, 0, 5, 0, 0, 0, 2, List.of()));
        assertFalse(without.isTimeEnded());
        assertNull(new MovementResult("m", "c", 1L, null, 2L, "l2", 1, 0, 0, 0, 5, 0, 0, 0, 2,
                List.of(), EdgeStateOutcome.none()).timeEnd());
        assertNull(without.getWeather());
        assertTrue(without.getCounterZero().isEmpty());
    }

    @Test
    @DisplayName("null in, null out; a null counterZero list maps to an empty one")
    void nullSafety() {
        assertNull(TimeStartWeatherResponse.fromModel(null));
        assertTrue(TimeStartWeatherResponse.counterZeroOf(null).isEmpty());
        assertTrue(SleepActionResponse.CounterZeroItem.fromModels(null).isEmpty());
        CounterZeroItem bare = new CounterZeroItem("RANDOM_EVENT", null, null, null, null, "e", 1, "FULL");
        assertTrue(SleepActionResponse.CounterZeroItem.fromModels(List.of(bare)).get(0)
                .getCardEffects().isEmpty());
    }
}
