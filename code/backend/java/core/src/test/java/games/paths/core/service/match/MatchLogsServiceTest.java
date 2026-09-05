package games.paths.core.service.match;

import games.paths.core.model.story.CardInfo;
import games.paths.core.port.match.MatchLogsPort.LogEntry;
import games.paths.core.port.match.MatchLogsPort.MatchLogsResult;
import games.paths.core.port.match.MatchLogsStorePort;
import games.paths.core.port.match.MatchLogsStorePort.CharacterLogView;
import games.paths.core.port.match.MatchLogsStorePort.ClockLogEntry;
import games.paths.core.port.match.MatchLogsStorePort.EventLogEntry;
import games.paths.core.port.match.MatchLogsStorePort.ItemLogEntry;
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
        when(store.findItemLog(MATCH_ID)).thenReturn(List.of());
        when(store.findWeatherIdCards(STORY_ID)).thenReturn(Map.of());
        when(store.findLocationIdCards(STORY_ID)).thenReturn(Map.of());
        when(store.findCharacterTemplateIdCards(STORY_ID)).thenReturn(Map.of());
        when(store.findEventIdCards(STORY_ID)).thenReturn(Map.of());
        when(store.findItemIdCards(STORY_ID)).thenReturn(Map.of());
        when(store.findCharactersByMatch(MATCH_ID)).thenReturn(Map.of());
        when(userAccessPort.findByUuid(USER_UUID))
                .thenReturn(Optional.of(new UserAccessPort.UserView(USER_ID, USER_UUID, "u", "PLAYER", 2)));
    }

    /** First page, default limit, no lang — the common case in these tests. */
    private MatchLogsResult admin() {
        return service.getMatchLogsForAdmin(MATCH_UUID, null, null, null, null);
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
            MatchLogsResult result = service.getMatchLogs(MATCH_UUID, USER_UUID, null, null, null, null);
            assertEquals(MATCH_UUID, result.matchUuid());
            assertEquals(2, result.currentClock());
            assertNotNull(result.logs());
        }

        @Test
        @DisplayName("throws MATCH_NOT_FOUND when match does not exist")
        void unknownMatch() {
            when(store.findMatchByUuid("unknown")).thenReturn(Optional.empty());
            TurnCycleException ex = assertThrows(TurnCycleException.class,
                    () -> service.getMatchLogs("unknown", USER_UUID, null, null, null, null));
            assertEquals(TurnCycleException.Code.MATCH_NOT_FOUND, ex.getCode());
        }

        @Test
        @DisplayName("throws MATCH_NOT_FOUND when user does not own the match")
        void notOwner() {
            when(userAccessPort.findByUuid("other-user"))
                    .thenReturn(Optional.of(new UserAccessPort.UserView(99L, "other-user", "x", "PLAYER", 2)));
            TurnCycleException ex = assertThrows(TurnCycleException.class,
                    () -> service.getMatchLogs(MATCH_UUID, "other-user", null, null, null, null));
            assertEquals(TurnCycleException.Code.MATCH_NOT_FOUND, ex.getCode());
        }

        @Test
        @DisplayName("throws MATCH_NOT_FOUND when user is unknown")
        void unknownUser() {
            when(userAccessPort.findByUuid("ghost")).thenReturn(Optional.empty());
            assertThrows(TurnCycleException.class,
                    () -> service.getMatchLogs(MATCH_UUID, "ghost", null, null, null, null));
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
                    () -> service.getMatchLogsForAdmin("x", null, null, null, null));
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
                    List.of(new EventLogEntry(1L, 2L, 0, "2026-01-01T00:01:30Z", "ACTION_SLEEP", null, null)));
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
                            "recovery safe=true p=3 dEnergy=5 dLife=2 dSad=-1", null, null)));
            MatchLogsResult r = admin();
            assertEquals(1, r.logs().size());
            LogEntry e = r.logs().get(0);
            assertEquals("RECOVERY", e.type());
            assertEquals(2L, e.idCharacterMatch());
            assertEquals("recovery safe=true p=3 dEnergy=5 dLife=2 dSad=-1", e.message());
        }

        @Test
        @DisplayName("counter-zero event is its own COUNTER_ZERO type, not RECOVERY (Step 33)")
        void counterZeroEntry() {
            when(store.findEventLog(MATCH_ID)).thenReturn(
                    List.of(new EventLogEntry(1L, null, 4, "2026-01-01T00:04:00Z",
                            "counter reached zero at location 5; pending event 777", 777L, 5L)));
            MatchLogsResult r = admin();
            assertEquals(1, r.logs().size());
            assertEquals("COUNTER_ZERO", r.logs().get(0).type());
            // The clock and the location used to be missing entirely: the row was written
            // without a clock (so it sorted outside the timeline) and the location lived
            // only inside the message string.
            assertEquals(4, r.logs().get(0).clock());
            assertEquals(5L, r.logs().get(0).idLocationTo());
            assertEquals(777L, r.logs().get(0).idEvent());
        }

        @Test
        @DisplayName("an automatic event is its own AUTOMATIC_EVENT type (Step 33)")
        void automaticEventEntry() {
            when(store.findEventLog(MATCH_ID)).thenReturn(
                    List.of(new EventLogEntry(1L, 2L, 3, "2026-01-01T00:05:00Z",
                            "automatic event 90040 (FIRST_ENTRY) at location 90002", 90040L, 90002L)));
            MatchLogsResult r = admin();
            assertEquals(1, r.logs().size());
            assertEquals("AUTOMATIC_EVENT", r.logs().get(0).type());
            assertEquals(90040L, r.logs().get(0).idEvent());
            assertEquals(90002L, r.logs().get(0).idLocationTo());
        }

        @Test
        @DisplayName("null log_message is skipped (not added to results)")
        void nullMessageSkipped() {
            when(store.findEventLog(MATCH_ID)).thenReturn(
                    List.of(new EventLogEntry(1L, null, null, "2026-01-01T00:00:00Z", null, null, null)));
            assertEquals(0, admin().logs().size());
        }

        @Test
        @DisplayName("unrecognised log_message is skipped")
        void unknownMessageSkipped() {
            when(store.findEventLog(MATCH_ID)).thenReturn(
                    List.of(new EventLogEntry(1L, null, null, "2026-01-01T00:00:00Z", "weather event 7", null, null)));
            assertEquals(0, admin().logs().size());
        }

        @Test
        @DisplayName("SADNESS_OVERFLOW / COMA edge-state rows are skipped, not shown as EVENT")
        void edgeStateMessagesSkipped() {
            when(store.findEventLog(MATCH_ID)).thenReturn(List.of(
                    new EventLogEntry(1L, 2L, null, "2026-01-01T00:00:00Z", "SADNESS_OVERFLOW char-1", null, null),
                    new EventLogEntry(2L, 2L, null, "2026-01-01T00:00:01Z", "COMA char-1", null, null)));
            assertEquals(0, admin().logs().size());
        }

        @Test
        @DisplayName("EVENT entry from EVENT_EXECUTED log_events message carries idEvent")
        void executedEventEntry() {
            when(store.findEventLog(MATCH_ID)).thenReturn(
                    List.of(new EventLogEntry(1L, 2L, 3, "2026-01-01T00:05:00Z",
                            "EVENT_EXECUTED 42", 42L, null)));
            MatchLogsResult r = admin();
            assertEquals(1, r.logs().size());
            LogEntry e = r.logs().get(0);
            assertEquals("EVENT", e.type());
            assertEquals(42L, e.idEvent());
            assertEquals(2L, e.idCharacterMatch());
            assertEquals("EVENT_EXECUTED 42", e.message());
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
        @DisplayName("v0.35.4 — what an event gave rides on the same row as what it took")
        void executedEventCarriesTheGain() {
            when(store.findEventLog(MATCH_ID)).thenReturn(
                    List.of(new EventLogEntry(1L, 2L, 3, "2026-01-01T00:05:00Z",
                            "EVENT_EXECUTED 42", 42L, null, 5, 0, 0, 7, 0, 2, 0, 30)));
            LogEntry e = admin().logs().get(0);
            assertEquals(5, e.energyCost());
            assertEquals(7, e.coinCost());
            assertEquals(2, e.foodGain());
            assertEquals(30, e.coinGain());
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
        @DisplayName("EVENT entry carries the triggered event's own card and the character (v0.30.3)")
        void eventCardAndCharacter() {
            when(store.findEventLog(MATCH_ID)).thenReturn(
                    List.of(new EventLogEntry(1L, 2L, 3, "2026-01-01T00:05:00Z",
                            "EVENT_EXECUTED 42", 42L, null)));
            when(store.findEventIdCards(STORY_ID)).thenReturn(Map.of(42L, 600));
            when(store.findCharactersByMatch(MATCH_ID)).thenReturn(
                    Map.of(2L, new CharacterLogView(2L, "char-uuid", 9L)));
            when(store.findCharacterTemplateIdCards(STORY_ID)).thenReturn(Map.of(9L, 500));
            when(contentQueryPort.getCardByStoryIdAndCardId(STORY_ID, 600, "en"))
                    .thenReturn(card("A Fork In The Road"));
            when(contentQueryPort.getCardByStoryIdAndCardId(STORY_ID, 500, "en"))
                    .thenReturn(card("Ranger"));

            LogEntry e = admin().logs().get(0);
            assertEquals(600, e.idCard());
            assertEquals("A Fork In The Road", e.card().title());
            assertEquals("char-uuid", e.characterUuid());
            assertEquals("Ranger", e.characterName());
        }

        @Test
        @DisplayName("EVENT entry with no matching event card resolves to a null card, not an error")
        void eventMissingCardIsNull() {
            when(store.findEventLog(MATCH_ID)).thenReturn(
                    List.of(new EventLogEntry(1L, null, 3, "2026-01-01T00:05:00Z",
                            "EVENT_EXECUTED 99", 99L, null)));
            // no event → card mapping seeded
            LogEntry e = admin().logs().get(0);
            assertNull(e.idCard());
            assertNull(e.card());
        }

        @Test
        @DisplayName("cards are resolved in the requested language")
        void cardsUseRequestedLang() {
            when(store.findWeatherLog(MATCH_ID)).thenReturn(
                    List.of(new WeatherLogEntry(1L, 0, 5L, "2026-01-01T00:00:00Z")));
            when(store.findWeatherIdCards(STORY_ID)).thenReturn(Map.of(5L, 300));
            when(contentQueryPort.getCardByStoryIdAndCardId(STORY_ID, 300, "it"))
                    .thenReturn(card("Temporale"));

            MatchLogsResult r = service.getMatchLogsForAdmin(MATCH_UUID, "it", null, null, null);
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
                    List.of(new EventLogEntry(1L, 2L, 0, "2026-01-01T00:01:30Z", "ACTION_SLEEP", null, null)));
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
            MatchLogsResult r = service.getMatchLogsForAdmin(MATCH_UUID, null, 2, null, null);
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
            MatchLogsResult page1 = service.getMatchLogsForAdmin(MATCH_UUID, null, 2, null, null);
            MatchLogsResult page2 = service.getMatchLogsForAdmin(MATCH_UUID, null, 2, page1.nextCursor(), null);
            MatchLogsResult page3 = service.getMatchLogsForAdmin(MATCH_UUID, null, 2, page2.nextCursor(), null);

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
            MatchLogsResult page1 = service.getMatchLogsForAdmin(MATCH_UUID, null, 2, null, null);
            MatchLogsResult page2 = service.getMatchLogsForAdmin(MATCH_UUID, null, 2, page1.nextCursor(), null);
            assertEquals(2, page2.logs().size());
            assertNull(page2.nextCursor());
        }

        @Test
        @DisplayName("an offset past the end returns an empty page, not an error")
        void offsetPastEnd() {
            seedClockEntries(2);
            MatchLogsResult r = service.getMatchLogsForAdmin(
                    MATCH_UUID, null, 2, MatchLogsService.encodeCursor(99), null);
            assertEquals(0, r.logs().size());
            assertNull(r.nextCursor());
            assertEquals(2, r.total());
        }

        @Test
        @DisplayName("a garbage cursor restarts from the first page")
        void garbageCursorRestarts() {
            seedClockEntries(3);
            MatchLogsResult r = service.getMatchLogsForAdmin(MATCH_UUID, null, 2, "not-a-cursor", null);
            assertEquals(0, r.logs().get(0).clock());
        }

        @Test
        @DisplayName("limit is clamped to [1, MAX_LIMIT] and defaults when absent")
        void limitClamping() {
            seedClockEntries(1);
            assertEquals(MatchLogsService.DEFAULT_LIMIT,
                    service.getMatchLogsForAdmin(MATCH_UUID, null, null, null, null).limit());
            assertEquals(MatchLogsService.MAX_LIMIT,
                    service.getMatchLogsForAdmin(MATCH_UUID, null, 9999, null, null).limit());
            assertEquals(1, service.getMatchLogsForAdmin(MATCH_UUID, null, 0, null, null).limit());
            assertEquals(1, service.getMatchLogsForAdmin(MATCH_UUID, null, -5, null, null).limit());
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
            service.getMatchLogsForAdmin(MATCH_UUID, null, 5, null, null);
            verify(store, times(1)).findWeatherIdCards(STORY_ID);
            verify(store, times(1)).findLocationIdCards(STORY_ID);
            verify(store, times(1)).findEventIdCards(STORY_ID);
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

    @Nested
    @DisplayName("order=asc|desc")
    class Ordering {

        /** Seeds `count` clock entries with ascending timestamps. */
        private void seedClockEntries(int count) {
            List<ClockLogEntry> rows = new ArrayList<>();
            for (int i = 0; i < count; i++) {
                rows.add(new ClockLogEntry(i + 1L, i, String.format("2026-01-01T00:%02d:00Z", i)));
            }
            when(store.findClockLog(MATCH_ID)).thenReturn(rows);
        }

        @Test
        @DisplayName("no order given keeps the oldest entry first")
        void defaultsToAscending() {
            seedClockEntries(3);
            MatchLogsResult r = service.getMatchLogsForAdmin(MATCH_UUID, null, null, null, null);
            assertEquals("asc", r.order());
            assertEquals(0, r.logs().get(0).clock());
            assertEquals(2, r.logs().get(2).clock());
        }

        @Test
        @DisplayName("desc starts from the newest entry")
        void descStartsFromTheNewest() {
            seedClockEntries(3);
            MatchLogsResult r = service.getMatchLogsForAdmin(MATCH_UUID, null, null, null, "desc");
            assertEquals("desc", r.order());
            assertEquals(2, r.logs().get(0).clock());
            assertEquals(1, r.logs().get(1).clock());
            assertEquals(0, r.logs().get(2).clock());
        }

        @Test
        @DisplayName("desc is case-insensitive and trimmed")
        void descIsCaseInsensitive() {
            seedClockEntries(2);
            assertEquals("desc",
                    service.getMatchLogsForAdmin(MATCH_UUID, null, null, null, "  DESC ").order());
        }

        @Test
        @DisplayName("an unknown order falls back to ascending")
        void unknownOrderFallsBack() {
            seedClockEntries(3);
            MatchLogsResult r = service.getMatchLogsForAdmin(MATCH_UUID, null, null, null, "sideways");
            assertEquals("asc", r.order());
            assertEquals(0, r.logs().get(0).clock());
        }

        @Test
        @DisplayName("desc reverses entries of every type, not only within one source")
        void descReversesAcrossTypes() {
            when(store.findWeatherLog(MATCH_ID)).thenReturn(
                    List.of(new WeatherLogEntry(1L, 1, 5L, "2026-01-01T00:02:00Z")));
            when(store.findMovementLog(MATCH_ID)).thenReturn(
                    List.of(new MovementLogEntry(2L, 1L, 1L, 2L, 3, "2026-01-01T00:01:00Z")));
            MatchLogsResult r = service.getMatchLogsForAdmin(MATCH_UUID, null, null, null, "desc");
            assertEquals("WEATHER", r.logs().get(0).type());
            assertEquals("MOVEMENT", r.logs().get(1).type());
        }

        @Test
        @DisplayName("with desc the cursor walks towards the older entries")
        void descCursorWalksBackwards() {
            seedClockEntries(5);
            MatchLogsResult page1 = service.getMatchLogsForAdmin(MATCH_UUID, null, 2, null, "desc");
            MatchLogsResult page2 = service.getMatchLogsForAdmin(
                    MATCH_UUID, null, 2, page1.nextCursor(), "desc");
            assertEquals(4, page1.logs().get(0).clock());
            assertEquals(3, page1.logs().get(1).clock());
            assertEquals(2, page2.logs().get(0).clock());
            assertEquals(1, page2.logs().get(1).clock());
        }

        @Test
        @DisplayName("the owner endpoint honours the order too")
        void ownerEndpointHonoursOrder() {
            seedClockEntries(3);
            MatchLogsResult r = service.getMatchLogs(MATCH_UUID, USER_UUID, null, null, null, "desc");
            assertEquals(2, r.logs().get(0).clock());
        }
    }

    @Nested
    @DisplayName("v0.35.4 — the item log")
    class ItemLog {

        private void givenItemRow(String action, int counter, Long idEvent,
                                  Integer energy, Integer food, Integer magic, Integer coin) {
            when(store.findItemLog(MATCH_ID)).thenReturn(List.of(
                    new ItemLogEntry(1L, 2L, 900L, action, counter, idEvent,
                            "2026-01-01T00:05:00Z", energy, food, magic, coin)));
        }

        @Test
        @DisplayName("an ADD row becomes an ITEM_ADD entry naming the effect's event")
        void addEntry() {
            givenItemRow("ADD", 1, 42L, 0, 0, 0, 0);
            LogEntry e = admin().logs().get(0);
            assertEquals("ITEM_ADD", e.type());
            assertEquals(900L, e.idItem());
            assertEquals("ADD", e.itemAction());
            assertEquals(1, e.counter());
            assertEquals(42L, e.idEvent());
            assertEquals(2L, e.idCharacterMatch());
        }

        @Test
        @DisplayName("a USE row splits its signed deltas: drained is a cost, restored is a gain")
        void useEntrySplitsTheDeltas() {
            givenItemRow("USE", 2, null, 9, 0, -3, 0);
            LogEntry e = admin().logs().get(0);
            assertEquals("ITEM_USE", e.type());
            assertEquals(2, e.counter());
            assertNull(e.idEvent());
            assertEquals(9, e.energyGain());
            assertEquals(3, e.magicCost());
            assertEquals(0, e.energyCost());
            assertEquals(0, e.magicGain());
        }

        @Test
        @DisplayName("DROP and REMOVE both surface as ITEM_DROP, and the raw action survives")
        void dropAndRemoveShareAType() {
            when(store.findItemLog(MATCH_ID)).thenReturn(List.of(
                    new ItemLogEntry(1L, 2L, 900L, "DROP", 1, null,
                            "2026-01-01T00:05:00Z", 0, 0, 0, 0),
                    new ItemLogEntry(2L, 2L, 901L, "remove", 1, 42L,
                            "2026-01-01T00:06:00Z", 0, 0, 0, 0)));
            MatchLogsResult r = admin();
            assertEquals("ITEM_DROP", r.logs().get(0).type());
            assertEquals("DROP", r.logs().get(0).itemAction());
            assertEquals("ITEM_DROP", r.logs().get(1).type());
            assertEquals("remove", r.logs().get(1).itemAction());
        }

        @Test
        @DisplayName("a row written before v0.35.4 has no action and reads as a usage")
        void nullActionIsAUsage() {
            givenItemRow(null, 1, null, 0, 0, 0, 0);
            assertEquals("ITEM_USE", admin().logs().get(0).type());
        }

        @Test
        @DisplayName("an unknown action is dropped, like an unknown log message")
        void unknownActionSkipped() {
            givenItemRow("TELEPORTED", 1, null, 0, 0, 0, 0);
            assertEquals(0, admin().logs().size());
        }

        @Test
        @DisplayName("an item entry is narrated by the item's own card")
        void itemCardIsResolved() {
            givenItemRow("USE", 1, null, 0, 0, 0, 0);
            when(store.findItemIdCards(STORY_ID)).thenReturn(Map.of(900L, 700));
            when(contentQueryPort.getCardByStoryIdAndCardId(STORY_ID, 700, "en"))
                    .thenReturn(card("Healing Potion"));
            LogEntry e = admin().logs().get(0);
            assertEquals(700, e.idCard());
            assertEquals("Healing Potion", e.card().title());
        }

        @Test
        @DisplayName("item entries take their place in the timeline by timestamp")
        void sortedWithTheRest() {
            when(store.findItemLog(MATCH_ID)).thenReturn(List.of(
                    new ItemLogEntry(1L, 2L, 900L, "USE", 1, null,
                            "2026-01-01T00:01:00Z", 0, 0, 0, 0)));
            when(store.findWeatherLog(MATCH_ID)).thenReturn(
                    List.of(new WeatherLogEntry(1L, 1, 5L, "2026-01-01T00:02:00Z")));
            MatchLogsResult r = admin();
            assertEquals("ITEM_USE", r.logs().get(0).type());
            assertEquals("WEATHER", r.logs().get(1).type());
        }
    }

    @Nested
    @DisplayName("the card each row is narrated by")
    class Cards {

        @Test
        @DisplayName("a REGISTRY_CHANGE row is its own type and carries no card")
        void registryChangeRow() {
            when(store.findEventLog(MATCH_ID)).thenReturn(List.of(new EventLogEntry(
                    1L, 2L, 0, "2026-01-01T00:01:30Z",
                    RegistryService.MSG_REGISTRY_CHANGE + " clue None -> ledger", null, null)));

            LogEntry e = admin().logs().get(0);

            assertEquals("REGISTRY_CHANGE", e.type());
            assertNull(e.card());
        }

        @Test
        @DisplayName("an AUTOMATIC_EVENT row is narrated by the event's own card")
        void automaticEventCard() {
            when(store.findEventLog(MATCH_ID)).thenReturn(List.of(new EventLogEntry(
                    1L, 2L, 0, "2026-01-01T00:01:30Z",
                    games.paths.core.port.match.LocationEntryStorePort.MSG_AUTOMATIC_EVENT + " fired", 5L, 7L)));
            when(store.findEventIdCards(STORY_ID)).thenReturn(Map.of(5L, 11));
            when(contentQueryPort.getCardByStoryIdAndCardId(STORY_ID, 11, "en"))
                    .thenReturn(card("The bell"));

            LogEntry e = admin().logs().get(0);

            assertEquals("AUTOMATIC_EVENT", e.type());
            assertEquals("The bell", e.card().title());
        }

        @Test
        @DisplayName("with no content port at all every row comes back card-less")
        void noContentPort() {
            MatchLogsService bare = new MatchLogsService(store, userAccessPort, null);
            when(store.findEventLog(MATCH_ID)).thenReturn(List.of(new EventLogEntry(
                    1L, 2L, 0, "2026-01-01T00:01:30Z", "ACTION_SLEEP", null, null)));

            LogEntry e = bare.getMatchLogsForAdmin(MATCH_UUID, null, null, null, null).logs().get(0);

            assertNull(e.card());
        }

        @Test
        @DisplayName("a row whose character the match no longer holds is left unnamed")
        void unknownCharacter() {
            when(store.findEventLog(MATCH_ID)).thenReturn(List.of(new EventLogEntry(
                    1L, 99L, 0, "2026-01-01T00:01:30Z", "ACTION_SLEEP", null, null)));

            LogEntry e = admin().logs().get(0);

            assertNull(e.characterUuid());
            assertNull(e.characterName());
        }

        @Test
        @DisplayName("a blank lang falls back to English")
        void blankLangIsEnglish() {
            when(store.findEventLog(MATCH_ID)).thenReturn(List.of(new EventLogEntry(
                    1L, 2L, 0, "2026-01-01T00:01:30Z", "EVENT_EXECUTED 5", 5L, 7L)));
            when(store.findEventIdCards(STORY_ID)).thenReturn(Map.of(5L, 11));
            when(contentQueryPort.getCardByStoryIdAndCardId(STORY_ID, 11, "en"))
                    .thenReturn(card("The bell"));

            LogEntry e = service.getMatchLogsForAdmin(MATCH_UUID, "  ", null, null, null)
                    .logs().get(0);

            assertEquals("The bell", e.card().title());
        }
    }
}
