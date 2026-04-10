package games.paths.adapters.rest.dto;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link StoryDetailResponse}.
 * Covers no-arg constructor, all setters/getters, and difficulties list.
 */
class StoryDetailResponseTest {

    @Test
    @DisplayName("No-arg constructor and setters should work for all fields")
    void settersAndGetters() {
        DifficultyResponse diff = new DifficultyResponse(
                "diff-1", "Easy", 5, 10, 1, 4, 3, 3, 1);

        StoryDetailResponse r = new StoryDetailResponse();
        r.setUuid("uuid-1");
        r.setTitle("Title");
        r.setDescription("Desc");
        r.setAuthor("Author");
        r.setCategory("adventure");
        r.setGroup("fantasy");
        r.setVisibility("PUBLIC");
        r.setPriority(5);
        r.setPeghi(2);
        r.setVersionMin("0.10");
        r.setVersionMax("1.0");
        r.setClockSingularDescription("hour");
        r.setClockPluralDescription("hours");
        r.setCopyrightText("(c) 2025");
        r.setLinkCopyright("https://example.com");
        r.setLocationCount(10);
        r.setEventCount(20);
        r.setItemCount(5);
        r.setDifficulties(List.of(diff));

        assertAll("StoryDetailResponse fields",
            () -> assertEquals("uuid-1", r.getUuid()),
            () -> assertEquals("Title", r.getTitle()),
            () -> assertEquals("Desc", r.getDescription()),
            () -> assertEquals("Author", r.getAuthor()),
            () -> assertEquals("adventure", r.getCategory()),
            () -> assertEquals("fantasy", r.getGroup()),
            () -> assertEquals("PUBLIC", r.getVisibility()),
            () -> assertEquals(5, r.getPriority()),
            () -> assertEquals(2, r.getPeghi()),
            () -> assertEquals("0.10", r.getVersionMin()),
            () -> assertEquals("1.0", r.getVersionMax()),
            () -> assertEquals("hour", r.getClockSingularDescription()),
            () -> assertEquals("hours", r.getClockPluralDescription()),
            () -> assertEquals("(c) 2025", r.getCopyrightText()),
            () -> assertEquals("https://example.com", r.getLinkCopyright()),
            () -> assertEquals(10, r.getLocationCount()),
            () -> assertEquals(20, r.getEventCount()),
            () -> assertEquals(5, r.getItemCount()),
            () -> assertEquals(1, r.getDifficulties().size()),
            () -> assertEquals("diff-1", r.getDifficulties().get(0).getUuid())
        );
    }

    @Test
    @DisplayName("Default values should be 0 for int fields and null for objects")
    void defaultValues() {
        StoryDetailResponse r = new StoryDetailResponse();

        assertAll("Default values",
            () -> assertNull(r.getUuid()),
            () -> assertNull(r.getTitle()),
            () -> assertNull(r.getDifficulties()),
            () -> assertEquals(0, r.getPriority()),
            () -> assertEquals(0, r.getLocationCount())
        );
    }
}
