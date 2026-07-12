package games.paths.core.service.match;

import games.paths.core.model.story.CardInfo;
import games.paths.core.port.match.MatchLogsPort.LogEntry;
import games.paths.core.port.match.MatchLogsPort.MatchLogsResult;
import games.paths.core.port.match.MatchLogsStorePort;
import games.paths.core.port.match.MatchLogsStorePort.CharacterLogView;
import games.paths.core.port.match.MatchLogsStorePort.ClockLogEntry;
import games.paths.core.port.match.MatchLogsStorePort.EventLogEntry;
import games.paths.core.port.match.MatchLogsStorePort.MatchSummary;
import games.paths.core.port.match.MatchLogsStorePort.MovementLogEntry;
import games.paths.core.port.match.MatchLogsStorePort.WeatherLogEntry;
import games.paths.core.port.match.TurnCyclePort.TurnCycleException;
import games.paths.core.port.match.UserAccessPort;
import games.paths.core.port.story.ContentQueryPort;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@DisplayName("MatchLogsService")
class MatchLogsServiceTest {

    private MatchLogsStorePort store;
    private UserAccessPort userAccessPort;
    private ContentQueryPort contentQueryPort;
    private MatchLogsService service;

    private static final String MATCH_UUID = "match-1";
    private static final long MATCH_ID = 1L;
    private static final long STORY_ID = 77L;
    private static final long USER_ID = 10L;
    private static final String USER_UUID = "user-1";

    @BeforeEach
    void setUp() {
        store = mock(MatchLogsStorePort.class);
        userAccessPort = mock(UserAccessPort.class);
        contentQueryPort = mock(ContentQueryPort.class);
        service = new MatchLogsService(store, userAccessPort, contentQueryPort);

        when(store.findMatchByUuid(MATCH_UUID))
                .thenReturn(Optional.of(new MatchSummary(MATCH_ID, MATCH_UUID, 2, USER_ID, STORY_ID)));
        when(store.findWeatherLog(MATCH_ID)).thenReturn(List.of());
        when(store.findMovementLog(MATCH_ID)).thenReturn(List.of());
        when(store.findClockLog(MATCH_ID)).thenReturn(List.of());
        when(store.findEventLog(MATCH_ID)).thenReturn(List.of());
        when(store.findWeatherIdCards(STORY_ID)).thenReturn(Map.of());
        when(store.findLocationIdCards(STORY_ID)).thenReturn(Map.of());
        when(store.findCharacterTemplateIdCards(STORY_ID)).thenReturn(Map.of());
        when(store.findCharactersByMatch(MATCH_ID)).thenReturn(Map.of());
        when(userAccessPort.findByUuid(USER_UUID))
                .thenReturn(Optional.of(new UserAccessPort.UserView(USER_ID, USER_UUID, "u", "PLAYER", 2)));
    }

    /** First page, default limit, no lang — the common case in these tests. */
    private MatchLogsResult admin() {
        return service.getMatchLogsForAdmin(MATCH_UUID, null, null, null);
    }

    private static CardInfo card(String title) {
        return new CardInfo("card-uuid", "type", "http://img", null, "fa-icon",
                null, null, null, null, null, title, "desc", null, null, null);
    }

    @Nested
    @DisplayName("getMatchLogs — ownership")
    class Ownership {

        @Test
        @DisplayName("returns result when user owns the match")
        void ownerCanRead() {
            MatchLogsResult result = service.getMatchLogs(MATCH_UUID, USER_UUID, null, null, null);
            assertEquals(MATCH_UUID, result.matchUuid());
            assertEquals(2, result.currentClock());
            assertNotNull(result.logs());
        }

        @Test
        @DisplayName("throws MATCH_NOT_FOUND when match does not exist")
        void unknownMatch() {
            when(store.findMatchByUuid("unknown")).thenReturn(Optional.empty());
            TurnCycleException ex = assertThrows(TurnCycleException.class,
                    () -> service.getMatchLogs("unknown", USER_UUID, null, null, null));
            assertEquals(TurnCycleException.Code.MATCH_NOT_FOUND, ex.getCode());
        }

