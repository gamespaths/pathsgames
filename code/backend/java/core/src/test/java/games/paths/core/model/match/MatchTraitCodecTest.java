package games.paths.core.model.match;

import org.junit.jupiter.api.Test;

import java.lang.reflect.Constructor;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link MatchTraitCodec}. Step 0.19.9 — exercises every
 * branch of the trait-uuid CSV join/split helpers.
 */
class MatchTraitCodecTest {

    @Test
    void joinNullOrEmptyReturnsNull() {
        assertNull(MatchTraitCodec.join(null));
        assertNull(MatchTraitCodec.join(new ArrayList<>()));
    }

    @Test
    void joinAllBlankReturnsNull() {
        assertNull(MatchTraitCodec.join(Arrays.asList(null, "", "   ")));
    }

    @Test
    void joinKeepsAndTrimsNonBlankValues() {
        assertEquals("a,b", MatchTraitCodec.join(Arrays.asList("a", null, "  b  ", "")));
    }

    @Test
    void splitNullOrBlankReturnsEmptyList() {
        assertTrue(MatchTraitCodec.split(null).isEmpty());
        assertTrue(MatchTraitCodec.split("   ").isEmpty());
    }

    @Test
    void splitParsesTrimsAndDropsBlanks() {
        assertEquals(List.of("a", "b"), MatchTraitCodec.split(" a , ,b, "));
    }

    @Test
    void splitResultIsMutable() {
        List<String> result = MatchTraitCodec.split("a");
        result.add("b");
        assertEquals(2, result.size());
    }

    @Test
    void privateConstructorForCoverage() throws Exception {
        Constructor<MatchTraitCodec> ctor = MatchTraitCodec.class.getDeclaredConstructor();
        ctor.setAccessible(true);
        assertNotNull(ctor.newInstance());
    }
}
