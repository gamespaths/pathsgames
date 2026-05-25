package games.paths.core.service.match;

import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.match.GamingStateLocationsEntity;
import games.paths.core.entity.match.GamingStateRegistryEntity;
import games.paths.core.entity.story.KeyEntity;
import games.paths.core.entity.story.LocationEntity;
import games.paths.core.entity.story.StoryDifficultyEntity;
import games.paths.core.entity.story.StoryEntity;
import games.paths.core.model.match.MatchCreateCommand;
import games.paths.core.model.match.MatchSummary;
import games.paths.core.port.match.MatchCommandPort;
import games.paths.core.port.match.MatchPersistencePort;
import games.paths.core.port.match.SystemModePort;
import games.paths.core.port.match.UserAccessPort;
import games.paths.core.port.story.StoryReadPort;
import games.paths.core.port.turnstile.TurnstileVerificationPort;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link MatchCommandService}.
 * Step 19 — covers all branches of single-player match creation.
 */
class MatchCommandServiceTest {

    private StoryReadPort storyReadPort;
    private MatchPersistencePort persistencePort;
    private UserAccessPort userAccessPort;
    private SystemModePort systemModePort;
    private MatchCommandService service;

    @BeforeEach
    void setUp() {
        storyReadPort = mock(StoryReadPort.class);
        persistencePort = mock(MatchPersistencePort.class);
        userAccessPort = mock(UserAccessPort.class);
        systemModePort = mock(SystemModePort.class);
        service = new MatchCommandService(storyReadPort, persistencePort, userAccessPort, systemModePort);
    }

    private MatchCreateCommand cmd(String userUuid, String storyUuid, String diffUuid) {
        return new MatchCreateCommand(userUuid, storyUuid, diffUuid,
                "My match", "char-tpl", null, null, null);
    }

    private UserAccessPort.UserView activeUser() {
        return new UserAccessPort.UserView(7L, "user-uuid", "alice", "PLAYER", 2);
    }

    private StoryEntity story(Long id, String uuid) {
        StoryEntity s = new StoryEntity();
        s.setId(id);
        s.setUuid(uuid);
        return s;
    }

    private StoryDifficultyEntity difficulty(Long id, String uuid, Integer cost) {
        StoryDifficultyEntity d = new StoryDifficultyEntity();
        d.setId(id);
        d.setUuid(uuid);
        d.setExpCost(cost);
        return d;
    }

    private LocationEntity location(Long id, String uuid, Integer counter) {
        LocationEntity l = new LocationEntity();
        l.setId(id);
        l.setUuid(uuid);
        l.setCounterTime(counter);
        return l;
    }

    private KeyEntity key(Long id, String name, String value) {
        KeyEntity k = new KeyEntity();
        k.setId(id);
        k.setName(name);
        k.setValue(value);
        return k;
    }

    @Nested
    @DisplayName("Validation")
    class Validation {

        @Test
        @DisplayName("null command → INVALID_INPUT")
        void nullCommand() {
            MatchCommandPort.MatchCreationException ex = assertThrows(
                    MatchCommandPort.MatchCreationException.class,
                    () -> service.createMatch(null));
            assertEquals(MatchCommandPort.MatchCreationException.Code.INVALID_INPUT, ex.getCode());
        }

        @Test
        @DisplayName("blank user uuid → INVALID_INPUT")
        void blankUser() {
            assertThrows(MatchCommandPort.MatchCreationException.class,
                    () -> service.createMatch(cmd("", "s", "d")));
        }

        @Test
        @DisplayName("null user uuid → INVALID_INPUT")
        void nullUser() {
            assertThrows(MatchCommandPort.MatchCreationException.class,
                    () -> service.createMatch(cmd(null, "s", "d")));
        }

        @Test
        @DisplayName("blank story uuid → INVALID_INPUT")
        void blankStory() {
            assertThrows(MatchCommandPort.MatchCreationException.class,
                    () -> service.createMatch(cmd("u", "", "d")));
        }

        @Test
        @DisplayName("null story uuid → INVALID_INPUT")
        void nullStory() {
            assertThrows(MatchCommandPort.MatchCreationException.class,
                    () -> service.createMatch(cmd("u", null, "d")));
        }

        @Test
        @DisplayName("blank difficulty uuid → INVALID_INPUT")
        void blankDiff() {
            assertThrows(MatchCommandPort.MatchCreationException.class,
                    () -> service.createMatch(cmd("u", "s", "")));
        }

