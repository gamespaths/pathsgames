package games.paths.adapters.admin.controller.auth;

import games.paths.core.model.auth.AdminUserView;
import games.paths.core.port.match.MatchOwnerPort;
import games.paths.core.port.match.MatchOwnerPort.MatchOwnerException;
import games.paths.core.port.match.MatchOwnerPort.MatchOwnerException.Code;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** UserAdminController (v0.41.6): preview by uuid / email / username, 404 and 409. */
class UserAdminControllerTest {

    private MockMvc mvc;
    private MatchOwnerPort port;

    @BeforeEach
    void setUp() {
        port = mock(MatchOwnerPort.class);
        mvc = MockMvcBuilders.standaloneSetup(new UserAdminController(port)).build();
    }

    @Test
    void anEligibleUserByEmail() throws Exception {
        when(port.findUser("player1@test.local")).thenReturn(new AdminUserView(3L, "u-3", "test_player1", null,
                "player1@test.local", "PLAYER", 2, null, null, null, 0));
        mvc.perform(get("/api/admin/users/player1@test.local"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("test_player1"))
                .andExpect(jsonPath("$.guest").value(false))
                .andExpect(jsonPath("$.expired").value(false))
                .andExpect(jsonPath("$.eligible").value(true))
                .andExpect(jsonPath("$.reason").doesNotExist());
    }

    @Test
    void anAdminIsAnsweredButNotEligible() throws Exception {
        when(port.findUser("test_admin")).thenReturn(new AdminUserView(1L, "u-1", "test_admin", null, null,
                "ADMIN", 2, null, null, null, 0));
        mvc.perform(get("/api/admin/users/test_admin"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eligible").value(false))
                .andExpect(jsonPath("$.reason").value("USER_NOT_ALLOWED"));
    }

    @Test
    void notFoundAndAmbiguous() throws Exception {
        when(port.findUser("ghost")).thenThrow(new MatchOwnerException(Code.USER_NOT_FOUND, "No user"));
        when(port.findUser("dup")).thenThrow(new MatchOwnerException(Code.USER_AMBIGUOUS, "Two users"));
        mvc.perform(get("/api/admin/users/ghost")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("USER_NOT_FOUND"));
        mvc.perform(get("/api/admin/users/dup")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("USER_AMBIGUOUS"));
    }
}
