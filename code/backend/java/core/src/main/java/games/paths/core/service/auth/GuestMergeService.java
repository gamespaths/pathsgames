package games.paths.core.service.auth;

import games.paths.core.model.auth.MatchOwnership;
import games.paths.core.model.auth.MergeResult;
import games.paths.core.model.match.MatchStatuses;
import games.paths.core.port.auth.GuestMergePersistencePort;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * GuestMergeService - v1.2.0 links the current guest to the Google user at login: its matches move to
 * the user; per story the STARTED match with the latest ts_update wins, the others become CANCELLED.
 */
public class GuestMergeService {

    private final GuestMergePersistencePort port;

    public GuestMergeService(GuestMergePersistencePort port) {
        this.port = port;
    }

    /** Merges the guest into the target user in one transaction; the empty guest is deleted. */
    public MergeResult merge(long guestUserId, long targetUserId) {
        if (guestUserId == targetUserId) {
            return MergeResult.none();
        }
        List<MatchOwnership> all = new ArrayList<>(port.matchesOfUser(targetUserId));
        all.addAll(port.matchesOfUser(guestUserId));
        List<Long> cancel = matchesToCancel(all);
        int moved = port.applyMerge(guestUserId, targetUserId, cancel, Instant.now().toString());
        return new MergeResult(moved, cancel);
    }

    /** Ended and completed matches are kept; of the STARTED ones of one story only the latest survives. */
    static List<Long> matchesToCancel(List<MatchOwnership> matches) {
        Map<Long, List<MatchOwnership>> byStory = new LinkedHashMap<>();
        for (MatchOwnership m : matches) {
            if (MatchStatuses.isActive(m.status())) {
                byStory.computeIfAbsent(m.storyId(), k -> new ArrayList<>()).add(m);
            }
        }
        Comparator<MatchOwnership> latest = Comparator
                .comparingLong((MatchOwnership m) -> epochMillis(m.tsUpdate()))
                .thenComparingLong(MatchOwnership::id);
        List<Long> cancel = new ArrayList<>();
        for (List<MatchOwnership> started : byStory.values()) {
            if (started.size() > 1) {
                MatchOwnership winner = started.stream().max(latest).orElseThrow();
                started.stream().filter(m -> m.id() != winner.id()).forEach(m -> cancel.add(m.id()));
            }
        }
        return cancel;
    }

    /** ISO-8601 or SQLite "yyyy-MM-dd HH:mm:ss" (UTC) to epoch millis; 0 when unreadable. */
    static long epochMillis(String ts) {
        if (ts == null || ts.isBlank()) {
            return 0;
        }
        String iso = ts.trim().replace(' ', 'T');
        if (!iso.endsWith("Z") && !iso.matches(".*[+-]\\d{2}:?\\d{2}$")) {
            iso = iso + "Z";
        }
        try {
            return java.time.OffsetDateTime.parse(iso).toInstant().toEpochMilli();
        } catch (java.time.format.DateTimeParseException e) {
            return 0;
        }
    }
}
