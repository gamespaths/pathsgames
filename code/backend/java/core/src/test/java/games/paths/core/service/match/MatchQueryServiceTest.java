package games.paths.core.service.match;

import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.match.GamingStateLocationsEntity;
import games.paths.core.entity.story.LocationEntity;
import games.paths.core.entity.story.StoryDifficultyEntity;
import games.paths.core.entity.story.StoryEntity;
import games.paths.core.model.match.MatchDetail;
import games.paths.core.model.match.MatchRegistryEntry;
import games.paths.core.model.match.MatchSummary;
import games.paths.core.port.match.MatchReadPort;
import games.paths.core.port.match.MovementStorePort;
import games.paths.core.port.match.UserAccessPort;
import games.paths.core.port.story.StoryReadPort;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link MatchQueryService}. Step 19.
 */
class MatchQueryServiceTest {

    private MatchReadPort matchReadPort;
    private StoryReadPort storyReadPort;
    private UserAccessPort userAccessPort;
    private RegistryService registryService;
    private MatchQueryService service;

    @BeforeEach
    void setUp() {
        matchReadPort = mock(MatchReadPort.class);
        storyReadPort = mock(StoryReadPort.class);
        userAccessPort = mock(UserAccessPort.class);
        registryService = mock(RegistryService.class);
        service = new MatchQueryService(matchReadPort, storyReadPort, userAccessPort,
                null, null, null, null, registryService);
    }

    private UserAccessPort.UserView user(long id, String uuid) {
        return new UserAccessPort.UserView(id, uuid, "u", "PLAYER", 2);
    }

    private GamingMatchEntity match(Long id, String uuid, Long userId, Long storyId, Long difficultyId) {
        GamingMatchEntity m = new GamingMatchEntity();
        m.setId(id);
        m.setUuid(uuid);
        m.setIdUserCreator(userId);
        m.setIdStory(storyId);
        m.setIdDifficulty(difficultyId);
        m.setStatus("CREATED");
        m.setCurrentClock(0);
        m.setExpCost(5);
        m.setName("test");
        m.setTsInsert("2024-01-01");
        m.setSinglePlayer(1);
        m.setCharacterTemplateUuid("char-tpl");
        m.setClassUuid("class-uuid");
        m.setTraitUuids("t1,t2");
        return m;
    }

    private StoryEntity story(Long id, String uuid, Integer startLoc) {
        StoryEntity s = new StoryEntity();
        s.setId(id);
        s.setUuid(uuid);
        s.setIdLocationStart(startLoc);
        return s;
    }

    private StoryDifficultyEntity difficulty(Long id, String uuid) {
        StoryDifficultyEntity d = new StoryDifficultyEntity();
        d.setId(id);
        d.setUuid(uuid);
        return d;
    }

    private LocationEntity location(Long id, String uuid) {
        LocationEntity l = new LocationEntity();
        l.setId(id);
        l.setUuid(uuid);
        return l;
    }

    private GamingStateLocationsEntity locState(Long matchId, Long locId) {
        GamingStateLocationsEntity e = new GamingStateLocationsEntity();
        e.setIdMatch(matchId);
        e.setIdLocation(locId);
        e.setUuid("loc-state-" + locId);
        e.setFlagAlreadyActived(0);
        e.setClockCounter(7);
        return e;
    }

    private MatchRegistryEntry regEntry(String key) {
        MatchRegistryEntry e = new MatchRegistryEntry();
        e.setUuid("reg-" + key);
        e.setKey(key);
        e.setValues(java.util.List.of("1"));
        return e;
    }

    @Nested
    @DisplayName("listUserMatches")
    class ListUserMatches {

        @Test
        @DisplayName("null uuid returns empty list")
        void nullUuid() {
            assertTrue(service.listUserMatches(null).isEmpty());
            verifyNoInteractions(userAccessPort, matchReadPort);
        }

        @Test
        @DisplayName("blank uuid returns empty list")
        void blankUuid() {
            assertTrue(service.listUserMatches("   ").isEmpty());
        }

        @Test
        @DisplayName("unknown user returns empty list")
        void unknownUser() {
            when(userAccessPort.findByUuid("u")).thenReturn(Optional.empty());
            assertTrue(service.listUserMatches("u").isEmpty());
            verify(matchReadPort, never()).findMatchesByUserId(any());
        }

