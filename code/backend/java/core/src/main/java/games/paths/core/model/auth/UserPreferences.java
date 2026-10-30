package games.paths.core.model.auth;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * UserPreferences - v1.7.0 the preferences of a user (users.language, users.theme_selected) and the
 * parsing of the supported-languages and supported-themes list parameters.
 */
public record UserPreferences(String language, String theme) {

    public static final String THEME_DEFAULT = "default";
    public static final String THEME_HIGH_CONTRAST = "high-contrast";
    public static final List<String> DEFAULT_LANGUAGES = List.of("en", "it");
    public static final List<String> DEFAULT_THEMES = List.of(THEME_DEFAULT, THEME_HIGH_CONTRAST);

    public boolean highContrast() {
        return THEME_HIGH_CONTRAST.equals(theme);
    }

    /** A comma-separated list, trimmed, lowercase, without blanks or duplicates; the fallback when empty. */
    public static List<String> parseList(String csv, List<String> fallback) {
        if (csv == null || csv.isBlank()) {
            return fallback;
        }
        List<String> out = Arrays.stream(csv.split(",")).map(s -> s.trim().toLowerCase(Locale.ROOT))
                .filter(s -> !s.isEmpty()).distinct().toList();
        return out.isEmpty() ? fallback : out;
    }
}