        @Test
        @DisplayName("null difficulty uuid → INVALID_INPUT")
        void nullDiff() {
            assertThrows(MatchCommandPort.MatchCreationException.class,
                    () -> service.createMatch(cmd("u", "s", null)));
        }
    }

    @Nested
    @DisplayName("Pre-conditions")
    class Preconditions {

        @Test
        @DisplayName("turnstile failure → TURNSTILE_VALIDATION_FAILED")
        void turnstileRejected() {
            TurnstileVerificationPort rejectAll = (token, ip) -> false;
            MatchCommandService strictService = new MatchCommandService(
                    storyReadPort, persistencePort, userAccessPort, systemModePort, rejectAll);
            MatchCommandPort.MatchCreationException ex = assertThrows(
                    MatchCommandPort.MatchCreationException.class,
                    () -> strictService.createMatch(new MatchCreateCommand("u", "s", "d",
                            null, null, null, null, null, "bad-token", "1.2.3.4")));
            assertEquals(MatchCommandPort.MatchCreationException.Code.TURNSTILE_VALIDATION_FAILED, ex.getCode());
        }

        @Test
        @DisplayName("maintenance mode → MAINTENANCE_MODE")
        void maintenance() {
            when(systemModePort.isMaintenance()).thenReturn(true);
            MatchCommandPort.MatchCreationException ex = assertThrows(
                    MatchCommandPort.MatchCreationException.class,
                    () -> service.createMatch(cmd("u", "s", "d")));
            assertEquals(MatchCommandPort.MatchCreationException.Code.MAINTENANCE_MODE, ex.getCode());
            verify(userAccessPort, never()).findByUuid(any());
        }

        @Test
        @DisplayName("user not found → USER_NOT_FOUND")
        void userNotFound() {
            when(systemModePort.isMaintenance()).thenReturn(false);
            when(userAccessPort.findByUuid("u")).thenReturn(Optional.empty());
            MatchCommandPort.MatchCreationException ex = assertThrows(
                    MatchCommandPort.MatchCreationException.class,
                    () -> service.createMatch(cmd("u", "s", "d")));
            assertEquals(MatchCommandPort.MatchCreationException.Code.USER_NOT_FOUND, ex.getCode());
        }

        @Test
        @DisplayName("banned user → USER_BANNED")
        void bannedUser() {
            when(systemModePort.isMaintenance()).thenReturn(false);
            when(userAccessPort.findByUuid("u"))
                    .thenReturn(Optional.of(new UserAccessPort.UserView(1L, "u", "x", "PLAYER", 4)));
            MatchCommandPort.MatchCreationException ex = assertThrows(
                    MatchCommandPort.MatchCreationException.class,
                    () -> service.createMatch(cmd("u", "s", "d")));
            assertEquals(MatchCommandPort.MatchCreationException.Code.USER_BANNED, ex.getCode());
        }

        @Test
        @DisplayName("blocked user → USER_BANNED")
        void blockedUser() {
            when(systemModePort.isMaintenance()).thenReturn(false);
            when(userAccessPort.findByUuid("u"))
                    .thenReturn(Optional.of(new UserAccessPort.UserView(1L, "u", "x", "PLAYER", 3)));
            assertThrows(MatchCommandPort.MatchCreationException.class,
                    () -> service.createMatch(cmd("u", "s", "d")));
        }

        @Test
        @DisplayName("user state null → not banned (success path)")
        void userStateNull() {
            when(systemModePort.isMaintenance()).thenReturn(false);
            when(userAccessPort.findByUuid("u"))
                    .thenReturn(Optional.of(new UserAccessPort.UserView(7L, "u", "x", "PLAYER", null)));
            when(storyReadPort.findStoryByUuid("s")).thenReturn(Optional.of(story(2L, "s")));
            when(storyReadPort.findDifficultyByStoryIdAndUuid(2L, "d"))
                    .thenReturn(Optional.of(difficulty(3L, "d", 5)));
            when(storyReadPort.findLocationsByStoryId(2L))
                    .thenReturn(List.of(location(10L, "loc-uuid", 0)));
            when(storyReadPort.findKeysByStoryId(2L)).thenReturn(List.of());
            when(persistencePort.saveMatch(any())).thenAnswer(inv -> {
                GamingMatchEntity m = inv.getArgument(0);
                m.setId(99L);
                m.setUuid("match-uuid");
                m.setTsInsert("2024-01-01T00:00:00Z");
                return m;
            });

            MatchSummary result = service.createMatch(cmd("u", "s", "d"));
            assertNotNull(result);
            assertEquals("match-uuid", result.getUuid());
        }

