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
}
