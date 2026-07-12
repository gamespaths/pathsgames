package games.paths.adapters.rest.controller.match;

import games.paths.core.port.match.TurnCyclePort;
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
 * Unit tests for {@link TurnCycleController} (Step 24): start, pass and
 * turn-sequence, plus the UNAUTHENTICATED guard and the error-code → HTTP
 * status mapping.
 */
class TurnCycleControllerTest {

    private MockMvc mockMvc;
    private TurnCyclePort turnCyclePort;

    @BeforeEach
    void setUp() {
        turnCyclePort = mock(TurnCyclePort.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new TurnCycleController(turnCyclePort)).build();
    }

    /** Adds the userUuid request attribute normally set by JwtAuthenticationFilter. */
    private MockHttpServletRequestBuilder authed(MockHttpServletRequestBuilder b) {
        return b.requestAttr("userUuid", "user-uuid");
    }

    private TurnCyclePort.TurnSequenceResult sequence() {
        return new TurnCyclePort.TurnSequenceResult("m1", 0, "RUNNING", "char-a",
                List.of(new TurnCyclePort.TurnEntry("char-a", 1L, "Ranger", 20L, 0,
                        "ACTIVE", 0, "2026-01-01T10:00:00Z", null)));
    }

    // ── POST /api/matches/{uuid}/start ───────────────────────────────────────

    @Test
    void start_returns200WithTheTurnSequence() throws Exception {
        when(turnCyclePort.startMatch("m1", "user-uuid")).thenReturn(sequence());

        mockMvc.perform(authed(post("/api/matches/m1/start")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.matchUuid").value("m1"))
                .andExpect(jsonPath("$.status").value("RUNNING"))
                .andExpect(jsonPath("$.activeCharacterUuid").value("char-a"))
                .andExpect(jsonPath("$.queue[0].characterUuid").value("char-a"))
                .andExpect(jsonPath("$.queue[0].priority").value(20))
                .andExpect(jsonPath("$.queue[0].name").value("Ranger"));
    }

    @Test
    void start_returns401WhenTheUserAttributeIsMissing() throws Exception {
        mockMvc.perform(post("/api/matches/m1/start"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHENTICATED"));
        verifyNoInteractions(turnCyclePort);
    }

    @Test
    void start_returns401WhenTheUserAttributeIsBlank() throws Exception {
        mockMvc.perform(post("/api/matches/m1/start").requestAttr("userUuid", "  "))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHENTICATED"));
        verifyNoInteractions(turnCyclePort);
    }

    @Test
    void start_returns404WhenTheMatchIsUnknown() throws Exception {
        when(turnCyclePort.startMatch("m1", "user-uuid"))
                .thenThrow(new TurnCycleException(Code.MATCH_NOT_FOUND, "Match not found"));

        mockMvc.perform(authed(post("/api/matches/m1/start")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("MATCH_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Match not found"));
    }

    @Test
    void start_returns409WhenTheMatchIsNotStartable() throws Exception {
        when(turnCyclePort.startMatch("m1", "user-uuid"))
                .thenThrow(new TurnCycleException(Code.MATCH_NOT_STARTABLE, "Already running"));

        mockMvc.perform(authed(post("/api/matches/m1/start")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("MATCH_NOT_STARTABLE"));
    }

    @Test
    void start_returns409WhenNoCharacterJoined() throws Exception {
        when(turnCyclePort.startMatch("m1", "user-uuid"))
                .thenThrow(new TurnCycleException(Code.NO_CHARACTERS_JOINED, "No characters"));

        mockMvc.perform(authed(post("/api/matches/m1/start")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("NO_CHARACTERS_JOINED"));
    }

    // ── POST /api/gameplay/{uuid}/action/pass ────────────────────────────────

    @Test
    void pass_returns200WithTheNextActiveCharacter() throws Exception {
        when(turnCyclePort.passTurn("m1", "user-uuid")).thenReturn(
                new TurnCyclePort.PassResult("m1", "char-a", "char-b", "RUNNING"));

        mockMvc.perform(authed(post("/api/gameplay/m1/action/pass")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.matchUuid").value("m1"))
                .andExpect(jsonPath("$.passedCharacterUuid").value("char-a"))
                .andExpect(jsonPath("$.nextActiveCharacterUuid").value("char-b"))
                .andExpect(jsonPath("$.status").value("RUNNING"));
    }

    @Test
    void pass_returns401WhenUnauthenticated() throws Exception {
        mockMvc.perform(post("/api/gameplay/m1/action/pass"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHENTICATED"));
        verifyNoInteractions(turnCyclePort);
    }

    @Test
    void pass_returns409WhenItIsNotTheCallersTurn() throws Exception {
        when(turnCyclePort.passTurn("m1", "user-uuid"))
                .thenThrow(new TurnCycleException(Code.NOT_YOUR_TURN, "Not your turn"));

        mockMvc.perform(authed(post("/api/gameplay/m1/action/pass")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("NOT_YOUR_TURN"));
    }

    @Test
    void pass_returns409WhenTheMatchIsNotRunning() throws Exception {
        when(turnCyclePort.passTurn("m1", "user-uuid"))
                .thenThrow(new TurnCycleException(Code.MATCH_NOT_RUNNING, "Not running"));

        mockMvc.perform(authed(post("/api/gameplay/m1/action/pass")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("MATCH_NOT_RUNNING"));
    }

    // ── GET /api/match/{uuid}/turn-sequence ──────────────────────────────────

    @Test
    void sequence_returns200WithTheQueue() throws Exception {
        when(turnCyclePort.getTurnSequence("m1", "user-uuid")).thenReturn(sequence());

        mockMvc.perform(authed(get("/api/match/m1/turn-sequence")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentClock").value(0))
                .andExpect(jsonPath("$.queue[0].status").value("ACTIVE"))
                .andExpect(jsonPath("$.queue[0].passCounter").value(0));
    }

    @Test
    void sequence_returns401WhenUnauthenticated() throws Exception {
        mockMvc.perform(get("/api/match/m1/turn-sequence"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHENTICATED"));
        verifyNoInteractions(turnCyclePort);
    }

    @Test
    void sequence_returns404WhenTheMatchIsUnknown() throws Exception {
        when(turnCyclePort.getTurnSequence("m1", "user-uuid"))
                .thenThrow(new TurnCycleException(Code.MATCH_NOT_FOUND, "Match not found"));

        mockMvc.perform(authed(get("/api/match/m1/turn-sequence")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("MATCH_NOT_FOUND"));
    }
}