        @Test
        @DisplayName("returns mapped summaries for user matches")
        void mapsMatches() {
            when(userAccessPort.findByUuid("u")).thenReturn(Optional.of(user(7L, "u")));
            when(matchReadPort.findMatchesByUserId(7L))
                    .thenReturn(List.of(match(1L, "m1", 7L, 2L, 3L)));

            List<MatchSummary> result = service.listUserMatches("u");
            assertEquals(1, result.size());
            assertEquals("m1", result.get(0).getUuid());
            assertEquals("u", result.get(0).getUserCreatorUuid());
            assertEquals(1, result.get(0).getSinglePlayer());
            assertEquals("char-tpl", result.get(0).getCharacterTemplateUuid());
            assertEquals("class-uuid", result.get(0).getClassUuid());
            assertEquals(List.of("t1", "t2"), result.get(0).getTraitUuids());
        }

        @Test
        @DisplayName("populates storyUuid and difficultyUuid from the match's story")
        void resolvesStoryAndDifficulty() {
            when(userAccessPort.findByUuid("u")).thenReturn(Optional.of(user(7L, "u")));
            when(matchReadPort.findMatchesByUserId(7L))
                    .thenReturn(List.of(match(1L, "m1", 7L, 2L, 3L)));
            when(storyReadPort.findAllStories()).thenReturn(List.of(story(2L, "story-uuid", 1)));
            when(storyReadPort.findDifficultiesByStoryId(2L))
                    .thenReturn(List.of(difficulty(3L, "diff-uuid")));

            List<MatchSummary> result = service.listUserMatches("u");

            assertEquals(1, result.size());
            assertEquals("story-uuid", result.get(0).getStoryUuid());
            assertEquals("diff-uuid", result.get(0).getDifficultyUuid());
        }
    }

    @Nested
    @DisplayName("listAllMatches")
    class ListAllMatches {

        @Test
        @DisplayName("empty when there are no matches")
        void empty() {
            when(matchReadPort.findAllMatches()).thenReturn(List.of());
            assertTrue(service.listAllMatches().isEmpty());
        }

        @Test
        @DisplayName("maps every match regardless of owner")
        void mapsAll() {
            when(matchReadPort.findAllMatches())
                    .thenReturn(List.of(match(1L, "m1", 7L, 2L, 3L),
                                        match(2L, "m2", 8L, 2L, 3L)));
            List<MatchSummary> result = service.listAllMatches();
            assertEquals(2, result.size());
            assertEquals("m1", result.get(0).getUuid());
            assertEquals("m2", result.get(1).getUuid());
            assertEquals(1, result.get(0).getSinglePlayer());
        }
    }

    @Nested
    @DisplayName("listMatchesPage (v0.28.1)")
    class ListMatchesPage {

        private games.paths.core.port.match.MatchReadPort.MatchPageCriteria capture() {
            var captor = org.mockito.ArgumentCaptor.forClass(
                    games.paths.core.port.match.MatchReadPort.MatchPageCriteria.class);
            verify(matchReadPort).findMatchesPage(captor.capture());
            return captor.getValue();
        }

        @Test
        @DisplayName("null filter → default page, no filters, over-fetch by one")
        void defaults() {
            when(matchReadPort.findMatchesPage(any())).thenReturn(List.of());
            var page = service.listMatchesPage(null);
            assertEquals(50, page.limit());
            assertNull(page.nextCursor());
            assertTrue(page.items().isEmpty());
            var c = capture();
            assertNull(c.status());
            assertNull(c.idUser());
            assertNull(c.idStory());
            assertNull(c.tsFrom());
            assertNull(c.tsCursor());
            assertNull(c.idCursor());
            assertEquals(51, c.limit()); // 50 + 1 to detect a further page
        }