        @Test
        @DisplayName("throws MATCH_NOT_FOUND when user does not own the match")
        void notOwner() {
            when(userAccessPort.findByUuid("other-user"))
                    .thenReturn(Optional.of(new UserAccessPort.UserView(99L, "other-user", "x", "PLAYER", 2)));
            TurnCycleException ex = assertThrows(TurnCycleException.class,
                    () -> service.getMatchLogs(MATCH_UUID, "other-user", null, null, null));
            assertEquals(TurnCycleException.Code.MATCH_NOT_FOUND, ex.getCode());
        }

        @Test
        @DisplayName("throws MATCH_NOT_FOUND when user is unknown")
        void unknownUser() {
            when(userAccessPort.findByUuid("ghost")).thenReturn(Optional.empty());
            assertThrows(TurnCycleException.class,
                    () -> service.getMatchLogs(MATCH_UUID, "ghost", null, null, null));
        }
    }

    @Nested
    @DisplayName("getMatchLogsForAdmin — no ownership check")
    class Admin {

        @Test
        @DisplayName("admin can read any match without user uuid")
        void adminRead() {
            MatchLogsResult result = admin();
            assertEquals(MATCH_UUID, result.matchUuid());
            assertEquals(2, result.currentClock());
        }

        @Test
        @DisplayName("admin throws MATCH_NOT_FOUND for unknown match")
        void unknownMatch() {
            when(store.findMatchByUuid("x")).thenReturn(Optional.empty());
            assertThrows(TurnCycleException.class,
                    () -> service.getMatchLogsForAdmin("x", null, null, null));
        }
    }

    @Nested
    @DisplayName("log entry assembly")
    class LogAssembly {

        @Test
        @DisplayName("WEATHER entry is mapped correctly")
        void weatherEntry() {
            when(store.findWeatherLog(MATCH_ID)).thenReturn(
                    List.of(new WeatherLogEntry(1L, 0, 5L, "2026-01-01T00:00:00Z")));
            MatchLogsResult r = admin();
            assertEquals(1, r.logs().size());
            LogEntry e = r.logs().get(0);
            assertEquals("WEATHER", e.type());
            assertEquals(0, e.clock());
            assertEquals(5L, e.idWeather());
            assertNull(e.idCharacterMatch());
        }

        @Test
        @DisplayName("MOVEMENT entry is mapped correctly")
        void movementEntry() {
            when(store.findMovementLog(MATCH_ID)).thenReturn(
                    List.of(new MovementLogEntry(1L, 2L, 10L, 20L, 7, "2026-01-01T00:01:00Z")));
            MatchLogsResult r = admin();
            assertEquals(1, r.logs().size());
            LogEntry e = r.logs().get(0);
            assertEquals("MOVEMENT", e.type());
            assertNull(e.clock());
            assertEquals(2L, e.idCharacterMatch());
            assertEquals(10L, e.idLocationFrom());
            assertEquals(20L, e.idLocationTo());
            assertEquals(7, e.energyCost());
        }

        @Test
        @DisplayName("CLOCK_ADVANCE entry is mapped correctly")
        void clockEntry() {
            when(store.findClockLog(MATCH_ID)).thenReturn(
                    List.of(new ClockLogEntry(1L, 1, "2026-01-01T00:02:00Z")));
            MatchLogsResult r = admin();
            assertEquals(1, r.logs().size());
            LogEntry e = r.logs().get(0);
            assertEquals("CLOCK_ADVANCE", e.type());
            assertEquals(1, e.clock());
        }

        @Test
        @DisplayName("SLEEP entry from ACTION_SLEEP log_events message")
        void sleepEntry() {
            when(store.findEventLog(MATCH_ID)).thenReturn(
                    List.of(new EventLogEntry(1L, 2L, 0, "2026-01-01T00:01:30Z", "ACTION_SLEEP")));
            MatchLogsResult r = admin();
            assertEquals(1, r.logs().size());
            LogEntry e = r.logs().get(0);
            assertEquals("SLEEP", e.type());
            assertEquals(2L, e.idCharacterMatch());
            assertEquals(0, e.clock());
        }

