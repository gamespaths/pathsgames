package games.paths.core.service.security;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * LogSanitizer - v1.2.0 redacts personal data before a log line is written: the keys email,
 * given_name, family_name, name, picture (and their camelCase forms) and any email address.
 */
public final class LogSanitizer {

    public static final String REDACTED = "[REDACTED]";
    static final Set<String> KEYS = Set.of("email", "email_address", "emailaddress", "given_name", "givenname",
            "family_name", "familyname", "name", "profile_name", "profilename", "picture", "picture_url",
            "pictureurl");
    private static final Pattern EMAIL = Pattern.compile("[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}");
    private static final Pattern PAIR = Pattern.compile(
            "(\"?)([A-Za-z_]+)(\"?\\s*[:=]\\s*)(\"[^\"]*\"|'[^']*'|[^,;}\\s]+)");

    private LogSanitizer() {
    }

    public static boolean isSensitiveKey(String key) {
        return key != null && KEYS.contains(key.toLowerCase());
    }

    /** A copy of the map with every sensitive value (nested maps and lists too) replaced. */
    public static Map<String, Object> sanitize(Map<String, ?> data) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (data == null) {
            return out;
        }
        data.forEach((k, v) -> out.put(k, isSensitiveKey(k) ? REDACTED : sanitizeValue(v)));
        return out;
    }

    /** key=value / "key": "value" pairs with a sensitive key and every email address redacted. */
    public static String sanitize(String text) {
        if (text == null) {
            return null;
        }
        Matcher m = PAIR.matcher(text);
        StringBuilder sb = new StringBuilder();
        while (m.find()) {
            String replacement = isSensitiveKey(m.group(2))
                    ? m.group(1) + m.group(2) + m.group(3) + REDACTED : m.group(0);
            m.appendReplacement(sb, Matcher.quoteReplacement(replacement));
        }
        m.appendTail(sb);
        return EMAIL.matcher(sb.toString()).replaceAll(REDACTED);
    }

    @SuppressWarnings("unchecked")
    private static Object sanitizeValue(Object v) {
        if (v instanceof Map<?, ?> map) {
            return sanitize((Map<String, ?>) map);
        }
        if (v instanceof Collection<?> list) {
            return list.stream().map(LogSanitizer::sanitizeValue).toList();
        }
        if (v instanceof String s) {
            return EMAIL.matcher(s).replaceAll(REDACTED);
        }
        return v;
    }

    /** Convenience for a list of maps. */
    public static List<Map<String, Object>> sanitizeAll(List<Map<String, Object>> rows) {
        return rows == null ? List.of() : rows.stream().map(LogSanitizer::sanitize).toList();
    }
}
