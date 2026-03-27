package games.paths.adapters.admin.controller.auth;

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
 * GET    /api/v1/admin/guests          → list all guest users
 * GET    /api/v1/admin/guests/stats    → guest statistics
 * GET    /api/v1/admin/guests/{uuid}   → get a single guest
 * DELETE /api/v1/admin/guests/{uuid}   → delete a single guest
 * DELETE /api/v1/admin/guests/expired  → cleanup expired guests
 */
@RestController
@RequestMapping("/api/v1/admin/guests")
public class GuestAdminController {

    private final GuestAdminPort guestAdminPort;

    public GuestAdminController(GuestAdminPort guestAdminPort) {
        this.guestAdminPort = guestAdminPort;
    }

    /**
     * GET /api/v1/admin/guests
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
     * GET /api/v1/admin/guests/stats
     * Returns aggregate guest statistics (total, active, expired).
     */
    @GetMapping("/stats")
    public ResponseEntity<GuestStatsResponse> getGuestStats() {
        GuestStats stats = guestAdminPort.getGuestStats();
        GuestStatsResponse response = new GuestStatsResponse(
                stats.getTotalGuests(),
                stats.getActiveGuests(),
                stats.getExpiredGuests()
        );
        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/v1/admin/guests/{uuid}
     * Returns details of a single guest user.
     */
    @GetMapping("/{uuid}")
    public ResponseEntity<Object> getGuestByUuid(@PathVariable String uuid) {
        GuestInfo guest = guestAdminPort.getGuestByUuid(uuid);
        if (guest == null) {
            Map<String, String> error = new LinkedHashMap<>();
            error.put("error", "GUEST_NOT_FOUND");
            error.put("message", "No guest user found with UUID: " + uuid);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
        }
        return ResponseEntity.ok(toResponse(guest));
    }

    /**
     * DELETE /api/v1/admin/guests/{uuid}
     * Deletes a single guest user and all associated tokens.
     */
    @DeleteMapping("/{uuid}")
    public ResponseEntity<Map<String, String>> deleteGuest(@PathVariable String uuid) {
        boolean deleted = guestAdminPort.deleteGuest(uuid);
        if (!deleted) {
            Map<String, String> error = new LinkedHashMap<>();
            error.put("error", "GUEST_NOT_FOUND");
            error.put("message", "No guest user found with UUID: " + uuid);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
        }
        Map<String, String> result = new LinkedHashMap<>();
        result.put("status", "DELETED");
        result.put("uuid", uuid);
        return ResponseEntity.ok(result);
    }

    /**
     * DELETE /api/v1/admin/guests/expired
     * Removes all expired guest sessions and their tokens.
     */
    @DeleteMapping("/expired")
    public ResponseEntity<Map<String, Object>> deleteExpiredGuests() {
        int deletedCount = guestAdminPort.deleteExpiredGuests();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "CLEANUP_COMPLETE");
        result.put("deletedCount", deletedCount);
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
                guest.isExpired()
        );
    }
}
