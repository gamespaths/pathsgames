package games.paths.core.port.match;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for the payload records of {@link TimeAdvancementPort} (Steps 25/26):
 * the sleep result with its recovery recap and the clock read.
 */
class TimeAdvancementPortRecordsTest {

    @Test
    void sleepResult_carriesTheRecoveryRecap() {
        TimeAdvancementPort.RecoveryItem item =
                new TimeAdvancementPort.RecoveryItem("char-a", 20, 5, -2);
        TimeAdvancementPort.SleepResult r =
                new TimeAdvancementPort.SleepResult("m1", "char-a", true, true, 3, List.of(item),
                        List.of());

        assertEquals("m1", r.matchUuid());
        assertEquals("char-a", r.characterUuid());
        assertTrue(r.isSleeping());
        assertTrue(r.timeEndTriggered());
        assertEquals(3, r.currentClock());
        assertEquals(1, r.recovery().size());
        assertEquals("char-a", r.recovery().get(0).characterUuid());
        assertEquals(20, r.recovery().get(0).energyDelta());
        assertEquals(5, r.recovery().get(0).lifeDelta());
        assertEquals(-2, r.recovery().get(0).sadDelta());
        assertEquals(item, r.recovery().get(0));
    }

    @Test
    void sleepResult_withoutTimeEndHasNoRecovery() {
        TimeAdvancementPort.SleepResult r =
                new TimeAdvancementPort.SleepResult("m1", "char-a", true, false, 2, List.of(),
                        List.of());

        assertFalse(r.timeEndTriggered());
        assertTrue(r.recovery().isEmpty());
    }

    @Test
    void clockResult_carriesLabelsAndPerCharacterState() {
        TimeAdvancementPort.ClockResult r = new TimeAdvancementPort.ClockResult(
                "m1", 4, "hour", "hours", true,
                List.of(new TimeAdvancementPort.ClockCharacter("char-a", true, 30)));

        assertEquals("m1", r.matchUuid());
        assertEquals(4, r.currentClock());
        assertEquals("hour", r.clockLabelSingular());
        assertEquals("hours", r.clockLabelPlural());
        assertTrue(r.anyCharacterSleeping());
        assertEquals("char-a", r.characters().get(0).characterUuid());
        assertTrue(r.characters().get(0).isSleeping());
        assertEquals(30, r.characters().get(0).energy());
    }
}
