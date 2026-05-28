package games.paths.adapters.auth.entity;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link UserEntity}.
 * Focuses on JPA lifecycle callbacks (onPersist/onUpdate), default field values, 
 * and integrity of getters/setters.
 */
@ExtendWith(MockitoExtension.class)
class UserEntityTest {

    // --- SEZIONE: CICLO DI VITA JPA ---

    @Nested
    @DisplayName("JPA Lifecycle Callbacks Tests")
    class LifecycleTests {

        @Test
        @DisplayName("Should initialize timestamps only on first creation")
        void onCreate_behavior() {
            UserEntity entity = new UserEntity();

            // Before: fields should be null
            assertNull(entity.getTsRegistration());
            assertNull(entity.getTsInsert());
            assertNull(entity.getTsUpdate());

            // Act
            entity.onCreate(); // Simula @PrePersist

            // Assert
            assertAll("Check initial timestamps",
                () -> assertNotNull(entity.getTsRegistration()),
                () -> assertNotNull(entity.getTsInsert()),
                () -> assertNotNull(entity.getTsUpdate())
            );

            // Re-calling onCreate should not overwrite (Idempotency check for Sonar)
            String originalReg = entity.getTsRegistration();
            entity.onCreate();
            assertEquals(originalReg, entity.getTsRegistration(), "Should not overwrite existing registration");
        }

        @Test
        @DisplayName("Should update only tsUpdate when onUpdate is triggered")
        void onUpdate_behavior() throws InterruptedException {
            UserEntity entity = new UserEntity();
            entity.onCreate();
            String originalInsert = entity.getTsInsert();
            String beforeUpdate = entity.getTsUpdate();

            // Wait a small amount to ensure timestamp difference
            Thread.sleep(2); 
            entity.onUpdate(); // Simula @PreUpdate

            assertAll("Verify update logic",
                () -> assertEquals(originalInsert, entity.getTsInsert(), "Insert timestamp must remain constant"),
                () -> assertNotEquals(beforeUpdate, entity.getTsUpdate(), "Update timestamp must change"),
                () -> assertNotNull(entity.getTsUpdate())
            );
        }
    }

    // --- SEZIONE: VALORI DI DEFAULT E MAPPATURA ---

    @Nested
    @DisplayName("Field Mapping and Defaults Tests")
    class MappingTests {

        @Test
        @DisplayName("Should verify all standard getters and setters")
        void gettersAndSetters_integrity() {
            UserEntity e = new UserEntity();
            e.setId(123L);
            e.setUuid("u-unique");
            e.setUsername("hero");
            e.setNickname("legend");
            e.setEmailAddress("test@paths.it");
            e.setPasswordHash("hash123");
            e.setGoogleIdSso("google-id");
            e.setThemeSelected("midnight");
            e.setPasswordHash("1234");
            e.setLanguage("it");
            e.setState(6);
            e.setGuestCookieToken("token-abc");
            e.setGuestExpiresAt("2030-01-01T00:00:00Z");
            e.setTsLastAccess("2024-01-01T10:00:00Z");

            assertAll("Verify all entity properties",
                () -> assertEquals(123L, e.getId()),
                () -> assertEquals("u-unique", e.getUuid()),
                () -> assertEquals("hero", e.getUsername()),
                () -> assertEquals("legend", e.getNickname()),
                () -> assertEquals("test@paths.it", e.getEmailAddress()),
                () -> assertEquals("1234", e.getPasswordHash()),
                () -> assertEquals("google-id", e.getGoogleIdSso()),
                () -> assertEquals("midnight", e.getThemeSelected()),
                () -> assertEquals("it", e.getLanguage()),
                () -> assertEquals(6, e.getState()),
                () -> assertEquals("token-abc", e.getGuestCookieToken()),
                () -> assertEquals("2030-01-01T00:00:00Z", e.getGuestExpiresAt()),
                () -> assertEquals("2024-01-01T10:00:00Z", e.getTsLastAccess())
            );
        }

        @Test
        @DisplayName("Should ensure business-required default values are set on instantiation")
        void defaultValues_verification() {
            UserEntity e = new UserEntity();
            
            assertAll("Verify default state",
                () -> assertEquals("PLAYER", e.getRole(), "Default role should be PLAYER"),
                () -> assertEquals(1, e.getState(), "Default state should be 1 (Active/Pending)"),
                () -> assertEquals("en", e.getLanguage(), "Default language should be English"),
                () -> assertEquals("default", e.getThemeSelected(), "Default theme should be 'default'")
            );
        }
    }
}