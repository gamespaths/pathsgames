package games.paths.adapters.rest.dto;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * ClassBonusInfoResponse — one class bonus row on the wire.
 */
@DisplayName("ClassBonusInfoResponse")
class ClassBonusInfoResponseTest {

    @Test
    @DisplayName("The all-args constructor fills every field")
    void allArgsConstructor() {
        ClassBonusInfoResponse d = new ClassBonusInfoResponse("bonus-1", "dexterity", 3);

        assertAll(
                () -> assertEquals("bonus-1", d.getUuid()),
                () -> assertEquals("dexterity", d.getStatistic()),
                () -> assertEquals(3, d.getValue()));
    }

    @Test
    @DisplayName("The no-args constructor leaves the payload empty for Jackson")
    void noArgsConstructorIsEmpty() {
        ClassBonusInfoResponse d = new ClassBonusInfoResponse();

        assertAll(
                () -> assertNull(d.getUuid()),
                () -> assertNull(d.getStatistic()),
                () -> assertEquals(0, d.getValue()));
    }

    @Test
    @DisplayName("The setters round-trip, negative bonuses included")
    void settersRoundTrip() {
        ClassBonusInfoResponse d = new ClassBonusInfoResponse();
        d.setUuid("bonus-2");
        d.setStatistic("intelligence");
        d.setValue(-2);

        assertAll(
                () -> assertEquals("bonus-2", d.getUuid()),
                () -> assertEquals("intelligence", d.getStatistic()),
                () -> assertEquals(-2, d.getValue()));
    }
}
