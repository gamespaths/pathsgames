package games.paths.core.dto;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link BaseStorySummaryResponse} shared fields.
 * Uses a minimal concrete subclass since the base is abstract.
 */
class BaseStorySummaryResponseTest {

    /** Concrete no-op subclass for testing purposes. */
    private static class TestSummary extends BaseStorySummaryResponse {
        TestSummary() { super(); }
        TestSummary(String uuid, String title, String description, String author,
                    String category, String group, String visibility,
                    Integer priority, Integer peghi, int difficultyCount) {
            super(uuid, title, description, author, category, group, visibility,
                  priority, peghi, difficultyCount);
        }
    }

    @Test
    @DisplayName("All-args constructor sets all fields")
    void allArgsConstructor() {
        TestSummary r = new TestSummary("u1", "Title", "Desc", "Auth",
                "cat", "grp", "PUBLIC", 5, 10, 3);
        assertAll(
            () -> assertEquals("u1", r.getUuid()),
            () -> assertEquals("Title", r.getTitle()),
            () -> assertEquals("Desc", r.getDescription()),
            () -> assertEquals("Auth", r.getAuthor()),
            () -> assertEquals("cat", r.getCategory()),
            () -> assertEquals("grp", r.getGroup()),
            () -> assertEquals("PUBLIC", r.getVisibility()),
            () -> assertEquals(5, r.getPriority()),
            () -> assertEquals(10, r.getPeghi()),
            () -> assertEquals(3, r.getDifficultyCount())
        );
    }

    @Test
    @DisplayName("No-arg constructor defaults to null/zero")
    void noArgConstructor() {
        TestSummary r = new TestSummary();
        assertAll(
            () -> assertNull(r.getUuid()),
            () -> assertNull(r.getTitle()),
            () -> assertNull(r.getDescription()),
            () -> assertNull(r.getAuthor()),
            () -> assertNull(r.getCategory()),
            () -> assertNull(r.getGroup()),
            () -> assertNull(r.getVisibility()),
            () -> assertNull(r.getPriority()),
            () -> assertNull(r.getPeghi()),
            () -> assertEquals(0, r.getDifficultyCount())
        );
    }

    @Test
    @DisplayName("Setters update all fields")
    void settersAndGetters() {
        TestSummary r = new TestSummary();
        r.setUuid("u2");
        r.setTitle("T2");
        r.setDescription("D2");
        r.setAuthor("A2");
        r.setCategory("c2");
        r.setGroup("g2");
        r.setVisibility("PRIVATE");
        r.setPriority(7);
        r.setPeghi(20);
        r.setDifficultyCount(4);

        assertAll(
            () -> assertEquals("u2", r.getUuid()),
            () -> assertEquals("T2", r.getTitle()),
            () -> assertEquals("D2", r.getDescription()),
            () -> assertEquals("A2", r.getAuthor()),
            () -> assertEquals("c2", r.getCategory()),
            () -> assertEquals("g2", r.getGroup()),
            () -> assertEquals("PRIVATE", r.getVisibility()),
            () -> assertEquals(7, r.getPriority()),
            () -> assertEquals(20, r.getPeghi()),
            () -> assertEquals(4, r.getDifficultyCount())
        );
    }

    @Test
    @DisplayName("Nullable Integer priority and peghi accept null")
    void nullablePriorityAndPeghi() {
        TestSummary r = new TestSummary();
        r.setPriority(null);
        r.setPeghi(null);
        assertNull(r.getPriority());
        assertNull(r.getPeghi());
    }
}
