package games.paths.adapters.rest.controller.dev;

import games.paths.core.model.dev.CleanupResult;
import games.paths.core.port.dev.TestDataCleanupPort;

import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit tests for {@link DevController}.
 */
class DevControllerTest {

    @Test
    void cleanup_shouldReturnCountsWhenDevEnabled() throws Exception {
        TestDataCleanupPort cleanupPort = mock(TestDataCleanupPort.class);
        when(cleanupPort.cleanupTestData()).thenReturn(new CleanupResult(5, 2));

        MockMvc mockMvc = MockMvcBuilders
                .standaloneSetup(new DevController(cleanupPort, true)).build();

        mockMvc.perform(post("/api/dev/cleanup"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deletedGuests").value(5))
                .andExpect(jsonPath("$.deletedMatches").value(2));

        verify(cleanupPort).cleanupTestData();
    }

    @Test
    void cleanup_shouldReturn403WhenDevDisabled() throws Exception {
        TestDataCleanupPort cleanupPort = mock(TestDataCleanupPort.class);

        MockMvc mockMvc = MockMvcBuilders
                .standaloneSetup(new DevController(cleanupPort, false)).build();

        mockMvc.perform(post("/api/dev/cleanup"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("DEV_ENDPOINTS_DISABLED"));

        // The cleanup use case must not run when dev endpoints are disabled.
        verify(cleanupPort, never()).cleanupTestData();
    }

    private static MockMvc devMvc(boolean enabled, games.paths.core.port.auth.AdminBootstrapPort admin,
                                  games.paths.core.port.dev.FakeGoogleTokenPort fake,
                                  games.paths.core.port.auth.AccountPort account) {
        return MockMvcBuilders.standaloneSetup(new DevController(mock(TestDataCleanupPort.class), enabled, admin, fake,
                account)).build();
    }

    @Test
    void v120_adminTokenFakeGoogleAndDeletionJob() throws Exception {
        games.paths.core.port.auth.AdminBootstrapPort admin = mock(games.paths.core.port.auth.AdminBootstrapPort.class);
        games.paths.core.port.dev.FakeGoogleTokenPort fake = mock(games.paths.core.port.dev.FakeGoogleTokenPort.class);
        games.paths.core.port.auth.AccountPort account = mock(games.paths.core.port.auth.AccountPort.class);
        when(admin.createAdmin("robot_admin")).thenReturn(new games.paths.core.model.auth.AdminBootstrapResult(
                "a-1", "admin_a1", "robot_admin", true, "admin-token", 5L));
        when(admin.createAdmin("ops")).thenReturn(new games.paths.core.model.auth.AdminBootstrapResult(
                "a-2", "admin_a2", "ops", false, "t2", 6L));
        when(fake.isEnabled()).thenReturn(true);
        when(fake.mint(org.mockito.ArgumentMatchers.anyMap())).thenReturn("fake-id-token");
        when(account.runDeletionJob()).thenReturn(2);
        MockMvc mvc = devMvc(true, admin, fake, account);

        mvc.perform(post("/api/dev/admin-token")).andExpect(status().isCreated())
                .andExpect(jsonPath("$.accessToken").value("admin-token"))
                .andExpect(jsonPath("$.role").value("ADMIN"));
        mvc.perform(post("/api/dev/admin-token").contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{\"nickname\":\"ops\"}"))
                .andExpect(jsonPath("$.created").value(false));
        mvc.perform(post("/api/dev/google-token").contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{\"sub\":\"s\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.idToken").value("fake-id-token"));
        mvc.perform(post("/api/dev/jobs/account-deletion")).andExpect(jsonPath("$.deletedUsers").value(2));
    }

    @Test
    void v120_devEndpointsRefusedWhenDisabledOrMissing() throws Exception {
        games.paths.core.port.dev.FakeGoogleTokenPort off = mock(games.paths.core.port.dev.FakeGoogleTokenPort.class);
        MockMvc disabled = devMvc(false, null, null, null);
        disabled.perform(post("/api/dev/admin-token")).andExpect(status().isForbidden());
        disabled.perform(post("/api/dev/google-token")).andExpect(status().isForbidden());
        disabled.perform(post("/api/dev/jobs/account-deletion")).andExpect(status().isForbidden());
        devMvc(true, null, off, null).perform(post("/api/dev/google-token")).andExpect(status().isForbidden());
        devMvc(true, null, null, null).perform(post("/api/dev/google-token")).andExpect(status().isForbidden());
    }

    @Test
    void v120_adminTokenRefusal() throws Exception {
        games.paths.core.port.auth.AdminBootstrapPort admin = mock(games.paths.core.port.auth.AdminBootstrapPort.class);
        when(admin.createAdmin("mario")).thenThrow(new games.paths.core.model.auth.AuthException(
                games.paths.core.model.auth.AuthException.Code.NICKNAME_TAKEN, "taken"));
        devMvc(true, admin, null, null).perform(post("/api/dev/admin-token")
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON).content("{\"nickname\":\"mario\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("NICKNAME_TAKEN"));
    }
}
