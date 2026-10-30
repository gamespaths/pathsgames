package games.paths.adapters.rest.controller;

/**
 * QueryLimits - v1.11.0 a ?limit= that is not an integer reads as absent (the default page), like a broken
 * cursor; the same rule on Java, Python and AWS instead of a framework 400/422.
 */
public final class QueryLimits {

    private QueryLimits() {
    }

    public static Integer parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Integer.valueOf(raw.trim());
        } catch (NumberFormatException notANumber) {
            return null;
        }
    }
}
