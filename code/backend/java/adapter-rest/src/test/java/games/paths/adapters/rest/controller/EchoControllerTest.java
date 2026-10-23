package games.paths.adapters.rest.controller;

import games.paths.adapters.rest.controller.EchoController;
import games.paths.core.port.EchoPort;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class EchoControllerTest {

    private MockMvc mockMvc;
    private EchoPort echoPort;

    @BeforeEach
    void setup() {
        echoPort = mock(EchoPort.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new EchoController(echoPort)).build();
    }

    @Test
    void getStatus_shouldReturnOkWithAllFields() throws Exception {
        when(echoPort.getServerStatus()).thenReturn("OK");
        when(echoPort.getTimestamp()).thenReturn(1700000000000L);
        when(echoPort.getServerProperties()).thenReturn(Map.of("version", "1.0.0", "env", "test"));

        mockMvc.perform(get("/api/echo/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OK"))
                .andExpect(jsonPath("$.timestamp").value(1700000000000L))
                .andExpect(jsonPath("$.properties.version").value("1.0.0"))
                .andExpect(jsonPath("$.properties.env").value("test"));
    }

    @Test
    void getStatus_shouldReturnJsonContentType() throws Exception {
        when(echoPort.getServerStatus()).thenReturn("OK");
        when(echoPort.getTimestamp()).thenReturn(System.currentTimeMillis());
        when(echoPort.getServerProperties()).thenReturn(Map.of());

        mockMvc.perform(get("/api/echo/status"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("application/json"));
    }

    @Test
    void getStatus_shouldReturnEmptyPropertiesWhenNoneConfigured() throws Exception {
        when(echoPort.getServerStatus()).thenReturn("OK");
        when(echoPort.getTimestamp()).thenReturn(1700000000000L);
        when(echoPort.getServerProperties()).thenReturn(Map.of());

        mockMvc.perform(get("/api/echo/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.properties", anEmptyMap()));
    }

    @Test
    void getStatus_shouldReturnCustomStatus() throws Exception {
        when(echoPort.getServerStatus()).thenReturn("MAINTENANCE");
        when(echoPort.getTimestamp()).thenReturn(1700000000000L);
        when(echoPort.getServerProperties()).thenReturn(Map.of());

        mockMvc.perform(get("/api/echo/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("MAINTENANCE"));
    }

    @Test
    void v120_googleFlagAndClientId() throws Exception {
        games.paths.core.port.auth.GoogleLoginPort google = mock(games.paths.core.port.auth.GoogleLoginPort.class);
        when(google.isEnabled()).thenReturn(true);
        when(google.clientId()).thenReturn("client.apps.googleusercontent.com");
        when(echoPort.getServerStatus()).thenReturn("OK");
        when(echoPort.getServerProperties()).thenReturn(Map.of());
        MockMvcBuilders.standaloneSetup(new EchoController(echoPort, google)).build()
                .perform(get("/api/echo/status"))
                .andExpect(jsonPath("$.googleEnabled").value(true))
                .andExpect(jsonPath("$.googleClientId").value("client.apps.googleusercontent.com"));
        mockMvc.perform(get("/api/echo/status")).andExpect(jsonPath("$.googleEnabled").doesNotExist());
    }

    @Test
    void v170_supportedLanguagesAndThemes() throws Exception {
        when(echoPort.getServerStatus()).thenReturn("OK");
        when(echoPort.getServerProperties()).thenReturn(Map.of());
        when(echoPort.getSupportedLanguages()).thenReturn(java.util.List.of("en", "it"));
        when(echoPort.getSupportedThemes()).thenReturn(java.util.List.of("default", "high-contrast"));

        mockMvc.perform(get("/api/echo/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.supportedLanguages[1]").value("it"))
                .andExpect(jsonPath("$.supportedThemes[1]").value("high-contrast"));
    }

    @Test
    void v170_step8_matchRefetchParameters() throws Exception {
        when(echoPort.getServerStatus()).thenReturn("OK");
        when(echoPort.getServerProperties()).thenReturn(Map.of());
        when(echoPort.getMatchRefetchBrowsers()).thenReturn(java.util.List.of("all"));
        when(echoPort.getMatchRefetchMinHiddenSeconds()).thenReturn(45);

        mockMvc.perform(get("/api/echo/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.matchRefetchBrowsers[0]").value("all"))
                .andExpect(jsonPath("$.matchRefetchMinHiddenSeconds").value(45));
    }
}
