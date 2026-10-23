package games.paths.core.service.match;

import games.paths.core.model.match.RequestStamp;
import games.paths.core.model.match.StaleMatchException;
import games.paths.core.port.match.MatchStampPort;
import games.paths.core.port.match.MatchStampStorePort;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoField;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

/**
 * MatchStampService - v1.7.0 one stamp per request; a gameplay write claims it first (step 8, compare-and-set
 * on ts_update) and adds play_ms += min(stamp - previous ts_update, cap).
 */
public class MatchStampService implements MatchStampPort {

    public static final long DEFAULT_CAP_SECONDS = 300;

    private static final DateTimeFormatter SQL_TIME = new DateTimeFormatterBuilder()
            .appendPattern("yyyy-MM-dd HH:mm:ss")
            .optionalStart().appendFraction(ChronoField.NANO_OF_SECOND, 0, 9, true).optionalEnd()
            .toFormatter();

    private final MatchStampStorePort store;
    private final long capMs;

    public MatchStampService(MatchStampStorePort store, long capSeconds) {
        this.store = store;
        this.capMs = (capSeconds > 0 ? capSeconds : DEFAULT_CAP_SECONDS) * 1000L;
    }

    public long capMs() {
        return capMs;
    }

    @Override
    public String checkGameplay(String matchUuid) {
        if (matchUuid == null || matchUuid.isBlank()) {
            return null;
        }
        String known = RequestStamp.claimedVersion(matchUuid);
        if (known == null) {
            known = RequestStamp.seenVersion(matchUuid);
        }
        if (known != null) {
            return known;
        }
        Optional<String> current = store.findTsUpdate(matchUuid);
        if (current.isEmpty()) {
            return null;
        }
        String seen = current.get();
        String expected = RequestStamp.ifMatch();
        if (expected != null && !expected.equals(seen)) {
            throw new StaleMatchException(matchUuid, seen);
        }
        RequestStamp.recordSeen(matchUuid, seen);
        return seen;
    }

    @Override
    public String claimGameplay(String matchUuid) {
        if (matchUuid == null || matchUuid.isBlank()) {
            return null;
        }
        String already = RequestStamp.claimedVersion(matchUuid);
        if (already != null) {
            return already;
        }
        String old = checkGameplay(matchUuid);
        if (old == null) {
            return null;
        }
        String next = nextVersion(old, RequestStamp.now());
        if (!store.claim(matchUuid, old, next, playDelta(old, next, capMs))) {
            throw new StaleMatchException(matchUuid, store.findTsUpdate(matchUuid).orElse(null));
        }
        RequestStamp.recordClaim(matchUuid, next);
        return next;
    }

    @Override
    public void touchAdmin(String matchUuid) {
        if (matchUuid == null || matchUuid.isBlank()) {
            return;
        }
        String old = store.findTsUpdate(matchUuid).orElse(null);
        store.stamp(matchUuid, nextVersion(old, RequestStamp.now()), 0L);
    }

    /** The new version: the request stamp, or old + 1 microsecond when the clock did not move past old. */
    public static String nextVersion(String old, String stamp) {
        Instant previous = parse(old);
        Instant now = parse(stamp);
        if (now == null) {
            now = Instant.now();
            stamp = now.toString();
        }
        if (previous == null || now.isAfter(previous)) {
            return stamp;
        }
        return previous.truncatedTo(ChronoUnit.MICROS).plus(1, ChronoUnit.MICROS).toString();
    }

    /** The play time one write adds: the gap since the previous stamp, never negative, at most the cap. */
    public static long playDelta(String previous, String now, long capMs) {
        Instant from = parse(previous);
        Instant to = parse(now);
        if (from == null || to == null) {
            return 0L;
        }
        long gap = to.toEpochMilli() - from.toEpochMilli();
        return Math.max(0L, Math.min(gap, capMs));
    }

    /** v1.7.0 step 9 - a stored timestamp as ISO-8601 UTC ("...Z"); the raw text when unreadable. */
    public static String isoUtc(String text) {
        Instant parsed = parse(text);
        return parsed != null ? parsed.toString() : text;
    }

    /** ISO-8601 instants, offsets and the SQL "yyyy-MM-dd HH:mm:ss[.f]" form (read as UTC); null otherwise. */
    static Instant parse(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String t = text.trim();
        try {
            return Instant.parse(t);
        } catch (DateTimeParseException ignored) {
            // not an instant: try the other stored forms
        }
        try {
            return OffsetDateTime.parse(t.replace(' ', 'T').replaceAll("([+-]\\d\\d)$", "$1:00")).toInstant();
        } catch (DateTimeParseException ignored) {
            // no offset: SQL local time, stored in UTC
        }
        try {
            return LocalDateTime.parse(t, SQL_TIME).toInstant(ZoneOffset.UTC);
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