        @Test
        @DisplayName("over-fetched extra row → trimmed page + nextCursor")
        void emitsNextCursor() {
            GamingMatchEntity m1 = match(1L, "m1", 7L, 2L, 3L);
            m1.setTsInsert("2024-03-03T00:00:00Z");
            GamingMatchEntity m2 = match(2L, "m2", 7L, 2L, 3L);
            m2.setTsInsert("2024-02-02T00:00:00Z");
            GamingMatchEntity m3 = match(3L, "m3", 7L, 2L, 3L);
            m3.setTsInsert("2024-01-01T00:00:00Z");
            // limit=2 over-fetches 3 rows; the 3rd proves there is a next page.
            when(matchReadPort.findMatchesPage(any())).thenReturn(List.of(m1, m2, m3));
            var page = service.listMatchesPage(
                    new games.paths.core.model.match.MatchListFilter(null, null, null, null, null, 2));
            assertEquals(2, page.items().size());
            assertEquals("m1", page.items().get(0).getUuid());
            assertEquals("m2", page.items().get(1).getUuid());
            assertNotNull(page.nextCursor());
            // The cursor points at the last *kept* row (m2), not the over-fetched m3.
            assertArrayEquals(new String[]{"2024-02-02T00:00:00Z", "2"},
                    MatchQueryService.decodeCursor(page.nextCursor()));
        }

        @Test
        @DisplayName("no extra row → last page, nextCursor null")
        void lastPageHasNoCursor() {
            when(matchReadPort.findMatchesPage(any()))
                    .thenReturn(List.of(match(1L, "m1", 7L, 2L, 3L)));
            var page = service.listMatchesPage(
                    new games.paths.core.model.match.MatchListFilter(null, null, null, null, null, 5));
            assertEquals(1, page.items().size());
            assertNull(page.nextCursor());
        }

        @Test
        @DisplayName("status filter is forwarded verbatim")
        void statusForwarded() {
            when(matchReadPort.findMatchesPage(any())).thenReturn(List.of());
            service.listMatchesPage(new games.paths.core.model.match.MatchListFilter(
                    "RUNNING", null, null, null, null, null));
            assertEquals("RUNNING", capture().status());
        }

        @Test
        @DisplayName("known creator uuid resolves to its id")
        void resolvesUser() {
            when(userAccessPort.findByUuid("u-7")).thenReturn(Optional.of(user(7L, "u-7")));
            when(matchReadPort.findMatchesPage(any())).thenReturn(List.of());
            service.listMatchesPage(new games.paths.core.model.match.MatchListFilter(
                    null, "u-7", null, null, null, null));
            assertEquals(7L, capture().idUser());
        }

        @Test
        @DisplayName("unknown creator uuid → empty page, repository not queried")
        void unknownUser() {
            when(userAccessPort.findByUuid("ghost")).thenReturn(Optional.empty());
            var page = service.listMatchesPage(new games.paths.core.model.match.MatchListFilter(
                    null, "ghost", null, null, null, null));
            assertTrue(page.items().isEmpty());
            assertNull(page.nextCursor());
            verify(matchReadPort, never()).findMatchesPage(any());
        }

        @Test
        @DisplayName("known story uuid resolves to its id")
        void resolvesStory() {
            when(storyReadPort.findStoryByUuid("s-2")).thenReturn(Optional.of(story(2L, "s-2", 1)));
            when(matchReadPort.findMatchesPage(any())).thenReturn(List.of());
            service.listMatchesPage(new games.paths.core.model.match.MatchListFilter(
                    null, null, "s-2", null, null, null));
            assertEquals(2L, capture().idStory());
        }

        @Test
        @DisplayName("unknown story uuid → empty page, repository not queried")
        void unknownStory() {
            when(storyReadPort.findStoryByUuid("nope")).thenReturn(Optional.empty());
            var page = service.listMatchesPage(new games.paths.core.model.match.MatchListFilter(
                    null, null, "nope", null, null, null));
            assertTrue(page.items().isEmpty());
            verify(matchReadPort, never()).findMatchesPage(any());
        }

        @Test
        @DisplayName("sinceDays becomes an ISO tsFrom lower bound")
        void sinceDaysBound() {
            when(matchReadPort.findMatchesPage(any())).thenReturn(List.of());
            service.listMatchesPage(new games.paths.core.model.match.MatchListFilter(
                    null, null, null, 7, null, null));
            assertNotNull(capture().tsFrom());
        }

        @Test
        @DisplayName("non-positive sinceDays is ignored")
        void sinceDaysIgnored() {
            when(matchReadPort.findMatchesPage(any())).thenReturn(List.of());
            service.listMatchesPage(new games.paths.core.model.match.MatchListFilter(
                    null, null, null, 0, null, null));
            assertNull(capture().tsFrom());
        }

