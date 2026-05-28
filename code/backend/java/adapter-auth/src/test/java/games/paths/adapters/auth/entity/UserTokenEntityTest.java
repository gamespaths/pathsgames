package games.paths.adapters.auth.entity;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link UserTokenEntity}.
 * Validates JPA lifecycle events, field mapping, and default states for session tokens.
 */
@ExtendWith(MockitoExtension.class)
class UserTokenEntityTest {

    // --- SEZIONE: LOGICA DEL CICLO DI VITA (CALLBACKS) ---

    @Nested
    @DisplayName("JPA Lifecycle Callbacks Tests")
    class LifecycleTests {

        @Test
        @DisplayName("Should initialize UUID and Timestamps only if they are null (onPersist)")
        void onCreate_initializesNullFields() {
            UserTokenEntity entity = new UserTokenEntity();

            // Act
            entity.onCreate();

            // Assert
            assertAll("Initial state after onCreate",
                () -> assertNotNull(entity.getUuid(), "UUID should be generated"),
                () -> assertNotNull(entity.getTsInsert(), "Insert timestamp should be set"),
                () -> assertNotNull(entity.getTsUpdate(), "Update timestamp should be set")
            );
        }

        @Test
        @DisplayName("Should NOT overwrite existing UUID or timestamps (Branch Coverage)")
        void onCreate_idempotency() {
            // Arrange
            UserTokenEntity entity = new UserTokenEntity();
            String customUuid = "fixed-uuid";
            entity.setUuid(customUuid);
            
            entity.onCreate(); // Prima chiamata per settare i timestamp
            String firstInsert = entity.getTsInsert();
            String firstUpdate = entity.getTsUpdate();

            // Act: Seconda chiamata (simula ri-salvataggio o logica difensiva)
            entity.onCreate();

            // Assert: I rami 'if (field == null)' devono saltare l'assegnazione
            assertAll("Verify no values were overwritten",
                () -> assertEquals(customUuid, entity.getUuid()),
                () -> assertEquals(firstInsert, entity.getTsInsert()),
                () -> assertEquals(firstUpdate, entity.getTsUpdate())
            );
        }

        @Test
        @DisplayName("Should update only the tsUpdate field on update event")
        void onUpdate_logic() throws InterruptedException {
            UserTokenEntity entity = new UserTokenEntity();
            entity.onCreate();
            String originalInsert = entity.getTsInsert();
            String beforeUpdate = entity.getTsUpdate();

            // Small delay to ensure timestamp change
            Thread.sleep(2);
            entity.onUpdate();

            assertAll("Verify update integrity",
                () -> assertEquals(originalInsert, entity.getTsInsert(), "Insert date must be immutable"),
                () -> assertNotEquals(beforeUpdate, entity.getTsUpdate(), "Update date must change"),
                () -> assertNotNull(entity.getTsUpdate())
            );
        }
    }

    // --- SEZIONE: MAPPATURA E STATO ---

    @Nested
    @DisplayName("Field Mapping and Default State Tests")
    class MappingTests {

        @Test
        @DisplayName("Should correctly map all entity fields via getters and setters")
        void gettersAndSetters_integrity() {
            UserTokenEntity e = new UserTokenEntity();

            e.setId(1L);
            e.setUuid("uuid-test");
            e.setIdUser(42L);
            e.setRefreshToken("rt-xyz");
            e.setExpiresAt("2030-01-01T00:00:00Z");
            e.setRevoked(true);

            assertAll("Verify UserTokenEntity properties",
                () -> assertEquals(1L, e.getId()),
                () -> assertEquals("uuid-test", e.getUuid()),
                () -> assertEquals(42L, e.getIdUser()),
                () -> assertEquals("rt-xyz", e.getRefreshToken()),
                () -> assertEquals("2030-01-01T00:00:00Z", e.getExpiresAt()),
                () -> assertTrue(e.getRevoked())
            );
        }

        @Test
        @DisplayName("Should ensure a new token is not revoked by default")
        void defaultState_isCorrect() {
            UserTokenEntity e = new UserTokenEntity();
            assertFalse(e.getRevoked(), "New tokens should be active (revoked=false)");
        }
    }
}