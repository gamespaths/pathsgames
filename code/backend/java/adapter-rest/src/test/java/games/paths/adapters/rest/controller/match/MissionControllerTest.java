package games.paths.adapters.rest.controller.match;

import games.paths.core.model.match.MatchMission;
import games.paths.core.model.match.MatchMissionStep;
import games.paths.core.port.match.MatchQueryPort;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@DisplayName("MissionController (Step 37)")
class MissionControllerTest {

    private MatchQueryPort queryPort;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        queryPort = mock(MatchQueryPort.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new MissionController(queryPort)).build();
    }

    private MockHttpServletRequestBuilder authed(MockHttpServletRequestBuilder b) {
        return b.requestAttr("userUuid", "user-uuid");
    }

    private static MatchMission mission() {
        MatchMission m = new MatchMission();
        m.setUuid("m-1");
        m.setName("Complete the Tutorial");
        m.setStatus("ACTIVE");
        m.setStepReached(1);
        m.setStepsTotal(2);
        MatchMissionStep s = new MatchMissionStep();
        s.setUuid("s-1");
        s.setStep(1);
        s.setDone(true);
        m.setSteps(List.of(s));
        return m;
    }

    @Test
    @DisplayName("the list answers with the missions the match has reached")
    void list() throws Exception {
        when(queryPort.getMatchMissions("mu", "user-uuid", null, "en"))
                .thenReturn(List.of(mission()));

        mockMvc.perform(authed(get("/api/match/mu/missions")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.missions[0].uuid").value("m-1"))
                .andExpect(jsonPath("$.missions[0].status").value("ACTIVE"))
                .andExpect(jsonPath("$.missions[0].stepReached").value(1))
                .andExpect(jsonPath("$.missions[0].steps[0].done").value(true));
    }

    @Test
    @DisplayName("the status filter and the language reach the port as they were asked")
    void filters() throws Exception {
        when(queryPort.getMatchMissions("mu", "user-uuid", "COMPLETED", "it"))
                .thenReturn(List.of());

        mockMvc.perform(authed(get("/api/match/mu/missions?status=COMPLETED&lang=it")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.missions").isEmpty());
    }

    @Test
    @DisplayName("detail answers with one mission and all its steps")
    void detail() throws Exception {
        when(queryPort.getMatchMission("mu", "user-uuid", "m-1", "en")).thenReturn(mission());

        mockMvc.perform(authed(get("/api/match/mu/missions/m-1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.uuid").value("m-1"))
                .andExpect(jsonPath("$.stepsTotal").value(2));
    }

    @Test
    @DisplayName("no identity on the request is 401, not a lookup")
    void unauthenticated() throws Exception {
        mockMvc.perform(get("/api/match/mu/missions"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHENTICATED"));
        mockMvc.perform(get("/api/match/mu/missions/m-1"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("a match nobody may see is not distinguishable from one that does not exist")
    void masked() throws Exception {
        when(queryPort.getMatchMissions(any(), any(), any(), any())).thenReturn(null);
        when(queryPort.getMatchMission(any(), any(), any(), any())).thenReturn(null);

        mockMvc.perform(authed(get("/api/match/mu/missions")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("MATCH_NOT_FOUND"));
        mockMvc.perform(authed(get("/api/match/mu/missions/m-1")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("MATCH_NOT_FOUND"));
    }

    @Test
    @DisplayName("a blank match or mission uuid is bad input, not a missing mission")
    void blankUuids() {
        // Straight at the method: a blank path segment never survives the servlet mapping.
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setAttribute("userUuid", "user-uuid");
        MissionController controller = new MissionController(queryPort);

        assertEquals(HttpStatus.BAD_REQUEST,
                controller.getMission("mu", "  ", "en", request).getStatusCode());
        assertEquals(HttpStatus.BAD_REQUEST,
                controller.getMissions("  ", null, "en", request).getStatusCode());
    }
}