        @Test
        @DisplayName("cursor decodes into the keyset position")
        void cursorDecoded() {
            String cursor = MatchQueryService.encodeCursor("2024-02-02T00:00:00Z", 9L);
            when(matchReadPort.findMatchesPage(any())).thenReturn(List.of());
            service.listMatchesPage(new games.paths.core.model.match.MatchListFilter(
                    null, null, null, null, cursor, null));
            var c = capture();
            assertEquals("2024-02-02T00:00:00Z", c.tsCursor());
            assertEquals(9L, c.idCursor());
        }

        @Test
        @DisplayName("limit is clamped to [1, 200] before the over-fetch")
        void limitClamped() {
            when(matchReadPort.findMatchesPage(any())).thenReturn(List.of());
            service.listMatchesPage(new games.paths.core.model.match.MatchListFilter(
                    null, null, null, null, null, 9999));
            assertEquals(201, capture().limit()); // 200 (max) + 1
        }

        @Test
        @DisplayName("zero/negative limit clamps up to 1")
        void limitFloor() {
            when(matchReadPort.findMatchesPage(any())).thenReturn(List.of());
            service.listMatchesPage(new games.paths.core.model.match.MatchListFilter(
                    null, null, null, null, null, 0));
            assertEquals(2, capture().limit()); // 1 (min) + 1
        }
    }

    @Nested
    @DisplayName("cursor codec")
    class CursorCodec {

        @Test
        void roundTrip() {
            String token = MatchQueryService.encodeCursor("2024-01-01T00:00:00Z", 42L);
            assertArrayEquals(new String[]{"2024-01-01T00:00:00Z", "42"},
                    MatchQueryService.decodeCursor(token));
        }

        @Test
        void encodeNullIsNull() {
            assertNull(MatchQueryService.encodeCursor(null, 1L));
            assertNull(MatchQueryService.encodeCursor("2024", null));
        }

        @Test
        void decodeBlankIsNull() {
            assertNull(MatchQueryService.decodeCursor(null));
            assertNull(MatchQueryService.decodeCursor(""));
        }

        @Test
        void decodeMalformedIsNull() {
            assertNull(MatchQueryService.decodeCursor("@@@not-base64@@@"));
            // base64 of "no-separator" (lacks the '|' delimiter)
            assertNull(MatchQueryService.decodeCursor(
                    java.util.Base64.getUrlEncoder().withoutPadding()
                            .encodeToString("noseparator".getBytes())));
            // non-numeric id part
            assertNull(MatchQueryService.decodeCursor(
                    java.util.Base64.getUrlEncoder().withoutPadding()
                            .encodeToString("2024|abc".getBytes())));
        }
    }

    @Nested
    @DisplayName("getMatchInfo")
    class GetMatchInfo {

        @Test
        @DisplayName("blank user uuid → null")
        void blankUser() {
            assertNull(service.getMatchInfo("m", null, "en"));
            assertNull(service.getMatchInfo("m", "  ", "en"));
        }

        @Test
        @DisplayName("blank match uuid → null")
        void blankMatch() {
            assertNull(service.getMatchInfo(null, "u", "en"));
            assertNull(service.getMatchInfo("  ", "u", "en"));
        }

        @Test
        @DisplayName("unknown user → null")
        void unknownUser() {
            when(userAccessPort.findByUuid("u")).thenReturn(Optional.empty());
            assertNull(service.getMatchInfo("m", "u", "en"));
        }

        @Test
        @DisplayName("match not found → null")
        void matchNotFound() {
            when(userAccessPort.findByUuid("u")).thenReturn(Optional.of(user(7L, "u")));
            when(matchReadPort.findMatchByUuid("m")).thenReturn(Optional.empty());
            assertNull(service.getMatchInfo("m", "u", "en"));
        }

        @Test
        @DisplayName("match owned by another user → null")
        void otherOwner() {
            when(userAccessPort.findByUuid("u")).thenReturn(Optional.of(user(7L, "u")));
            when(matchReadPort.findMatchByUuid("m"))
                    .thenReturn(Optional.of(match(1L, "m", 99L, 2L, 3L)));
            assertNull(service.getMatchInfo("m", "u", "en"));
        }

