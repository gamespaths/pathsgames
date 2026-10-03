package games.paths.adapters.admin.controller.match;

import games.paths.core.model.auth.AdminUserView;
import games.paths.core.model.match.MatchOwnerMoveResult;
import games.paths.core.port.match.MatchOwnerPort;
import games.paths.core.port.match.MatchOwnerPort.MatchOwnerException;
import games.paths.core.port.match.MatchOwnerPort.MatchOwnerException.Code;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** MatchOwnerAdminController (v0.41.6): owner GET, move PUT and every error status. */
class MatchOwnerAdminControllerTest {

    private MockMvc mvc;
    private MatchOwnerPort port;

    @BeforeEach
    void setUp() {
        port = mock(MatchOwnerPort.class);
        mvc = MockMvcBuilders.standaloneSetup(new MatchOwnerAdminController(port)).build();
    }

    @Test
    void getOwner_answersTheUserShape() throws Exception {
        when(port.owner("m-1")).thenReturn(new AdminUserView(1L, "u-1", "alice", "Alice", "a@x.it", "PLAYER", 6,
                "2000-01-01T00:00:00Z", "2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z", 2));
        mvc.perform(get("/api/admin/matches/m-1/owner"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.uuid").value("u-1"))
                .andExpect(jsonPath("$.username").value("alice"))
                .andExpect(jsonPath("$.guest").value(true))
                .andExpect(jsonPath("$.expired").value(true))
                .andExpect(jsonPath("$.matchCount").value(2))
                .andExpect(jsonPath("$.eligible").value(false))
                .andExpect(jsonPath("$.reason").value("USER_EXPIRED"));
    }

    @Test
    void getOwner_unknownMatchIs404() throws Exception {
        when(port.owner("nope")).thenThrow(new MatchOwnerException(Code.MATCH_NOT_FOUND, "Match not found: nope"));
        mvc.perform(get("/api/admin/matches/nope/owner"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("MATCH_NOT_FOUND"))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    void move_answersMoved() throws Exception {
        when(port.move("m-1", "bob")).thenReturn(new MatchOwnerMoveResult("MOVED", "m-1",
                new MatchOwnerMoveResult.Owner("u-1", "alice"), new MatchOwnerMoveResult.Owner("u-2", "bob"), 1));
        mvc.perform(put("/api/admin/matches/m-1/owner").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"user\":\"bob\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("MOVED"))
                .andExpect(jsonPath("$.matchUuid").value("m-1"))
                .andExpect(jsonPath("$.previousOwner.username").value("alice"))
                .andExpect(jsonPath("$.owner.uuid").value("u-2"))
                .andExpect(jsonPath("$.charactersMoved").value(1));
    }

    @Test
    void move_badBodiesAre400() throws Exception {
        for (String body : new String[]{"{}", "{\"user\":\"  \"}", "{\"user\":5}"}) {
            mvc.perform(put("/api/admin/matches/m-1/owner").contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("INVALID_INPUT"));
        }
        mvc.perform(put("/api/admin/matches/m-1/owner").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest());
        verify(port, never()).move(anyString(), anyString());
    }

    @ParameterizedTest
    @CsvSource({"INVALID_INPUT,400", "MATCH_NOT_FOUND,404", "USER_NOT_FOUND,404", "USER_AMBIGUOUS,409",
            "MATCH_TERMINATED,409", "MATCH_MULTI_CHARACTER,409", "USER_NOT_ALLOWED,409", "USER_EXPIRED,409",
            "ACTIVE_MATCH_ALREADY_EXISTS,409"})
    void move_mapsEveryCode(String code, int http) throws Exception {
        when(port.move("m-1", "x")).thenThrow(new MatchOwnerException(Code.valueOf(code), "msg"));
        mvc.perform(put("/api/admin/matches/m-1/owner").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"user\":\"x\"}"))
                .andExpect(status().is(http))
                .andExpect(jsonPath("$.error").value(code))
                .andExpect(jsonPath("$.message").value("msg"));
    }
}
