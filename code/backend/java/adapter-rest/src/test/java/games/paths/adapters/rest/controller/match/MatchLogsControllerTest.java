package games.paths.adapters.rest.controller.match;

import games.paths.core.model.story.CardInfo;
import games.paths.core.port.match.MatchLogsPort;
import games.paths.core.port.match.MatchLogsPort.LogEntry;
import games.paths.core.port.match.MatchLogsPort.MatchLogsResult;
import games.paths.core.port.match.TurnCyclePort.TurnCycleException;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Step 28.7 — GET /api/matches/{uuidMatch}/logs. */
class MatchLogsControllerTest {

    private MockMvc mockMvc;
    private MatchLogsPort matchLogsPort;

    @BeforeEach
    void setUp() {
        matchLogsPort = mock(MatchLogsPort.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new MatchLogsController(matchLogsPort)).build();
    }

    /** The auth filter puts the caller uuid on the request; standalone MockMvc must fake it. */
    private static MockHttpServletRequestBuilder authed(MockHttpServletRequestBuilder b) {
        return b.requestAttr("userUuid", "user-uuid");
    }

    private static CardInfo card(String title) {
        return new CardInfo("card-uuid", "type", "http://img", null, "fa-icon",
                null, null, null, null, null, title, "desc", null, null, null);
    }

    @Test
    void logs_returns200WithTheConsolidatedTimeline() throws Exception {
        when(matchLogsPort.getMatchLogs("m1", "user-uuid", null, null, null, null)).thenReturn(
                new MatchLogsResult("m1", 3, List.of(
                        new LogEntry("WEATHER", 1, "2024-01-01T10:00:00Z", 7L,
                                null, null, null, null, null, null, null, 300, card("Storm"), null,
                                0, 0, 0),
                        new LogEntry("MOVEMENT", null, "2024-01-01T11:00:00Z", null,
                                10L, "char-uuid", "Ranger", 100L, 200L, 4, null,
                                400, card("Dark Forest"), null, 1, 0, 2)),
                        null, 50, 2, "asc"));

        mockMvc.perform(authed(get("/api/matches/m1/logs")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.matchUuid").value("m1"))
                .andExpect(jsonPath("$.currentClock").value(3))
                .andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.limit").value(50))
                .andExpect(jsonPath("$.nextCursor").doesNotExist())
                .andExpect(jsonPath("$.logs[0].type").value("WEATHER"))
                .andExpect(jsonPath("$.logs[0].idWeather").value(7))
                .andExpect(jsonPath("$.logs[0].idCard").value(300))
                .andExpect(jsonPath("$.logs[0].card.title").value("Storm"))
                .andExpect(jsonPath("$.logs[1].type").value("MOVEMENT"))
                .andExpect(jsonPath("$.logs[1].idLocationFrom").value(100))
                .andExpect(jsonPath("$.logs[1].idLocationTo").value(200))
                .andExpect(jsonPath("$.logs[1].energyCost").value(4))
                .andExpect(jsonPath("$.logs[1].characterUuid").value("char-uuid"))
                .andExpect(jsonPath("$.logs[1].characterName").value("Ranger"))
                .andExpect(jsonPath("$.logs[1].card.title").value("Dark Forest"));
    }

    @Test
    void logs_eventEntryExposesIdEventAndItsOwnCard() throws Exception {
        when(matchLogsPort.getMatchLogs("m1", "user-uuid", null, null, null, null)).thenReturn(
                new MatchLogsResult("m1", 3, List.of(
                        new LogEntry("EVENT", 3, "2024-01-01T12:00:00Z", null,
                                10L, "char-uuid", "Ranger", null, null, 3,
                                "EVENT_EXECUTED 42", 600, card("A Fork In The Road"), 42L,
                                2, 1, 5)),
                        null, 50, 1, "asc"));

        mockMvc.perform(authed(get("/api/matches/m1/logs")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.logs[0].type").value("EVENT"))
                .andExpect(jsonPath("$.logs[0].idEvent").value(42))
                .andExpect(jsonPath("$.logs[0].idCard").value(600))
                .andExpect(jsonPath("$.logs[0].card.title").value("A Fork In The Road"))
                .andExpect(jsonPath("$.logs[0].characterUuid").value("char-uuid"))
                .andExpect(jsonPath("$.logs[0].characterName").value("Ranger"));
    }

    @Test
    void logs_passesLangLimitCursorAndOrderThroughToThePort() throws Exception {
        when(matchLogsPort.getMatchLogs("m1", "user-uuid", "it", 10, "cur", "desc"))
                .thenReturn(new MatchLogsResult("m1", 0, List.of(), "next", 10, 30, "desc"));

        mockMvc.perform(authed(get("/api/matches/m1/logs?lang=it&limit=10&cursor=cur&order=desc")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nextCursor").value("next"))
                .andExpect(jsonPath("$.limit").value(10))
                .andExpect(jsonPath("$.total").value(30))
                .andExpect(jsonPath("$.order").value("desc"));
    }

    @Test
    void logs_returns200WithEmptyListWhenNothingLoggedYet() throws Exception {
        when(matchLogsPort.getMatchLogs("m1", "user-uuid", null, null, null, null))
                .thenReturn(new MatchLogsResult("m1", 0, List.of(), null, 50, 0, "asc"));

        mockMvc.perform(authed(get("/api/matches/m1/logs")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.logs").isEmpty());
    }

    @Test
    void logs_returns401WhenTheCallerIsAnonymous() throws Exception {
        mockMvc.perform(get("/api/matches/m1/logs"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHENTICATED"));
        verifyNoInteractions(matchLogsPort);
    }

    @Test
    void logs_returns404WhenTheMatchIsUnknownOrNotOwned() throws Exception {
        when(matchLogsPort.getMatchLogs("m1", "user-uuid", null, null, null, null)).thenThrow(
                new TurnCycleException(TurnCycleException.Code.MATCH_NOT_FOUND,
                        "Match not found or not accessible"));

        mockMvc.perform(authed(get("/api/matches/m1/logs")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("MATCH_NOT_FOUND"));
    }
}
