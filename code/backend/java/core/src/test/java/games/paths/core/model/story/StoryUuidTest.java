package games.paths.core.model.story;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** Unit tests for {@link StoryUuid} (v0.41.5). */
class StoryUuidTest {

    @Test
    void normalizeTrimsAndLowercases() {
        assertEquals("0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
                StoryUuid.normalize(" 0A1B2C3D-4E5F-4A6B-8C7D-9E0F1A2B3C4D "));
        assertEquals("123", StoryUuid.normalize(123));
    }

    @Test
    void normalizeMapsAbsentAndBlankToNull() {
        assertNull(StoryUuid.normalize(null));
        assertNull(StoryUuid.normalize(""));
        assertNull(StoryUuid.normalize("   "));
    }

    @Test
    void isValidChecksTheLowercaseShape() {
        assertTrue(StoryUuid.isValid("0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d"));
        assertFalse(StoryUuid.isValid("0A1B2C3D-4E5F-4A6B-8C7D-9E0F1A2B3C4D"));
        assertFalse(StoryUuid.isValid("0a1b2c3d4e5f4a6b8c7d9e0f1a2b3c4d"));
        assertFalse(StoryUuid.isValid("story-001"));
        assertFalse(StoryUuid.isValid(null));
    }
}
