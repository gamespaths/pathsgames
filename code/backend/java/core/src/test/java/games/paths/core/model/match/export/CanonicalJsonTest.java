package games.paths.core.model.match.export;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** v0.41.4 — the canonical JSON on the vectors shared with python and aws (H.2.6). */
@DisplayName("CanonicalJson (v0.41.4)")
class CanonicalJsonTest {

    @SuppressWarnings("unchecked")
    static List<Map<String, Object>> vectors() throws IOException {
        try (InputStream in = CanonicalJsonTest.class.getResourceAsStream("/match-export/canonical-vectors.json")) {
            Map<String, Object> file = (Map<String, Object>) CanonicalJson.parse(
                    new String(in.readAllBytes(), StandardCharsets.UTF_8));
            return (List<Map<String, Object>>) file.get("vectors");
        }
    }

    @Test
    void sharedVectorsGiveTheSameTextAndChecksum() throws IOException {
        List<Map<String, Object>> vectors = vectors();
        assertEquals(8, vectors.size());
        for (Map<String, Object> v : vectors) {
            Object value = CanonicalJson.parse((String) v.get("input"));
            assertEquals(v.get("canonical"), CanonicalJson.write(value), (String) v.get("name"));
            assertEquals(v.get("sha256"), CanonicalJson.sha256(value), (String) v.get("name"));
        }
    }

    @Test
    void writesJavaValuesAndDropsNullKeys() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("b", List.of(1, "x"));
        m.put("a", null);
        m.put("c", new Object[]{true, null});
        m.put("d", new StringBuilder("sb"));
        m.put("e", new BigDecimal("2.50"));
        m.put("f", BigInteger.TEN.pow(20));
        List<Object> withNull = new ArrayList<>(Arrays.asList(null, 2L));
        m.put("g", withNull);
        assertEquals("{\"b\":[1,\"x\"],\"c\":[true,null],\"d\":\"sb\",\"e\":2.5,\"f\":100000000000000000000,"
                + "\"g\":[null,2]}", CanonicalJson.write(m));
        assertEquals(CanonicalJson.write(m).length(), CanonicalJson.size(m));
    }

    @Test
    void floatsAreWrittenAsPythonDoes() {
        assertEquals("0.0", CanonicalJson.pythonFloat(0.0));
        assertEquals("-0.0", CanonicalJson.pythonFloat(-0.0));
        assertEquals("1.0", CanonicalJson.pythonFloat(1.0));
        assertEquals("1e+16", CanonicalJson.pythonFloat(1e16));
        assertEquals("-1.5e+20", CanonicalJson.pythonFloat(-1.5e20));
        assertEquals("1e-05", CanonicalJson.pythonFloat(0.00001));
        assertEquals("0.0001", CanonicalJson.pythonFloat(0.0001));
        assertEquals("123456789.25", CanonicalJson.pythonFloat(123456789.25));
        assertEquals("null", CanonicalJson.pythonFloat(Double.NaN));
        assertEquals("null", CanonicalJson.pythonFloat(Double.POSITIVE_INFINITY));
        assertEquals("2.5", CanonicalJson.number(2.5f));
    }

    @Test
    void parseRefusesNonJsonAndKeepsBigIntegers() {
        assertNull(CanonicalJson.parse(null));
        assertNull(CanonicalJson.parse("{not json"));
        assertEquals(5L, CanonicalJson.parse("5"));
        assertInstanceOf(BigInteger.class, CanonicalJson.parse("123456789012345678901234567890"));
    }

    @Test
    void keysSortByCodePoint() {
        assertTrue(CanonicalJson.compareCodePoints("a", "b") < 0);
        assertTrue(CanonicalJson.compareCodePoints("ab", "a") > 0);
        assertEquals(0, CanonicalJson.compareCodePoints("x", "x"));
        // U+FF5E sorts before U+1F600 by code point although its UTF-16 unit is larger.
        assertTrue(CanonicalJson.compareCodePoints("～", "😀") < 0);
    }

    @Test
    void shaOfTextIsHex() {
        assertEquals("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", CanonicalJson.sha256Hex(""));
    }
}
