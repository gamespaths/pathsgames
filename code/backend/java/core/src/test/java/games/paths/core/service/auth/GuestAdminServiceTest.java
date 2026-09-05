package games.paths.core.service.auth;

import games.paths.core.model.auth.GuestInfo;
import games.paths.core.model.auth.GuestStats;
import games.paths.core.port.auth.GuestAdminPersistencePort;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link GuestAdminService}.
 * Uses Mockito to verify interaction with the persistence port and validates domain logic mapping.
 */
@ExtendWith(MockitoExtension.class)
class GuestAdminServiceTest {

    @Mock
    private GuestAdminPersistencePort persistence;

    @InjectMocks
    private GuestAdminService service;

    @Nested
    @DisplayName("Guest Retrieval Tests")
    class RetrievalTests {

        @Test
        @DisplayName("Should map all results from persistence to GuestInfo list")
        void listAllGuests_mapsResults() {
            // Arrange
            Map<String, Object> m = Map.of(
                    "uuid", "u1",
                    "username", "guest1",
                    "guestExpiresAt", "2030-01-01T00:00:00Z"
            );
            when(persistence.findAllGuests()).thenReturn(List.of(m));

            // Act
            List<GuestInfo> list = service.listAllGuests();

            // Assert
            assertAll("Check list mapping",
                () -> assertEquals(1, list.size()),
                () -> assertEquals("u1", list.get(0).userUuid()),
                () -> assertEquals("guest1", list.get(0).username())
            );
        }

        @Test
        @DisplayName("Should return null for null or blank UUID")
        void getGuestByUuid_invalidInput() {
            assertNull(service.getGuestByUuid(null));
            assertNull(service.getGuestByUuid("  "));
            verifyNoInteractions(persistence);
        }

        @Test
        @DisplayName("Should return null if guest is not found in persistence")
        void getGuestByUuid_notFound() {
            when(persistence.findGuestByUuid("missing")).thenReturn(null);
            assertNull(service.getGuestByUuid("missing"));
        }

        @Test
        @DisplayName("Should use default state 6 when state is null in database (Sonar/Branch coverage)")
        void shouldHandleNullStateWithDefaultValue() {
            // Arrange
            String uuid = "no-state-uuid";
            Map<String, Object> mockData = new HashMap<>();
            mockData.put("uuid", uuid);
            mockData.put("username", "guest_no_state");
            mockData.put("state", null); 

            when(persistence.findGuestByUuid(uuid)).thenReturn(mockData);

            // Act
            GuestInfo result = service.getGuestByUuid(uuid);

            // Assert
            assertEquals(6, result.state(), "State should fall back to default 6");
        }

        @Test
        @DisplayName("Should use state when state is not null in database")
        void shouldUseStateWhenNotNull() {
            // Arrange
            String uuid = "no-state-uuid";
            Map<String, Object> mockData = new HashMap<>();
            mockData.put("uuid", uuid);
            mockData.put("username", "guest_no_state");
            mockData.put("state", 42); 

            when(persistence.findGuestByUuid(uuid)).thenReturn(mockData);

            // Act
            GuestInfo result = service.getGuestByUuid(uuid);

            // Assert
            assertEquals(42, result.state(), "State should use the value from the database");
        }
    }


    @Nested
    @DisplayName("Expiration Logic Tests")
    class ExpirationTests {

        @Test
        @DisplayName("Should correctly identify expired sessions and handle parse errors")
        void isExpired_logicTestThroughPublicMethod() {
            // Arrange
            Map<String, Object> expiredData = Map.of("uuid", "u1", "username", "g1", "guestExpiresAt", "2000-01-01T00:00:00Z");
            Map<String, Object> invalidData = Map.of("uuid", "u2", "username", "g2", "guestExpiresAt", "not-a-date");
            Map<String, Object> blankData = Map.of("uuid", "u3", "username", "g3", "guestExpiresAt", "");
            
            
            when(persistence.findGuestByUuid("u1")).thenReturn(expiredData);
            when(persistence.findGuestByUuid("u2")).thenReturn(invalidData);
            when(persistence.findGuestByUuid("u3")).thenReturn(blankData);

            // Act & Assert
            assertTrue(service.getGuestByUuid("u1").expired(), "Past date should be expired");
            assertFalse(service.getGuestByUuid("u2").expired(), "Invalid date should not be expired (catch block)");
            assertFalse(service.getGuestByUuid("u3").expired(), "Blank date should not be expired");
        }
    }


    @Nested
    @DisplayName("Admin Operations Tests")
    class AdminOpsTests {

        @Test
        @DisplayName("Should delegate delete operation to persistence")
        void deleteGuest_delegation() {
            when(persistence.deleteGuestByUuid("u1")).thenReturn(true);
            
            assertTrue(service.deleteGuest("u1"));
            assertFalse(service.deleteGuest(" ")); // input blank
            assertFalse(service.deleteGuest(null)); // input null
            
            verify(persistence, times(1)).deleteGuestByUuid("u1");
        }

