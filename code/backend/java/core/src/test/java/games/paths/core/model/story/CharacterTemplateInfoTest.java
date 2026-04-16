package games.paths.core.model.story;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link CharacterTemplateInfo}.
 * Validates builder logic, field defaults, and toString.
 */
@ExtendWith(MockitoExtension.class)
class CharacterTemplateInfoTest {

    private CharacterTemplateInfo.Builder validBuilder() {
        return CharacterTemplateInfo.builder()
                .uuid("ct-1")
                .name("Warrior")
                .description("Strong melee fighter")
                .lifeMax(20)
                .energyMax(10)
                .sadMax(5)
                .dexterityStart(2)
                .intelligenceStart(1)
                .constitutionStart(3);
    }

    @Nested
    @DisplayName("Creation and Mapping Tests")
    class CreationTests {

        @Test
        @DisplayName("Should build successfully and map all fields")
        void build_success() {
            CharacterTemplateInfo ct = validBuilder().build();

            assertAll("CharacterTemplateInfo fields",
                () -> assertEquals("ct-1", ct.getUuid()),
                () -> assertEquals("Warrior", ct.getName()),
                () -> assertEquals("Strong melee fighter", ct.getDescription()),
                () -> assertEquals(20, ct.getLifeMax()),
                () -> assertEquals(10, ct.getEnergyMax()),
                () -> assertEquals(5, ct.getSadMax()),
                () -> assertEquals(2, ct.getDexterityStart()),
                () -> assertEquals(1, ct.getIntelligenceStart()),
                () -> assertEquals(3, ct.getConstitutionStart()),
                () -> assertTrue(ct.toString().contains("ct-1")),
                () -> assertTrue(ct.toString().contains("Warrior"))
            );
        }

        @Test
        @DisplayName("Should allow null uuid, name, and description")
        void build_nullOptionalFields() {
            CharacterTemplateInfo ct = CharacterTemplateInfo.builder()
                    .uuid(null)
                    .name(null)
                    .description(null)
                    .build();

            assertAll("Null fields",
                () -> assertNull(ct.getUuid()),
                () -> assertNull(ct.getName()),
                () -> assertNull(ct.getDescription())
            );
        }

        @Test
        @DisplayName("Should default int fields to 0 when not set")
        void build_defaultIntFields() {
            CharacterTemplateInfo ct = CharacterTemplateInfo.builder()
                    .uuid("uuid-test")
                    .build();

            assertAll("Default int values",
                () -> assertEquals(0, ct.getLifeMax()),
                () -> assertEquals(0, ct.getEnergyMax()),
                () -> assertEquals(0, ct.getSadMax()),
                () -> assertEquals(0, ct.getDexterityStart()),
                () -> assertEquals(0, ct.getIntelligenceStart()),
                () -> assertEquals(0, ct.getConstitutionStart())
            );
        }
    }
}
