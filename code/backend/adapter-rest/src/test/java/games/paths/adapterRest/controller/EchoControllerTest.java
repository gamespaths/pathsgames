package games.paths.adapterRest.controller;

import games.paths.core.port.in.EchoPort;
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
}