        @Test
        @DisplayName("Should return aggregated guest stats")
        void getGuestStats_aggregation() {
            // Arrange
            when(persistence.countAllGuests()).thenReturn(10L);
            when(persistence.countActiveGuests()).thenReturn(8L);
            when(persistence.countExpiredGuests()).thenReturn(2L);

            // Act
            GuestStats stats = service.getGuestStats();

            // Assert
            assertAll("Verify stats mapping",
                () -> assertEquals(10L, stats.getTotalGuests()),
                () -> assertEquals(8L, stats.getActiveGuests()),
                () -> assertEquals(2L, stats.getExpiredGuests())
            );
        }

        @Test
        @DisplayName("Should delegate expired guests cleanup")
        void deleteExpiredGuests_delegation() {
            when(persistence.deleteExpiredGuests()).thenReturn(5);
            assertEquals(5, service.deleteExpiredGuests());
            verify(persistence).deleteExpiredGuests();
        }
    }

    @Nested
    @DisplayName("v0.36.2 - paging and the stale purge")
    class PagingAndPurge {

        private final games.paths.core.port.match.MatchPersistencePort matches =
                mock(games.paths.core.port.match.MatchPersistencePort.class);

        private GuestAdminService paged() {
            return new GuestAdminService(persistence, matches);
        }

        private static Map<String, Object> row(long id, String lastAccess) {
            Map<String, Object> m = new HashMap<>();
            m.put("id", id);
            m.put("uuid", "g" + id);
            m.put("username", "u" + id);
            m.put("role", "PLAYER");
            m.put("state", 6);
            m.put("tsRegistration", "2020-01-01T00:00:00Z");
            m.put("tsLastAccess", lastAccess);
            return m;
        }

        @Test
        @DisplayName("a full page answers a cursor and drops the over-fetched row")
        void aFullPageAnswersACursor() {
            // The service asks for limit+1 to learn whether more exist, then hands back limit.
            when(persistence.findGuestsPage(null, null, null, 3)).thenReturn(List.of(
                    row(3, "2026-01-03T00:00:00Z"),
                    row(2, "2026-01-02T00:00:00Z"),
                    row(1, "2026-01-01T00:00:00Z")));

            var page = paged().listGuestsPage(
                    new games.paths.core.model.auth.GuestListFilter(null, null, 2));

            assertEquals(2, page.items().size());
            assertEquals(2, page.limit());
            assertNotNull(page.nextCursor());
        }

        @Test
        @DisplayName("the last page answers no cursor")
        void theLastPageAnswersNoCursor() {
            when(persistence.findGuestsPage(null, null, null, 51))
                    .thenReturn(List.of(row(1, "2026-01-01T00:00:00Z")));

            var page = paged().listGuestsPage(
                    new games.paths.core.model.auth.GuestListFilter(null, null, null));

            assertNull(page.nextCursor());
            assertEquals(50, page.limit());
        }

        @Test
        @DisplayName("the cursor round-trips to the row it named")
        void theCursorRoundTrips() {
            when(persistence.findGuestsPage(null, null, null, 2)).thenReturn(List.of(
                    row(2, "2026-01-02T00:00:00Z"), row(1, "2026-01-01T00:00:00Z")));
            String cursor = paged().listGuestsPage(
                    new games.paths.core.model.auth.GuestListFilter(null, null, 1)).nextCursor();

            paged().listGuestsPage(
                    new games.paths.core.model.auth.GuestListFilter(null, cursor, 1));

            verify(persistence).findGuestsPage(null, "2026-01-02T00:00:00Z", 2L, 2);
        }

        @Test
        @DisplayName("a malformed cursor restarts at page one instead of failing")
        void aMalformedCursorRestarts() {
            paged().listGuestsPage(
                    new games.paths.core.model.auth.GuestListFilter(null, "not-a-cursor", 10));

            verify(persistence).findGuestsPage(null, null, null, 11);
        }

        @Test
        @DisplayName("a guest that never came back is ordered by its registration")
        void aGuestThatNeverCameBackUsesItsRegistration() {
            when(persistence.findGuestsPage(null, null, null, 2))
                    .thenReturn(List.of(row(2, null), row(1, null)));

            String cursor = paged().listGuestsPage(
                    new games.paths.core.model.auth.GuestListFilter(null, null, 1)).nextCursor();
            paged().listGuestsPage(
                    new games.paths.core.model.auth.GuestListFilter(null, cursor, 1));

            verify(persistence).findGuestsPage(null, "2020-01-01T00:00:00Z", 2L, 2);
        }

