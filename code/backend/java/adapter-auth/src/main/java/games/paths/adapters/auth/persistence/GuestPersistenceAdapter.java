package games.paths.adapters.auth.persistence;

import games.paths.adapters.auth.entity.UserEntity;
import games.paths.adapters.auth.entity.UserTokenEntity;
import games.paths.adapters.auth.repository.UserRepository;
import games.paths.adapters.auth.repository.UserTokenRepository;
import games.paths.core.port.auth.GuestPersistencePort;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

/**
 * GuestPersistenceAdapter - Database adapter for guest user persistence.
 * Uses Spring Data JPA repositories for clean, SQL-free persistence.
 * Operates on the existing users and users_tokens tables (Flyway migration V0.10.1).
 */
@Repository
@Transactional
public class GuestPersistenceAdapter implements GuestPersistencePort {

    private static final int GUEST_STATE = 6;
    private static final String GUEST_ROLE = "PLAYER";

    private final UserRepository userRepository;
    private final UserTokenRepository userTokenRepository;

    public GuestPersistenceAdapter(UserRepository userRepository, UserTokenRepository userTokenRepository) {
        this.userRepository = userRepository;
        this.userTokenRepository = userTokenRepository;
    }

    @Override
    public long createGuestUser(String uuid, String username, String guestCookieToken, String guestExpiresAt) {
        UserEntity user = new UserEntity();
        user.setUuid(uuid);
        user.setUsername(username);
        user.setRole(GUEST_ROLE);
        user.setState(GUEST_STATE);
        user.setNickname(username);
        user.setGuestCookieToken(guestCookieToken);
        user.setGuestExpiresAt(guestExpiresAt);

        UserEntity saved = userRepository.save(user);
        return saved.getId();
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> findGuestByCookieToken(String guestCookieToken) {
        Optional<UserEntity> opt = userRepository.findByGuestCookieTokenAndState(guestCookieToken, GUEST_STATE);

        if (opt.isEmpty()) {
            return null;
        }

        UserEntity user = opt.get();
        return Map.of(
                "id", user.getId(),
                "uuid", user.getUuid(),
                "username", user.getUsername(),
                "guest_expires_at", user.getGuestExpiresAt() != null ? user.getGuestExpiresAt() : ""
        );
    }

    @Override
    public void storeRefreshToken(long userId, String refreshToken, String expiresAt) {
        UserTokenEntity token = new UserTokenEntity();
        token.setIdUser(userId);
        token.setRefreshToken(refreshToken);
        token.setExpiresAt(expiresAt);

        userTokenRepository.save(token);
    }

    @Override
    public void updateLastAccess(long userId) {
        Optional<UserEntity> opt = userRepository.findById(userId);
        opt.ifPresent(user -> {
            user.setTsLastAccess(Instant.now().toString());
            userRepository.save(user);
        });
    }

    @Override
    public int deleteExpiredGuests() {
        String now = Instant.now().toString();

        // First delete tokens for expired guests
        userTokenRepository.deleteTokensOfExpiredGuests(GUEST_STATE, now);

        // Then delete the expired guest users
        return userRepository.deleteExpiredGuests(GUEST_STATE, now);
    }
}
