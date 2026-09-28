package games.paths.adapters.rest.controller.security;

import games.paths.adapters.rest.controller.auth.GuestAuthController;
import games.paths.adapters.rest.controller.match.MatchController;
import games.paths.core.model.auth.GuestSession;
import games.paths.core.model.match.MatchSummary;
import games.paths.core.port.auth.GuestAuthPort;
import games.paths.core.port.match.MatchCommandPort;
import games.paths.core.port.match.MatchQueryPort;
import games.paths.core.service.security.RateLimitService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** v0.41.0 — Step 41: the per-guest match bucket and the dev/test aged-guest header. */
class Step41AlphaPrepControllerTest {

    private static GuestSession guestSession() {
        return GuestSession.builder()
                .userUuid("u-1").username("robottest_u1")
                .accessToken("a").refreshToken("r")
                .accessTokenExpiresAt(1L).refreshTokenExpiresAt(2L)
                .guestCookieToken("c").build();
    }

    @Nested
    @DisplayName("POST /api/matches — match-guest bucket")
    class PerGuestBucket {
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

        private MockMvc mvc(int perIp, int perGuest) {
            return MockMvcBuilders.standaloneSetup(new MatchController(commandPort,
                    mock(MatchQueryPort.class), limiter, perIp, null, perGuest, 86400)).build();
        }

        private MockHttpServletRequestBuilder create(String user, String ip) {
            return post("/api/matches")
                    .requestAttr("userUuid", user)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"storyUuid\":\"s\",\"difficultyUuid\":\"d\"}")
                    .with(r -> { r.setRemoteAddr(ip); return r; });
        }

        @Test
        @DisplayName("The limit-th match of one guest passes, the next answers 429 on any address")
        void perGuestLimit() throws Exception {
            MockMvc mvc = mvc(0, 2);
            mvc.perform(create("u-1", "1.1.1.1")).andExpect(status().isCreated());
            mvc.perform(create("u-1", "2.2.2.2")).andExpect(status().isCreated());
            mvc.perform(create("u-1", "3.3.3.3"))
                    .andExpect(status().isTooManyRequests())
                    .andExpect(header().string("Retry-After", "86400"))
                    .andExpect(jsonPath("$.error").value("RATE_LIMITED"))
                    .andExpect(jsonPath("$.retryAfterSeconds").value(86400))
                    .andExpect(jsonPath("$.message").value(
                            org.hamcrest.Matchers.startsWith("Too many matches created by this player")));
            // another guest is not affected
            mvc.perform(create("u-2", "3.3.3.3")).andExpect(status().isCreated());
            verify(commandPort, times(3)).createMatch(any());
        }

        @Test
        @DisplayName("Zero disables the bucket; the per-IP bucket still answers first")
        void zeroDisablesAndIpComesFirst() throws Exception {
            MockMvc off = mvc(0, 0);
            for (int i = 0; i < 12; i++) {
                off.perform(create("u-9", "9.9.9.9")).andExpect(status().isCreated());
            }
            MockMvc both = mvc(1, 5);
            both.perform(create("u-3", "4.4.4.4")).andExpect(status().isCreated());
            both.perform(create("u-3", "4.4.4.4"))
                    .andExpect(status().isTooManyRequests())
                    .andExpect(jsonPath("$.message").value(
                            org.hamcrest.Matchers.startsWith("Too many matches created from this address")));
        }

        @Test
        @DisplayName("No limiter at all: nothing is counted")
        void noLimiter() throws Exception {
            MockMvc mvc = MockMvcBuilders.standaloneSetup(new MatchController(commandPort,
                    mock(MatchQueryPort.class), null, 1, null, 1, 86400)).build();
            mvc.perform(create("u-1", "1.1.1.1")).andExpect(status().isCreated());
            mvc.perform(create("u-1", "1.1.1.1")).andExpect(status().isCreated());
        }
    }

    @Nested
    @DisplayName("POST /api/auth/guest — X-Test-Guest-Age-Days")
    class AgedGuest {
        private GuestAuthPort guestAuthPort;

        @BeforeEach
        void setUp() {
            guestAuthPort = mock(GuestAuthPort.class);
            when(guestAuthPort.createGuestSession(any())).thenReturn(guestSession());
            when(guestAuthPort.createGuestSession(any(), any())).thenReturn(guestSession());
        }

        private MockMvc mvc(boolean testEndpoints) {
            return MockMvcBuilders.standaloneSetup(new GuestAuthController(guestAuthPort, testEndpoints)).build();
        }

        @Test
        @DisplayName("With test endpoints on, marker and age reach the service")
        void ageForwarded() throws Exception {
            mvc(true).perform(post("/api/auth/guest")
                            .header("X-Test-Marker", "robottest")
                            .header("X-Test-Guest-Age-Days", " 400 "))
                    .andExpect(status().isCreated());
            verify(guestAuthPort).createGuestSession("robottest", 400);
        }

        @Test
        @DisplayName("With test endpoints off the header is ignored")
        void ignoredInProduction() throws Exception {
            mvc(false).perform(post("/api/auth/guest")
                            .header("X-Test-Marker", "robottest")
                            .header("X-Test-Guest-Age-Days", "400"))
                    .andExpect(status().isCreated());
            verify(guestAuthPort).createGuestSession((String) null);
            verify(guestAuthPort, never()).createGuestSession(any(), anyInt());
        }

        @Test
        @DisplayName("A value that is not a number is ignored, never an error")
        void notANumber() throws Exception {
            mvc(true).perform(post("/api/auth/guest")
                            .header("X-Test-Marker", "robottest")
                            .header("X-Test-Guest-Age-Days", "old"))
                    .andExpect(status().isCreated());
            verify(guestAuthPort).createGuestSession("robottest");
        }

        @Test
        @DisplayName("parseAge reads a trimmed integer or nothing")
        void parseAge() throws Exception {
            java.lang.reflect.Method m = GuestAuthController.class.getDeclaredMethod("parseAge", String.class);
            m.setAccessible(true);
            assertEquals(12, m.invoke(null, "12"));
            assertNull(m.invoke(null, (Object) null));
            assertNull(m.invoke(null, "  "));
            assertNull(m.invoke(null, "1.5"));
        }
    }
}
