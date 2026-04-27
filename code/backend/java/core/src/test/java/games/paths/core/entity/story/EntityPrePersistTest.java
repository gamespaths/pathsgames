package games.paths.core.entity.story;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class EntityPrePersistTest {

    @Test
    void choiceEntityPrePersist() {
        ChoiceEntity e = new ChoiceEntity();
        e.onCreate();
        assertEquals(0, e.getPriority());
        assertEquals(0, e.getOtherwiseFlag());
        assertEquals(0, e.getIsProgress());
        assertEquals("AND", e.getLogicOperator());
    }

    @Test
    void locationNeighborEntityPrePersist() {
        LocationNeighborEntity e = new LocationNeighborEntity();
        e.onCreate();
        assertEquals(0, e.getFlagBack());
        assertEquals(0, e.getEnergyCost());
    }
}
