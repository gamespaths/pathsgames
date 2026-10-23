package games.paths.core.model.match;

import java.time.Instant;

/**
 * RequestStamp - v1.7.0 one timestamp per request: every match write of the request stamps the same value.
 * Opened and closed by the web filter (with the If-Match header); outside a request every call answers now.
 */
public final class RequestStamp {

    private static final ThreadLocal<Context> CURRENT = new ThreadLocal<>();

    private RequestStamp() {
    }

    /** The open request: its stamp, the If-Match version sent by the client and the match claimed. */
    private static final class Context {
        private String stamp = Instant.now().toString();
        private String ifMatch;
        private String claimedMatch;
        private String claimedVersion;
        private String seenMatch;
        private String seenVersion;
    }

    public static void open() {
        open(null);
    }

    /** Opens the request with the If-Match header value (quotes, W/ and "*" mean as usual). */
    public static void open(String ifMatch) {
        Context ctx = new Context();
        ctx.ifMatch = normalizeIfMatch(ifMatch);
        CURRENT.set(ctx);
    }

    public static void close() {
        CURRENT.remove();
    }

    /** The stamp of the running request, or now when there is none. */
    public static String now() {
        Context ctx = CURRENT.get();
        return ctx != null ? ctx.stamp : Instant.now().toString();
    }

    /** The version the client says it is looking at, null when absent or "*". */
    public static String ifMatch() {
        Context ctx = CURRENT.get();
        return ctx != null ? ctx.ifMatch : null;
    }

    /** v1.7.0 step 8 - records the version read at request start: the claim compares against it. */
    public static void recordSeen(String matchUuid, String version) {
        Context ctx = CURRENT.get();
        if (ctx != null) {
            ctx.seenMatch = matchUuid;
            ctx.seenVersion = version;
        }
    }

    /** The version this request read on the match before its checks, null otherwise. */
    public static String seenVersion(String matchUuid) {
        Context ctx = CURRENT.get();
        return ctx != null && matchUuid != null && matchUuid.equals(ctx.seenMatch) ? ctx.seenVersion : null;
    }

    /** v1.7.0 step 8 - records the claim: the new version becomes the stamp of every later write. */
    public static void recordClaim(String matchUuid, String version) {
        Context ctx = CURRENT.get();
        if (ctx != null) {
            ctx.claimedMatch = matchUuid;
            ctx.claimedVersion = version;
            ctx.stamp = version;
        }
    }

    /** The version this request already claimed on the match, null otherwise. */
    public static String claimedVersion(String matchUuid) {
        Context ctx = CURRENT.get();
        return ctx != null && matchUuid != null && matchUuid.equals(ctx.claimedMatch) ? ctx.claimedVersion : null;
    }

    /** The version claimed by this request on any match, null when nothing was claimed. */
    public static String claimedVersion() {
        Context ctx = CURRENT.get();
        return ctx != null ? ctx.claimedVersion : null;
    }

    static String normalizeIfMatch(String raw) {
        if (raw == null) {
            return null;
        }
        String v = raw.trim();
        if (v.startsWith("W/")) {
            v = v.substring(2).trim();
        }
        if (v.length() >= 2 && v.startsWith("\"") && v.endsWith("\"")) {
            v = v.substring(1, v.length() - 1);
        }
        return v.isEmpty() || "*".equals(v) ? null : v;
    }
}
