package games.paths.adapters.rest.controller.auth;

import games.paths.adapters.rest.cookie.CookieHelper;
import games.paths.core.model.auth.AuthException;
import games.paths.core.model.auth.AuthenticatedSession;
import games.paths.core.model.auth.GoogleLoginCommand;
import games.paths.core.model.auth.UserProfile;
import games.paths.core.port.auth.GoogleLoginPort;
import games.paths.core.service.security.CsrfTokenService;
import games.paths.core.service.security.RateLimitService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit tests of {@link GoogleAuthController} (v1.2.0 POST /api/auth/google).
 */
class GoogleAuthControllerTest {

    private static final String BODY = "{\"idToken\":\"id\",\"nonce\":\"n\",\"language\":\"it\"}";

    private static AuthenticatedSession session(String mergedGuest) {
        UserProfile profile = new UserProfile("u-1", "google_u1", "mario", "Mario Rossi", "pic", "PLAYER", 2, "it",
                "GOOGLE");
        return new AuthenticatedSession(profile, "access", "refresh", 1L, 2L, true, mergedGuest, 1);
    }

    private static MockMvc mvc(GoogleLoginPort port, RateLimitService limiter, int perIp) {
        return MockMvcBuilders.standaloneSetup(new GoogleAuthController(port, limiter, perIp,
                new CsrfTokenService("secret-secret-secret-secret-secret", true))).build();
    }

    @Test
    void loginSetsTheRefreshCookieAndMergesTheGuest() throws Exception {
        GoogleLoginPort port = mock(GoogleLoginPort.class);
        when(port.login(any())).thenReturn(session("g-1"));
        MvcResult result = mvc(port, null, 0).perform(post("/api/auth/google").contentType(MediaType.APPLICATION_JSON)
                        .content(BODY).header("Authorization", "Bearer guest-access")
                        .cookie(new Cookie(CookieHelper.GUEST_COOKIE_TOKEN, "cookie")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userUuid").value("u-1"))
                .andExpect(jsonPath("$.nickname").value("mario"))
                .andExpect(jsonPath("$.displayName").value("Mario Rossi"))
                .andExpect(jsonPath("$.accountType").value("GOOGLE"))
                .andExpect(jsonPath("$.accessToken").value("access"))
                .andExpect(jsonPath("$.mergedGuest").value(true))
                .andExpect(jsonPath("$.cancelledMatches").value(1))
                .andExpect(jsonPath("$.csrfToken").isNotEmpty())
                .andReturn();
        List<String> cookies = result.getResponse().getHeaders("Set-Cookie");
        assertTrue(cookies.stream().anyMatch(c -> c.startsWith(CookieHelper.REFRESH_TOKEN_COOKIE + "=refresh")));
        assertTrue(cookies.stream().anyMatch(c -> c.startsWith(CookieHelper.GUEST_COOKIE_TOKEN + "=;")));
        ArgumentCaptor<GoogleLoginCommand> cmd = ArgumentCaptor.forClass(GoogleLoginCommand.class);
        verify(port).login(cmd.capture());
        assertEquals("id", cmd.getValue().idToken());
        assertEquals("guest-access", cmd.getValue().guestAccessToken());
        assertEquals("cookie", cmd.getValue().guestCookieToken());
        assertEquals("it", cmd.getValue().language());
    }

    @Test
    void loginWithoutGuestKeepsCookiesAndNoCsrfService() throws Exception {
        GoogleLoginPort port = mock(GoogleLoginPort.class);
        when(port.login(any())).thenReturn(session(null));
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new GoogleAuthController(port, null, 0, null)).build();
        MvcResult result = mvc.perform(post("/api/auth/google").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"idToken\":5}").header("Authorization", "Basic x"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mergedGuest").value(false))
                .andReturn();
        assertTrue(result.getResponse().getHeaders("Set-Cookie").stream()
                .noneMatch(c -> c.startsWith(CookieHelper.GUEST_COOKIE_TOKEN)));
        ArgumentCaptor<GoogleLoginCommand> cmd = ArgumentCaptor.forClass(GoogleLoginCommand.class);
        verify(port).login(cmd.capture());
        assertNull(cmd.getValue().idToken());
        assertNull(cmd.getValue().guestAccessToken());
    }

    @Test
    void refusalsCarryTheirCodeAndStatus() throws Exception {
        GoogleLoginPort port = mock(GoogleLoginPort.class);
        when(port.login(any())).thenThrow(new AuthException(AuthException.Code.EMAIL_DOMAIN_NOT_ALLOWED, "gmail only"));
        mvc(port, null, 0).perform(post("/api/auth/google").contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("EMAIL_DOMAIN_NOT_ALLOWED"));
        doThrow(new AuthException(AuthException.Code.IDENTITY_MISMATCH, "support")).when(port).login(any());
        mvc(port, null, 0).perform(post("/api/auth/google").contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isConflict());
        doThrow(new AuthException(AuthException.Code.PROVIDER_UNAVAILABLE, "down")).when(port).login(any());
        mvc(port, null, 0).perform(post("/api/auth/google")).andExpect(status().isServiceUnavailable());
    }

    @Test
    void googlePerIpRateLimit() throws Exception {
        GoogleLoginPort port = mock(GoogleLoginPort.class);
        when(port.login(any())).thenReturn(session(null));
        MockMvc mvc = mvc(port, new RateLimitService(3600), 1);
        mvc.perform(post("/api/auth/google").contentType(MediaType.APPLICATION_JSON).content(BODY)
                .header("X-Forwarded-For", "9.9.9.9")).andExpect(status().isOk());
        mvc.perform(post("/api/auth/google").contentType(MediaType.APPLICATION_JSON).content(BODY)
                        .header("X-Forwarded-For", "9.9.9.9"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.error").value("RATE_LIMITED"));
    }
}