        @Test
        @DisplayName("story not found → STORY_NOT_FOUND")
        void storyNotFound() {
            when(systemModePort.isMaintenance()).thenReturn(false);
            when(userAccessPort.findByUuid("u")).thenReturn(Optional.of(activeUser()));
            when(storyReadPort.findStoryByUuid("s")).thenReturn(Optional.empty());
            MatchCommandPort.MatchCreationException ex = assertThrows(
                    MatchCommandPort.MatchCreationException.class,
                    () -> service.createMatch(cmd("u", "s", "d")));
            assertEquals(MatchCommandPort.MatchCreationException.Code.STORY_NOT_FOUND, ex.getCode());
        }

        @Test
        @DisplayName("difficulty not found → DIFFICULTY_NOT_FOUND")
        void difficultyNotFound() {
            when(systemModePort.isMaintenance()).thenReturn(false);
            when(userAccessPort.findByUuid("u")).thenReturn(Optional.of(activeUser()));
            when(storyReadPort.findStoryByUuid("s")).thenReturn(Optional.of(story(2L, "s")));
            when(storyReadPort.findDifficultyByStoryIdAndUuid(2L, "d")).thenReturn(Optional.empty());
            MatchCommandPort.MatchCreationException ex = assertThrows(
                    MatchCommandPort.MatchCreationException.class,
                    () -> service.createMatch(cmd("u", "s", "d")));
            assertEquals(MatchCommandPort.MatchCreationException.Code.DIFFICULTY_NOT_FOUND, ex.getCode());
        }

        @Test
        @DisplayName("locations null → STORY_HAS_NO_LOCATIONS")
        void nullLocations() {
            when(systemModePort.isMaintenance()).thenReturn(false);
            when(userAccessPort.findByUuid("u")).thenReturn(Optional.of(activeUser()));
            when(storyReadPort.findStoryByUuid("s")).thenReturn(Optional.of(story(2L, "s")));
            when(storyReadPort.findDifficultyByStoryIdAndUuid(2L, "d"))
                    .thenReturn(Optional.of(difficulty(3L, "d", 5)));
            when(storyReadPort.findLocationsByStoryId(2L)).thenReturn(null);
            assertThrows(MatchCommandPort.MatchCreationException.class,
                    () -> service.createMatch(cmd("u", "s", "d")));
        }

        @Test
        @DisplayName("locations empty → STORY_HAS_NO_LOCATIONS")
        void emptyLocations() {
            when(systemModePort.isMaintenance()).thenReturn(false);
            when(userAccessPort.findByUuid("u")).thenReturn(Optional.of(activeUser()));
            when(storyReadPort.findStoryByUuid("s")).thenReturn(Optional.of(story(2L, "s")));
            when(storyReadPort.findDifficultyByStoryIdAndUuid(2L, "d"))
                    .thenReturn(Optional.of(difficulty(3L, "d", 5)));
            when(storyReadPort.findLocationsByStoryId(2L)).thenReturn(List.of());
            MatchCommandPort.MatchCreationException ex = assertThrows(
                    MatchCommandPort.MatchCreationException.class,
                    () -> service.createMatch(cmd("u", "s", "d")));
            assertEquals(MatchCommandPort.MatchCreationException.Code.STORY_HAS_NO_LOCATIONS, ex.getCode());
        }
    }

    @Nested
    @DisplayName("Happy path")
    class HappyPath {

        @BeforeEach
        void wireOk() {
            when(systemModePort.isMaintenance()).thenReturn(false);
            when(userAccessPort.findByUuid("user-uuid")).thenReturn(Optional.of(activeUser()));
            when(storyReadPort.findStoryByUuid("story-uuid")).thenReturn(Optional.of(story(2L, "story-uuid")));
            when(storyReadPort.findDifficultyByStoryIdAndUuid(2L, "diff-uuid"))
                    .thenReturn(Optional.of(difficulty(3L, "diff-uuid", 5)));
            when(persistencePort.saveMatch(any())).thenAnswer(inv -> {
                GamingMatchEntity m = inv.getArgument(0);
                m.setId(42L);
                m.setUuid("match-uuid");
                m.setTsInsert("2024-01-01T00:00:00Z");
                return m;
            });
        }

