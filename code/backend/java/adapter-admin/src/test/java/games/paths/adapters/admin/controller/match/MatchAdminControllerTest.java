package games.paths.adapters.admin.controller.match;

import games.paths.core.model.match.MatchDetail;
import games.paths.core.model.match.MatchListFilter;
import games.paths.core.model.match.MatchSummary;
import games.paths.core.model.match.MatchSummaryPage;
import games.paths.core.port.match.CharacterCommandPort;
import games.paths.core.port.match.MatchCommandPort;
import games.paths.core.port.match.MatchQueryPort;
import games.paths.core.port.match.MovementPort;
import games.paths.core.port.match.TimeAdvancementPort;
import games.paths.core.port.match.TurnCyclePort;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
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
    private games.paths.core.service.match.WeatherSelectionService weatherService;
    private MovementPort movementPort;
    private games.paths.core.port.match.MatchLogsPort matchLogsPort;

    @BeforeEach
    void setUp() {
        commandPort = mock(MatchCommandPort.class);
        queryPort = mock(MatchQueryPort.class);
        timeAdvancementPort = mock(TimeAdvancementPort.class);
        characterCommandPort = mock(CharacterCommandPort.class);
        weatherService = mock(games.paths.core.service.match.WeatherSelectionService.class);
        movementPort = mock(MovementPort.class);
        matchLogsPort = mock(games.paths.core.port.match.MatchLogsPort.class);
        mockMvc = MockMvcBuilders.standaloneSetup(
                new MatchAdminController(commandPort, queryPort, timeAdvancementPort,
                        characterCommandPort, weatherService, movementPort, matchLogsPort)).build();
    }

    @Test
    void getAdminMatchLocations_returnsLocationsWithTotalEnergyCost() throws Exception {
        games.paths.core.model.story.CardInfo card = new games.paths.core.model.story.CardInfo(
                "card-uuid", "location", "http://img/a.jpg", null, null,
                null, null, null, null, null, "Hall", "desc", null, null, null);
        MovementPort.NeighborCost n = new MovementPort.NeighborCost(
                2L, "loc-2", "NORTH", 9, card, 1, 1, 2, 4, true);
        MovementPort.VisitedLocation loc = new MovementPort.VisitedLocation(
                1L, "loc-1", 10, card, true, 2, List.of(n));
        when(movementPort.listLocationsForAdmin("match-uuid", null)).thenReturn(List.of(loc));

        mockMvc.perform(get("/api/admin/matches/match-uuid/locations"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.locations[0].characterCount").value(2))
                .andExpect(jsonPath("$.locations[0].neighbors[0].totalEnergyCost").value(4))
                .andExpect(jsonPath("$.locations[0].neighbors[0].uuid").value("loc-2"))
                .andExpect(jsonPath("$.locations[0].card.title").value("Hall"))
                .andExpect(jsonPath("$.locations[0].neighbors[0].card.uuid").value("card-uuid"));
    }

    @Test
    void getAdminMatchLocations_notFound() throws Exception {
        when(movementPort.listLocationsForAdmin(org.mockito.ArgumentMatchers.eq("missing"), org.mockito.ArgumentMatchers.any())).thenThrow(
                new MovementPort.MovementException(
                        MovementPort.MovementException.Code.MATCH_NOT_FOUND, "no"));
        mockMvc.perform(get("/api/admin/matches/missing/locations"))
                .andExpect(status().isNotFound());
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
    void listAllMatches_returnsEnvelope() throws Exception {
        when(queryPort.listMatchesPage(org.mockito.ArgumentMatchers.any()))
                .thenReturn(new MatchSummaryPage(List.of(summary()), "next-tok", 50));
        mockMvc.perform(get("/api/admin/matches"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].uuid").value("match-uuid"))
                .andExpect(jsonPath("$.nextCursor").value("next-tok"))
                .andExpect(jsonPath("$.limit").value(50));
    }

    @Test
    void listAllMatches_emptyEnvelope() throws Exception {
        when(queryPort.listMatchesPage(org.mockito.ArgumentMatchers.any()))
                .thenReturn(new MatchSummaryPage(List.of(), null, 50));
        mockMvc.perform(get("/api/admin/matches"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.items").isEmpty());
    }

    @Test
    void listAllMatches_forwardsQueryParams() throws Exception {
        when(queryPort.listMatchesPage(org.mockito.ArgumentMatchers.any()))
                .thenReturn(new MatchSummaryPage(List.of(), null, 25));
        mockMvc.perform(get("/api/admin/matches")
                        .param("limit", "25")
                        .param("cursor", "cur-1")
                        .param("status", "RUNNING")
                        .param("userUuid", "u-9")
                        .param("storyUuid", "s-7")
                        .param("sinceDays", "7"))
                .andExpect(status().isOk());
        var captor = org.mockito.ArgumentCaptor.forClass(MatchListFilter.class);
        verify(queryPort).listMatchesPage(captor.capture());
        MatchListFilter f = captor.getValue();
        assertEquals(25, f.limit());
        assertEquals("cur-1", f.cursor());
        assertEquals("RUNNING", f.status());
        assertEquals("u-9", f.userUuid());
        assertEquals("s-7", f.storyUuid());
        assertEquals(7, f.sinceDays());
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
    void getAdminMatchWeather_returns200WithSeedCurrentAndLog() throws Exception {
        when(weatherService.weatherAdmin("m1")).thenReturn(
                new games.paths.core.service.match.WeatherSelectionService.WeatherAdminView(
                        42L,
                        new games.paths.core.port.match.WeatherStorePort.CurrentWeatherView(
                                9L, "w-9", 7L, 55, 123, -5, 1, 2, 3),
                        List.of(new games.paths.core.port.match.WeatherStorePort.WeatherRuleSummary(
                                9L, "w-9", 123, "Storm", 30, -5, 1, 3, true, true)),
                        List.of(new games.paths.core.port.match.WeatherStorePort.WeatherLogView(
                                1L, "l-1", 0, 9L, "w-9", 123, "2026-06-24T00:00:00Z"))));
        mockMvc.perform(get("/api/admin/matches/m1/weather"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rngSeed").value(42))
                .andExpect(jsonPath("$.current.idWeather").value(9))
                .andExpect(jsonPath("$.current.idCard").value(55))
                .andExpect(jsonPath("$.current.deltaEnergy").value(-5))
                .andExpect(jsonPath("$.rules[0].current").value(true))
                .andExpect(jsonPath("$.rules[0].name").value("Storm"))
                .andExpect(jsonPath("$.rules[0].costMoveSafeLocation").value(1))
                .andExpect(jsonPath("$.rules[0].costMoveNotSafeLocation").value(3))
                .andExpect(jsonPath("$.rules[0].probability").value(30))
                .andExpect(jsonPath("$.log[0].weatherUuid").value("w-9"));
    }

    @Test
    void getAdminMatchWeather_returns400WhenBlankUuid() throws Exception {
        mockMvc.perform(get("/api/admin/matches/ /weather"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_INPUT"));
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

    // ── Step 28.7 — GET /api/admin/matches/{uuidMatch}/logs ──────────────────

    @Test
    void getAdminMatchLogs_returns200WithTheTimeline() throws Exception {
        when(matchLogsPort.getMatchLogsForAdmin("m1", null, null, null, null)).thenReturn(
                new games.paths.core.port.match.MatchLogsPort.MatchLogsResult("m1", 2, List.of(
                        new games.paths.core.port.match.MatchLogsPort.LogEntry(
                                "SLEEP", 1, "2024-01-01T10:00:00Z", null, 10L,
                                "char-uuid", "Ranger", null, null, null, null, null, null)),
                        null, 50, 1, "asc"));

        mockMvc.perform(get("/api/admin/matches/m1/logs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.matchUuid").value("m1"))
                .andExpect(jsonPath("$.currentClock").value(2))
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.logs[0].type").value("SLEEP"))
                .andExpect(jsonPath("$.logs[0].idCharacterMatch").value(10))
                .andExpect(jsonPath("$.logs[0].characterName").value("Ranger"));
    }

    @Test
    void getAdminMatchLogs_passesLangLimitCursorAndOrderThroughToThePort() throws Exception {
        when(matchLogsPort.getMatchLogsForAdmin("m1", "it", 10, "cur", "desc")).thenReturn(
                new games.paths.core.port.match.MatchLogsPort.MatchLogsResult(
                        "m1", 2, List.of(), "next", 10, 42, "desc"));

        mockMvc.perform(get("/api/admin/matches/m1/logs?lang=it&limit=10&cursor=cur&order=desc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nextCursor").value("next"))
                .andExpect(jsonPath("$.limit").value(10))
                .andExpect(jsonPath("$.total").value(42))
                .andExpect(jsonPath("$.order").value("desc"));
    }

    @Test
    void getAdminMatchLogs_returns404WhenTheMatchIsUnknown() throws Exception {
        when(matchLogsPort.getMatchLogsForAdmin("m1", null, null, null, null)).thenThrow(
                new games.paths.core.port.match.TurnCyclePort.TurnCycleException(
                        games.paths.core.port.match.TurnCyclePort.TurnCycleException.Code.MATCH_NOT_FOUND,
                        "Match not found"));

        mockMvc.perform(get("/api/admin/matches/m1/logs"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("MATCH_NOT_FOUND"));
    }

    @Test
    void getAdminMatchLogs_returns400WhenTheUuidIsBlank() throws Exception {
        mockMvc.perform(get("/api/admin/matches/ /logs"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_INPUT"));
        verifyNoInteractions(matchLogsPort);
    }

    // ── POST /api/admin/matches/{m}/player/{p}/changeStatistics ───────────────

    @Test
    void changeStatistics_returns200AndForwardsEveryProvidedField() throws Exception {
        when(characterCommandPort.changeStatistics(eq("m1"), eq("p1"), any()))
                .thenReturn(CharacterCommandPort.ChangeStatsOutcome.UPDATED);

        mockMvc.perform(post("/api/admin/matches/m1/player/p1/changeStatistics")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"dex\":11,\"intel\":12,\"con\":13,\"energy\":60,\"life\":70,"
                                + "\"sad\":8,\"coin\":5,\"food\":3,\"magic\":4}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UPDATED"))
                .andExpect(jsonPath("$.matchUuid").value("m1"))
                .andExpect(jsonPath("$.playerUuid").value("p1"));

        var captor = org.mockito.ArgumentCaptor.forClass(CharacterCommandPort.ChangeStatsCommand.class);
        verify(characterCommandPort).changeStatistics(eq("m1"), eq("p1"), captor.capture());
        CharacterCommandPort.ChangeStatsCommand c = captor.getValue();
        assertEquals(11, c.getDex());
        assertEquals(12, c.getIntel());
        assertEquals(13, c.getCon());
        assertEquals(60, c.getEnergy());
        assertEquals(70, c.getLife());
        assertEquals(8, c.getSad());
        assertEquals(5, c.getCoin());
        assertEquals(3, c.getFood());
        assertEquals(4, c.getMagic());
    }

    @Test
    void changeStatistics_dropsFieldsSetToMinusOne() throws Exception {
        when(characterCommandPort.changeStatistics(eq("m1"), eq("p1"), any()))
                .thenReturn(CharacterCommandPort.ChangeStatsOutcome.UPDATED);

        mockMvc.perform(post("/api/admin/matches/m1/player/p1/changeStatistics")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"dex\":-1,\"intel\":-1,\"con\":-1,\"energy\":-1,\"life\":-1,"
                                + "\"sad\":-1,\"coin\":-1,\"food\":-1,\"magic\":9}"))
                .andExpect(status().isOk());

        var captor = org.mockito.ArgumentCaptor.forClass(CharacterCommandPort.ChangeStatsCommand.class);
        verify(characterCommandPort).changeStatistics(eq("m1"), eq("p1"), captor.capture());
        CharacterCommandPort.ChangeStatsCommand c = captor.getValue();
        assertNull(c.getDex());
        assertNull(c.getIntel());
        assertNull(c.getCon());
        assertNull(c.getEnergy());
        assertNull(c.getLife());
        assertNull(c.getSad());
        assertNull(c.getCoin());
        assertNull(c.getFood());
        assertEquals(9, c.getMagic());
    }

    @Test
    void changeStatistics_acceptsAnEmptyBody() throws Exception {
        when(characterCommandPort.changeStatistics(eq("m1"), eq("p1"), any()))
                .thenReturn(CharacterCommandPort.ChangeStatsOutcome.UPDATED);

        mockMvc.perform(post("/api/admin/matches/m1/player/p1/changeStatistics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UPDATED"));

        var captor = org.mockito.ArgumentCaptor.forClass(CharacterCommandPort.ChangeStatsCommand.class);
        verify(characterCommandPort).changeStatistics(eq("m1"), eq("p1"), captor.capture());
        assertNull(captor.getValue().getDex());
    }

    @Test
    void changeStatistics_returns400WhenThePlayerUuidIsBlank() throws Exception {
        mockMvc.perform(post("/api/admin/matches/m1/player/ /changeStatistics")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"dex\":3}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_INPUT"));
        verifyNoInteractions(characterCommandPort);
    }

    @Test
    void changeStatistics_returns404WhenTheMatchIsUnknown() throws Exception {
        when(characterCommandPort.changeStatistics(eq("m1"), eq("p1"), any()))
                .thenReturn(CharacterCommandPort.ChangeStatsOutcome.MATCH_NOT_FOUND);

        mockMvc.perform(post("/api/admin/matches/m1/player/p1/changeStatistics")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"dex\":3}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("MATCH_NOT_FOUND"));
    }

    @Test
    void changeStatistics_returns404WhenThePlayerIsUnknown() throws Exception {
        when(characterCommandPort.changeStatistics(eq("m1"), eq("p1"), any()))
                .thenReturn(CharacterCommandPort.ChangeStatsOutcome.PLAYER_NOT_FOUND);

        mockMvc.perform(post("/api/admin/matches/m1/player/p1/changeStatistics")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"dex\":3}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("PLAYER_NOT_FOUND"));
    }

    @Test
    void changeStatisticsRequest_gettersAndSetters() {
        MatchAdminController.ChangeStatisticsRequest r = new MatchAdminController.ChangeStatisticsRequest();
        r.setDex(1);
        r.setIntel(2);
        r.setCon(3);
        r.setEnergy(4);
        r.setLife(5);
        r.setSad(6);
        r.setCoin(7);
        r.setFood(8);
        r.setMagic(9);

        assertEquals(1, r.getDex());
        assertEquals(2, r.getIntel());
        assertEquals(3, r.getCon());
        assertEquals(4, r.getEnergy());
        assertEquals(5, r.getLife());
        assertEquals(6, r.getSad());
        assertEquals(7, r.getCoin());
        assertEquals(8, r.getFood());
        assertEquals(9, r.getMagic());
    }

    // ── remaining admin-read branches ────────────────────────────────────────

    @Test
    void getAdminMatchWeather_returnsNullCurrentWhenNoWeatherWasEverRolled() throws Exception {
        when(weatherService.weatherAdmin("m1")).thenReturn(
                new games.paths.core.service.match.WeatherSelectionService.WeatherAdminView(
                        null, null, List.of(), List.of()));

        mockMvc.perform(get("/api/admin/matches/m1/weather"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rngSeed").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.current").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.rules").isEmpty())
                .andExpect(jsonPath("$.log").isEmpty());
    }

    @Test
    void getAdminMatchLocations_forwardsTheLangParameter() throws Exception {
        when(movementPort.listLocationsForAdmin("m1", "it")).thenReturn(List.of());

        mockMvc.perform(get("/api/admin/matches/m1/locations?lang=it"))
                .andExpect(status().isOk());
        verify(movementPort).listLocationsForAdmin("m1", "it");
    }

    @Test
    void getAdminMatchLocations_returns400WhenTheUuidIsBlank() throws Exception {
        mockMvc.perform(get("/api/admin/matches/ /locations"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_INPUT"));
        verifyNoInteractions(movementPort);
    }

    @Test
    void getAdminMatchInfo_returns400WhenTheUuidIsBlank() throws Exception {
        mockMvc.perform(get("/api/admin/matches/ /info"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_INPUT"));
        verifyNoInteractions(queryPort);
    }

    @Test
    void getAdminMatchClock_returns400WhenTheUuidIsBlank() throws Exception {
        mockMvc.perform(get("/api/admin/matches/ /clock"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_INPUT"));
        verifyNoInteractions(timeAdvancementPort);
    }

    @Test
    void updateMatch_returns400WhenTheBodyIsAbsent() throws Exception {
        mockMvc.perform(put("/api/admin/matches/m1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_INPUT"));
        verifyNoInteractions(commandPort);
    }
}