        @Test
        @DisplayName("RECOVERY entry from recovery log_events message")
        void recoveryEntry() {
            when(store.findEventLog(MATCH_ID)).thenReturn(
                    List.of(new EventLogEntry(1L, 2L, null, "2026-01-01T00:03:00Z",
                            "recovery safe=true p=3 dEnergy=5 dLife=2 dSad=-1")));
            MatchLogsResult r = admin();
            assertEquals(1, r.logs().size());
            LogEntry e = r.logs().get(0);
            assertEquals("RECOVERY", e.type());
            assertEquals(2L, e.idCharacterMatch());
            assertEquals("recovery safe=true p=3 dEnergy=5 dLife=2 dSad=-1", e.message());
        }

        @Test
        @DisplayName("counter-zero event is mapped as RECOVERY")
        void counterZeroEntry() {
            when(store.findEventLog(MATCH_ID)).thenReturn(
                    List.of(new EventLogEntry(1L, null, null, "2026-01-01T00:04:00Z",
                            "counter reached zero at location 5")));
            MatchLogsResult r = admin();
            assertEquals(1, r.logs().size());
            assertEquals("RECOVERY", r.logs().get(0).type());
        }

        @Test
        @DisplayName("null log_message is skipped (not added to results)")
        void nullMessageSkipped() {
            when(store.findEventLog(MATCH_ID)).thenReturn(
                    List.of(new EventLogEntry(1L, null, null, "2026-01-01T00:00:00Z", null)));
            assertEquals(0, admin().logs().size());
        }

        @Test
        @DisplayName("unrecognised log_message is skipped")
        void unknownMessageSkipped() {
            when(store.findEventLog(MATCH_ID)).thenReturn(
                    List.of(new EventLogEntry(1L, null, null, "2026-01-01T00:00:00Z", "weather event 7")));
            assertEquals(0, admin().logs().size());
        }

        @Test
        @DisplayName("entries are sorted by timestamp ascending across types")
        void sortedByTimestamp() {
            when(store.findWeatherLog(MATCH_ID)).thenReturn(
                    List.of(new WeatherLogEntry(1L, 1, 5L, "2026-01-01T00:02:00Z")));
            when(store.findMovementLog(MATCH_ID)).thenReturn(
                    List.of(new MovementLogEntry(2L, 1L, 1L, 2L, 3, "2026-01-01T00:01:00Z")));
            MatchLogsResult r = admin();
            assertEquals(2, r.logs().size());
            assertEquals("MOVEMENT", r.logs().get(0).type());
            assertEquals("WEATHER", r.logs().get(1).type());
        }

        @Test
        @DisplayName("empty match returns empty log list with correct currentClock")
        void emptyLogs() {
            MatchLogsResult r = admin();
            assertEquals(0, r.logs().size());
            assertEquals(2, r.currentClock());
        }
    }

    @Nested
    @DisplayName("card and character enrichment (v0.28.7)")
    class Enrichment {

        @Test
        @DisplayName("WEATHER entry carries the weather's own card")
        void weatherCard() {
            when(store.findWeatherLog(MATCH_ID)).thenReturn(
                    List.of(new WeatherLogEntry(1L, 0, 5L, "2026-01-01T00:00:00Z")));
            when(store.findWeatherIdCards(STORY_ID)).thenReturn(Map.of(5L, 300));
            when(contentQueryPort.getCardByStoryIdAndCardId(STORY_ID, 300, "en"))
                    .thenReturn(card("Thunderstorm"));

            LogEntry e = admin().logs().get(0);
            assertEquals(300, e.idCard());
            assertEquals("Thunderstorm", e.card().title());
        }