        @Test
        @DisplayName("creates match and seeds locations + registry with default values")
        void createsAll() {
            when(storyReadPort.findLocationsByStoryId(2L)).thenReturn(List.of(
                    location(10L, "loc-1", 5),
                    location(11L, "loc-2", null)
            ));
            when(storyReadPort.findKeysByStoryId(2L)).thenReturn(List.of(
                    key(20L, "boolean_key", "1"),
                    key(21L, "string_key", "hello"),
                    key(22L, "spaces_key", "  "),
                    key(23L, "null_key", null)
            ));

            MatchSummary result = service.createMatch(cmd("user-uuid", "story-uuid", "diff-uuid"));

            assertNotNull(result);
            assertEquals("match-uuid", result.getUuid());
            assertEquals("user-uuid", result.getUserCreatorUuid());
            assertEquals("story-uuid", result.getStoryUuid());
            assertEquals("diff-uuid", result.getDifficultyUuid());
            assertEquals("CREATED", result.getStatus());
            assertEquals(0, result.getCurrentClock());
            assertEquals(5, result.getExpCost());
            assertEquals("My match", result.getName());
            assertEquals(1, result.getSinglePlayer());
            assertEquals("char-tpl", result.getCharacterTemplateUuid());
            assertNull(result.getClassUuid());
            assertTrue(result.getTraitUuids().isEmpty());

            verify(persistencePort).saveLocations(argThat(list ->
                    list != null && list.size() == 2
                            && firstLocation(list).getIdLocation() == 10L
                            && firstLocation(list).getClockCounter() == 5
            ));

            verify(persistencePort).saveRegistry(argThat(list ->
                    list != null && list.size() == 4
            ));
        }

        @Test
        @DisplayName("persists the creator loadout (class, traits, single-player flag)")
        void createsWithLoadout() {
            when(storyReadPort.findLocationsByStoryId(2L))
                    .thenReturn(List.of(location(10L, "loc", 0)));
            when(storyReadPort.findKeysByStoryId(2L)).thenReturn(List.of());

            MatchCreateCommand command = new MatchCreateCommand(
                    "user-uuid", "story-uuid", "diff-uuid", "My match", "char-tpl",
                    "class-uuid", List.of("trait-1", "trait-2"), 0);
            MatchSummary result = service.createMatch(command);

            assertEquals(0, result.getSinglePlayer());
            assertEquals("char-tpl", result.getCharacterTemplateUuid());
            assertEquals("class-uuid", result.getClassUuid());
            assertEquals(List.of("trait-1", "trait-2"), result.getTraitUuids());
        }

        @Test
        @DisplayName("null exp cost on difficulty defaults to 5")
        void difficultyNullExp() {
            when(storyReadPort.findDifficultyByStoryIdAndUuid(2L, "diff-uuid"))
                    .thenReturn(Optional.of(difficulty(3L, "diff-uuid", null)));
            when(storyReadPort.findLocationsByStoryId(2L))
                    .thenReturn(List.of(location(10L, "loc", 0)));
            when(storyReadPort.findKeysByStoryId(2L)).thenReturn(List.of());

            MatchSummary result = service.createMatch(cmd("user-uuid", "story-uuid", "diff-uuid"));
            assertEquals(5, result.getExpCost());
        }

        @Test
        @DisplayName("null keys list does not crash")
        void nullKeys() {
            when(storyReadPort.findLocationsByStoryId(2L))
                    .thenReturn(List.of(location(10L, "loc", 0)));
            when(storyReadPort.findKeysByStoryId(2L)).thenReturn(null);

            MatchSummary result = service.createMatch(cmd("user-uuid", "story-uuid", "diff-uuid"));
            assertNotNull(result);
            verify(persistencePort).saveRegistry(argThat(list -> list != null && list.isEmpty()));
        }

        @Test
        @DisplayName("resolveStoryForTesting hits read port")
        void testSeam() {
            when(storyReadPort.findStoryByUuid("x")).thenReturn(Optional.empty());
            assertTrue(service.resolveStoryForTesting("x").isEmpty());
        }
    }

    private static GamingStateLocationsEntity firstLocation(List<GamingStateLocationsEntity> list) {
        return list.get(0);
    }

    @Nested
    @DisplayName("Exception details")
    class ExceptionDetails {

