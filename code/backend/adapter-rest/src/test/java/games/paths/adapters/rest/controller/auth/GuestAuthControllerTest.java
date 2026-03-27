package games.paths.adapters.rest.controller.auth;

import games.paths.adapters.rest.controller.auth.GuestAuthController;
import games.paths.core.model.auth.GuestSession;
import games.paths.core.port.auth.GuestAuthPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

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

        mockMvc.perform(post("/api/v1/auth/guest")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userUuid").value("550e8400-e29b-41d4-a716-446655440000"))
                .andExpect(jsonPath("$.username").value("guest_550e8400"))
                .andExpect(jsonPath("$.accessToken").value("eyJ.access.token"))
                .andExpect(jsonPath("$.refreshToken").value("eyJ.refresh.token"))
                .andExpect(jsonPath("$.guestCookieToken").value("cookie-token-123"));
    }

    @Test
    void resumeGuestSession_shouldReturn200ForValidToken() throws Exception {
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

        mockMvc.perform(post("/api/v1/auth/guest/resume")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"guestCookieToken\": \"cookie-token-123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userUuid").value("550e8400-e29b-41d4-a716-446655440000"))
                .andExpect(jsonPath("$.accessToken").value("eyJ.new.access"));
    }

    @Test
    void resumeGuestSession_shouldReturn401ForExpiredSession() throws Exception {
        when(guestAuthPort.resumeGuestSession("expired-token")).thenReturn(null);

        mockMvc.perform(post("/api/v1/auth/guest/resume")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"guestCookieToken\": \"expired-token\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("SESSION_EXPIRED_OR_NOT_FOUND"));
    }

    @Test
    void resumeGuestSession_shouldReturn400ForMissingToken() throws Exception {
        mockMvc.perform(post("/api/v1/auth/guest/resume")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("MISSING_COOKIE_TOKEN"));
    }

    @Test
    void resumeGuestSession_shouldReturn400ForBlankToken() throws Exception {
        mockMvc.perform(post("/api/v1/auth/guest/resume")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"guestCookieToken\": \"   \"}"))
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

        mockMvc.perform(post("/api/v1/auth/guest"))
                .andExpect(status().isCreated())
                .andExpect(content().contentTypeCompatibleWith("application/json"));
    }
}