        @Test
        @DisplayName("MOVEMENT entry carries the destination location's card and the character")
        void movementCardAndCharacter() {
            when(store.findMovementLog(MATCH_ID)).thenReturn(
                    List.of(new MovementLogEntry(1L, 2L, 10L, 20L, 7, "2026-01-01T00:01:00Z")));
            when(store.findLocationIdCards(STORY_ID)).thenReturn(Map.of(20L, 400));
            when(store.findCharactersByMatch(MATCH_ID)).thenReturn(
                    Map.of(2L, new CharacterLogView(2L, "char-uuid", 9L)));
            when(store.findCharacterTemplateIdCards(STORY_ID)).thenReturn(Map.of(9L, 500));
            when(contentQueryPort.getCardByStoryIdAndCardId(STORY_ID, 400, "en"))
                    .thenReturn(card("Dark Forest"));
            when(contentQueryPort.getCardByStoryIdAndCardId(STORY_ID, 500, "en"))
                    .thenReturn(card("Ranger"));

            LogEntry e = admin().logs().get(0);
            assertEquals(400, e.idCard());
            assertEquals("Dark Forest", e.card().title());
            assertEquals("char-uuid", e.characterUuid());
            assertEquals("Ranger", e.characterName());
        }

        @Test
        @DisplayName("cards are resolved in the requested language")
        void cardsUseRequestedLang() {
            when(store.findWeatherLog(MATCH_ID)).thenReturn(
                    List.of(new WeatherLogEntry(1L, 0, 5L, "2026-01-01T00:00:00Z")));
            when(store.findWeatherIdCards(STORY_ID)).thenReturn(Map.of(5L, 300));
            when(contentQueryPort.getCardByStoryIdAndCardId(STORY_ID, 300, "it"))
                    .thenReturn(card("Temporale"));

            MatchLogsResult r = service.getMatchLogsForAdmin(MATCH_UUID, "it", null, null);
            assertEquals("Temporale", r.logs().get(0).card().title());
        }

        @Test
        @DisplayName("entries without a card resolve to a null card, not an error")
        void missingCardIsNull() {
            when(store.findWeatherLog(MATCH_ID)).thenReturn(
                    List.of(new WeatherLogEntry(1L, 0, 5L, "2026-01-01T00:00:00Z")));
            // no weather → card mapping seeded
            LogEntry e = admin().logs().get(0);
            assertNull(e.idCard());
            assertNull(e.card());
        }

        @Test
        @DisplayName("SLEEP entry names the character that slept")
        void sleepCharacter() {
            when(store.findEventLog(MATCH_ID)).thenReturn(
                    List.of(new EventLogEntry(1L, 2L, 0, "2026-01-01T00:01:30Z", "ACTION_SLEEP")));
            when(store.findCharactersByMatch(MATCH_ID)).thenReturn(
                    Map.of(2L, new CharacterLogView(2L, "char-uuid", 9L)));
            when(store.findCharacterTemplateIdCards(STORY_ID)).thenReturn(Map.of(9L, 500));
            when(contentQueryPort.getCardByStoryIdAndCardId(STORY_ID, 500, "en"))
                    .thenReturn(card("Ranger"));

            LogEntry e = admin().logs().get(0);
            assertEquals("char-uuid", e.characterUuid());
            assertEquals("Ranger", e.characterName());
        }

        @Test
        @DisplayName("a character no longer in the match leaves the name null")
        void unknownCharacterIsNull() {
            when(store.findMovementLog(MATCH_ID)).thenReturn(
                    List.of(new MovementLogEntry(1L, 42L, 10L, 20L, 7, "2026-01-01T00:01:00Z")));
            LogEntry e = admin().logs().get(0);
            assertEquals(42L, e.idCharacterMatch());
            assertNull(e.characterUuid());
            assertNull(e.characterName());
        }
    }

    @Nested
    @DisplayName("cursor pagination (v0.28.7)")
    class Pagination {

        /** Seeds `count` clock entries with ascending timestamps. */
        private void seedClockEntries(int count) {
            List<ClockLogEntry> rows = new ArrayList<>();
            for (int i = 0; i < count; i++) {
                rows.add(new ClockLogEntry(i + 1L, i, String.format("2026-01-01T00:%02d:00Z", i)));
            }
            when(store.findClockLog(MATCH_ID)).thenReturn(rows);
        }

        @Test
        @DisplayName("first page is capped at the requested limit and exposes a nextCursor")
        void firstPage() {
            seedClockEntries(5);
            MatchLogsResult r = service.getMatchLogsForAdmin(MATCH_UUID, null, 2, null);
            assertEquals(2, r.logs().size());
            assertEquals(2, r.limit());
            assertEquals(5, r.total());
            assertNotNull(r.nextCursor());
            assertEquals(0, r.logs().get(0).clock());
            assertEquals(1, r.logs().get(1).clock());
        }

