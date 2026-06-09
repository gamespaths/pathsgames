package games.paths.adapters.rest.controller.match;

import games.paths.core.model.match.CharacterInstanceInfo;
import games.paths.core.port.match.CharacterCommandPort;
import games.paths.core.port.match.CharacterCommandPort.CharacterJoinException;
import games.paths.core.port.match.CharacterQueryPort;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class CharacterControllerTest {

    private MockMvc mockMvc;
    private CharacterCommandPort commandPort;
    private CharacterQueryPort queryPort;

    @BeforeEach
    void setUp() {
        commandPort = mock(CharacterCommandPort.class);
        queryPort = mock(CharacterQueryPort.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new CharacterController(commandPort, queryPort)).build();
    }

    private MockHttpServletRequestBuilder authed(MockHttpServletRequestBuilder b) {
        return b.requestAttr("userUuid", "user-uuid");
    }

    private CharacterInstanceInfo info() {
        CharacterInstanceInfo i = new CharacterInstanceInfo();
        i.setUuid("char-uuid");
        i.setMatchUuid("match-uuid");
        i.setUserUuid("user-uuid");
        i.setDexterity(19);
        i.setLife(137);
        i.setTraitUuids(List.of("trait-1"));
        return i;
    }

    // ─── join ────────────────────────────────────────────────────────────────

    @Test
    void join_unauthenticated_401() throws Exception {
        mockMvc.perform(post("/api/matches/m1/join")
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void join_success_201() throws Exception {
        when(commandPort.join(any())).thenReturn(info());
        mockMvc.perform(authed(post("/api/matches/m1/join"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"characterTemplateUuid\":\"t\",\"classUuid\":\"c\",\"traitUuids\":[\"x\"]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.uuid").value("char-uuid"))
                .andExpect(jsonPath("$.life").value(137));
    }

    @Test
    void join_emptyBody_usesStoredLoadout_201() throws Exception {
        when(commandPort.join(any())).thenReturn(info());
        mockMvc.perform(authed(post("/api/matches/m1/join")))
                .andExpect(status().isCreated());
    }

    @Test
    void join_matchNotFound_404() throws Exception {
        when(commandPort.join(any())).thenThrow(
                new CharacterJoinException(CharacterJoinException.Code.MATCH_NOT_FOUND, "x"));
        mockMvc.perform(authed(post("/api/matches/m1/join"))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void join_templateNotFound_404() throws Exception {
        when(commandPort.join(any())).thenThrow(
                new CharacterJoinException(CharacterJoinException.Code.TEMPLATE_NOT_FOUND, "x"));
        mockMvc.perform(authed(post("/api/matches/m1/join"))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void join_classNotFound_404() throws Exception {
        when(commandPort.join(any())).thenThrow(
                new CharacterJoinException(CharacterJoinException.Code.CLASS_NOT_FOUND, "x"));
        mockMvc.perform(authed(post("/api/matches/m1/join"))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void join_userNotFound_404() throws Exception {
        when(commandPort.join(any())).thenThrow(
                new CharacterJoinException(CharacterJoinException.Code.USER_NOT_FOUND, "x"));
        mockMvc.perform(authed(post("/api/matches/m1/join"))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void join_userBanned_403() throws Exception {
        when(commandPort.join(any())).thenThrow(
                new CharacterJoinException(CharacterJoinException.Code.USER_BANNED, "x"));
        mockMvc.perform(authed(post("/api/matches/m1/join"))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void join_alreadyJoined_409() throws Exception {
        when(commandPort.join(any())).thenThrow(
                new CharacterJoinException(CharacterJoinException.Code.ALREADY_JOINED, "x"));
        mockMvc.perform(authed(post("/api/matches/m1/join"))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isConflict());
    }

    @Test
    void join_classNotCompatible_409() throws Exception {
        when(commandPort.join(any())).thenThrow(
                new CharacterJoinException(CharacterJoinException.Code.CLASS_NOT_COMPATIBLE, "x"));
        mockMvc.perform(authed(post("/api/matches/m1/join"))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isConflict());
    }

    @Test
    void join_matchNotJoinable_409() throws Exception {
        when(commandPort.join(any())).thenThrow(
                new CharacterJoinException(CharacterJoinException.Code.MATCH_NOT_JOINABLE, "x"));
        mockMvc.perform(authed(post("/api/matches/m1/join"))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isConflict());
    }

    @Test
    void join_invalidInput_400() throws Exception {
        when(commandPort.join(any())).thenThrow(
                new CharacterJoinException(CharacterJoinException.Code.INVALID_INPUT, "x"));
        mockMvc.perform(authed(post("/api/matches/m1/join"))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }

    // ─── players ──────────────────────────────────────────────────────────────

    @Test
    void listPlayers_unauthenticated_401() throws Exception {
        mockMvc.perform(get("/api/match/m1/players"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void listPlayers_ok_200() throws Exception {
        when(queryPort.listPlayers("m1", "user-uuid")).thenReturn(List.of(info()));
        mockMvc.perform(authed(get("/api/match/m1/players")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].uuid").value("char-uuid"));
    }

    @Test
    void listPlayers_null_404() throws Exception {
        when(queryPort.listPlayers("m1", "user-uuid")).thenReturn(null);
        mockMvc.perform(authed(get("/api/match/m1/players")))
                .andExpect(status().isNotFound());
    }

    // ─── character detail ──────────────────────────────────────────────────────

    @Test
    void getCharacter_unauthenticated_401() throws Exception {
        mockMvc.perform(get("/api/match/m1/characters/c1"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getCharacter_ok_200() throws Exception {
        when(queryPort.getCharacter("m1", "c1", "user-uuid")).thenReturn(info());
        mockMvc.perform(authed(get("/api/match/m1/characters/c1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.uuid").value("char-uuid"));
    }

    @Test
    void getCharacter_null_404() throws Exception {
        when(queryPort.getCharacter("m1", "c1", "user-uuid")).thenReturn(null);
        mockMvc.perform(authed(get("/api/match/m1/characters/c1")))
                .andExpect(status().isNotFound());
    }
}
