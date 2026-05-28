package games.paths.core.model.match;

import java.util.ArrayList;
import java.util.List;

/**
 * MatchTraitCodec - converts the match trait-uuid selection between the
 * domain representation ({@code List<String>}) and the comma-separated
 * string persisted in {@code gaming_match.trait_uuids}.
 *
 * <p>Step 0.19.9 — trait selection added to the match creation request.</p>
 */
public final class MatchTraitCodec {

    private MatchTraitCodec() {
    }

    /**
     * Joins trait uuids into a comma-separated string. Blank entries are
     * dropped; an empty or null input yields {@code null}.
     */
    public static String join(List<String> traitUuids) {
        if (traitUuids == null || traitUuids.isEmpty()) {
            return null;
        }
        List<String> cleaned = new ArrayList<>();
        for (String t : traitUuids) {
            if (t != null && !t.isBlank()) {
                cleaned.add(t.trim());
            }
        }
        return cleaned.isEmpty() ? null : String.join(",", cleaned);
    }

    /**
     * Splits a comma-separated string into trait uuids. A blank or null
     * input yields an empty (mutable) list.
     */
    public static List<String> split(String csv) {
        List<String> result = new ArrayList<>();
        if (csv == null || csv.isBlank()) {
            return result;
        }
        for (String part : csv.split(",")) {
            if (part != null && !part.isBlank()) {
                result.add(part.trim());
            }
        }
        return result;
    }
}