        @Test
        @DisplayName("returns full detail with state, registry, and start location")
        void fullPath() {
            when(userAccessPort.findByUuid("u")).thenReturn(Optional.of(user(7L, "u")));
            GamingMatchEntity m = match(1L, "m", 7L, 2L, 3L);
            when(matchReadPort.findMatchByUuid("m")).thenReturn(Optional.of(m));
            StoryEntity story = story(2L, "story-uuid", 10);
            when(storyReadPort.findAllStories()).thenReturn(List.of(story));
            when(storyReadPort.findLocationsByStoryId(2L)).thenReturn(List.of(
                    location(10L, "loc-10"),
                    location(11L, "loc-11")
            ));
            when(storyReadPort.findDifficultiesByStoryId(2L))
                    .thenReturn(List.of(difficulty(3L, "diff-uuid"), difficulty(99L, "other")));
            when(matchReadPort.findLocationsByMatchId(1L))
                    .thenReturn(List.of(locState(1L, 10L), locState(1L, 11L)));
            when(registryService.listEntries(eq(1L), any(), eq(false), any()))
                    .thenReturn(List.of(regEntry("k")));

            MatchDetail detail = service.getMatchInfo("m", "u", "en");
            assertNotNull(detail);
            assertEquals("m", detail.getMatch().getUuid());
            assertEquals("story-uuid", detail.getMatch().getStoryUuid());
            assertEquals("diff-uuid", detail.getMatch().getDifficultyUuid());
            assertEquals(10L, detail.getCurrentLocationId());
            assertEquals("loc-10", detail.getCurrentLocationUuid());
            assertEquals(2, detail.getLocations().size());
            assertEquals(1, detail.getRegistry().size());
            assertEquals("k", detail.getRegistry().get(0).getKey());
            assertTrue(detail.getEvents().isEmpty());
            assertTrue(detail.getChoices().isEmpty());
        }

        @Test
        @DisplayName("v0.28.6 — player info keeps only VISITED locations, admin keeps all")
        void visitedFilterAppliesToPlayerNotAdmin() {
            when(userAccessPort.findByUuid("u")).thenReturn(Optional.of(user(7L, "u")));
            GamingMatchEntity m = match(1L, "m", 7L, 2L, 3L);
            when(matchReadPort.findMatchByUuid("m")).thenReturn(Optional.of(m));
            when(storyReadPort.findAllStories()).thenReturn(List.of(story(2L, "story-uuid", 10)));
            when(storyReadPort.findLocationsByStoryId(2L))
                    .thenReturn(List.of(location(10L, "loc-10"), location(11L, "loc-11")));
            when(storyReadPort.findDifficultiesByStoryId(2L)).thenReturn(List.of());
            when(matchReadPort.findLocationsByMatchId(1L))
                    .thenReturn(List.of(locState(1L, 10L), locState(1L, 11L)));
            when(registryService.listEntries(eq(1L), any(), eq(false), any()))
                    .thenReturn(List.of());

            // Only location 10 has been visited.
            MovementStorePort movementStorePort = mock(MovementStorePort.class);
            when(movementStorePort.findVisitedLocationIds(1L)).thenReturn(List.of(10L));
            MatchQueryService svc = new MatchQueryService(matchReadPort, storyReadPort,
                    userAccessPort, null, null, movementStorePort);

            MatchDetail player = svc.getMatchInfo("m", "u", "en");
            assertEquals(1, player.getLocations().size());
            assertEquals(10L, player.getLocations().get(0).getIdLocation());

            // The admin console needs the full gaming_state_locations table.
            MatchDetail admin = svc.getMatchInfoForAdmin("m");
            assertEquals(2, admin.getLocations().size());
        }

        @Test
        @DisplayName("story without start location")
        void noStartLocation() {
            when(userAccessPort.findByUuid("u")).thenReturn(Optional.of(user(7L, "u")));
            GamingMatchEntity m = match(1L, "m", 7L, 2L, 3L);
            when(matchReadPort.findMatchByUuid("m")).thenReturn(Optional.of(m));
            when(storyReadPort.findAllStories()).thenReturn(List.of(story(2L, "story-uuid", null)));
            when(storyReadPort.findLocationsByStoryId(2L)).thenReturn(List.of());
            when(storyReadPort.findDifficultiesByStoryId(2L)).thenReturn(List.of());
            when(matchReadPort.findLocationsByMatchId(1L)).thenReturn(List.of());
            when(registryService.listEntries(eq(1L), any(), eq(false), any()))
                    .thenReturn(List.of());

            MatchDetail detail = service.getMatchInfo("m", "u", "en");
            assertNotNull(detail);
            assertNull(detail.getCurrentLocationId());
            assertNull(detail.getCurrentLocationUuid());
        }

