package games.paths.core.service.match;

import games.paths.core.model.match.MatchStatuses;
import games.paths.core.port.event.DomainEventPublisher;
import games.paths.core.port.match.EventExecutionPort;
import games.paths.core.port.match.TimeAdvancementPort;
import games.paths.core.port.match.TurnCycleStorePort;
import games.paths.core.port.match.TurnCycleStorePort.CharacterTurnView;
import games.paths.core.port.match.TurnCycleStorePort.MatchView;
import games.paths.core.port.match.UserAccessPort;
import games.paths.core.port.match.WeatherStorePort;
import games.paths.core.port.match.WeatherStorePort.CurrentWeatherView;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Step 40 - the weather view a forced time-end answers with. */
@DisplayName("TimeAdvancementService - Step 40 time-start weather")
@SuppressWarnings("unchecked")
class TimeAdvancementServiceWeatherTest {

    private static final String MATCH = "match-uuid";
    private static final long MATCH_ID = 1L;
    private static final long CHAR_ID = 10L;

    private TurnCycleStorePort store;
    private WeatherSelectionService weather;
    private TimeAdvancementService service;

    @BeforeEach
    void setUp() {
        store = mock(TurnCycleStorePort.class);
        weather = mock(WeatherSelectionService.class);
        TimeStartRecoveryService recovery = mock(TimeStartRecoveryService.class);
        when(recovery.applyAtTimeStart(anyLong())).thenReturn(TimeStartRecoveryService.TimeStartOutcome.none());
        when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(
                new MatchView(MATCH_ID, MATCH, MatchStatuses.RUNNING, 3, 7L, CHAR_ID)));
        when(store.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of(
                new CharacterTurnView(CHAR_ID, "c", 7L, 5, 5, 5, 100, 50, true)));
        when(store.incrementMatchClock(MATCH_ID)).thenReturn(4);
        service = new TimeAdvancementService(store, mock(UserAccessPort.class),
                mock(DomainEventPublisher.class), recovery, weather);
    }

    private static CurrentWeatherView view(long id) {
        return new CurrentWeatherView(id, "w-" + id, 5L, 30 + (int) id, 40, -2, 3, 4, 4);
    }

    @Test
    @DisplayName("a switched weather is answered with changed=true and its own fields")
    void changedWeather() {
        when(weather.currentWeather(MATCH_ID)).thenReturn(Optional.of(view(1)), Optional.of(view(2)));

        TimeAdvancementService.TimeEndOutcome out = service.forceTimeEnd(MATCH, CHAR_ID);

        TimeAdvancementPort.TimeStartWeather w = out.weather();
        assertNotNull(w);
        assertTrue(w.changed());
        assertEquals(2L, w.idWeather());
        assertEquals("w-2", w.uuid());
        assertEquals(32, w.idCard());
        assertEquals(-2, w.deltaEnergy());
        assertEquals(3, w.costMoveSafeLocation());
        assertEquals(4, w.costMoveNotSafeLocation());
        assertNull(w.card());
        verify(weather).applyAtTimeStart(MATCH_ID);
    }

    @Test
    @DisplayName("the same weather rolled again is changed=false")
    void sameWeather() {
        when(weather.currentWeather(MATCH_ID)).thenReturn(Optional.of(view(1)), Optional.of(view(1)));

        assertFalse(service.forceTimeEnd(MATCH, CHAR_ID).weather().changed());
    }

    @Test
    @DisplayName("no eligible weather after the time-start answers null")
    void noWeather() {
        when(weather.currentWeather(MATCH_ID)).thenReturn(Optional.of(view(1)), Optional.empty());

        assertNull(service.forceTimeEnd(MATCH, CHAR_ID).weather());
    }

    @Test
    @DisplayName("without a weather engine the view is null")
    void noEngine() {
        TimeStartRecoveryService recovery = mock(TimeStartRecoveryService.class);
        when(recovery.applyAtTimeStart(anyLong())).thenReturn(TimeStartRecoveryService.TimeStartOutcome.none());
        TimeAdvancementService bare = new TimeAdvancementService(store, mock(UserAccessPort.class),
                mock(DomainEventPublisher.class), recovery);

        assertNull(bare.forceTimeEnd(MATCH).weather());
    }

    @Test
    @DisplayName("weatherView: a first weather ever counts as changed")
    void firstWeatherIsChanged() {
        assertTrue(TimeAdvancementService.weatherView(null, view(3)).changed());
        assertNull(TimeAdvancementService.weatherView(view(3), null));
    }

    @Test
    @DisplayName("withCard keeps every field and sets the card; the legacy outcome has no weather")
    void withCardAndLegacyOutcome() {
        TimeAdvancementPort.TimeStartWeather w = TimeAdvancementService.weatherView(view(1), view(2));
        games.paths.core.model.story.CardInfo card = new games.paths.core.model.story.CardInfo("c", "weather",
                null, null, null, null, null, null, null, null, "Rain", null, null, null, null);
        TimeAdvancementPort.TimeStartWeather carded = w.withCard(card);
        assertSame(card, carded.card());
        assertEquals(w.uuid(), carded.uuid());
        assertTrue(carded.changed());
        TimeAdvancementService.TimeEndOutcome legacy = new TimeAdvancementService.TimeEndOutcome(
                2, List.of(), EventExecutionPort.EdgeStateOutcome.none(), List.of());
        assertNull(legacy.weather());
    }

    @Test
    @DisplayName("WeatherSelectionService.currentWeather(id) reads the store by match id")
    void currentWeatherById() {
        WeatherStorePort ws = mock(WeatherStorePort.class);
        when(ws.findCurrentWeather(MATCH_ID)).thenReturn(Optional.of(view(9)));
        WeatherSelectionService real = new WeatherSelectionService(ws, mock(RegistryService.class));
        assertEquals(9L, real.currentWeather(MATCH_ID).orElseThrow().idWeather());
    }
}
