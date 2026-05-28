package games.paths.core.entity.story;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link BaseMissionEntity} shared fields.
 * Uses {@link MissionEntity} as a concrete implementation.
 */
class BaseMissionEntityTest {

    @Test
    @DisplayName("conditionKey round-trip")
    void conditionKey() {
        MissionEntity e = new MissionEntity();
        assertNull(e.getConditionKey());
        e.setConditionKey("QUEST_FLAG");
        assertEquals("QUEST_FLAG", e.getConditionKey());
    }

    @Test
    @DisplayName("conditionValueFrom round-trip")
    void conditionValueFrom() {
        MissionEntity e = new MissionEntity();
        assertNull(e.getConditionValueFrom());
        e.setConditionValueFrom("0");
        assertEquals("0", e.getConditionValueFrom());
    }

    @Test
    @DisplayName("conditionValueTo round-trip")
    void conditionValueTo() {
        MissionEntity e = new MissionEntity();
        assertNull(e.getConditionValueTo());
        e.setConditionValueTo("1");
        assertEquals("1", e.getConditionValueTo());
    }

    @Test
    @DisplayName("idEventCompleted round-trip")
    void idEventCompleted() {
        MissionEntity e = new MissionEntity();
        assertNull(e.getIdEventCompleted());
        e.setIdEventCompleted(42);
        assertEquals(42, e.getIdEventCompleted());
    }

    @Test
    @DisplayName("MissionStepEntity inherits BaseMissionEntity fields")
    void missionStepInherits() {
        MissionStepEntity e = new MissionStepEntity();
        e.setConditionKey("STEP_KEY");
        e.setConditionValueFrom("A");
        e.setConditionValueTo("B");
        e.setIdEventCompleted(99);

        assertAll(
            () -> assertEquals("STEP_KEY", e.getConditionKey()),
            () -> assertEquals("A", e.getConditionValueFrom()),
            () -> assertEquals("B", e.getConditionValueTo()),
            () -> assertEquals(99, e.getIdEventCompleted())
        );
    }
}
