package games.paths.adapters.rest.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** v1.11.0 {@link QueryLimits}: a ?limit= that is not an integer reads as absent. */
class QueryLimitsTest {

    @Test
    @DisplayName("An integer is kept, anything else is the default page (null)")
    void parse() {
        assertEquals(25, QueryLimits.parse("25"));
        assertEquals(7, QueryLimits.parse(" 7 "));
        assertEquals(-3, QueryLimits.parse("-3"));
        assertNull(QueryLimits.parse("abc"));
        assertNull(QueryLimits.parse("1.5"));
        assertNull(QueryLimits.parse(" "));
        assertNull(QueryLimits.parse(null));
    }
}
