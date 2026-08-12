package games.paths.adapters.rest.controller.match;

import games.paths.core.port.match.TimeAdvancementPort;
import games.paths.core.port.match.TurnCyclePort.TurnCycleException;
import games.paths.core.port.match.TurnCyclePort.TurnCycleException.Code;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit tests for {@link TimeClockController} (Step 25): the sleep action and the
 * clock read, plus the UNAUTHENTICATED guard and the error-code → HTTP status
 * mapping.
 */
class TimeClockControllerTest {

    private MockMvc mockMvc;
    private TimeAdvancementPort timeAdvancementPort;

    @BeforeEach
    void setUp() {
        timeAdvancementPort = mock(TimeAdvancementPort.class);
        mockMvc = MockMvcBuilders.standaloneSetup(
                new TimeClockController(timeAdvancementPort)).build();
    }

    /** Adds the userUuid request attribute normally set by JwtAuthenticationFilter. */
    private MockHttpServletRequestBuilder authed(MockHttpServletRequestBuilder b) {
        return b.requestAttr("userUuid", "user-uuid");
    }

    // ── POST /api/gameplay/{uuid}/action/sleep ───────────────────────────────

    @Test
    void sleep_returns200WithoutTimeEnd() throws Exception {
        when(timeAdvancementPort.sleep("m1", "user-uuid")).thenReturn(
                new TimeAdvancementPort.SleepResult("m1", "char-a", true, false, 2, List.of(), List.of()));

        mockMvc.perform(authed(post("/api/gameplay/m1/action/sleep")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.matchUuid").value("m1"))
                .andExpect(jsonPath("$.characterUuid").value("char-a"))
                .andExpect(jsonPath("$.isSleeping").value(true))
                .andExpect(jsonPath("$.timeEndTriggered").value(false))
                .andExpect(jsonPath("$.currentClock").value(2))
                .andExpect(jsonPath("$.recovery").isEmpty());
    }

    @Test
    void sleep_returns200WithTheRecoveryDeltasWhenTimeEndTriggers() throws Exception {
        when(timeAdvancementPort.sleep("m1", "user-uuid")).thenReturn(
                new TimeAdvancementPort.SleepResult("m1", "char-a", true, true, 3,
                        List.of(new TimeAdvancementPort.RecoveryItem("char-a", 20, 5, -2)),
                        List.of()));

        mockMvc.perform(authed(post("/api/gameplay/m1/action/sleep")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.timeEndTriggered").value(true))
                .andExpect(jsonPath("$.currentClock").value(3))
                .andExpect(jsonPath("$.recovery[0].characterUuid").value("char-a"))
                .andExpect(jsonPath("$.recovery[0].energyDelta").value(20))
                .andExpect(jsonPath("$.recovery[0].lifeDelta").value(5))
                .andExpect(jsonPath("$.recovery[0].sadDelta").value(-2));
    }

    @Test
    void sleep_returns401WhenTheUserAttributeIsMissing() throws Exception {
        mockMvc.perform(post("/api/gameplay/m1/action/sleep"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHENTICATED"));
        verifyNoInteractions(timeAdvancementPort);
    }

    @Test
    void sleep_returns401WhenTheUserAttributeIsBlank() throws Exception {
        mockMvc.perform(post("/api/gameplay/m1/action/sleep").requestAttr("userUuid", " "))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHENTICATED"));
        verifyNoInteractions(timeAdvancementPort);
    }

    @Test
    void sleep_returns404WhenTheMatchIsUnknown() throws Exception {
        when(timeAdvancementPort.sleep("m1", "user-uuid"))
                .thenThrow(new TurnCycleException(Code.MATCH_NOT_FOUND, "Match not found"));

        mockMvc.perform(authed(post("/api/gameplay/m1/action/sleep")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("MATCH_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Match not found"));
    }

    @Test
    void sleep_returns409WhenTheMatchIsNotRunning() throws Exception {
        when(timeAdvancementPort.sleep("m1", "user-uuid"))
                .thenThrow(new TurnCycleException(Code.MATCH_NOT_RUNNING, "Not running"));

        mockMvc.perform(authed(post("/api/gameplay/m1/action/sleep")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("MATCH_NOT_RUNNING"));
    }

    // ── GET /api/match/{uuid}/clock ──────────────────────────────────────────

    @Test
    void clock_returns200WithTheClockPayload() throws Exception {
        when(timeAdvancementPort.clock("m1", "user-uuid")).thenReturn(
                new TimeAdvancementPort.ClockResult("m1", 4, "hour", "hours", true,
                        List.of(new TimeAdvancementPort.ClockCharacter("char-a", true, 30))));

        mockMvc.perform(authed(get("/api/match/m1/clock")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.matchUuid").value("m1"))
                .andExpect(jsonPath("$.currentClock").value(4))
                .andExpect(jsonPath("$.clockLabelSingular").value("hour"))
                .andExpect(jsonPath("$.clockLabelPlural").value("hours"))
                .andExpect(jsonPath("$.anyCharacterSleeping").value(true))
                .andExpect(jsonPath("$.characters[0].characterUuid").value("char-a"))
                .andExpect(jsonPath("$.characters[0].energy").value(30));
    }

    @Test
    void clock_returns401WhenUnauthenticated() throws Exception {
        mockMvc.perform(get("/api/match/m1/clock"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHENTICATED"));
        verifyNoInteractions(timeAdvancementPort);
    }

    @Test
    void clock_returns404WhenTheMatchIsUnknown() throws Exception {
        when(timeAdvancementPort.clock("m1", "user-uuid"))
                .thenThrow(new TurnCycleException(Code.MATCH_NOT_FOUND, "Match not found"));

        mockMvc.perform(authed(get("/api/match/m1/clock")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("MATCH_NOT_FOUND"));
    }

    @Test
    void clock_returns409WhenTheCallerDidNotJoinTheMatch() throws Exception {
        when(timeAdvancementPort.clock("m1", "user-uuid"))
                .thenThrow(new TurnCycleException(Code.NOT_YOUR_TURN, "Not a participant"));

        mockMvc.perform(authed(get("/api/match/m1/clock")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("NOT_YOUR_TURN"));
    }
}
