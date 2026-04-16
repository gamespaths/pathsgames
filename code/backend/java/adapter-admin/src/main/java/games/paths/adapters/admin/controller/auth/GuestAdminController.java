package games.paths.adapters.admin.controller.auth;

import games.paths.adapters.admin.AdminConstant;
import games.paths.adapters.admin.dto.auth.GuestInfoResponse;
import games.paths.adapters.admin.dto.auth.GuestStatsResponse;
import games.paths.core.model.auth.GuestInfo;
import games.paths.core.model.auth.GuestStats;
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
 * GET /api/admin/guests → list all guest users
 * GET /api/admin/guests/stats → guest statistics
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
     * GET /api/admin/guests
     * Lists all guest users ordered by registration date.
     */
    @GetMapping
    public ResponseEntity<List<GuestInfoResponse>> listAllGuests() {
        List<GuestInfo> guests = guestAdminPort.listAllGuests();
        List<GuestInfoResponse> response = guests.stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(response);
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
                guest.getUserUuid(),
                guest.getUsername(),
                guest.getNickname(),
                guest.getRole(),
                guest.getState(),
                guest.getGuestCookieToken(),
                guest.getGuestExpiresAt(),
                guest.getLanguage(),
                guest.getTsRegistration(),
                guest.getTsLastAccess(),
                guest.isExpired());
    }
}
