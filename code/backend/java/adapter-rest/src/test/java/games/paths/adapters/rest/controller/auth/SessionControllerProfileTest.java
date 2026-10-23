package games.paths.adapters.rest.controller.auth;

import games.paths.core.model.auth.AuthException;
import games.paths.core.model.auth.UserPreferences;
import games.paths.core.model.auth.UserProfile;
import games.paths.core.model.auth.UserStats;
import games.paths.core.port.auth.AccountPort;
import games.paths.core.port.auth.SessionPort;
import games.paths.core.service.security.CsrfTokenService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** v1.7.0 GET /api/auth/me statistics and preferences, PATCH /api/auth/me with CSRF and guest refusal. */
class SessionControllerProfileTest {

    private static final String SECRET = "secret-secret-secret-secret-secret";
    private static final String BEARER = "access-token";

    private AccountPort account;
    private MockMvc mvc;
    private final CsrfTokenService csrf = new CsrfTokenService(SECRET, true);

    @BeforeEach
    void setUp() {
        account = mock(AccountPort.class);
        mvc = MockMvcBuilders.standaloneSetup(new SessionController(mock(SessionPort.class), csrf, account)).build();
        when(account.profile("u-1")).thenReturn(Optional.of(new UserProfile("u-1", "google_u1", "mario", "Mario",
                null, "PLAYER", 2, "it", "GOOGLE")));
        when(account.preferences("u-1")).thenReturn(Optional.of(new UserPreferences("it", "high-contrast")));
        when(account.stats("u-1")).thenReturn(new UserStats(3, 1, 1, 90_000, 12));
    }

    private MockHttpServletRequestBuilder patchMe(String body) {
        return patch("/api/auth/me").requestAttr("userUuid", "u-1").header("Authorization", "Bearer " + BEARER)
                .header(CsrfTokenService.HEADER, csrf.tokenFor(BEARER))
                .contentType(MediaType.APPLICATION_JSON).content(body);
    }

    @Test
    void meCarriesPreferencesAndStatistics() throws Exception {
        mvc.perform(get("/api/auth/me").requestAttr("userUuid", "u-1").header("Authorization", "Bearer " + BEARER))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.preferences.language").value("it"))
                .andExpect(jsonPath("$.preferences.theme").value("high-contrast"))
                .andExpect(jsonPath("$.preferences.highContrast").value(true))
                .andExpect(jsonPath("$.stats.matchesPlayed").value(3))
                .andExpect(jsonPath("$.stats.matchesCompleted").value(1))
                .andExpect(jsonPath("$.stats.matchesGameOver").value(1))
                .andExpect(jsonPath("$.stats.playTimeMs").value(90_000))
                .andExpect(jsonPath("$.stats.clocksPlayed").value(12))
                .andExpect(jsonPath("$.csrfToken").value(csrf.tokenFor(BEARER)));
    }

    @Test
    void v170MeCarriesTheActiveSessions() throws Exception {
        SessionPort sessions = mock(SessionPort.class);
        when(sessions.activeSessions("u-1")).thenReturn(4);
        MockMvc withSessions = MockMvcBuilders.standaloneSetup(new SessionController(sessions, csrf, account)).build();
        withSessions.perform(get("/api/auth/me").requestAttr("userUuid", "u-1")
                        .header("Authorization", "Bearer " + BEARER))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activeSessions").value(4));
    }

    @Test
    void patchSavesAndAnswersTheProfile() throws Exception {
        mvc.perform(patchMe("{\"language\":\"en\",\"highContrast\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stats.matchesPlayed").value(3));
        verify(account).updatePreferences("u-1", "en", "high-contrast");
        mvc.perform(patchMe("{\"highContrast\":false}")).andExpect(status().isOk());
        verify(account).updatePreferences("u-1", null, "default");
        mvc.perform(patchMe("{\"theme\":\"high-contrast\",\"highContrast\":false}")).andExpect(status().isOk());
        verify(account).updatePreferences("u-1", null, "high-contrast");
    }

    @Test
    void patchRefusesWrongTypesAndServiceErrors() throws Exception {
        mvc.perform(patchMe("{\"language\":5}")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_REQUEST"));
        mvc.perform(patchMe("{\"theme\":true}")).andExpect(status().isBadRequest());
        mvc.perform(patchMe("{\"highContrast\":\"yes\"}")).andExpect(status().isBadRequest());
        when(account.updatePreferences("u-1", "fr", null))
                .thenThrow(new AuthException(AuthException.Code.INVALID_REQUEST, "Unsupported language: fr"));
        mvc.perform(patchMe("{\"language\":\"fr\"}")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_REQUEST"));
        when(account.updatePreferences("u-1", "en", null))
                .thenThrow(new AuthException(AuthException.Code.GOOGLE_ACCOUNT_REQUIRED, "guest"));
        mvc.perform(patchMe("{\"language\":\"en\"}")).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("GOOGLE_ACCOUNT_REQUIRED"));
    }

    @Test
    void patchNeedsAUserAndTheCsrfHeader() throws Exception {
        mvc.perform(patch("/api/auth/me").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(patch("/api/auth/me").requestAttr("userUuid", "u-1").header("Authorization", "Bearer " + BEARER)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"language\":\"en\"}"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.error").value("CSRF_TOKEN_MISSING"));
        mvc.perform(patch("/api/auth/me").requestAttr("userUuid", "u-1").header("Authorization", "Bearer " + BEARER)
                        .header(CsrfTokenService.HEADER, "forged")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"language\":\"en\"}"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.error").value("CSRF_TOKEN_INVALID"));
        verify(account, never()).updatePreferences(any(), any(), any());
        MockMvc noAccount = MockMvcBuilders.standaloneSetup(new SessionController(mock(SessionPort.class))).build();
        noAccount.perform(patch("/api/auth/me").requestAttr("userUuid", "u-1")
                .contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isUnauthorized());
    }

    @Test
    void anEmptyBodyIsLeftToTheServiceAndCsrfOffSkipsTheCheck() throws Exception {
        MockMvc relaxed = MockMvcBuilders.standaloneSetup(new SessionController(mock(SessionPort.class),
                new CsrfTokenService(SECRET, false), account)).build();
        when(account.updatePreferences("u-1", null, null))
                .thenThrow(new AuthException(AuthException.Code.INVALID_REQUEST, "Nothing to update"));
        relaxed.perform(patch("/api/auth/me").requestAttr("userUuid", "u-1")).andExpect(status().isBadRequest());
        when(account.preferences("u-1")).thenReturn(Optional.empty());
        relaxed.perform(patch("/api/auth/me").requestAttr("userUuid", "u-1").contentType(MediaType.APPLICATION_JSON)
                .content("{\"language\":\"it\"}")).andExpect(status().isOk())
                .andExpect(jsonPath("$.preferences").doesNotExist());
    }
}
