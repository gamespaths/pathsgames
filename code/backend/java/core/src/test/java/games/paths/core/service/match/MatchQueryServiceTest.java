package games.paths.core.service.match;

import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.match.GamingStateLocationsEntity;
import games.paths.core.entity.match.GamingStateRegistryEntity;
import games.paths.core.entity.story.LocationEntity;
import games.paths.core.entity.story.StoryDifficultyEntity;
import games.paths.core.entity.story.StoryEntity;
import games.paths.core.model.match.MatchDetail;
import games.paths.core.model.match.MatchSummary;
import games.paths.core.port.match.MatchReadPort;
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
    private MatchQueryService service;

    @BeforeEach
    void setUp() {
        matchReadPort = mock(MatchReadPort.class);
        storyReadPort = mock(StoryReadPort.class);
        userAccessPort = mock(UserAccessPort.class);
        service = new MatchQueryService(matchReadPort, storyReadPort, userAccessPort);
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

    private GamingStateRegistryEntity regEntry(Long id, Long matchId, String key) {
        GamingStateRegistryEntity e = new GamingStateRegistryEntity();
        e.setId(id);
        e.setIdMatch(matchId);
        e.setUuid("reg-" + id);
        e.setKey(key);
        e.setIntValue(1);
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
    @DisplayName("getMatchInfo")
    class GetMatchInfo {

        @Test
        @DisplayName("blank user uuid → null")
        void blankUser() {
            assertNull(service.getMatchInfo("m", null));
            assertNull(service.getMatchInfo("m", "  "));
        }

        @Test
        @DisplayName("blank match uuid → null")
        void blankMatch() {
            assertNull(service.getMatchInfo(null, "u"));
            assertNull(service.getMatchInfo("  ", "u"));
        }

        @Test
        @DisplayName("unknown user → null")
        void unknownUser() {
            when(userAccessPort.findByUuid("u")).thenReturn(Optional.empty());
            assertNull(service.getMatchInfo("m", "u"));
        }

        @Test
        @DisplayName("match not found → null")
        void matchNotFound() {
            when(userAccessPort.findByUuid("u")).thenReturn(Optional.of(user(7L, "u")));
            when(matchReadPort.findMatchByUuid("m")).thenReturn(Optional.empty());
            assertNull(service.getMatchInfo("m", "u"));
        }

        @Test
        @DisplayName("match owned by another user → null")
        void otherOwner() {
            when(userAccessPort.findByUuid("u")).thenReturn(Optional.of(user(7L, "u")));
            when(matchReadPort.findMatchByUuid("m"))
                    .thenReturn(Optional.of(match(1L, "m", 99L, 2L, 3L)));
            assertNull(service.getMatchInfo("m", "u"));
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
            when(matchReadPort.findRegistryByMatchId(1L))
                    .thenReturn(List.of(regEntry(20L, 1L, "k")));

            MatchDetail detail = service.getMatchInfo("m", "u");
            assertNotNull(detail);
            assertEquals("m", detail.getMatch().getUuid());
            assertEquals("story-uuid", detail.getMatch().getStoryUuid());
            assertEquals("diff-uuid", detail.getMatch().getDifficultyUuid());
            assertEquals(10L, detail.getCurrentLocationId());
            assertEquals("loc-10", detail.getCurrentLocationUuid());
            assertNotNull(detail.getCurrentLocationName());
            assertEquals(2, detail.getLocations().size());
            assertEquals(1, detail.getRegistry().size());
            assertEquals("k", detail.getRegistry().get(0).getKey());
            assertTrue(detail.getEvents().isEmpty());
            assertTrue(detail.getChoices().isEmpty());
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
            when(matchReadPort.findRegistryByMatchId(1L)).thenReturn(List.of());

            MatchDetail detail = service.getMatchInfo("m", "u");
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
            when(matchReadPort.findRegistryByMatchId(1L)).thenReturn(List.of());

            MatchDetail detail = service.getMatchInfo("m", "u");
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
            when(matchReadPort.findRegistryByMatchId(1L)).thenReturn(List.of());

            MatchDetail detail = service.getMatchInfo("m", "u");
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
            when(matchReadPort.findRegistryByMatchId(1L)).thenReturn(List.of(regEntry(20L, 1L, "k")));

            MatchDetail detail = service.getMatchInfoForAdmin("m");
            assertNotNull(detail);
            assertEquals("m", detail.getMatch().getUuid());
            assertEquals("story-uuid", detail.getMatch().getStoryUuid());
            assertEquals(1, detail.getRegistry().size());
        }
    }
}
