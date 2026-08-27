package games.paths.core.model.match;

import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * EffectStatCodec - translates a {@code list_items_effects.effect_code} into the
 * statistic token the effect engine speaks.
 *
 * <p>Step 34. The two tables disagree on spelling, and only on one word. The
 * schema documents {@code effect_code} as {@code LIFE, ENERGY, EXP, SADNESS,
 * DEX, INT, COS, FOOD, MAGIC, COIN} while {@code list_events_effects.statistics}
 * — the vocabulary the engine's {@code applyStat} switches on — spells the
 * sadness axis {@code sad}. Every other code differs only by case, and the
 * engine already lowercases what it receives, so the whole mapping table is one
 * alias.</p>
 *
 * <p>This is deliberately applied on the ITEM path only. Normalising inside the
 * engine would silently start accepting {@code statistics = 'SADNESS'} on
 * {@code list_events_effects} and {@code list_choices_effects} too, widening a
 * vocabulary the schema freezes and diverging from the python and AWS twins.</p>
 */
public final class EffectStatCodec {

    /** The single genuine divergence between the two spellings. */
    private static final Map<String, String> ALIASES = Map.of(
            "sadness", "sad",
            "coins", "coin");

    /** The statistic tokens the engine actually acts on; anything else is authored noise. */
    private static final Set<String> KNOWN = Set.of(
            "life", "energy", "sad", "exp", "dex", "int", "cos", "food", "magic", "coin");

    private EffectStatCodec() {
    }

    /**
     * Case-insensitive translation. An unknown code is returned lowercased rather
     * than rejected, so the engine's {@code default -> } branch keeps treating it
     * as authored noise instead of failing the whole item usage. Never throws.
     *
     * @return the engine token, or {@code null} for a null or blank input
     */
    public static String normalize(String effectCode) {
        if (effectCode == null || effectCode.isBlank()) {
            return null;
        }
        String key = effectCode.trim().toLowerCase(Locale.ROOT);
        return ALIASES.getOrDefault(key, key);
    }

    /** Whether {@link #normalize(String)} of this code lands on a token the engine acts on. */
    public static boolean isKnown(String effectCode) {
        String normalized = normalize(effectCode);
        return normalized != null && KNOWN.contains(normalized);
    }
}