        @Test
        @DisplayName("Code enum has expected entries")
        void codes() {
            assertEquals(8, MatchCommandPort.MatchCreationException.Code.values().length);
            assertEquals(MatchCommandPort.MatchCreationException.Code.USER_BANNED,
                    MatchCommandPort.MatchCreationException.Code.valueOf("USER_BANNED"));
        }

        @Test
        @DisplayName("Exception getCode returns the code")
        void exceptionGetCode() {
            MatchCommandPort.MatchCreationException ex = new MatchCommandPort.MatchCreationException(
                    MatchCommandPort.MatchCreationException.Code.MAINTENANCE_MODE, "msg");
            assertEquals(MatchCommandPort.MatchCreationException.Code.MAINTENANCE_MODE, ex.getCode());
            assertEquals("msg", ex.getMessage());
        }
    }

    @Test
    @DisplayName("UserView ban/block logic is consistent")
    void userViewLogic() {
        UserAccessPort.UserView active = new UserAccessPort.UserView(1L, "a", "u", "PLAYER", 2);
        assertFalse(active.isBanned());
        assertFalse(active.isBlocked());

        UserAccessPort.UserView banned = new UserAccessPort.UserView(2L, "b", "u", "PLAYER", 4);
        assertTrue(banned.isBanned());
        assertFalse(banned.isBlocked());

        UserAccessPort.UserView blocked = new UserAccessPort.UserView(3L, "c", "u", "PLAYER", 3);
        assertFalse(blocked.isBanned());
        assertTrue(blocked.isBlocked());

        UserAccessPort.UserView nullState = new UserAccessPort.UserView(4L, "d", "u", "PLAYER", null);
        assertFalse(nullState.isBanned());
        assertFalse(nullState.isBlocked());
    }

    @Test
    @DisplayName("All matchings save methods receive correct entities")
    void smokeSaveSanity() {
        when(systemModePort.isMaintenance()).thenReturn(false);
        when(userAccessPort.findByUuid("u")).thenReturn(Optional.of(activeUser()));
        when(storyReadPort.findStoryByUuid("s")).thenReturn(Optional.of(story(2L, "s")));
        when(storyReadPort.findDifficultyByStoryIdAndUuid(2L, "d"))
                .thenReturn(Optional.of(difficulty(3L, "d", 5)));
        when(storyReadPort.findLocationsByStoryId(2L)).thenReturn(List.of(location(10L, "x", 0)));
        when(storyReadPort.findKeysByStoryId(2L)).thenReturn(List.of(key(20L, "k", "1")));
        when(persistencePort.saveMatch(any())).thenAnswer(inv -> {
            GamingMatchEntity m = inv.getArgument(0);
            m.setId(1L);
            m.setUuid("uuid");
            m.setTsInsert("now");
            return m;
        });

        service.createMatch(cmd("u", "s", "d"));

        verify(persistencePort).saveMatch(any(GamingMatchEntity.class));
        verify(persistencePort).saveLocations(anyList());
        verify(persistencePort).saveRegistry(anyList());
    }

    @Nested
    @DisplayName("Default value parsing for registry")
    class RegistryDefaults {

        @BeforeEach
        void wire() {
            when(systemModePort.isMaintenance()).thenReturn(false);
            when(userAccessPort.findByUuid("u")).thenReturn(Optional.of(activeUser()));
            when(storyReadPort.findStoryByUuid("s")).thenReturn(Optional.of(story(2L, "s")));
            when(storyReadPort.findDifficultyByStoryIdAndUuid(2L, "d"))
                    .thenReturn(Optional.of(difficulty(3L, "d", 5)));
            when(storyReadPort.findLocationsByStoryId(2L))
                    .thenReturn(List.of(location(10L, "loc", 0)));
            when(persistencePort.saveMatch(any())).thenAnswer(inv -> {
                GamingMatchEntity m = inv.getArgument(0);
                m.setId(99L);
                m.setUuid("uuid");
                m.setTsInsert("now");
                return m;
            });
        }

        @SuppressWarnings("unchecked")
        private List<GamingStateRegistryEntity> capturedRegistry() {
            org.mockito.ArgumentCaptor<List<GamingStateRegistryEntity>> captor =
                    org.mockito.ArgumentCaptor.forClass(List.class);
            verify(persistencePort).saveRegistry(captor.capture());
            return captor.getValue();
        }

        @Test
        @DisplayName("integer values mapped to int_value")
        void intValue() {
            when(storyReadPort.findKeysByStoryId(2L))
                    .thenReturn(List.of(key(20L, "n", "42")));
            service.createMatch(cmd("u", "s", "d"));
            List<GamingStateRegistryEntity> saved = capturedRegistry();
            assertEquals(1, saved.size());
            assertEquals(42, saved.get(0).getIntValue());
            assertNull(saved.get(0).getStringValue());
        }

