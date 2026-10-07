package games.paths.adapters.rest.controller.security;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import games.paths.adapters.rest.controller.auth.GuestAuthController;
import games.paths.adapters.rest.controller.auth.SessionController;
import games.paths.adapters.rest.controller.match.MatchController;
import games.paths.adapters.rest.cookie.CookieHelper;
import games.paths.core.model.auth.GuestSession;
import games.paths.core.model.auth.RefreshedSession;
import games.paths.core.model.match.MatchSummary;
import games.paths.core.port.auth.GuestAuthPort;
import games.paths.core.port.auth.SessionPort;
import games.paths.core.port.match.MatchCommandPort;
import games.paths.core.port.match.MatchQueryPort;
import games.paths.core.service.security.CsrfTokenService;
import games.paths.core.service.security.RateLimitService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/**
 * v0.37.7 — Step 41: the rate limiter on guest and match creation, and the CSRF token that
 * every access token is issued with and that POST /api/matches demands back.
 */
class Step41SecurityControllerTest {

    private static final String SECRET = "PathsGamesDevSecret2026_MustBeAtLeast32Chars!";
    private static final String ACCESS = "eyJ.access.token";

    private final CsrfTokenService csrf = new CsrfTokenService(SECRET, true);

    private GuestSession guestSession() {
        return GuestSession.builder()
                .userUuid("u-1").username("guest_u1")
                .accessToken(ACCESS).refreshToken("r")
                .accessTokenExpiresAt(1L).refreshTokenExpiresAt(2L)
                .guestCookieToken("c").build();
    }

    @Nested
    @DisplayName("POST /api/auth/guest")
    class GuestCreation {
        private GuestAuthPort guestAuthPort;
        private RateLimitService limiter;

        @BeforeEach
        void setUp() {
            guestAuthPort = mock(GuestAuthPort.class);
            when(guestAuthPort.createGuestSession(any())).thenReturn(guestSession());
            when(guestAuthPort.resumeGuestSession(any())).thenReturn(guestSession());
            limiter = new RateLimitService(3600);
        }

        private MockMvc mvc(int guestPerIp) {
            return MockMvcBuilders.standaloneSetup(
                    new GuestAuthController(guestAuthPort, true, limiter, guestPerIp, csrf)).build();
        }

