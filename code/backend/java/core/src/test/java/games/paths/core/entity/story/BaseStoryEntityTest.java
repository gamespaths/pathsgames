package games.paths.core.entity.story;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Nested;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link BaseStoryEntity}.
 *
 * <p>Uses {@link StoryEntity} as a concrete subclass because
 * {@code BaseStoryEntity} is abstract.  The tests focus on the shared
 * lifecycle behaviour defined in the base class.</p>
 */
class BaseStoryEntityTest {

    // ── @PrePersist (baseOnCreate) ───────────────────────────────────────────────

    @Nested
    @DisplayName("baseOnCreate() — @PrePersist lifecycle")
    class BaseOnCreateTests {

        @Test
        @DisplayName("baseOnCreate() populates uuid, tsInsert, tsUpdate when all are null")
        void baseOnCreate_populatesTimestampsAndUuid() {
            StoryEntity entity = new StoryEntity();
            assertNull(entity.getUuid());
            assertNull(entity.getTsInsert());
            assertNull(entity.getTsUpdate());

            entity.baseOnCreate();

            assertAll(
                () -> assertNotNull(entity.getUuid(), "uuid must be set"),
                () -> assertNotNull(entity.getTsInsert(), "tsInsert must be set"),
                () -> assertNotNull(entity.getTsUpdate(), "tsUpdate must be set")
            );
        }

        @Test
        @DisplayName("baseOnCreate() does NOT overwrite existing uuid (idempotency)")
        void baseOnCreate_doesNotOverwriteExistingUuid() {
            StoryEntity entity = new StoryEntity();
            entity.setUuid("existing-uuid");
            entity.baseOnCreate();
            assertEquals("existing-uuid", entity.getUuid(),
                "uuid must not be overwritten on second persist call");
        }

        @Test
        @DisplayName("baseOnCreate() does NOT overwrite existing tsInsert and tsUpdate")
        void baseOnCreate_doesNotOverwriteExistingTimestamps() {
            StoryEntity entity = new StoryEntity();
            entity.baseOnCreate();
            String originalTsInsert = entity.getTsInsert();
            String originalTsUpdate = entity.getTsUpdate();

            // Call again — should not change existing timestamps
            entity.baseOnCreate();
            assertAll(
                () -> assertEquals(originalTsInsert, entity.getTsInsert(),
                        "tsInsert must not be overwritten"),
                () -> assertEquals(originalTsUpdate, entity.getTsUpdate(),
                        "tsUpdate must not be overwritten")
            );
        }

        @Test
        @DisplayName("Generated uuid has UUID format (8-4-4-4-12 hex)")
        void baseOnCreate_generatesValidUuidFormat() {
            StoryEntity entity = new StoryEntity();
            entity.baseOnCreate();
            String uuid = entity.getUuid();
            assertTrue(uuid.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"),
                "Expected UUID format, got: " + uuid);
        }

        @Test
        @DisplayName("baseOnCreate() stores ISO-8601 instant strings")
        void baseOnCreate_isoInstantStrings() {
            StoryEntity entity = new StoryEntity();
            entity.baseOnCreate();
            // ISO-8601 instants contain 'T' and 'Z'
            String ts = entity.getTsInsert();
            assertTrue(ts.contains("T"), "Expected ISO-8601 'T' separator in tsInsert");
            assertTrue(ts.contains("Z"), "Expected ISO-8601 'Z' suffix in tsInsert");
        }
    }

    // ── @PreUpdate (onUpdate) ────────────────────────────────────────────────────

    @Nested
    @DisplayName("onUpdate() — @PreUpdate lifecycle")
    class OnUpdateTests {

        @Test
        @DisplayName("onUpdate() changes tsUpdate but not tsInsert")
        void onUpdate_changesTsUpdate() throws InterruptedException {
            StoryEntity entity = new StoryEntity();
            entity.baseOnCreate();
            String originalTsInsert = entity.getTsInsert();
            String beforeUpdate = entity.getTsUpdate();

            Thread.sleep(2);
            entity.onUpdate();

            assertAll(
                () -> assertEquals(originalTsInsert, entity.getTsInsert(), "tsInsert must not change"),
                () -> assertNotEquals(beforeUpdate, entity.getTsUpdate(), "tsUpdate must change")
            );
        }
    }

    // ── getters / setters ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Getter / Setter tests")
    class GetterSetterTests {

        @Test
        @DisplayName("setUuid() and getUuid() round-trip correctly")
        void setUuid_roundTrip() {
            StoryEntity entity = new StoryEntity();
            entity.setUuid("test-uuid-123");
            assertEquals("test-uuid-123", entity.getUuid());
        }

        @Test
        @DisplayName("getTsInsert() returns null before baseOnCreate()")
        void getTsInsert_nullBeforeCreate() {
            StoryEntity entity = new StoryEntity();
            assertNull(entity.getTsInsert());
        }

        @Test
        @DisplayName("getTsUpdate() returns null before baseOnCreate()")
        void getTsUpdate_nullBeforeCreate() {
            StoryEntity entity = new StoryEntity();
            assertNull(entity.getTsUpdate());
        }

        @Test
        @DisplayName("setIdCard() and getIdCard() round-trip correctly")
        void setIdCard_roundTrip() {
            StoryEntity entity = new StoryEntity();
            assertNull(entity.getIdCard(), "idCard must be null initially");
            entity.setIdCard(42);
            assertEquals(42, entity.getIdCard());
        }

        @Test
        @DisplayName("setIdStory() and getIdStory() round-trip correctly")
        void setIdStory_roundTrip() {
            StoryEntity entity = new StoryEntity();
            assertNull(entity.getIdStory(), "idStory must be null initially");
            entity.setIdStory(99L);
            assertEquals(99L, entity.getIdStory());
        }

        @Test
        @DisplayName("setIdTextName() and getIdTextName() round-trip correctly")
        void setIdTextName_roundTrip() {
            StoryEntity entity = new StoryEntity();
            assertNull(entity.getIdTextName(), "idTextName must be null initially");
            entity.setIdTextName(7);
            assertEquals(7, entity.getIdTextName());
        }

        @Test
        @DisplayName("setIdTextDescription() and getIdTextDescription() round-trip correctly")
        void setIdTextDescription_roundTrip() {
            StoryEntity entity = new StoryEntity();
            assertNull(entity.getIdTextDescription(), "idTextDescription must be null initially");
            entity.setIdTextDescription(13);
            assertEquals(13, entity.getIdTextDescription());
        }
    }
}
