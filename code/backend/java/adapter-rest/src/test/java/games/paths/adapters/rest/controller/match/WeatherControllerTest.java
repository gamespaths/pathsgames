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

    private games.paths.core.port.match.MatchPersistencePort matchPort;
    private games.paths.core.port.match.UserAccessPort userAccessPort;

    @BeforeEach
    void setUp() {
        weatherService = mock(WeatherSelectionService.class);
        contentQueryPort = mock(games.paths.core.port.story.ContentQueryPort.class);
        matchPort = mock(games.paths.core.port.match.MatchPersistencePort.class);
        userAccessPort = mock(games.paths.core.port.match.UserAccessPort.class);
        when(userAccessPort.findByUuid("owner")).thenReturn(Optional.of(
                new games.paths.core.port.match.UserAccessPort.UserView(5L, "owner", "o", "PLAYER", 2)));
        when(userAccessPort.findByUuid("other")).thenReturn(Optional.of(
                new games.paths.core.port.match.UserAccessPort.UserView(6L, "other", "x", "PLAYER", 2)));
        games.paths.core.entity.match.GamingMatchEntity match = new games.paths.core.entity.match.GamingMatchEntity();
        match.setIdUserCreator(5L);
        when(matchPort.findMatchByUuid("m1")).thenReturn(Optional.of(match));
        mockMvc = MockMvcBuilders.standaloneSetup(
                new WeatherController(weatherService, contentQueryPort, matchPort, userAccessPort)).build();
    }

    private static org.springframework.test.web.servlet.request.RequestPostProcessor as(String user) {
        return r -> {
            r.setAttribute("userUuid", user);
            return r;
        };
    }

    @Test
    void v1_11_weather_of_a_match_the_caller_did_not_create_is_404() throws Exception {
        when(weatherService.currentWeather("m1")).thenReturn(Optional.of(
                new CurrentWeatherView(9L, "w-9", 7L, 55, 123, -5, 1, 2, 3)));
        when(matchPort.findMatchByUuid("gone")).thenReturn(Optional.empty());
        mockMvc.perform(get("/api/matches/m1/weather").with(as("other")))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.error").value("MATCH_NOT_FOUND"));
        mockMvc.perform(get("/api/matches/m1/weather").with(as("nobody")))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/matches/gone/weather").with(as("owner")))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.error").value("MATCH_NOT_FOUND"));
        mockMvc.perform(get("/api/matches/m1/weather"))
                .andExpect(status().isNotFound());
        verify(weatherService, never()).currentWeather("m1");
    }

    @Test
    void weather_returns200WithCurrentWeatherAndResolvedCard() throws Exception {
        when(weatherService.currentWeather("m1")).thenReturn(Optional.of(
                new CurrentWeatherView(9L, "w-9", 7L, 55, 123, -5, 1, 2, 3)));
        when(contentQueryPort.getCardByStoryIdAndCardId(7L, 55, "en")).thenReturn(
                new games.paths.core.model.story.CardInfo("card-9", "weather",
                        "http://img", null, "fa-cloud", null, null, null, null, null,
                        "Storm", "A storm", null, null, null));
        mockMvc.perform(get("/api/matches/m1/weather").with(as("owner")))
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
        mockMvc.perform(get("/api/matches/m1/weather").with(as("owner")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("WEATHER_NOT_FOUND"));
    }
}
