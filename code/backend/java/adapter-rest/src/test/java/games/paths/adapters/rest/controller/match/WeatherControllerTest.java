package games.paths.adapters.rest.controller.match;

import games.paths.core.port.match.WeatherStorePort.CurrentWeatherView;
import games.paths.core.service.match.WeatherSelectionService;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Optional;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class WeatherControllerTest {

    private MockMvc mockMvc;
    private WeatherSelectionService weatherService;
    private games.paths.core.port.story.ContentQueryPort contentQueryPort;

    @BeforeEach
    void setUp() {
        weatherService = mock(WeatherSelectionService.class);
        contentQueryPort = mock(games.paths.core.port.story.ContentQueryPort.class);
        mockMvc = MockMvcBuilders.standaloneSetup(
                new WeatherController(weatherService, contentQueryPort)).build();
    }

    @Test
    void weather_returns200WithCurrentWeatherAndResolvedCard() throws Exception {
        when(weatherService.currentWeather("m1")).thenReturn(Optional.of(
                new CurrentWeatherView(9L, "w-9", 7L, 55, 123, -5, 1, 2, 3)));
        when(contentQueryPort.getCardByStoryIdAndCardId(7L, 55, "en")).thenReturn(
                new games.paths.core.model.story.CardInfo("card-9", "weather",
                        "http://img", null, "fa-cloud", null, null, null, null, null,
                        "Storm", "A storm", null, null, null));
        mockMvc.perform(get("/api/matches/m1/weather"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.idWeather").value(9))
                .andExpect(jsonPath("$.uuid").value("w-9"))
                .andExpect(jsonPath("$.idCard").value(55))
                .andExpect(jsonPath("$.card.urlImage").value("http://img"))
                .andExpect(jsonPath("$.card.title").value("Storm"))
                .andExpect(jsonPath("$.deltaEnergy").value(-5))
                .andExpect(jsonPath("$.costMoveSafeLocation").value(1))
                .andExpect(jsonPath("$.costMoveNotSafeLocation").value(2))
                .andExpect(jsonPath("$.currentClock").value(3));
    }

    @Test
    void weather_returns404WhenNoWeatherSet() throws Exception {
        when(weatherService.currentWeather("m1")).thenReturn(Optional.empty());
        mockMvc.perform(get("/api/matches/m1/weather"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("WEATHER_NOT_FOUND"));
    }
}
