package games.paths.adapters.rest.controller.match;

import games.paths.core.port.match.MovementPort;
import games.paths.core.port.match.MovementPort.MovementException;
import games.paths.core.port.match.MovementPort.MovementResult;
import games.paths.core.port.match.MovementPort.NeighborCost;
import games.paths.core.port.match.MovementPort.VisitedLocation;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class MovementControllerTest {

    private MockMvc mockMvc;
    private MovementPort movementPort;

    @BeforeEach
    void setUp() {
        movementPort = mock(MovementPort.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new MovementController(movementPort)).build();
    }

    private static MockHttpServletRequestBuilder authed(MockHttpServletRequestBuilder b) {
        return b.requestAttr("userUuid", "user-uuid");
    }

    @Test
    void startMovement_returns200() throws Exception {
        when(movementPort.startMovement("m1", "user-uuid", "loc-2")).thenReturn(
                new MovementResult("m1", "char-1", 1L, null, 2L, "loc-2", 6, 4, 3));
        mockMvc.perform(authed(post("/api/gameplay/m1/movements/start"))
                        .contentType(APPLICATION_JSON)
                        .content("{\"targetLocationUuid\":\"loc-2\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.toLocationUuid").value("loc-2"))
                .andExpect(jsonPath("$.energySpent").value(6))
                .andExpect(jsonPath("$.newEnergy").value(4));
    }

    @Test
    void startMovement_unauthenticated() throws Exception {
        mockMvc.perform(post("/api/gameplay/m1/movements/start")
                        .contentType(APPLICATION_JSON).content("{\"targetLocationUuid\":\"loc-2\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void startMovement_missingTarget_returns400() throws Exception {
        mockMvc.perform(authed(post("/api/gameplay/m1/movements/start"))
                        .contentType(APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("MISSING_TARGET"));
    }

    @Test
    void startMovement_notFound_returns404() throws Exception {
        when(movementPort.startMovement(any(), any(), any())).thenThrow(
                new MovementException(MovementException.Code.MATCH_NOT_FOUND, "no"));
        mockMvc.perform(authed(post("/api/gameplay/m1/movements/start"))
                        .contentType(APPLICATION_JSON).content("{\"targetLocationUuid\":\"loc-2\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("MATCH_NOT_FOUND"));
    }

    @Test
    void startMovement_insufficientEnergy_returns409() throws Exception {
        when(movementPort.startMovement(any(), any(), any())).thenThrow(
                new MovementException(MovementException.Code.INSUFFICIENT_ENERGY, "no"));
        mockMvc.perform(authed(post("/api/gameplay/m1/movements/start"))
                        .contentType(APPLICATION_JSON).content("{\"targetLocationUuid\":\"loc-2\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("INSUFFICIENT_ENERGY"));
    }

    @Test
    void locations_returns200() throws Exception {
        NeighborCost n = new NeighborCost(2L, "loc-2", "NORTH", 1, 1, 2, 4, true);
        VisitedLocation loc = new VisitedLocation(1L, "loc-1", 7, true, 1, List.of(n));
        when(movementPort.listLocations("m1", "user-uuid")).thenReturn(List.of(loc));
        mockMvc.perform(authed(get("/api/match/m1/locations")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.locations[0].characterCount").value(1))
                .andExpect(jsonPath("$.locations[0].neighbors[0].totalEnergyCost").value(4));
    }

    @Test
    void locations_unauthenticated() throws Exception {
        mockMvc.perform(get("/api/match/m1/locations"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void locations_notFound() throws Exception {
        when(movementPort.listLocations(eq("m1"), any())).thenThrow(
                new MovementException(MovementException.Code.MATCH_NOT_FOUND, "no"));
        mockMvc.perform(authed(get("/api/match/m1/locations")))
                .andExpect(status().isNotFound());
    }
}
