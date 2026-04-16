package games.paths.adapters.admin;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link AdminConstant}.
 * Verifies that all constant values are correctly defined.
 */
class AdminConstantTest {

    @Test
    @DisplayName("Key constants should have expected values")
    void keyConstants() {
        assertAll("Key constants",
            () -> assertEquals("error", AdminConstant.KEY_ERROR),
            () -> assertEquals("message", AdminConstant.KEY_MESSAGE),
            () -> assertEquals("story", AdminConstant.KEY_STORY),
            () -> assertEquals("stories", AdminConstant.KEY_STORIES),
            () -> assertEquals("categories", AdminConstant.KEY_CATEGORIES),
            () -> assertEquals("groups", AdminConstant.KEY_GROUPS),
            () -> assertEquals("status", AdminConstant.KEY_STATUS),
            () -> assertEquals("uuid", AdminConstant.KEY_UUID),
            () -> assertEquals("deletedCount", AdminConstant.KEY_DELETED_COUNT)
        );
    }

    @Test
    @DisplayName("Message constants should have expected values")
    void messageConstants() {
        assertAll("Message constants",
            () -> assertEquals("STORY_ALREADY_EXISTS", AdminConstant.STORY_ALREADY_EXISTS),
            () -> assertEquals("STORY_NOT_FOUND", AdminConstant.STORY_NOT_FOUND),
            () -> assertEquals("INVALID_STORY_DATA", AdminConstant.INVALID_STORY_DATA),
            () -> assertEquals("STORY_DELETED", AdminConstant.STORY_DELETED),
            () -> assertEquals("STORY_IMPORT_SUCCESS", AdminConstant.STORY_IMPORT_SUCCESS),
            () -> assertEquals("STORY_IMPORT_FAILED", AdminConstant.STORY_IMPORT_FAILED),
            () -> assertEquals("INVALID_IMPORT_DATA", AdminConstant.INVALID_IMPORT_DATA),
            () -> assertEquals("EMPTY_IMPORT_DATA", AdminConstant.EMPTY_IMPORT_DATA),
            () -> assertEquals("Request body must contain story data", AdminConstant.EMPTY_IMPORT_DATA_MESSAGE),
            () -> assertTrue(AdminConstant.STORY_NOT_FOUND_WITH_UUID.startsWith("No story found")),
            () -> assertEquals("GUEST_NOT_FOUND", AdminConstant.GUEST_NOT_FOUND),
            () -> assertTrue(AdminConstant.GUEST_NOT_FOUND_WITH_UUID.startsWith("No guest"))
        );
    }
}
