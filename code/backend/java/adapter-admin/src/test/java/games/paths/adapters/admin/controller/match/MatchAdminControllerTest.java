package games.paths.adapters.admin.controller.match;

import games.paths.core.model.match.MatchDetail;
import games.paths.core.model.match.MatchSummary;
import games.paths.core.port.match.CharacterCommandPort;
import games.paths.core.port.match.MatchCommandPort;
import games.paths.core.port.match.MatchQueryPort;
import games.paths.core.port.match.TimeAdvancementPort;
import games.paths.core.port.match.TurnCyclePort;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit tests for {@link MatchAdminController} — the admin-only match endpoints extracted
 * from {@code MatchController}. Mirrors the standalone-MockMvc style used across the
 * adapter-admin controllers.
 */
class MatchAdminControllerTest {

    private MockMvc mockMvc;
    private MatchCommandPort commandPort;
    private MatchQueryPort queryPort;
    private TimeAdvancementPort timeAdvancementPort;
    private CharacterCommandPort characterCommandPort;

    @BeforeEach
    void setUp() {
        commandPort = mock(MatchCommandPort.class);
        queryPort = mock(MatchQueryPort.class);
        timeAdvancementPort = mock(TimeAdvancementPort.class);
        characterCommandPort = mock(CharacterCommandPort.class);
        mockMvc = MockMvcBuilders.standaloneSetup(
                new MatchAdminController(commandPort, queryPort, timeAdvancementPort,
                        characterCommandPort)).build();
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
    void listMatchStatuses_returns200WithStatuses() throws Exception {
        mockMvc.perform(get("/api/admin/matches/statuses"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].value").value("CREATED"))
                .andExpect(jsonPath("$[0].terminal").value(false))
                .andExpect(jsonPath("$[3].value").value("ENDED"))
                .andExpect(jsonPath("$[3].terminal").value(true));
    }

    @Test
    void getAdminMatchClock_returns200WithClockPayload() throws Exception {
        when(timeAdvancementPort.clockForAdmin("m1")).thenReturn(
                new TimeAdvancementPort.ClockResult("m1", 3, "hour", "hours", true,
                        List.of(new TimeAdvancementPort.ClockCharacter("char-a", true, 40))));
        mockMvc.perform(get("/api/admin/matches/m1/clock"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.matchUuid").value("m1"))
                .andExpect(jsonPath("$.currentClock").value(3))
                .andExpect(jsonPath("$.clockLabelSingular").value("hour"))
                .andExpect(jsonPath("$.anyCharacterSleeping").value(true))
                .andExpect(jsonPath("$.characters[0].characterUuid").value("char-a"))
                .andExpect(jsonPath("$.characters[0].isSleeping").value(true))
                .andExpect(jsonPath("$.characters[0].energy").value(40));
    }

    @Test
    void getAdminMatchClock_returns404WhenNotFound() throws Exception {
        when(timeAdvancementPort.clockForAdmin("m1")).thenThrow(
                new TurnCyclePort.TurnCycleException(
                        TurnCyclePort.TurnCycleException.Code.MATCH_NOT_FOUND, "Match not found"));
        mockMvc.perform(get("/api/admin/matches/m1/clock"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("MATCH_NOT_FOUND"));
    }

    @Test
    void updateMatch_returns200WhenUpdated() throws Exception {
        when(commandPort.updateMatch("m1", "ENDED", "new name"))
                .thenReturn(MatchCommandPort.UpdateOutcome.UPDATED);
        mockMvc.perform(put("/api/admin/matches/m1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"ENDED\",\"name\":\"new name\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UPDATED"))
                .andExpect(jsonPath("$.uuid").value("m1"));
    }

    @Test
    void updateMatch_returns400ForEmptyBody() throws Exception {
        mockMvc.perform(put("/api/admin/matches/m1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_INPUT"));
    }

    @Test
    void updateMatch_returns400ForInvalidStatus() throws Exception {
        when(commandPort.updateMatch(any(), any(), any()))
                .thenReturn(MatchCommandPort.UpdateOutcome.INVALID_STATUS);
        mockMvc.perform(put("/api/admin/matches/m1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"BOGUS\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_STATUS"));
    }

    @Test
    void updateMatch_returns404WhenNotFound() throws Exception {
        when(commandPort.updateMatch(any(), any(), any()))
                .thenReturn(MatchCommandPort.UpdateOutcome.NOT_FOUND);
        mockMvc.perform(put("/api/admin/matches/m1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"x\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("MATCH_NOT_FOUND"));
    }

    @Test
    void stopMatch_setsStatusToEnded() throws Exception {
        when(commandPort.updateMatch("m1", "ENDED", null))
                .thenReturn(MatchCommandPort.UpdateOutcome.UPDATED);
        mockMvc.perform(post("/api/admin/matches/m1/stop"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UPDATED"));
        verify(commandPort).updateMatch("m1", "ENDED", null);
    }

    @Test
    void pauseAndResume_setExpectedStatuses() throws Exception {
        when(commandPort.updateMatch(any(), any(), any()))
                .thenReturn(MatchCommandPort.UpdateOutcome.UPDATED);
        mockMvc.perform(post("/api/admin/matches/m1/pause")).andExpect(status().isOk());
        mockMvc.perform(post("/api/admin/matches/m1/resume")).andExpect(status().isOk());
        verify(commandPort).updateMatch("m1", "PAUSED", null);
        verify(commandPort).updateMatch("m1", "RUNNING", null);
    }

    @Test
    void deleteMatch_returns200WhenDeleted() throws Exception {
        when(commandPort.deleteMatch("m1")).thenReturn(MatchCommandPort.DeleteOutcome.DELETED);
        mockMvc.perform(delete("/api/admin/matches/m1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DELETED"));
    }

    @Test
    void deleteMatch_returns409WhenNotStopped() throws Exception {
        when(commandPort.deleteMatch("m1")).thenReturn(MatchCommandPort.DeleteOutcome.NOT_STOPPED);
        mockMvc.perform(delete("/api/admin/matches/m1"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("MATCH_NOT_STOPPED"));
    }

    @Test
    void deleteMatch_returns404WhenNotFound() throws Exception {
        when(commandPort.deleteMatch("m1")).thenReturn(MatchCommandPort.DeleteOutcome.NOT_FOUND);
        mockMvc.perform(delete("/api/admin/matches/m1"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("MATCH_NOT_FOUND"));
    }

    @Test
    void getAdminMatchInfo_returns200WithDetail() throws Exception {
        MatchDetail detail = new MatchDetail();
        detail.setMatch(summary());
        detail.setLocations(List.of());
        detail.setRegistry(List.of());
        detail.setEvents(List.of());
        detail.setChoices(List.of());
        when(queryPort.getMatchInfoForAdmin("m1")).thenReturn(detail);

        mockMvc.perform(get("/api/admin/matches/m1/info"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.match.uuid").value("match-uuid"));
    }

    @Test
    void getAdminMatchInfo_returns404WhenMissing() throws Exception {
        when(queryPort.getMatchInfoForAdmin("m1")).thenReturn(null);
        mockMvc.perform(get("/api/admin/matches/m1/info"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("MATCH_NOT_FOUND"));
    }
}
