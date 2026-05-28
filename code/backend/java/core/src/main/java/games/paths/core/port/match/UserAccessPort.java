package games.paths.core.port.match;

import java.util.Optional;

/**
 * UserAccessPort - Outbound port used by match services to resolve a user
 * by uuid without depending on the auth adapter directly.
 *
 * <p>The implementation lives in the auth adapter and looks up the
 * {@code users} table, returning the minimum information required by the
 * match domain (id, uuid, ban state).</p>
 */
public interface UserAccessPort {

    /**
     * UserView - Read-only projection of a row from the {@code users} table.
     * Field {@code state} maps the database column: 1=registration, 2=active,
     * 3=blocked, 4=banned, 5=password_reset, 6=guest.
     */
    record UserView(Long id, String uuid, String username, String role, Integer state) {

        public boolean isBanned() {
            return state != null && state == 4;
        }

        public boolean isBlocked() {
            return state != null && state == 3;
        }
    }

    Optional<UserView> findByUuid(String uuid);
}
