package games.paths.adapters.admin.controller.auth;

import games.paths.core.model.auth.AdminUserActionResult;
import games.paths.core.model.auth.AdminUserDetail;
import games.paths.core.model.auth.AdminUserItem;
import games.paths.core.model.auth.AdminUserListFilter;
import games.paths.core.model.auth.AdminUserPage;
import games.paths.core.model.auth.AdminUserView;
import games.paths.core.model.auth.UserAdminException;
import games.paths.core.model.auth.UserIdentity;
import games.paths.core.model.auth.UserStats;
import games.paths.core.port.auth.UserAdminPort;
import games.paths.core.port.match.MatchOwnerPort;
import games.paths.core.port.match.MatchOwnerPort.MatchOwnerException;
import games.paths.core.port.match.MatchOwnerPort.MatchOwnerException.Code;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** UserAdminController (v0.41.6 preview, v1.7.0 list, detail and actions). */
class UserAdminControllerTest {

    private MockMvc mvc;
    private MatchOwnerPort port;
    private UserAdminPort admin;

    @BeforeEach
    void setUp() {
        port = mock(MatchOwnerPort.class);
        admin = mock(UserAdminPort.class);
        mvc = MockMvcBuilders.standaloneSetup(new UserAdminController(port, admin)).build();
    }

    @Test
    void anEligibleUserByEmailWithTheDetail() throws Exception {
        when(port.findUser("player1@test.local")).thenReturn(new AdminUserView(3L, "u-3", "test_player1", null,
                "player1@test.local", "PLAYER", 2, null, null, null, 0));
        UserIdentity google = new UserIdentity(1L, 3L, "GOOGLE", "sub-1", "player1@gmail.com", "P One", "P",
                "One", "https://pic", "en", "2026-10-01T00:00:00Z");
        when(admin.detail("u-3")).thenReturn(new AdminUserDetail("GOOGLE", null, false, false, 2,
                new UserStats(1, 0, 0, 10, 3), List.of(google)));
        mvc.perform(get("/api/admin/users/player1@test.local"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("test_player1"))
                .andExpect(jsonPath("$.guest").value(false))
                .andExpect(jsonPath("$.eligible").value(true))
                .andExpect(jsonPath("$.accountType").value("GOOGLE"))
                .andExpect(jsonPath("$.sessions").value(2))
                .andExpect(jsonPath("$.stats.matchesPlayed").value(1))
                .andExpect(jsonPath("$.identities[0].subject").value("sub-1"));
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

    @Test
    void listAnswersTheCursorEnvelopeWithoutEmail() throws Exception {
        AdminUserItem item = new AdminUserItem(5L, "u-5", "alice", 2, "PLAYER", "GOOGLE", "2026-01-01", "2026-10-01",
                null);
        when(admin.list(new AdminUserListFilter(null, "ali", "2", null, 10)))
                .thenReturn(new AdminUserPage(List.of(item), "next", 10));
        mvc.perform(get("/api/admin/users").param("nickname", "ali").param("state", "2").param("limit", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].nickname").value("alice"))
                .andExpect(jsonPath("$.items[0].email").doesNotExist())
                .andExpect(jsonPath("$.nextCursor").value("next"))
                .andExpect(jsonPath("$.limit").value(10));
    }

    @Test
    void listRefusesAGuestState() throws Exception {
        when(admin.list(any())).thenThrow(new UserAdminException(UserAdminException.Code.INVALID_INPUT, "no"));
        mvc.perform(get("/api/admin/users").param("state", "6"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("INVALID_INPUT"));
    }

    @Test
    void actionsPassTheAdminAndTheBody() throws Exception {
        AdminUserActionResult ok = new AdminUserActionResult("u-5", "BAN", 4, null, false, List.of("m-1"));
        when(admin.ban("adm", "u-5", "spam")).thenReturn(ok);
        when(admin.suspend("adm", "u-5", "2026-11-01", "rude")).thenReturn(ok);
        when(admin.unblock("adm", "u-5", "ok")).thenReturn(ok);
        when(admin.relinkSubject("adm", "u-5", "new sub")).thenReturn(ok);
        when(admin.deleteUser("adm", "u-5", "old")).thenReturn(ok);
        mvc.perform(post("/api/admin/users/u-5/ban").requestAttr("userUuid", "adm")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"spam\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.bannedMatchUuids[0]").value("m-1"));
        mvc.perform(post("/api/admin/users/u-5/suspend").requestAttr("userUuid", "adm")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"rude\",\"until\":\"2026-11-01\"}"))
                .andExpect(status().isOk());
        mvc.perform(post("/api/admin/users/u-5/unblock").requestAttr("userUuid", "adm")
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"ok\"}")).andExpect(status().isOk());
        mvc.perform(post("/api/admin/users/u-5/relink-subject").requestAttr("userUuid", "adm")
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"new sub\"}")).andExpect(status().isOk());
        mvc.perform(post("/api/admin/users/u-5/deletion").requestAttr("userUuid", "adm")
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"old\"}")).andExpect(status().isOk());
    }

    @Test
    void refusalsMapToTheirStatus() throws Exception {
        when(admin.ban(isNull(), eq("u-1"), isNull()))
                .thenThrow(new UserAdminException(UserAdminException.Code.ADMIN_NOT_BANNABLE, "admin"));
        when(admin.suspend(isNull(), eq("u-2"), isNull(), isNull()))
                .thenThrow(new UserAdminException(UserAdminException.Code.USER_NOT_FOUND, "none"));
        when(admin.unblock(isNull(), eq("u-3"), isNull()))
                .thenThrow(new UserAdminException(UserAdminException.Code.INVALID_STATE_TRANSITION, "active"));
        mvc.perform(post("/api/admin/users/u-1/ban")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("ADMIN_NOT_BANNABLE"));
        mvc.perform(post("/api/admin/users/u-2/suspend")).andExpect(status().isNotFound());
        mvc.perform(post("/api/admin/users/u-3/unblock")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("INVALID_STATE_TRANSITION"));
    }
}
