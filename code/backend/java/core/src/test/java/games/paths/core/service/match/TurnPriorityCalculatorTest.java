package games.paths.core.service.match;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("TurnPriorityCalculator")
class TurnPriorityCalculatorTest {

    @Test
    @DisplayName("applies (DEX*3 + INT*2 + COS*1) * 1000 + LIFE*10 + idCharacter")
    void formula() {
        // (12*3 + 12*2 + 12) * 1000 + 120*10 + 1 = 72*1000 + 1200 + 1
        assertEquals(73201L, TurnPriorityCalculator.compute(12, 12, 12, 120, 1));
    }

    @Test
    @DisplayName("idCharacter breaks ties deterministically")
    void tieBreak() {
        long a = TurnPriorityCalculator.compute(5, 5, 5, 10, 1);
        long b = TurnPriorityCalculator.compute(5, 5, 5, 10, 2);
        assertEquals(a + 1, b);
        assertTrue(b > a);
    }

    @Test
    @DisplayName("higher stats yield higher priority")
    void higherStats() {
        long strong = TurnPriorityCalculator.compute(10, 10, 10, 50, 1);
        long weak = TurnPriorityCalculator.compute(1, 1, 1, 5, 9);
        assertTrue(strong > weak);
    }
}
