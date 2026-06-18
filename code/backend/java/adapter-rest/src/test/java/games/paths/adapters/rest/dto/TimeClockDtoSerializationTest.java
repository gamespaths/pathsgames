package games.paths.adapters.rest.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import games.paths.core.port.match.TimeAdvancementPort;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Step 25 — guards the JSON property names of the time/clock DTOs against the
 * shared API contract. The boolean field must serialise as {@code isSleeping}
 * (matching Python/AWS), not the Jackson default {@code sleeping}.
 */
class TimeClockDtoSerializationTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void clockResponseUsesIsSleepingKey() throws Exception {
        TimeAdvancementPort.ClockResult model = new TimeAdvancementPort.ClockResult(
                "match-uuid", 5, "hour", "hours", true,
                List.of(new TimeAdvancementPort.ClockCharacter("char-uuid", true, 40)));

        String json = mapper.writeValueAsString(ClockResponse.fromModel(model));

        assertTrue(json.contains("\"anyCharacterSleeping\":true"), json);
        assertTrue(json.contains("\"isSleeping\":true"), json);
        assertFalse(json.contains("\"sleeping\":"), json);
        assertTrue(json.contains("\"clockLabelSingular\":\"hour\""), json);
        assertTrue(json.contains("\"energy\":40"), json);
    }

    @Test
    void sleepActionResponseUsesIsSleepingAndTimeEndTriggeredKeys() throws Exception {
        TimeAdvancementPort.SleepResult model = new TimeAdvancementPort.SleepResult(
                "match-uuid", "char-uuid", false, true, 4);

        String json = mapper.writeValueAsString(SleepActionResponse.fromModel(model));

        assertTrue(json.contains("\"isSleeping\":false"), json);
        assertTrue(json.contains("\"timeEndTriggered\":true"), json);
        assertTrue(json.contains("\"currentClock\":4"), json);
        assertFalse(json.contains("\"sleeping\":"), json);
    }
}
