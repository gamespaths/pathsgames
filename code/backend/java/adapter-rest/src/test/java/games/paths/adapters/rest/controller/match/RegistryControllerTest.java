package games.paths.adapters.rest.controller.match;

import games.paths.core.model.match.MatchRegistryEntry;
import games.paths.core.model.match.MatchRegistryGroup;
import games.paths.core.port.match.MatchQueryPort;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@DisplayName("RegistryController (Step 36)")
class RegistryControllerTest {

    private MockMvc mockMvc;
    private MatchQueryPort queryPort;

    @BeforeEach
    void setUp() {
        queryPort = mock(MatchQueryPort.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new RegistryController(queryPort)).build();
    }

    private MockHttpServletRequestBuilder authed(MockHttpServletRequestBuilder b) {
        return b.requestAttr("userUuid", "user-uuid");
    }

    private static MatchRegistryEntry entry(String key, Integer intValue) {
        MatchRegistryEntry e = new MatchRegistryEntry();
        e.setUuid("reg-" + key);
        e.setKey(key);
        e.setIntValue(intValue);
        e.setCategory("tutorial");
        e.setVisible(true);
        e.setPriority(1);
        e.setIdCharacter(12L);
        return e;
    }

    @Test
    @DisplayName("returns the groups with every field the board needs")
    void returnsGroups() throws Exception {
        when(queryPort.getMatchRegistry("match-uuid", "user-uuid", false, "en"))
                .thenReturn(List.of(new MatchRegistryGroup("tutorial",
                        List.of(entry("tutorial_progress", 3)))));

        mockMvc.perform(authed(get("/api/match/match-uuid/registry")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groups[0].category").value("tutorial"))
                .andExpect(jsonPath("$.groups[0].entries[0].key").value("tutorial_progress"))
                .andExpect(jsonPath("$.groups[0].entries[0].intValue").value(3))
                .andExpect(jsonPath("$.groups[0].entries[0].stringValue").doesNotExist())
                .andExpect(jsonPath("$.groups[0].entries[0].visible").value(true))
                .andExpect(jsonPath("$.groups[0].entries[0].priority").value(1))
                .andExpect(jsonPath("$.groups[0].entries[0].idCharacter").value(12));
    }

    @Test
    @DisplayName("an empty registry is an empty array, never a missing key")
    void emptyRegistry() throws Exception {
        when(queryPort.getMatchRegistry(any(), any(), anyBoolean(), any())).thenReturn(List.of());

        mockMvc.perform(authed(get("/api/match/match-uuid/registry")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groups").isArray())
                .andExpect(jsonPath("$.groups").isEmpty());
    }

    @Test
    @DisplayName("includeHidden defaults to false and is passed through when asked for")
    void includeHiddenIsForwarded() throws Exception {
        when(queryPort.getMatchRegistry(any(), any(), anyBoolean(), any())).thenReturn(List.of());

        mockMvc.perform(authed(get("/api/match/match-uuid/registry")))
                .andExpect(status().isOk());
        verify(queryPort).getMatchRegistry("match-uuid", "user-uuid", false, "en");

        mockMvc.perform(authed(get("/api/match/match-uuid/registry?includeHidden=true&lang=it")))
                .andExpect(status().isOk());
        verify(queryPort).getMatchRegistry("match-uuid", "user-uuid", true, "it");
    }

    @Test
    @DisplayName("a match the caller does not own reads as not-found, never as forbidden")
    void notOwnedIsNotFound() throws Exception {
        when(queryPort.getMatchRegistry(any(), any(), anyBoolean(), any())).thenReturn(null);

        mockMvc.perform(authed(get("/api/match/other-uuid/registry")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("MATCH_NOT_FOUND"));
    }

    @Test
    @DisplayName("no authenticated user → 401, and the port is never asked")
    void unauthenticated() throws Exception {
        mockMvc.perform(get("/api/match/match-uuid/registry"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHENTICATED"));
        verify(queryPort, never()).getMatchRegistry(any(), any(), anyBoolean(), any());
    }

    @Test
    @DisplayName("a blank match uuid is a bad request, not a lookup")
    void blankUuid() {
        // No route can produce a blank path segment, so the guard is exercised directly.
        var request = new org.springframework.mock.web.MockHttpServletRequest();
        request.setAttribute("userUuid", "user-uuid");

        var response = new RegistryController(queryPort).getRegistry("  ", "en", false, request);

        assertEquals(400, response.getStatusCode().value());
        verify(queryPort, never()).getMatchRegistry(any(), any(), anyBoolean(), any());
    }
}