        @Test
        @DisplayName("start location id present but location entity missing")
        void startLocationMissingEntity() {
            when(userAccessPort.findByUuid("u")).thenReturn(Optional.of(user(7L, "u")));
            GamingMatchEntity m = match(1L, "m", 7L, 2L, 3L);
            when(matchReadPort.findMatchByUuid("m")).thenReturn(Optional.of(m));
            when(storyReadPort.findAllStories()).thenReturn(List.of(story(2L, "story-uuid", 10)));
            when(storyReadPort.findLocationsByStoryId(2L)).thenReturn(List.of());
            when(storyReadPort.findDifficultiesByStoryId(2L)).thenReturn(List.of());
            when(matchReadPort.findLocationsByMatchId(1L)).thenReturn(List.of());
            when(registryService.listEntries(eq(1L), any(), eq(false), any()))
                    .thenReturn(List.of());

            MatchDetail detail = service.getMatchInfo("m", "u", "en");
            assertNotNull(detail);
            assertEquals(10L, detail.getCurrentLocationId());
            assertNull(detail.getCurrentLocationUuid());
        }

        @Test
        @DisplayName("story missing from findAllStories")
        void storyMissing() {
            when(userAccessPort.findByUuid("u")).thenReturn(Optional.of(user(7L, "u")));
            GamingMatchEntity m = match(1L, "m", 7L, 2L, 3L);
            when(matchReadPort.findMatchByUuid("m")).thenReturn(Optional.of(m));
            when(storyReadPort.findAllStories()).thenReturn(List.of());
            when(matchReadPort.findLocationsByMatchId(1L)).thenReturn(List.of());
            when(registryService.listEntries(eq(1L), any(), eq(false), any()))
                    .thenReturn(List.of());

            MatchDetail detail = service.getMatchInfo("m", "u", "en");
            assertNotNull(detail);
            assertNull(detail.getMatch().getStoryUuid());
            assertNull(detail.getMatch().getDifficultyUuid());
        }

        @Test
        @DisplayName("getMatchInfoForAdmin: blank uuid → null")
        void adminBlankUuid() {
            assertNull(service.getMatchInfoForAdmin(null));
            assertNull(service.getMatchInfoForAdmin("  "));
        }

        @Test
        @DisplayName("getMatchInfoForAdmin: match not found → null")
        void adminMatchNotFound() {
            when(matchReadPort.findMatchByUuid("m")).thenReturn(Optional.empty());
            assertNull(service.getMatchInfoForAdmin("m"));
        }

        @Test
        @DisplayName("getMatchInfoForAdmin: returns detail of a match owned by another user")
        void adminAnyOwner() {
            // match created by user 99 — the admin info endpoint skips the
            // ownership check that GET /api/match/{uuid}/info enforces.
            GamingMatchEntity m = match(1L, "m", 99L, 2L, 3L);
            when(matchReadPort.findMatchByUuid("m")).thenReturn(Optional.of(m));
            when(storyReadPort.findAllStories()).thenReturn(List.of(story(2L, "story-uuid", 10)));
            when(storyReadPort.findLocationsByStoryId(2L)).thenReturn(List.of(location(10L, "loc-10")));
            when(storyReadPort.findDifficultiesByStoryId(2L))
                    .thenReturn(List.of(difficulty(3L, "diff-uuid")));
            when(matchReadPort.findLocationsByMatchId(1L)).thenReturn(List.of(locState(1L, 10L)));
            when(registryService.listEntries(eq(1L), any(), eq(false), any()))
                    .thenReturn(List.of(regEntry("k")));

            MatchDetail detail = service.getMatchInfoForAdmin("m");
            assertNotNull(detail);
            assertEquals("m", detail.getMatch().getUuid());
            assertEquals("story-uuid", detail.getMatch().getStoryUuid());
            assertEquals(1, detail.getRegistry().size());
        }
    }
}
