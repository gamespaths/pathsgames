package games.paths.adapters.rest.controller.auth;

import games.paths.adapters.rest.cookie.CookieHelper;
import games.paths.core.model.auth.GuestSession;
import games.paths.core.port.auth.GuestAuthPort;

import jakarta.servlet.http.Cookie;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit tests for {@link GuestAuthController}.
 * Since v0.13.0-httponly refreshToken and guestCookieToken are set as HttpOnly
 * cookies and no longer returned in the JSON body.
 */
class GuestAuthControllerTest {

        private MockMvc mockMvc;
        private GuestAuthPort guestAuthPort;

        @BeforeEach
        void setup() {
                guestAuthPort = mock(GuestAuthPort.class);
                mockMvc = MockMvcBuilders.standaloneSetup(new GuestAuthController(guestAuthPort)).build();
        }

        @Test
        void createGuestSession_shouldReturn201WithSessionData() throws Exception {
                GuestSession session = GuestSession.builder()
                                .userUuid("550e8400-e29b-41d4-a716-446655440000")
                                .username("guest_550e8400")
                                .accessToken("eyJ.access.token")
                                .refreshToken("eyJ.refresh.token")
                                .accessTokenExpiresAt(1700000000000L)
                                .refreshTokenExpiresAt(1700600000000L)
                                .guestCookieToken("cookie-token-123")
                                .build();

                when(guestAuthPort.createGuestSession()).thenReturn(session);

                MvcResult result = mockMvc.perform(post("/api/auth/guest"))
                                .andExpect(status().isCreated())
                                .andExpect(jsonPath("$.userUuid").value("550e8400-e29b-41d4-a716-446655440000"))
                                .andExpect(jsonPath("$.username").value("guest_550e8400"))
                                .andExpect(jsonPath("$.accessToken").value("eyJ.access.token"))
                                // refreshToken and guestCookieToken NOT in body (HttpOnly cookies)
                                .andExpect(jsonPath("$.refreshToken").doesNotExist())
                                .andExpect(jsonPath("$.guestCookieToken").doesNotExist())
                                .andReturn();

                // Verify HttpOnly cookies are set in the response
                List<String> setCookies = result.getResponse().getHeaders("Set-Cookie");
                assertTrue(setCookies.stream().anyMatch(h ->
                        h.contains("pathsgames.refreshToken=eyJ.refresh.token") && h.contains("HttpOnly")),
                        "refreshToken cookie should be set as HttpOnly");
                assertTrue(setCookies.stream().anyMatch(h ->
                        h.contains("pathsgames.guestcookie=cookie-token-123") && h.contains("HttpOnly")),
                        "guestCookieToken cookie should be set as HttpOnly");
        }

        @Test
        void resumeGuestSession_shouldReturn200ForValidCookie() throws Exception {
                GuestSession session = GuestSession.builder()
                                .userUuid("550e8400-e29b-41d4-a716-446655440000")
                                .username("guest_550e8400")
                                .accessToken("eyJ.new.access")
                                .refreshToken("eyJ.new.refresh")
                                .accessTokenExpiresAt(1700000000000L)
                                .refreshTokenExpiresAt(1700600000000L)
                                .guestCookieToken("cookie-token-123")
                                .build();

                when(guestAuthPort.resumeGuestSession("cookie-token-123")).thenReturn(session);

                MvcResult result = mockMvc.perform(post("/api/auth/guest/resume")
                                .cookie(new Cookie(CookieHelper.GUEST_COOKIE_TOKEN, "cookie-token-123")))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.userUuid").value("550e8400-e29b-41d4-a716-446655440000"))
                                .andExpect(jsonPath("$.accessToken").value("eyJ.new.access"))
                                .andExpect(jsonPath("$.refreshToken").doesNotExist())
                                .andReturn();

                // Verify HttpOnly cookies are refreshed
                List<String> setCookies = result.getResponse().getHeaders("Set-Cookie");
                assertTrue(setCookies.stream().anyMatch(h ->
                        h.contains("pathsgames.refreshToken=") && h.contains("HttpOnly")));
        }

        @Test
        void resumeGuestSession_shouldReturn401ForExpiredSession() throws Exception {
                when(guestAuthPort.resumeGuestSession("expired-token")).thenReturn(null);

                mockMvc.perform(post("/api/auth/guest/resume")
                                .cookie(new Cookie(CookieHelper.GUEST_COOKIE_TOKEN, "expired-token")))
                                .andExpect(status().isUnauthorized())
                                .andExpect(jsonPath("$.error").value("SESSION_EXPIRED_OR_NOT_FOUND"));
        }

        @Test
        void resumeGuestSession_shouldReturn400ForMissingCookie() throws Exception {
                // No cookie at all
                mockMvc.perform(post("/api/auth/guest/resume"))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.error").value("MISSING_COOKIE_TOKEN"));
        }

        @Test
        void resumeGuestSession_shouldReturn400ForBlankCookie() throws Exception {
                mockMvc.perform(post("/api/auth/guest/resume")
                                .cookie(new Cookie(CookieHelper.GUEST_COOKIE_TOKEN, "   ")))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.error").value("MISSING_COOKIE_TOKEN"));
        }

        @Test
        void createGuestSession_shouldReturnJsonContentType() throws Exception {
                GuestSession session = GuestSession.builder()
                                .userUuid("uuid")
                                .username("guest_test")
                                .accessToken("token")
                                .refreshToken("refresh")
                                .accessTokenExpiresAt(1700000000000L)
                                .refreshTokenExpiresAt(1700600000000L)
                                .guestCookieToken("cookie")
                                .build();

                when(guestAuthPort.createGuestSession()).thenReturn(session);

                mockMvc.perform(post("/api/auth/guest"))
                                .andExpect(status().isCreated())
                                .andExpect(content().contentTypeCompatibleWith("application/json"));
        }
}
