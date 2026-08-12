package games.paths.adapters.rest.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import games.paths.core.model.story.CardInfo;
import games.paths.core.port.match.EventExecutionPort;
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
                "match-uuid", "char-uuid", false, true, 4,
                java.util.List.of(new TimeAdvancementPort.RecoveryItem("char-uuid", 2, 1, -3)),
                java.util.List.of());

        String json = mapper.writeValueAsString(SleepActionResponse.fromModel(model));

        assertTrue(json.contains("\"isSleeping\":false"), json);
        assertTrue(json.contains("\"timeEndTriggered\":true"), json);
        assertTrue(json.contains("\"currentClock\":4"), json);
        assertFalse(json.contains("\"sleeping\":"), json);
        // Step 26 — the recovery recap is serialized on the sleep response.
        assertTrue(json.contains("\"recovery\":"), json);
        assertTrue(json.contains("\"energyDelta\":2"), json);
    }

    @Test
    void counterZeroCarriesEventCardLocationCardAndEffectCards() throws Exception {
        CardInfo eventCard = card("card-event", "The fuse burns out");
        CardInfo effectCard = card("card-effect", "You feel weaker");
        CardInfo locationCard = card("card-location", "The old mill");
        EventExecutionPort.AppliedEffect effect = new EventExecutionPort.AppliedEffect(
                "evt-fuse", "eff-1", "ENERGY", -3, "SELF", null, List.of("char-uuid"), effectCard);
        TimeAdvancementPort.SleepResult model = new TimeAdvancementPort.SleepResult(
                "match-uuid", "char-uuid", true, true, 4, List.of(),
                List.of(new TimeAdvancementPort.CounterZeroItem("COUNTER_ZERO", 12L,
                        eventCard, locationCard, List.of(effect), "evt-fuse", 4, "FULL")));

        String json = mapper.writeValueAsString(SleepActionResponse.fromModel(model));

        // v0.33.1 — three cards per entry: the event, the place, and the effects it applied.
        assertTrue(json.contains("\"title\":\"The fuse burns out\""), json);
        assertTrue(json.contains("\"cardLocation\":"), json);
        assertTrue(json.contains("\"title\":\"The old mill\""), json);
        assertTrue(json.contains("\"cardEffects\":"), json);
        assertTrue(json.contains("\"title\":\"You feel weaker\""), json);
        assertTrue(json.contains("\"effectUuid\":\"eff-1\""), json);
        assertTrue(json.contains("\"visibility\":\"FULL\""), json);
    }

    @Test
    void anonymousCounterZeroLeaksNoCardAtAll() throws Exception {
        TimeAdvancementPort.SleepResult model = new TimeAdvancementPort.SleepResult(
                "match-uuid", "char-uuid", true, true, 4, List.of(),
                List.of(new TimeAdvancementPort.CounterZeroItem("COUNTER_ZERO", 12L,
                        null, null, List.of(), "evt-fuse", 4, "ANONYMOUS")));

        String json = mapper.writeValueAsString(SleepActionResponse.fromModel(model));

        assertTrue(json.contains("\"card\":null"), json);
        assertTrue(json.contains("\"cardLocation\":null"), json);
        assertTrue(json.contains("\"cardEffects\":[]"), json);
    }

    /** A card with just the fields the assertions read. */
    private static CardInfo card(String uuid, String title) {
        return new CardInfo(uuid, "EVENT", null, null, null, null, null, null, null, null,
                title, null, null, null, null);
    }
}
