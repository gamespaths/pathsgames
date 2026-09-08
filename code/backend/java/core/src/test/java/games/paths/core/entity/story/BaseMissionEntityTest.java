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
    @DisplayName("conditionValue round-trip")
    void conditionValue() {
        MissionEntity e = new MissionEntity();
        assertNull(e.getConditionValue());
        e.setConditionValue("0");
        assertEquals("0", e.getConditionValue());
    }

    @Test
    @DisplayName("conditionValues round-trip")
    void conditionValues() {
        MissionEntity e = new MissionEntity();
        assertNull(e.getConditionValues());
        e.setConditionValues("1");
        assertEquals("1", e.getConditionValues());
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
        e.setConditionValue("A");
        e.setConditionValues("B");
        e.setIdEventCompleted(99);

        assertAll(
            () -> assertEquals("STEP_KEY", e.getConditionKey()),
            () -> assertEquals("A", e.getConditionValue()),
            () -> assertEquals("B", e.getConditionValues()),
            () -> assertEquals(99, e.getIdEventCompleted())
        );
    }
}
