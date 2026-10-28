package games.paths.adapters.rest.filter;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;

/**
 * RequestPaths - v1.10.0 the path a request is routed on, the same one Spring MVC matches (decoded, no
 * ;parameters, single slashes), and the raw URIs refused before any filter decides on a path.
 */
public final class RequestPaths {

    private static final String UNRESERVED = "-._~";
    private static final String NEVER_ENCODED = "/\\;%";

    private RequestPaths() {
    }

    /** The routed path of the request, without the context path; null when the request has no URI. */
    public static String routed(HttpServletRequest request) {
        String uri = request.getRequestURI();
        if (uri == null) {
            return null;
        }
        String context = request.getContextPath();
        String path = context != null && !context.isEmpty() && uri.startsWith(context)
                ? uri.substring(context.length()) : uri;
        return normalize(path);
    }

    /** Decoded, without ;parameters and with single slashes; an unreadable escape leaves it undecoded. */
    static String normalize(String rawPath) {
        String plain = rawPath.replaceAll(";[^/]*", "");
        try {
            plain = UriUtils.decode(plain, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException unreadable) {
            // refused by isSuspicious anyway
        }
        return plain.replaceAll("/{2,}", "/");
    }

    /**
     * True for a raw path a filter could read differently from Spring: a ';', a '\', a dot segment, a broken
     * escape or an escape of a character that never needs one (letters, digits, -._~, / \ ; % and controls).
     */
    public static boolean isSuspicious(String rawPath) {
        if (rawPath == null) {
            return false;
        }
        if (rawPath.indexOf(';') >= 0 || rawPath.indexOf('\\') >= 0) {
            return true;
        }
        for (int i = rawPath.indexOf('%'); i >= 0; i = rawPath.indexOf('%', i + 1)) {
            int value = i + 2 < rawPath.length() ? hex(rawPath.charAt(i + 1), rawPath.charAt(i + 2)) : -1;
            // a broken escape is -1, so below 0x20 too
            if (value < 0x20 || value == 0x7F || (value < 0x80 && Character.isLetterOrDigit(value))
                    || UNRESERVED.indexOf(value) >= 0 || NEVER_ENCODED.indexOf(value) >= 0) {
                return true;
            }
        }
        for (String segment : rawPath.split("/")) {
            if (segment.equals(".") || segment.equals("..")) {
                return true;
            }
        }
        return false;
    }

    private static int hex(char high, char low) {
        int h = Character.digit(high, 16);
        int l = Character.digit(low, 16);
        return h < 0 || l < 0 ? -1 : h * 16 + l;
    }
}