        @Test
        @DisplayName("nextCursor walks the timeline to the end, then goes null")
        void walkPages() {
            seedClockEntries(5);
            MatchLogsResult page1 = service.getMatchLogsForAdmin(MATCH_UUID, null, 2, null);
            MatchLogsResult page2 = service.getMatchLogsForAdmin(MATCH_UUID, null, 2, page1.nextCursor());
            MatchLogsResult page3 = service.getMatchLogsForAdmin(MATCH_UUID, null, 2, page2.nextCursor());

            assertEquals(2, page2.logs().get(0).clock());
            assertEquals(3, page2.logs().get(1).clock());
            assertEquals(1, page3.logs().size());
            assertEquals(4, page3.logs().get(0).clock());
            assertNull(page3.nextCursor());
        }

        @Test
        @DisplayName("last exact page has no nextCursor")
        void exactPageHasNoCursor() {
            seedClockEntries(4);
            MatchLogsResult page1 = service.getMatchLogsForAdmin(MATCH_UUID, null, 2, null);
            MatchLogsResult page2 = service.getMatchLogsForAdmin(MATCH_UUID, null, 2, page1.nextCursor());
            assertEquals(2, page2.logs().size());
            assertNull(page2.nextCursor());
        }

        @Test
        @DisplayName("an offset past the end returns an empty page, not an error")
        void offsetPastEnd() {
            seedClockEntries(2);
            MatchLogsResult r = service.getMatchLogsForAdmin(
                    MATCH_UUID, null, 2, MatchLogsService.encodeCursor(99));
            assertEquals(0, r.logs().size());
            assertNull(r.nextCursor());
            assertEquals(2, r.total());
        }

        @Test
        @DisplayName("a garbage cursor restarts from the first page")
        void garbageCursorRestarts() {
            seedClockEntries(3);
            MatchLogsResult r = service.getMatchLogsForAdmin(MATCH_UUID, null, 2, "not-a-cursor");
            assertEquals(0, r.logs().get(0).clock());
        }

        @Test
        @DisplayName("limit is clamped to [1, MAX_LIMIT] and defaults when absent")
        void limitClamping() {
            seedClockEntries(1);
            assertEquals(MatchLogsService.DEFAULT_LIMIT,
                    service.getMatchLogsForAdmin(MATCH_UUID, null, null, null).limit());
            assertEquals(MatchLogsService.MAX_LIMIT,
                    service.getMatchLogsForAdmin(MATCH_UUID, null, 9999, null).limit());
            assertEquals(1, service.getMatchLogsForAdmin(MATCH_UUID, null, 0, null).limit());
            assertEquals(1, service.getMatchLogsForAdmin(MATCH_UUID, null, -5, null).limit());
        }

        @Test
        @DisplayName("cursor round-trips through encode/decode")
        void cursorRoundTrip() {
            assertEquals(42, MatchLogsService.decodeCursor(MatchLogsService.encodeCursor(42)));
            assertEquals(0, MatchLogsService.decodeCursor(null));
            assertEquals(0, MatchLogsService.decodeCursor(""));
            assertEquals(0, MatchLogsService.decodeCursor("###"));
        }

        @Test
        @DisplayName("enrichment queries run once per page, not once per entry")
        void enrichmentIsBatched() {
            seedClockEntries(5);
            service.getMatchLogsForAdmin(MATCH_UUID, null, 5, null);
            verify(store, times(1)).findWeatherIdCards(STORY_ID);
            verify(store, times(1)).findLocationIdCards(STORY_ID);
            verify(store, times(1)).findCharactersByMatch(MATCH_ID);
        }

        @Test
        @DisplayName("an empty timeline skips the enrichment queries entirely")
        void emptyPageSkipsEnrichment() {
            MatchLogsResult r = admin();
            assertEquals(0, r.total());
            assertNull(r.nextCursor());
            verify(store, never()).findWeatherIdCards(anyLong());
        }
    }
}
