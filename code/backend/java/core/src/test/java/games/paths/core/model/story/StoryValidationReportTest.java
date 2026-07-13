package games.paths.core.model.story;

import games.paths.core.port.story.StoryValidatorPort;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class StoryValidationReportTest {

    @Test
    void emptyReport_isValid_andSummaryIsValid() {
        StoryValidationReport report = new StoryValidationReport();
        assertTrue(report.isValid());
        assertEquals(0, report.size());
        assertEquals("story is valid", report.summary());
        assertTrue(report.getErrors().isEmpty());
    }

    @Test
    void addError_makesReportInvalid() {
        StoryValidationReport report = new StoryValidationReport();
        report.add("rule1", "location", "id1", "field", "error message");

        assertFalse(report.isValid());
        assertEquals(1, report.size());
        assertEquals(1, report.getErrors().size());
    }

    @Test
    void summary_upToFiveErrors_listsAllMessages() {
        StoryValidationReport report = new StoryValidationReport();
        for (int i = 1; i <= 5; i++) {
            report.add("rule", "type", "id" + i, "f", "msg" + i);
        }
        String summary = report.summary();
        assertTrue(summary.contains("msg1"));
        assertTrue(summary.contains("msg5"));
        assertFalse(summary.contains("more)"));
    }

    @Test
    void summary_moreThanFiveErrors_appendsCount() {
        StoryValidationReport report = new StoryValidationReport();
        for (int i = 1; i <= 8; i++) {
            report.add("rule", "type", "id" + i, "f", "msg" + i);
        }
        String summary = report.summary();
        assertTrue(summary.contains("(+3 more)"));
    }

    @Test
    void storyValidationException_wrapsReport() {
        StoryValidationReport report = new StoryValidationReport();
        report.add("rule", "type", "id", "f", "bad field");

        StoryValidatorPort.StoryValidationException ex =
                new StoryValidatorPort.StoryValidationException(report);

        assertSame(report, ex.getReport());
        assertTrue(ex.getMessage().contains("Story validation failed"));
    }
}
