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
                () -> assertEquals("u1", list.get(0).getUserUuid()),
                () -> assertEquals("guest1", list.get(0).getUsername())
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
            assertEquals(6, result.getState(), "State should fall back to default 6");
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
            assertEquals(42, result.getState(), "State should use the value from the database");
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
            assertTrue(service.getGuestByUuid("u1").isExpired(), "Past date should be expired");
            assertFalse(service.getGuestByUuid("u2").isExpired(), "Invalid date should not be expired (catch block)");
            assertFalse(service.getGuestByUuid("u3").isExpired(), "Blank date should not be expired");
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
}