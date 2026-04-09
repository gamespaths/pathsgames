package games.paths.core.service.auth;

import games.paths.core.model.auth.GuestInfo;
import games.paths.core.model.auth.GuestStats;
import games.paths.core.port.auth.GuestAdminPersistencePort;
import games.paths.core.port.auth.GuestAdminPort;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * GuestAdminService - Domain service implementing guest administration.
 * This is pure domain logic with no Spring/framework dependency.
 * Ports are injected via constructor by the launcher configuration.
 */
public class GuestAdminService implements GuestAdminPort {

    private final GuestAdminPersistencePort persistencePort;

    public GuestAdminService(GuestAdminPersistencePort persistencePort) {
        this.persistencePort = persistencePort;
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

        return GuestInfo.builder()
                .userUuid((String) data.get("uuid"))
                .username((String) data.get("username"))
                .nickname((String) data.get("nickname"))
                .role((String) data.get("role"))
                .state(data.get("state") != null ? ((Number) data.get("state")).intValue() : 6)
                .guestCookieToken((String) data.get("guestCookieToken"))
                .guestExpiresAt(expiresAt)
                .language((String) data.get("language"))
                .tsRegistration((String) data.get("tsRegistration"))
                .tsLastAccess((String) data.get("tsLastAccess"))
                .expired(expired)
                .build();
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