        @Test
        @DisplayName("non-numeric value mapped to string_value")
        void stringValue() {
            when(storyReadPort.findKeysByStoryId(2L))
                    .thenReturn(List.of(key(20L, "name", "hi")));
            service.createMatch(cmd("u", "s", "d"));
            List<GamingStateRegistryEntity> saved = capturedRegistry();
            assertEquals("hi", saved.get(0).getStringValue());
            assertNull(saved.get(0).getIntValue());
        }

        @Test
        @DisplayName("blank value mapped to empty string")
        void blankValue() {
            when(storyReadPort.findKeysByStoryId(2L))
                    .thenReturn(List.of(key(20L, "n", "   ")));
            service.createMatch(cmd("u", "s", "d"));
            List<GamingStateRegistryEntity> saved = capturedRegistry();
            assertEquals("", saved.get(0).getStringValue());
        }

        @Test
        @DisplayName("null value leaves both columns null")
        void nullValue() {
            when(storyReadPort.findKeysByStoryId(2L))
                    .thenReturn(List.of(key(20L, "n", null)));
            service.createMatch(cmd("u", "s", "d"));
            List<GamingStateRegistryEntity> saved = capturedRegistry();
            assertNull(saved.get(0).getStringValue());
            assertNull(saved.get(0).getIntValue());
        }
    }

    @Nested
    @DisplayName("Admin update / delete")
    class AdminUpdateDelete {

        private GamingMatchEntity matchWithStatus(String status) {
            GamingMatchEntity m = new GamingMatchEntity();
            m.setStatus(status);
            return m;
        }

        @Test
        @DisplayName("updateMatch with a valid status delegates and returns UPDATED")
        void updateMatch_validStatus_returnsUpdated() {
            when(persistencePort.updateMatchFields("m1", "ENDED", "n")).thenReturn(true);
            assertEquals(MatchCommandPort.UpdateOutcome.UPDATED,
                    service.updateMatch("m1", "ENDED", "n"));
        }

        @Test
        @DisplayName("updateMatch with an invalid status returns INVALID_STATUS without persisting")
        void updateMatch_invalidStatus_returnsInvalidStatus() {
            assertEquals(MatchCommandPort.UpdateOutcome.INVALID_STATUS,
                    service.updateMatch("m1", "BOGUS", null));
            verify(persistencePort, never()).updateMatchFields(any(), any(), any());
        }

        @Test
        @DisplayName("updateMatch returns NOT_FOUND when the match does not exist")
        void updateMatch_notFound_returnsNotFound() {
            when(persistencePort.updateMatchFields(any(), any(), any())).thenReturn(false);
            assertEquals(MatchCommandPort.UpdateOutcome.NOT_FOUND,
                    service.updateMatch("m1", null, "n"));
        }

        @Test
        @DisplayName("deleteMatch deletes a match in a terminal status")
        void deleteMatch_terminalStatus_deletes() {
            when(persistencePort.findMatchByUuid("m1"))
                    .thenReturn(Optional.of(matchWithStatus("ENDED")));
            when(persistencePort.deleteMatchByUuid("m1")).thenReturn(true);
            assertEquals(MatchCommandPort.DeleteOutcome.DELETED, service.deleteMatch("m1"));
            verify(persistencePort).deleteMatchByUuid("m1");
        }

        @Test
        @DisplayName("deleteMatch rejects a non-terminal match with NOT_STOPPED")
        void deleteMatch_nonTerminalStatus_returnsNotStopped() {
            when(persistencePort.findMatchByUuid("m1"))
                    .thenReturn(Optional.of(matchWithStatus("RUNNING")));
            assertEquals(MatchCommandPort.DeleteOutcome.NOT_STOPPED, service.deleteMatch("m1"));
            verify(persistencePort, never()).deleteMatchByUuid(any());
        }

        @Test
        @DisplayName("deleteMatch returns NOT_FOUND for an unknown match")
        void deleteMatch_unknownMatch_returnsNotFound() {
            when(persistencePort.findMatchByUuid("m1")).thenReturn(Optional.empty());
            assertEquals(MatchCommandPort.DeleteOutcome.NOT_FOUND, service.deleteMatch("m1"));
        }
    }
}
