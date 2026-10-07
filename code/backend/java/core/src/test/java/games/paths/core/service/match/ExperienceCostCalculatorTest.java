package games.paths.core.service.match;

import games.paths.core.entity.story.StoryDifficultyEntity;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Step 38 — the use-exp price list and its guards. */
class ExperienceCostCalculatorTest {

    @Test
    @DisplayName("cost = expCost × current + expCostBase")
    void formula() {
        ExperienceCostCalculator c = new ExperienceCostCalculator(3, 2, 0);
        assertEquals(38, c.cost(12));
        assertEquals(2, c.cost(0));
        assertEquals(3, c.expCost());
        assertEquals(2, c.expCostBase());
        assertNull(c.maxStatValue());
    }

    @Test
    @DisplayName("guards: expCost <= 0 reads 1, expCostBase < 0 reads 0, a cost never drops under 1")
    void guards() {
        assertEquals(12, new ExperienceCostCalculator(0, 0, 0).cost(12));
        assertEquals(12, new ExperienceCostCalculator(null, null, null).cost(12));
        assertEquals(12, new ExperienceCostCalculator(-4, -9, -1).cost(12));
        assertEquals(1, new ExperienceCostCalculator(1, 0, 0).cost(0));
    }

    @Test
    @DisplayName("maxStatValue caps: at the cap the next point costs null")
    void cap() {
        ExperienceCostCalculator c = new ExperienceCostCalculator(1, 0, 10);
        assertEquals(10, c.maxStatValue());
        assertFalse(c.atCap(9));
        assertTrue(c.atCap(10));
        assertTrue(c.atCap(11));
        assertEquals(9, c.costOrNull(9));
        assertNull(c.costOrNull(10));
        assertNull(new ExperienceCostCalculator(1, 0, 0).maxStatValue());
        assertNull(new ExperienceCostCalculator(1, 0, -5).maxStatValue());
    }

    @Test
    @DisplayName("costs() renders dex/int/cos in that order, null where capped")
    void costs() {
        Map<String, Integer> m = new ExperienceCostCalculator(2, 1, 6).costs(1, 6, 3);
        assertEquals(List.of("dex", "int", "cos"), List.copyOf(m.keySet()));
        assertEquals(3, m.get("dex"));
        assertNull(m.get("int"));
        assertEquals(7, m.get("cos"));
        assertEquals(List.of("dex", "int", "cos"), ExperienceCostCalculator.STATS);
    }

    @Test
    @DisplayName("of(): reads the difficulty row, or falls back to the match expCost with no base and no cap")
    void ofDifficulty() {
        StoryDifficultyEntity d = new StoryDifficultyEntity();
        d.setExpCost(5);
        d.setExpCostBase(4);
        d.setMaxStatValue(30);
        ExperienceCostCalculator c = ExperienceCostCalculator.of(d, 99);
        assertEquals(54, c.cost(10));
        assertEquals(30, c.maxStatValue());

        ExperienceCostCalculator fb = ExperienceCostCalculator.of(null, 3);
        assertEquals(30, fb.cost(10));
        assertNull(fb.maxStatValue());
        assertEquals(10, ExperienceCostCalculator.of(null, null).cost(10));
    }
}
