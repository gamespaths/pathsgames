package games.paths.core.model.story;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link DifficultyInfo}.
 * Validates builder logic, field defaults, and toString.
 */
@ExtendWith(MockitoExtension.class)
class DifficultyInfoTest {

    private DifficultyInfo.Builder validBuilder() {
        return DifficultyInfo.builder()
                .uuid("diff-1")
                .description("Easy")
                .expCost(5)
                .maxWeight(10)
                .minCharacter(1)
                .maxCharacter(4)
                .costHelpComa(3)
                .costMaxCharacteristics(3)
                .numberMaxFreeAction(1)
                .life(120)
                .energy(110)
                .sad(0)
                .dexterity(12)
                .intelligence(13)
                .constitution(14)
                .weight(15);
    }

    @Nested
    @DisplayName("Creation and Mapping Tests")
    class CreationTests {

        @Test
        @DisplayName("Should build successfully and map all fields")
        void build_success() {
            DifficultyInfo di = validBuilder().build();

            assertAll("DifficultyInfo fields",
                () -> assertEquals("diff-1", di.getUuid()),
                () -> assertEquals("Easy", di.getDescription()),
                () -> assertEquals(5, di.getExpCost()),
                () -> assertEquals(10, di.getMaxWeight()),
                () -> assertEquals(1, di.getMinCharacter()),
                () -> assertEquals(4, di.getMaxCharacter()),
                () -> assertEquals(3, di.getCostHelpComa()),
                () -> assertEquals(3, di.getCostMaxCharacteristics()),
                () -> assertEquals(1, di.getNumberMaxFreeAction()),
                () -> assertEquals(120, di.getLife()),
                () -> assertEquals(110, di.getEnergy()),
                () -> assertEquals(0, di.getSad()),
                () -> assertEquals(12, di.getDexterity()),
                () -> assertEquals(13, di.getIntelligence()),
                () -> assertEquals(14, di.getConstitution()),
                () -> assertEquals(15, di.getWeight()),
                () -> assertTrue(di.toString().contains("diff-1")),
                () -> assertTrue(di.toString().contains("5"))
            );
        }

        @Test
        @DisplayName("Should allow null uuid and description")
        void build_nullOptionalFields() {
            DifficultyInfo di = DifficultyInfo.builder()
                    .uuid(null)
                    .description(null)
                    .build();

            assertNull(di.getUuid());
            assertNull(di.getDescription());
        }

        @Test
        @DisplayName("Should default int fields to 0 when not set")
        void build_defaultIntFields() {
            DifficultyInfo di = DifficultyInfo.builder()
                    .uuid("uuid-test")
                    .build();

            assertAll("Default int values",
                () -> assertEquals(0, di.getExpCost()),
                () -> assertEquals(0, di.getMaxWeight()),
                () -> assertEquals(0, di.getMinCharacter()),
                () -> assertEquals(0, di.getMaxCharacter()),
                () -> assertEquals(0, di.getCostHelpComa()),
                () -> assertEquals(0, di.getCostMaxCharacteristics()),
                () -> assertEquals(0, di.getNumberMaxFreeAction()),
                () -> assertEquals(0, di.getLife()),
                () -> assertEquals(0, di.getEnergy()),
                () -> assertEquals(0, di.getSad()),
                () -> assertEquals(0, di.getDexterity()),
                () -> assertEquals(0, di.getIntelligence()),
                () -> assertEquals(0, di.getConstitution()),
                () -> assertEquals(0, di.getWeight())
            );
        }

        @Test
        @DisplayName("Should expose idCard, card, and trait budget fields")
        void build_cardAndTraitBudgetFields() {
            CardInfo card = new CardInfo(null, "STORY", null, null, null, null, null, null, null, null, "Easy Mode", null, null, null, null);
            DifficultyInfo di = DifficultyInfo.builder()
                    .uuid("diff-2")
                    .idCard(7)
                    .card(card)
                    .traitCostPositiveBudget(10)
                    .traitCostNegativeBudget(5)
                    .build();

            assertEquals(7, di.getIdCard());
            assertSame(card, di.getCard());
            assertEquals(10, di.getTraitCostPositiveBudget());
            assertEquals(5, di.getTraitCostNegativeBudget());
        }

        @Test
        @DisplayName("Null trait budgets should remain null")
        void build_nullTraitBudgets() {
            DifficultyInfo di = DifficultyInfo.builder().uuid("diff-3").build();
            assertNull(di.getIdCard());
            assertNull(di.getCard());
            assertNull(di.getTraitCostPositiveBudget());
            assertNull(di.getTraitCostNegativeBudget());
        }
    }
}
