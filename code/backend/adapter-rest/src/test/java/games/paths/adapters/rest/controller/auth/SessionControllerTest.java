package games.paths.adapters.rest.controller.auth;

import games.paths.adapters.rest.cookie.CookieHelper;
import games.paths.core.model.auth.RefreshedSession;
import games.paths.core.port.auth.SessionPort;

import jakarta.servlet.http.Cookie;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit tests for {@link SessionController}.
 * Since v0.13.0-httponly, refresh tokens are read from / written to HttpOnly cookies.
 */
class SessionControllerTest {

    private MockMvc mockMvc;
    private SessionPort sessionPort;

    @BeforeEach
    void setup() {
        sessionPort = mock(SessionPort.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new SessionController(sessionPort)).build();
    }

    // ==========================================================================
    // POST /api/auth/refresh
    // ==========================================================================

    @Nested
    @DisplayName("POST /api/auth/refresh")
    class RefreshTests {

        @Test
        @DisplayName("Should return 200 with new access token and set HttpOnly cookie on success")
        void refresh_success() throws Exception {
            RefreshedSession session = RefreshedSession.builder()
                    .userUuid("u-1")
                    .username("guest_u1")
                    .role("PLAYER")
                    .accessToken("new-access")
                    .refreshToken("new-refresh")
                    .accessTokenExpiresAt(1000L)
                    .refreshTokenExpiresAt(2000L)
                    .build();

            when(sessionPort.refreshToken("old-refresh")).thenReturn(session);

            MvcResult result = mockMvc.perform(post("/api/auth/refresh")
                            .cookie(new Cookie(CookieHelper.REFRESH_TOKEN_COOKIE, "old-refresh")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.userUuid").value("u-1"))
                    .andExpect(jsonPath("$.username").value("guest_u1"))
                    .andExpect(jsonPath("$.role").value("PLAYER"))
                    .andExpect(jsonPath("$.accessToken").value("new-access"))
                    .andExpect(jsonPath("$.refreshToken").doesNotExist())
                    .andExpect(jsonPath("$.accessTokenExpiresAt").value(1000))
                    .andExpect(jsonPath("$.refreshTokenExpiresAt").value(2000))
                    .andReturn();

            List<String> setCookies = result.getResponse().getHeaders("Set-Cookie");
            assertTrue(setCookies.stream().anyMatch(h ->
                    h.contains("pathsgames.refreshToken=new-refresh") && h.contains("HttpOnly")),
                    "New refresh token should be set as HttpOnly cookie");
        }

        @Test
        @DisplayName("Should return 400 when refresh cookie is missing")
        void refresh_missingToken() throws Exception {
            mockMvc.perform(post("/api/auth/refresh"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("MISSING_REFRESH_TOKEN"));
        }

        @Test
        @DisplayName("Should return 400 when refresh cookie is blank")
        void refresh_blankToken() throws Exception {
            mockMvc.perform(post("/api/auth/refresh")
                            .cookie(new Cookie(CookieHelper.REFRESH_TOKEN_COOKIE, "   ")))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("MISSING_REFRESH_TOKEN"));
        }

        @Test
        @DisplayName("Should return 401 when refresh token is invalid/expired")
        void refresh_invalidToken() throws Exception {
            when(sessionPort.refreshToken("expired")).thenReturn(null);

            mockMvc.perform(post("/api/auth/refresh")
                            .cookie(new Cookie(CookieHelper.REFRESH_TOKEN_COOKIE, "expired")))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.error").value("INVALID_REFRESH_TOKEN"));
        }
    }

    // ==========================================================================
    // POST /api/auth/logout
    // ==========================================================================

    @Nested
    @DisplayName("POST /api/auth/logout")
    class LogoutTests {

        @Test
        @DisplayName("Should return 200 on successful revocation and delete cookies")
        void logout_success() throws Exception {
            when(sessionPort.logout("ref-tok")).thenReturn(true);

            MvcResult result = mockMvc.perform(post("/api/auth/logout")
                            .cookie(new Cookie(CookieHelper.REFRESH_TOKEN_COOKIE, "ref-tok")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("OK"))
                    .andExpect(jsonPath("$.message").value("Token revoked successfully"))
                    .andReturn();

            List<String> setCookies = result.getResponse().getHeaders("Set-Cookie");
            assertTrue(setCookies.stream().anyMatch(h ->
                    h.contains("pathsgames.refreshToken=") && h.contains("Max-Age=0")),
                    "refreshToken cookie should be deleted on logout");
        }

        @Test
        @DisplayName("Should return 400 when refresh cookie is missing")
        void logout_missingToken() throws Exception {
            mockMvc.perform(post("/api/auth/logout"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("MISSING_REFRESH_TOKEN"));
        }

        @Test
        @DisplayName("Should return 400 when refresh cookie is blank")
        void logout_blankToken() throws Exception {
            mockMvc.perform(post("/api/auth/logout")
                            .cookie(new Cookie(CookieHelper.REFRESH_TOKEN_COOKIE, "   ")))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("MISSING_REFRESH_TOKEN"));
        }

        @Test
        @DisplayName("Should return 404 when token not found")
        void logout_notFound() throws Exception {
            when(sessionPort.logout("unknown")).thenReturn(false);

            mockMvc.perform(post("/api/auth/logout")
                            .cookie(new Cookie(CookieHelper.REFRESH_TOKEN_COOKIE, "unknown")))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error").value("TOKEN_NOT_FOUND"));
        }
    }

    // ==========================================================================
    // POST /api/auth/logout/all
    // ==========================================================================

    @Nested
    @DisplayName("POST /api/auth/logout/all")
    class LogoutAllTests {

        @Test
        @DisplayName("Should return 200 on successful revocation of all sessions")
        void logoutAll_success() throws Exception {
            when(sessionPort.revokeAllSessions("u-1")).thenReturn(true);

            mockMvc.perform(post("/api/auth/logout/all")
                            .requestAttr("userUuid", "u-1"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("OK"))
                    .andExpect(jsonPath("$.message").value("All sessions revoked successfully"));
        }

        @Test
        @DisplayName("Should return 401 when userUuid attribute is missing")
        void logoutAll_noUserUuid() throws Exception {
            mockMvc.perform(post("/api/auth/logout/all"))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.error").value("UNAUTHORIZED"));
        }

        @Test
        @DisplayName("Should return 401 when userUuid attribute is blank")
        void logoutAll_blankUserUuid() throws Exception {
            mockMvc.perform(post("/api/auth/logout/all")
                            .requestAttr("userUuid", "  "))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.error").value("UNAUTHORIZED"));
        }

        @Test
        @DisplayName("Should return 404 when user not found for session revocation")
        void logoutAll_userNotFound() throws Exception {
            when(sessionPort.revokeAllSessions("u-unknown")).thenReturn(false);

            mockMvc.perform(post("/api/auth/logout/all")
                            .requestAttr("userUuid", "u-unknown"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error").value("USER_NOT_FOUND"));
        }
    }

    // ==========================================================================
    // GET /api/auth/me
    // ==========================================================================

    @Nested
    @DisplayName("GET /api/auth/me")
    class MeTests {

        @Test
        @DisplayName("Should return 200 with user info")
        void me_success() throws Exception {
            mockMvc.perform(get("/api/auth/me")
                            .requestAttr("userUuid", "u-42")
                            .requestAttr("username", "testuser")
                            .requestAttr("role", "ADMIN"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.userUuid").value("u-42"))
                    .andExpect(jsonPath("$.username").value("testuser"))
                    .andExpect(jsonPath("$.role").value("ADMIN"));
        }

        @Test
        @DisplayName("Should return 401 when userUuid attribute is missing")
        void me_noUserUuid() throws Exception {
            mockMvc.perform(get("/api/auth/me"))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.error").value("UNAUTHORIZED"));
        }

        @Test
        @DisplayName("Should return 401 when userUuid attribute is blank")
        void me_blankUserUuid() throws Exception {
            mockMvc.perform(get("/api/auth/me")
                            .requestAttr("userUuid", "  "))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.error").value("UNAUTHORIZED"));
        }
    }
}
