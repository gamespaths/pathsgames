package games.paths.core.service.auth;

import games.paths.core.model.auth.MatchOwnership;
import games.paths.core.model.auth.MergeResult;
import games.paths.core.model.match.MatchStatuses;
import games.paths.core.port.auth.GuestMergePersistencePort;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * GuestMergeService - v1.2.0 links the current guest to the Google user at login: its matches move to the
 * user. v1.7.0 step 9: per story the Google user's active match always wins, the guest's become CANCELLED.
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
        List<MatchOwnership> target = port.matchesOfUser(targetUserId);
        List<MatchOwnership> guest = port.matchesOfUser(guestUserId);
        List<MatchOwnership> cancel = matchesToCancel(target, guest);
        List<Long> ids = cancel.stream().map(MatchOwnership::id).toList();
        int moved = port.applyMerge(guestUserId, targetUserId, ids, Instant.now().toString());
        return new MergeResult(moved, ids, cancel.stream().map(MatchOwnership::uuid).toList());
    }

    /**
     * Ended and completed matches are kept. Per story: when the Google user has an active match every active
     * guest match of that story is cancelled; otherwise the guest's survives. Inside one side only the latest
     * ts_update stays (safety net: the duplicate guard already allows one active match per story).
     */
    static List<MatchOwnership> matchesToCancel(List<MatchOwnership> target, List<MatchOwnership> guest) {
        Map<Long, List<MatchOwnership>> targetActive = activeByStory(target);
        Map<Long, List<MatchOwnership>> guestActive = activeByStory(guest);
        Set<MatchOwnership> cancel = new LinkedHashSet<>();
        cancel.addAll(olderOfEachStory(targetActive));
        for (Map.Entry<Long, List<MatchOwnership>> e : guestActive.entrySet()) {
            if (targetActive.containsKey(e.getKey())) {
                cancel.addAll(e.getValue());
            } else {
                cancel.addAll(olderOfEachStory(Map.of(e.getKey(), e.getValue())));
            }
        }
        return new ArrayList<>(cancel);
    }

    private static Map<Long, List<MatchOwnership>> activeByStory(List<MatchOwnership> matches) {
        Map<Long, List<MatchOwnership>> byStory = new LinkedHashMap<>();
        for (MatchOwnership m : matches != null ? matches : List.<MatchOwnership>of()) {
            if (MatchStatuses.isActive(m.status())) {
                byStory.computeIfAbsent(m.storyId(), k -> new ArrayList<>()).add(m);
            }
        }
        return byStory;
    }

    /** Of the active matches of one story all but the latest (ties: the higher id). */
    private static List<MatchOwnership> olderOfEachStory(Map<Long, List<MatchOwnership>> byStory) {
        Comparator<MatchOwnership> latest = Comparator
                .comparingLong((MatchOwnership m) -> epochMillis(m.tsUpdate()))
                .thenComparingLong(MatchOwnership::id);
        List<MatchOwnership> older = new ArrayList<>();
        for (List<MatchOwnership> started : byStory.values()) {
            MatchOwnership winner = started.stream().max(latest).orElseThrow();
            started.stream().filter(m -> m.id() != winner.id()).forEach(older::add);
        }
        return older;
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
