package games.paths.core.service.security;

import java.time.Clock;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * RateLimitService - Step 41: fixed-window request counters keyed by bucket and caller.
 * A limit of zero or less disables a bucket, which is the dev / Robot default.
 */
public class RateLimitService {

    /** The verdict of one attempt: whether it passed and, when it did not, how long to wait. */
    public record Verdict(boolean allowed, int limit, int remaining, long retryAfterSeconds) {
        public static Verdict unlimited() {
            return new Verdict(true, 0, Integer.MAX_VALUE, 0);
        }
    }

    private static final int SWEEP_EVERY = 1024;

    private final long windowMillis;
    private final Clock clock;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();
    private final AtomicInteger calls = new AtomicInteger();

    public RateLimitService(int windowSeconds) {
        this(windowSeconds, Clock.systemUTC());
    }

    public RateLimitService(int windowSeconds, Clock clock) {
        this.windowMillis = Math.max(1, windowSeconds) * 1000L;
        this.clock = clock;
    }

    /**
     * Count one attempt of {@code key} in {@code bucket} against {@code limit}.
     * The attempt is counted whether or not it is allowed, so a caller hammering a closed
     * window keeps it closed; a blank key (no client address) is never limited.
     */
    public Verdict tryAcquire(String bucket, String key, int limit) {
        if (limit <= 0 || key == null || key.isBlank()) {
            return Verdict.unlimited();
        }
        long now = clock.millis();
        sweepOccasionally(now);
        Window w = windows.compute(bucket + "|" + key.trim(), (k, current) ->
                current == null || current.expired(now) ? new Window(now) : current);
        int count = w.count.incrementAndGet();
        long retryAfter = Math.max(1, (w.start + windowMillis - now + 999) / 1000);
        return new Verdict(count <= limit, limit, Math.max(0, limit - count), retryAfter);
    }

    /** Forget every window. */
    public void reset() {
        windows.clear();
    }

    /** The address a request comes from: the first X-Forwarded-For hop, else the socket peer. */
    public static String clientIp(String forwardedFor, String remoteAddr) {
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            String first = forwardedFor.split(",")[0].trim();
            if (!first.isEmpty()) {
                return first;
            }
        }
        return remoteAddr == null ? "" : remoteAddr.trim();
    }

    private void sweepOccasionally(long now) {
        if (calls.incrementAndGet() % SWEEP_EVERY == 0) {
            windows.entrySet().removeIf(e -> e.getValue().expired(now));
        }
    }

    private final class Window {
        private final long start;
        private final AtomicInteger count = new AtomicInteger();

        private Window(long start) {
            this.start = start;
        }

        private boolean expired(long now) {
            return now - start >= windowMillis;
        }
    }
}