        @Test
        @DisplayName("The response carries the CSRF token bound to the access token, on create and resume")
        void csrfTokenIssued() throws Exception {
            MockMvc mvc = mvc(0);
            mvc.perform(post("/api/auth/guest"))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.csrfToken").value(csrf.tokenFor(ACCESS)));
            mvc.perform(post("/api/auth/guest/resume")
                            .cookie(new Cookie(CookieHelper.GUEST_COOKIE_TOKEN, "c")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.csrfToken").value(csrf.tokenFor(ACCESS)));
        }

        @Test
        @DisplayName("The limit-th guest from one address passes, the next answers 429 with Retry-After")
        void guestRateLimited() throws Exception {
            MockMvc mvc = mvc(2);
            mvc.perform(post("/api/auth/guest").with(r -> { r.setRemoteAddr("1.1.1.1"); return r; }))
                    .andExpect(status().isCreated());
            mvc.perform(post("/api/auth/guest").with(r -> { r.setRemoteAddr("1.1.1.1"); return r; }))
                    .andExpect(status().isCreated());
            mvc.perform(post("/api/auth/guest").with(r -> { r.setRemoteAddr("1.1.1.1"); return r; }))
                    .andExpect(status().isTooManyRequests())
                    .andExpect(header().exists("Retry-After"))
                    .andExpect(jsonPath("$.error").value("RATE_LIMITED"))
                    .andExpect(jsonPath("$.retryAfterSeconds").isNumber());
            // another address is not affected, and the forwarded hop is what counts
            mvc.perform(post("/api/auth/guest").with(r -> { r.setRemoteAddr("1.1.1.1"); return r; })
                            .header("X-Forwarded-For", "2.2.2.2, 1.1.1.1"))
                    .andExpect(status().isCreated());
            verify(guestAuthPort, times(3)).createGuestSession(any());
        }

        @Test
        @DisplayName("A zero limit never refuses, and the legacy constructor issues no CSRF token")
        void disabled() throws Exception {
            MockMvc mvc = mvc(0);
            for (int i = 0; i < 20; i++) {
                mvc.perform(post("/api/auth/guest")).andExpect(status().isCreated());
            }
            MockMvc legacy = MockMvcBuilders.standaloneSetup(new GuestAuthController(guestAuthPort, true)).build();
            legacy.perform(post("/api/auth/guest"))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.csrfToken").doesNotExist());
        }
    }

    @Nested
    @DisplayName("POST /api/auth/refresh")
    class Refresh {
        @Test
        @DisplayName("A refreshed access token comes with its own CSRF token")
        void refreshCarriesCsrf() throws Exception {
            SessionPort sessionPort = mock(SessionPort.class);
            when(sessionPort.refreshToken("old")).thenReturn(RefreshedSession.builder()
                    .userUuid("u-1").username("g").role("PLAYER")
                    .accessToken("new-access").refreshToken("new-refresh")
                    .accessTokenExpiresAt(1L).refreshTokenExpiresAt(2L).build());
            MockMvc mvc = MockMvcBuilders.standaloneSetup(new SessionController(sessionPort, csrf)).build();
            mvc.perform(post("/api/auth/refresh").cookie(new Cookie(CookieHelper.REFRESH_TOKEN_COOKIE, "old")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.csrfToken").value(csrf.tokenFor("new-access")));
        }
    }

    @Nested
    @DisplayName("GET /api/auth/me")
    class Me {
        @Test
        @DisplayName("Answers the CSRF token of the bearer it was called with")
        void meCarriesCsrf() throws Exception {
            MockMvc mvc = MockMvcBuilders.standaloneSetup(new SessionController(mock(SessionPort.class), csrf)).build();
            mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/auth/me")
                            .requestAttr("userUuid", "u-1").requestAttr("username", "g").requestAttr("role", "PLAYER")
                            .header("Authorization", "Bearer " + ACCESS))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.csrfToken").value(csrf.tokenFor(ACCESS)));
            MockMvc legacy = MockMvcBuilders.standaloneSetup(new SessionController(mock(SessionPort.class))).build();
            legacy.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/auth/me")
                            .requestAttr("userUuid", "u-1"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.csrfToken").doesNotExist());
        }
    }

    @Nested
    @DisplayName("POST /api/matches")
    class MatchCreation {
        private MatchCommandPort commandPort;
        private RateLimitService limiter;

        @BeforeEach
        void setUp() {
            commandPort = mock(MatchCommandPort.class);
            MatchSummary s = new MatchSummary();
            s.setUuid("m-1");
            when(commandPort.createMatch(any())).thenReturn(s);
            limiter = new RateLimitService(3600);
        }

        private MockMvc mvc(int matchPerIp, CsrfTokenService service) {
            return MockMvcBuilders.standaloneSetup(new MatchController(commandPort,
                    mock(MatchQueryPort.class), limiter, matchPerIp, service)).build();
        }

        private MockHttpServletRequestBuilder create(String ip) {
            return post("/api/matches")
                    .requestAttr("userUuid", "u-1")
                    .header("Authorization", "Bearer " + ACCESS)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"storyUuid\":\"s\",\"difficultyUuid\":\"d\"}")
                    .with(r -> { r.setRemoteAddr(ip); return r; });
        }

        @Test
        @DisplayName("Without the header the match is refused with CSRF_TOKEN_MISSING")
        void missing() throws Exception {
            mvc(0, csrf).perform(create("1.1.1.1"))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.error").value("CSRF_TOKEN_MISSING"));
            verify(commandPort, never()).createMatch(any());
        }

        @Test
        @DisplayName("A token issued for another access token is refused with CSRF_TOKEN_INVALID")
        void invalid() throws Exception {
            mvc(0, csrf).perform(create("1.1.1.1").header(CsrfTokenService.HEADER, csrf.tokenFor("other")))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.error").value("CSRF_TOKEN_INVALID"));
            verify(commandPort, never()).createMatch(any());
        }

        @Test
        @DisplayName("The right token lets the creation through")
        void valid() throws Exception {
            mvc(0, csrf).perform(create("1.1.1.1").header(CsrfTokenService.HEADER, csrf.tokenFor(ACCESS)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.uuid").value("m-1"));
        }

        @Test
        @DisplayName("Not enforced, or the legacy constructor: the header is not asked for")
        void notEnforced() throws Exception {
            mvc(0, new CsrfTokenService(SECRET, false)).perform(create("1.1.1.1"))
                    .andExpect(status().isCreated());
            MockMvc legacy = MockMvcBuilders.standaloneSetup(
                    new MatchController(commandPort, mock(MatchQueryPort.class))).build();
            legacy.perform(create("1.1.1.1")).andExpect(status().isCreated());
        }

        @Test
        @DisplayName("The limit-th match from one address passes, the next answers 429")
        void matchRateLimited() throws Exception {
            MockMvc mvc = mvc(1, csrf);
            String token = csrf.tokenFor(ACCESS);
            mvc.perform(create("3.3.3.3").header(CsrfTokenService.HEADER, token))
                    .andExpect(status().isCreated());
            mvc.perform(create("3.3.3.3").header(CsrfTokenService.HEADER, token))
                    .andExpect(status().isTooManyRequests())
                    .andExpect(header().exists("Retry-After"))
                    .andExpect(jsonPath("$.error").value("RATE_LIMITED"))
                    .andExpect(jsonPath("$.retryAfterSeconds").isNumber());
            mvc.perform(create("4.4.4.4").header(CsrfTokenService.HEADER, token))
                    .andExpect(status().isCreated());
            verify(commandPort, times(2)).createMatch(any());
        }

        @Test
        @DisplayName("The CSRF check runs before the rate limit, so a forged call never spends the window")
        void csrfBeforeRateLimit() throws Exception {
            MockMvc mvc = mvc(1, csrf);
            mvc.perform(create("5.5.5.5")).andExpect(status().isForbidden());
            mvc.perform(create("5.5.5.5").header(CsrfTokenService.HEADER, csrf.tokenFor(ACCESS)))
                    .andExpect(status().isCreated());
        }
    }
}