        @Test
        @DisplayName("the purge takes the matches BEFORE the guests")
        void thePurgeTakesTheMatchesFirst() {
            // A match references its creator by foreign key: the children must go first.
            when(persistence.findGuestIdsWithLastAccessBefore(any())).thenReturn(List.of(7L, 8L));
            when(matches.deleteMatchesByUserCreatorIds(List.of(7L, 8L))).thenReturn(5);
            when(persistence.deleteGuestsByIds(List.of(7L, 8L))).thenReturn(2);

            var summary = paged().deleteStaleGuests(90);

            assertEquals(2, summary.guests());
            assertEquals(5, summary.matches());
            var order = inOrder(matches, persistence);
            order.verify(matches).deleteMatchesByUserCreatorIds(List.of(7L, 8L));
            order.verify(persistence).deleteGuestsByIds(List.of(7L, 8L));
        }

        @Test
        @DisplayName("the preview deletes nothing")
        void thePreviewDeletesNothing() {
            when(persistence.findGuestIdsWithLastAccessBefore(any())).thenReturn(List.of(7L, 8L));
            when(matches.countMatchesByUserCreatorIds(List.of(7L, 8L))).thenReturn(5L);

            var summary = paged().previewStaleGuests(90);

            assertEquals(2, summary.guests());
            assertEquals(5, summary.matches());
            verify(persistence, never()).deleteGuestsByIds(any());
            verify(matches, never()).deleteMatchesByUserCreatorIds(any());
        }

        @Test
        @DisplayName("a purge that matches nobody touches nothing")
        void aPurgeThatMatchesNobodyTouchesNothing() {
            when(persistence.findGuestIdsWithLastAccessBefore(any())).thenReturn(List.of());

            var summary = paged().deleteStaleGuests(90);

            assertEquals(0, summary.guests());
            assertEquals(0, summary.matches());
            verify(matches, never()).deleteMatchesByUserCreatorIds(any());
        }

        @Test
        @DisplayName("a null filter is the same as asking for the first default page")
        void aNullFilterIsTheDefaultPage() {
            when(persistence.findGuestsPage(null, null, null, 51)).thenReturn(List.of());

            var page = paged().listGuestsPage(null);

            assertEquals(50, page.limit());
            assertTrue(page.items().isEmpty());
            assertNull(page.nextCursor());
        }

        @Test
        @DisplayName("a malformed cursor restarts at page one rather than failing")
        void aMalformedCursorRestartsAtPageOne() {
            assertNull(GuestAdminService.decodeCursor(null));
            assertNull(GuestAdminService.decodeCursor("   "));
            assertNull(GuestAdminService.decodeCursor("!!not-base64!!"));
            assertNull(GuestAdminService.decodeCursor(
                    java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(
                            "no-separator".getBytes(java.nio.charset.StandardCharsets.UTF_8))));
            assertNull(GuestAdminService.decodeCursor(
                    java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(
                            "|7".getBytes(java.nio.charset.StandardCharsets.UTF_8))));
            assertNull(GuestAdminService.decodeCursor(
                    java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(
                            "2026-01-01T00:00:00Z|".getBytes(java.nio.charset.StandardCharsets.UTF_8))));
            assertNull(GuestAdminService.decodeCursor(
                    java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(
                            "2026-01-01T00:00:00Z|not-a-number".getBytes(java.nio.charset.StandardCharsets.UTF_8))));
        }

        @Test
        @DisplayName("a preview with nobody stale counts no match either")
        void previewWithNobodyStale() {
            when(persistence.findGuestIdsWithLastAccessBefore(any())).thenReturn(List.of());

            var summary = paged().previewStaleGuests(90);

            assertEquals(0, summary.guests());
            assertEquals(0, summary.matches());
            verify(matches, never()).countMatchesByUserCreatorIds(any());
        }

        @Test
        @DisplayName("a preview counts the guests and the matches they created")
        void previewCountsGuestsAndMatches() {
            when(persistence.findGuestIdsWithLastAccessBefore(any())).thenReturn(List.of(1L, 2L));
            when(matches.countMatchesByUserCreatorIds(List.of(1L, 2L))).thenReturn(5L);

            var summary = paged().previewStaleGuests(90);

            assertEquals(2, summary.guests());
            assertEquals(5, summary.matches());
        }

        @Test
        @DisplayName("a negative bound names no instant, so nothing is stale")
        void aNegativeBoundIsNoBound() {
            when(persistence.findGuestIdsWithLastAccessBefore(null)).thenReturn(List.of());

            assertEquals(0, paged().previewStaleGuests(-1).guests());
            verify(persistence).findGuestIdsWithLastAccessBefore(null);
        }

        @Test
        @DisplayName("the purge deletes the matches first, then the guests")
        void thePurgeDeletesMatchesFirst() {
            when(persistence.findGuestIdsWithLastAccessBefore(any())).thenReturn(List.of(1L));
            when(matches.deleteMatchesByUserCreatorIds(List.of(1L))).thenReturn(3);
            when(persistence.deleteGuestsByIds(List.of(1L))).thenReturn(1);

            var summary = paged().deleteStaleGuests(90);

            assertEquals(1, summary.guests());
            assertEquals(3, summary.matches());
        }
    }
}
