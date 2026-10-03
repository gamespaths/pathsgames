package games.paths.core.model.story;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * StoryUuid - the story identifier accepted by the import: 8-4-4-4-12 hex, stored lowercase.
 * Input is trimmed and lowercased first; no RFC 4122 version check (demo stories would fail it).
 */
public final class StoryUuid {

    /** Same shape as {@code $defs.uuid} in match-export-v1.schema.json. */
    private static final Pattern PATTERN =
            Pattern.compile("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$");

    private StoryUuid() {
    }

    /** Trimmed and lowercased value, or {@code null} when absent or blank (the import mints one). */
    public static String normalize(Object raw) {
        if (raw == null) {
            return null;
        }
        String value = raw.toString().trim();
        return value.isEmpty() ? null : value.toLowerCase(Locale.ROOT);
    }

    /** True when the value is a normalized story uuid. */
    public static boolean isValid(String value) {
        return value != null && PATTERN.matcher(value).matches();
    }
}
