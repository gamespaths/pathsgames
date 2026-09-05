package games.paths.adapters.admin.controller.auth;

import games.paths.adapters.admin.AdminConstant;
import games.paths.adapters.admin.dto.auth.GuestInfoResponse;
import games.paths.adapters.admin.dto.auth.GuestStatsResponse;
import games.paths.core.model.auth.GuestInfo;
import games.paths.core.model.auth.GuestInfoPage;
import games.paths.core.model.auth.GuestListFilter;
import games.paths.core.model.auth.GuestStats;
import games.paths.core.model.auth.StaleGuestsSummary;
import games.paths.core.port.auth.GuestAdminPort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * GuestAdminController - REST adapter for guest user administration.
 * GET /api/admin/guests → one page of guest users (v0.36.2)
 * GET /api/admin/guests/stats → guest statistics
 * GET|DELETE /api/admin/guests/stale → preview / purge guests not seen for N days, matches included
 * GET /api/admin/guests/{uuid} → get a single guest
 * DELETE /api/admin/guests/{uuid} → delete a single guest
 * DELETE /api/admin/guests/expired → cleanup expired guests
 */
@RestController
@RequestMapping("/api/admin/guests")
public class GuestAdminController {

    private final GuestAdminPort guestAdminPort;

    public GuestAdminController(GuestAdminPort guestAdminPort) {
        this.guestAdminPort = guestAdminPort;
    }

    /**
     * GET /api/admin/guests — v0.36.2, one page at a time, most recently seen first.
     *
     * <p>Answers the {@code {items, nextCursor, limit}} envelope the admin match list already
     * uses. Before this the endpoint returned the whole table, which on the AWS backend is a
     * full-table scan and timed out at 15s. All parameters are optional:</p>
     * <ul>
     *   <li>{@code limit} — page size (default 50, max 200);</li>
     *   <li>{@code cursor} — opaque token from a previous {@code nextCursor};</li>
     *   <li>{@code olderThanDays} — only guests not seen for at least N days.</li>
     * </ul>
     */
    @GetMapping
    public ResponseEntity<Object> listAllGuests(
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) Integer olderThanDays) {
        GuestInfoPage page = guestAdminPort.listGuestsPage(
                new GuestListFilter(olderThanDays, cursor, limit));
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("items", page.items().stream().map(this::toResponse).collect(Collectors.toList()));
        body.put("nextCursor", page.nextCursor());
        body.put("limit", page.limit());
        return ResponseEntity.ok(body);
    }

    /**
     * GET /api/admin/guests/stale?olderThanDays=N — the dry run: how many guests, and how many
     * of their matches, the deletion below would take. The console shows this before asking.
     */
    @GetMapping("/stale")
    public ResponseEntity<Object> previewStaleGuests(
            @RequestParam(required = false) Integer olderThanDays) {
        if (olderThanDays == null || olderThanDays < 0) {
            return badOlderThanDays();
        }
        return ResponseEntity.ok(staleBody(guestAdminPort.previewStaleGuests(olderThanDays)));
    }

    /**
     * DELETE /api/admin/guests/stale?olderThanDays=N — remove every guest not seen for N days
     * AND every match they created, whatever its status. Matches go first: a match references
     * its creator by foreign key. Distinct from {@code DELETE /expired}, which only ever
     * removes sessions whose own expiry has passed and never touches a match.
     */
    @DeleteMapping("/stale")
    public ResponseEntity<Object> deleteStaleGuests(
            @RequestParam(required = false) Integer olderThanDays) {
        if (olderThanDays == null || olderThanDays < 0) {
            return badOlderThanDays();
        }
        StaleGuestsSummary summary = guestAdminPort.deleteStaleGuests(olderThanDays);
        Map<String, Object> body = staleBody(summary);
        body.put(AdminConstant.KEY_STATUS, "CLEANUP_COMPLETE");
        return ResponseEntity.ok(body);
    }

    private static Map<String, Object> staleBody(StaleGuestsSummary summary) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("guests", summary.guests());
        body.put("matches", summary.matches());
        return body;
    }

    private static ResponseEntity<Object> badOlderThanDays() {
        Map<String, Object> error = new LinkedHashMap<>();
        error.put(AdminConstant.KEY_ERROR, "INVALID_INPUT");
        error.put(AdminConstant.KEY_MESSAGE, "olderThanDays is required and must be >= 0");
        return ResponseEntity.badRequest().body(error);
    }

    /**
     * GET /api/admin/guests/stats
     * Returns aggregate guest statistics (total, active, expired).
     */
    @GetMapping("/stats")
    public ResponseEntity<GuestStatsResponse> getGuestStats() {
        GuestStats stats = guestAdminPort.getGuestStats();
        GuestStatsResponse response = new GuestStatsResponse(
                stats.getTotalGuests(),
                stats.getActiveGuests(),
                stats.getExpiredGuests());
        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/admin/guests/{uuid}
     * Returns details of a single guest user.
     */
    @GetMapping("/{uuid}")
    public ResponseEntity<Object> getGuestByUuid(@PathVariable String uuid) {
        GuestInfo guest = guestAdminPort.getGuestByUuid(uuid);
        if (guest == null) {
            Map<String, String> error = new LinkedHashMap<>();
            error.put(AdminConstant.KEY_ERROR, AdminConstant.GUEST_NOT_FOUND);
            error.put(AdminConstant.KEY_MESSAGE, AdminConstant.GUEST_NOT_FOUND_WITH_UUID + uuid);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
        }
        return ResponseEntity.ok(toResponse(guest));
    }

    /**
     * DELETE /api/admin/guests/{uuid}
     * Deletes a single guest user and all associated tokens.
     */
    @DeleteMapping("/{uuid}")
    public ResponseEntity<Map<String, String>> deleteGuest(@PathVariable String uuid) {
        boolean deleted = guestAdminPort.deleteGuest(uuid);
        if (!deleted) {
            Map<String, String> error = new LinkedHashMap<>();
            error.put(AdminConstant.KEY_ERROR, AdminConstant.GUEST_NOT_FOUND);
            error.put(AdminConstant.KEY_MESSAGE, AdminConstant.GUEST_NOT_FOUND_WITH_UUID + uuid);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
        }
        Map<String, String> result = new LinkedHashMap<>();
        result.put(AdminConstant.KEY_STATUS, "DELETED");
        result.put(AdminConstant.KEY_UUID, uuid);
        return ResponseEntity.ok(result);
    }

    /**
     * DELETE /api/admin/guests/expired
     * Removes all expired guest sessions and their tokens.
     */
    @DeleteMapping("/expired")
    public ResponseEntity<Map<String, Object>> deleteExpiredGuests() {
        int deletedCount = guestAdminPort.deleteExpiredGuests();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put(AdminConstant.KEY_STATUS, "CLEANUP_COMPLETE");
        result.put(AdminConstant.KEY_DELETED_COUNT, deletedCount);
        return ResponseEntity.ok(result);
    }

    private GuestInfoResponse toResponse(GuestInfo guest) {
        return new GuestInfoResponse(
                guest.userUuid(),
                guest.username(),
                guest.nickname(),
                guest.role(),
                guest.state(),
                guest.guestCookieToken(),
                guest.guestExpiresAt(),
                guest.language(),
                guest.tsRegistration(),
                guest.tsLastAccess(),
                guest.expired());
    }
}
