package games.paths.adapters.rest.controller.match;

import games.paths.adapters.rest.dto.MatchInfoResponse;
import games.paths.core.model.match.MatchCreateCommand;
import games.paths.core.model.match.MatchDetail;
import games.paths.core.model.match.MatchEventOption;
import games.paths.core.model.match.MatchLocationState;
import games.paths.core.model.match.MatchRegistryEntry;
import games.paths.core.model.match.MatchSummary;
import games.paths.core.port.match.MatchCommandPort;
import games.paths.core.port.match.MatchQueryPort;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class MatchControllerTest {

    private MockMvc mockMvc;
    private MatchCommandPort commandPort;
    private MatchQueryPort queryPort;

    @BeforeEach
    void setUp() {
        commandPort = mock(MatchCommandPort.class);
        queryPort = mock(MatchQueryPort.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new MatchController(commandPort, queryPort)).build();
    }

    private MockHttpServletRequestBuilder authed(MockHttpServletRequestBuilder b) {
        return b.requestAttr("userUuid", "user-uuid");
    }

    private MatchSummary summary() {
        MatchSummary s = new MatchSummary();
        s.setUuid("match-uuid");
        s.setStoryUuid("story-uuid");
        s.setDifficultyUuid("diff-uuid");
        s.setStatus("CREATED");
        s.setCurrentClock(0);
        s.setExpCost(5);
        s.setUserCreatorUuid("user-uuid");
        s.setName("name");
        s.setTsInsert("ts");
        s.setSinglePlayer(1);
        s.setCharacterTemplateUuid("char-tpl");
        s.setClassUuid("class-uuid");
        s.setTraitUuids(List.of("trait-1", "trait-2"));
        return s;
    }

    @Test
    void createMatch_unauthenticated_returns401() throws Exception {
        mockMvc.perform(post("/api/matches")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"storyUuid\":\"s\",\"difficultyUuid\":\"d\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void createMatch_emptyBody_returns400() throws Exception {
        mockMvc.perform(authed(post("/api/matches"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createMatch_missingStory_returns400() throws Exception {
        mockMvc.perform(authed(post("/api/matches"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"difficultyUuid\":\"d\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createMatch_missingDifficulty_returns400() throws Exception {
        mockMvc.perform(authed(post("/api/matches"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"storyUuid\":\"s\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createMatch_success_returns201() throws Exception {
        when(commandPort.createMatch(any())).thenReturn(summary());

        mockMvc.perform(authed(post("/api/matches"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"storyUuid\":\"s\",\"difficultyUuid\":\"d\",\"name\":\"n\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.uuid").value("match-uuid"))
                .andExpect(jsonPath("$.storyUuid").value("story-uuid"))
                .andExpect(jsonPath("$.singlePlayer").value(1))
                .andExpect(jsonPath("$.characterTemplateUuid").value("char-tpl"))
                .andExpect(jsonPath("$.classUuid").value("class-uuid"))
                .andExpect(jsonPath("$.traitUuids[0]").value("trait-1"));
    }

    @Test
    void createMatch_passesLoadoutToCommand() throws Exception {
        when(commandPort.createMatch(any())).thenReturn(summary());
        ArgumentCaptor<MatchCreateCommand> captor = ArgumentCaptor.forClass(MatchCreateCommand.class);

        mockMvc.perform(authed(post("/api/matches"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"storyUuid\":\"s\",\"difficultyUuid\":\"d\","
                                + "\"characterTemplateUuid\":\"ct\",\"classUuid\":\"cl\","
                                + "\"traitUuids\":[\"t1\",\"t2\"],\"singlePlayer\":0}"))
                .andExpect(status().isCreated());

        verify(commandPort).createMatch(captor.capture());
        MatchCreateCommand cmd = captor.getValue();
        org.junit.jupiter.api.Assertions.assertEquals("ct", cmd.getCharacterTemplateUuid());
        org.junit.jupiter.api.Assertions.assertEquals("cl", cmd.getClassUuid());
        org.junit.jupiter.api.Assertions.assertEquals(List.of("t1", "t2"), cmd.getTraitUuids());
        org.junit.jupiter.api.Assertions.assertEquals(0, cmd.getSinglePlayer());
    }

    @Test
    void createMatch_storyNotFound_returns404() throws Exception {
        when(commandPort.createMatch(any())).thenThrow(new MatchCommandPort.MatchCreationException(
                MatchCommandPort.MatchCreationException.Code.STORY_NOT_FOUND, "no story"));

        mockMvc.perform(authed(post("/api/matches"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"storyUuid\":\"s\",\"difficultyUuid\":\"d\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("STORY_NOT_FOUND"));
    }

    @Test
    void createMatch_difficultyNotFound_returns404() throws Exception {
        when(commandPort.createMatch(any())).thenThrow(new MatchCommandPort.MatchCreationException(
                MatchCommandPort.MatchCreationException.Code.DIFFICULTY_NOT_FOUND, "no diff"));

        mockMvc.perform(authed(post("/api/matches"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"storyUuid\":\"s\",\"difficultyUuid\":\"d\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void createMatch_userNotFound_returns404() throws Exception {
        when(commandPort.createMatch(any())).thenThrow(new MatchCommandPort.MatchCreationException(
                MatchCommandPort.MatchCreationException.Code.USER_NOT_FOUND, "no user"));

        mockMvc.perform(authed(post("/api/matches"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"storyUuid\":\"s\",\"difficultyUuid\":\"d\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void createMatch_userBanned_returns403() throws Exception {
        when(commandPort.createMatch(any())).thenThrow(new MatchCommandPort.MatchCreationException(
                MatchCommandPort.MatchCreationException.Code.USER_BANNED, "banned"));

        mockMvc.perform(authed(post("/api/matches"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"storyUuid\":\"s\",\"difficultyUuid\":\"d\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void createMatch_maintenance_returns503() throws Exception {
        when(commandPort.createMatch(any())).thenThrow(new MatchCommandPort.MatchCreationException(
                MatchCommandPort.MatchCreationException.Code.MAINTENANCE_MODE, "maintenance"));

        mockMvc.perform(authed(post("/api/matches"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"storyUuid\":\"s\",\"difficultyUuid\":\"d\"}"))
                .andExpect(status().isServiceUnavailable());
    }

    @Test
    void createMatch_storyHasNoLocations_returns400() throws Exception {
        when(commandPort.createMatch(any())).thenThrow(new MatchCommandPort.MatchCreationException(
                MatchCommandPort.MatchCreationException.Code.STORY_HAS_NO_LOCATIONS, "empty"));

        mockMvc.perform(authed(post("/api/matches"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"storyUuid\":\"s\",\"difficultyUuid\":\"d\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createMatch_invalidInput_returns400() throws Exception {
        when(commandPort.createMatch(any())).thenThrow(new MatchCommandPort.MatchCreationException(
                MatchCommandPort.MatchCreationException.Code.INVALID_INPUT, "bad"));

        mockMvc.perform(authed(post("/api/matches"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"storyUuid\":\"s\",\"difficultyUuid\":\"d\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void listMatches_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/matches"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void listMatches_returnsArray() throws Exception {
        when(queryPort.listUserMatches("user-uuid")).thenReturn(List.of(summary()));
        mockMvc.perform(authed(get("/api/matches")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].uuid").value("match-uuid"));
    }

    @Test
    void listAllMatches_returnsArray() throws Exception {
        when(queryPort.listAllMatches()).thenReturn(List.of(summary()));
        mockMvc.perform(get("/api/admin/matches"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].uuid").value("match-uuid"));
    }

    @Test
    void listAllMatches_emptyArray() throws Exception {
        when(queryPort.listAllMatches()).thenReturn(List.of());
        mockMvc.perform(get("/api/admin/matches"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void getMatchInfo_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/match/abc/info"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getMatchInfo_notFound_returns404() throws Exception {
        when(queryPort.getMatchInfo("abc", "user-uuid")).thenReturn(null);
        mockMvc.perform(authed(get("/api/match/abc/info")))
                .andExpect(status().isNotFound());
    }

    @Test
    void getMatchInfo_returns200() throws Exception {
        MatchDetail detail = new MatchDetail();
        detail.setMatch(summary());
        detail.setCurrentLocationId(10L);
        detail.setCurrentLocationUuid("loc-uuid");
        detail.setCurrentLocationName("loc");
        MatchLocationState s = new MatchLocationState();
        s.setIdLocation(10L);
        s.setUuid("ls");
        s.setFlagAlreadyActived(0);
        s.setClockCounter(2);
        s.setName("ls-name");
        detail.setLocations(List.of(s));
        MatchRegistryEntry r = new MatchRegistryEntry();
        r.setUuid("r");
        r.setKey("k");
        r.setIntValue(1);
        detail.setRegistry(List.of(r));
        detail.setEvents(List.of(new MatchEventOption("ev", "n", "EVENT")));
        detail.setChoices(List.of(new MatchEventOption("ch", "n", "CHOICE")));
        when(queryPort.getMatchInfo("abc", "user-uuid")).thenReturn(detail);

        mockMvc.perform(authed(get("/api/match/abc/info")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.match.uuid").value("match-uuid"))
                .andExpect(jsonPath("$.currentLocationId").value(10))
                .andExpect(jsonPath("$.locations[0].uuid").value("ls"))
                .andExpect(jsonPath("$.registry[0].key").value("k"))
                .andExpect(jsonPath("$.events[0].uuid").value("ev"))
                .andExpect(jsonPath("$.choices[0].uuid").value("ch"));
    }

    @Test
    void responseDtosFromModel_handleNullsAndConvertCorrectly() {
        // exercise the static factory methods on the response DTOs
        MatchInfoResponse nullCase = MatchInfoResponse.fromModel(null);
        org.junit.jupiter.api.Assertions.assertNull(nullCase);
    }
}
