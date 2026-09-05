package games.paths.core.service.auth;

import games.paths.core.model.auth.GuestInfo;
import games.paths.core.model.auth.GuestInfoPage;
import games.paths.core.model.auth.GuestListFilter;
import games.paths.core.model.auth.GuestStats;
import games.paths.core.model.auth.StaleGuestsSummary;
import games.paths.core.port.auth.GuestAdminPersistencePort;
import games.paths.core.port.auth.GuestAdminPort;
import games.paths.core.port.match.MatchPersistencePort;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * GuestAdminService - Domain service implementing guest administration.
 * This is pure domain logic with no Spring/framework dependency.
 * Ports are injected via constructor by the launcher configuration.
 */
public class GuestAdminService implements GuestAdminPort {

    /** Page size when the caller names none, and the ceiling whatever it names. */
    private static final int DEFAULT_PAGE_LIMIT = 50;
    private static final int MAX_PAGE_LIMIT = 200;

    private final GuestAdminPersistencePort persistencePort;
    /** Null on the bare constructor: the stale purge then refuses rather than orphaning matches. */
    private final MatchPersistencePort matchPersistencePort;

    public GuestAdminService(GuestAdminPersistencePort persistencePort) {
        this(persistencePort, null);
    }

    public GuestAdminService(GuestAdminPersistencePort persistencePort,
                             MatchPersistencePort matchPersistencePort) {
        this.persistencePort = persistencePort;
        this.matchPersistencePort = matchPersistencePort;
    }

    @Override
    public GuestInfoPage listGuestsPage(GuestListFilter filter) {
        GuestListFilter f = filter == null ? new GuestListFilter(null, null, null) : filter;
        int limit = clampLimit(f.limit());
        String[] cursor = decodeCursor(f.cursor());
        // Over-fetch one row to learn whether a further page exists.
        List<Map<String, Object>> rows = persistencePort.findGuestsPage(
                boundOf(f.olderThanDays()),
                cursor == null ? null : cursor[0],
                cursor == null ? null : Long.valueOf(cursor[1]),
                limit + 1);
        boolean hasMore = rows.size() > limit;
        List<Map<String, Object>> pageRows = hasMore ? rows.subList(0, limit) : rows;
        List<GuestInfo> items = new ArrayList<>();
        for (Map<String, Object> row : pageRows) {
            items.add(toGuestInfo(row));
        }
        String nextCursor = null;
        if (hasMore && !pageRows.isEmpty()) {
            Map<String, Object> last = pageRows.get(pageRows.size() - 1);
            nextCursor = encodeCursor(seenAt(last), last.get("id"));
        }
        return new GuestInfoPage(items, nextCursor, limit);
    }

    @Override
    public StaleGuestsSummary previewStaleGuests(int olderThanDays) {
        List<Long> ids = persistencePort.findGuestIdsWithLastAccessBefore(boundOf(olderThanDays));
        if (ids.isEmpty() || matchPersistencePort == null) {
            return new StaleGuestsSummary(ids.size(), 0);
        }
        return new StaleGuestsSummary(ids.size(),
                matchPersistencePort.countMatchesByUserCreatorIds(ids));
    }

    @Override
    public StaleGuestsSummary deleteStaleGuests(int olderThanDays) {
        List<Long> ids = persistencePort.findGuestIdsWithLastAccessBefore(boundOf(olderThanDays));
        if (ids.isEmpty()) {
            return new StaleGuestsSummary(0, 0);
        }
        // Matches before guests: a match references its creator by foreign key, so the
        // children must go first — the ordering TestDataCleanupService already relies on.
        int matches = matchPersistencePort == null ? 0
                : matchPersistencePort.deleteMatchesByUserCreatorIds(ids);
        return new StaleGuestsSummary(persistencePort.deleteGuestsByIds(ids), matches);
    }

    /** The ISO-8601 instant N days ago, or null when the caller named no bound. */
    private static String boundOf(Integer olderThanDays) {
        if (olderThanDays == null || olderThanDays < 0) {
            return null;
        }
        return Instant.now().minus(olderThanDays, ChronoUnit.DAYS).toString();
    }

    /** When a guest was last seen: its last access, or its registration if it never came back. */
    private static String seenAt(Map<String, Object> row) {
        Object last = row.get("tsLastAccess");
        return last != null ? last.toString() : String.valueOf(row.get("tsRegistration"));
    }

    private static int clampLimit(Integer requested) {
        if (requested == null) {
            return DEFAULT_PAGE_LIMIT;
        }
        return Math.max(1, Math.min(requested, MAX_PAGE_LIMIT));
    }

    /** The same opaque {@code "<timestamp>|<id>"} token the admin match list uses. */
    static String encodeCursor(String seenAt, Object id) {
        return java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(
                (seenAt + "|" + id).getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    /** Null for a missing or malformed token, so the query restarts at page one, never fails. */
    static String[] decodeCursor(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return null;
        }
        try {
            String raw = new String(java.util.Base64.getUrlDecoder().decode(cursor),
                    java.nio.charset.StandardCharsets.UTF_8);
            int sep = raw.lastIndexOf('|');
            if (sep <= 0 || sep == raw.length() - 1) {
                return null;
            }
            String idPart = raw.substring(sep + 1);
            Long.parseLong(idPart);
            return new String[]{raw.substring(0, sep), idPart};
        } catch (IllegalArgumentException notACursor) {
            return null;
        }
    }

    @Override
    public List<GuestInfo> listAllGuests() {
        List<Map<String, Object>> guests = persistencePort.findAllGuests();
        return guests.stream()
                .map(this::toGuestInfo)
                .collect(Collectors.toList());
    }

    @Override
    public GuestInfo getGuestByUuid(String uuid) {
        if (uuid == null || uuid.isBlank()) {
            return null;
        }
        Map<String, Object> guest = persistencePort.findGuestByUuid(uuid);
        if (guest == null) {
            return null;
        }
        return toGuestInfo(guest);
    }

    @Override
    public boolean deleteGuest(String uuid) {
        if (uuid == null || uuid.isBlank()) {
            return false;
        }
        return persistencePort.deleteGuestByUuid(uuid);
    }

    @Override
    public int deleteExpiredGuests() {
        return persistencePort.deleteExpiredGuests();
    }

    @Override
    public GuestStats getGuestStats() {
        long total = persistencePort.countAllGuests();
        long active = persistencePort.countActiveGuests();
        long expired = persistencePort.countExpiredGuests();
        return new GuestStats(total, active, expired);
    }

    /**
     * Converts a persistence map to a GuestInfo domain model.
     */
    private GuestInfo toGuestInfo(Map<String, Object> data) {
        String expiresAt = (String) data.get("guestExpiresAt");
        boolean expired = isExpired(expiresAt);

        return new GuestInfo(
                (String) data.get("uuid"),
                (String) data.get("username"),
                (String) data.get("nickname"),
                (String) data.get("role"),
                data.get("state") != null ? ((Number) data.get("state")).intValue() : 6,
                (String) data.get("guestCookieToken"),
                expiresAt,
                (String) data.get("language"),
                (String) data.get("tsRegistration"),
                (String) data.get("tsLastAccess"),
                expired);
    }

    private boolean isExpired(String expiresAt) {
        if (expiresAt == null || expiresAt.isBlank()) {
            return false;
        }
        try {
            return Instant.now().isAfter(Instant.parse(expiresAt));
        } catch (Exception e) {
            return false;
        }
    }
}
