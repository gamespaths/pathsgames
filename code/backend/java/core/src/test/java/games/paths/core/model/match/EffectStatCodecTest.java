package games.paths.core.model.match;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("EffectStatCodec (Step 34)")
class EffectStatCodecTest {

    @ParameterizedTest
    @CsvSource({
            "LIFE,life", "ENERGY,energy", "EXP,exp", "DEX,dex", "INT,int", "COS,cos",
            "FOOD,food", "MAGIC,magic", "COIN,coin",
            "life,life", "  Energy  ,energy"
    })
    @DisplayName("codes that differ only by case fall out of the lowercasing")
    void normalize_lowercases(String code, String expected) {
        assertEquals(expected, EffectStatCodec.normalize(code));
    }

    @ParameterizedTest
    @CsvSource({"SADNESS,sad", "sadness,sad", "Sadness,sad", "sad,sad", "COINS,coin"})
    @DisplayName("the documented aliases are the only genuine divergences")
    void normalize_aliases(String code, String expected) {
        assertEquals(expected, EffectStatCodec.normalize(code));
    }

    @Test
    @DisplayName("an unknown code is lowercased, not rejected: the engine treats it as noise")
    void normalize_unknownIsLowercasedNotRejected() {
        assertEquals("health", EffectStatCodec.normalize("HEALTH"));
        assertFalse(EffectStatCodec.isKnown("HEALTH"));
    }

    @Test
    void normalize_nullAndBlank() {
        assertNull(EffectStatCodec.normalize(null));
        assertNull(EffectStatCodec.normalize("   "));
        assertFalse(EffectStatCodec.isKnown(null));
        assertFalse(EffectStatCodec.isKnown(""));
    }

    @Test
    void isKnown_acceptsEveryEngineToken() {
        for (String code : new String[]{"LIFE", "ENERGY", "SADNESS", "EXP", "DEX", "INT", "COS",
                                        "FOOD", "MAGIC", "COIN"}) {
            assertTrue(EffectStatCodec.isKnown(code), code + " must be a known effect code");
        }
    }
}
