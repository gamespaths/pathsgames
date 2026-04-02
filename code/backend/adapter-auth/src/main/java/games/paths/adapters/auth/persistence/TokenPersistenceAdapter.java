package games.paths.adapters.auth.persistence;

import games.paths.adapters.auth.entity.UserEntity;
import games.paths.adapters.auth.entity.UserTokenEntity;
import games.paths.adapters.auth.repository.UserRepository;
import games.paths.adapters.auth.repository.UserTokenRepository;
import games.paths.core.port.auth.TokenPersistencePort;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * TokenPersistenceAdapter - Database adapter for token persistence operations.
 * Implements the TokenPersistencePort using Spring Data JPA repositories.
 * Handles token validation, revocation, and user lookup for session management.
 */
@Repository
@Transactional
public class TokenPersistenceAdapter implements TokenPersistencePort {

    private final UserRepository userRepository;
    private final UserTokenRepository userTokenRepository;

    public TokenPersistenceAdapter(UserRepository userRepository, UserTokenRepository userTokenRepository) {
        this.userRepository = userRepository;
        this.userTokenRepository = userTokenRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isRefreshTokenValid(String refreshToken) {
        Optional<UserTokenEntity> opt = userTokenRepository.findByRefreshTokenAndRevokedFalse(refreshToken);
        if (opt.isEmpty()) {
            return false;
        }

        UserTokenEntity token = opt.get();
        // Check if token has not expired
        String expiresAt = token.getExpiresAt();
        if (expiresAt != null) {
            try {
                Instant expiry = Instant.parse(expiresAt);
                return !Instant.now().isAfter(expiry);
            } catch (Exception e) {
                return false;
            }
        }
        return true;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> findUserByRefreshToken(String refreshToken) {
        Optional<UserTokenEntity> tokenOpt = userTokenRepository.findByRefreshTokenAndRevokedFalse(refreshToken);
        if (tokenOpt.isEmpty()) {
            return null;
        }

        UserTokenEntity tokenEntity = tokenOpt.get();
        Optional<UserEntity> userOpt = userRepository.findById(tokenEntity.getIdUser());
        if (userOpt.isEmpty()) {
            return null;
        }

        UserEntity user = userOpt.get();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", user.getId());
        result.put("uuid", user.getUuid());
        result.put("username", user.getUsername());
        result.put("role", user.getRole());
        result.put("state", user.getState());
        return result;
    }

    @Override
    public boolean revokeRefreshToken(String refreshToken) {
        Optional<UserTokenEntity> opt = userTokenRepository.findByRefreshToken(refreshToken);
        if (opt.isEmpty()) {
            return false;
        }

        UserTokenEntity token = opt.get();
        if (Boolean.TRUE.equals(token.getRevoked())) {
            return false; // Already revoked
        }

        token.setRevoked(true);
        userTokenRepository.save(token);
        return true;
    }

    @Override
    public int revokeAllUserTokens(long userId) {
        String now = Instant.now().toString();
        return userTokenRepository.revokeAllByUserId(userId, now);
    }

    @Override
    @Transactional(readOnly = true)
    public int countActiveTokensByUserId(long userId) {
        String now = Instant.now().toString();
        return userTokenRepository.countActiveTokensByUserId(userId, now);
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
    @Transactional(readOnly = true)
    public long findUserIdByUuid(String userUuid) {
        Optional<UserEntity> opt = userRepository.findByUuid(userUuid);
        return opt.map(UserEntity::getId).orElse(-1L);
    }

    @Override
    public void revokeOldestTokensIfLimitExceeded(long userId, int maxTokens) {
        List<UserTokenEntity> activeTokens = userTokenRepository.findActiveTokensByUserIdOrderByTsInsertAsc(userId);
        int excess = activeTokens.size() - maxTokens;
        if (excess > 0) {
            for (int i = 0; i < excess; i++) {
                UserTokenEntity oldest = activeTokens.get(i);
                oldest.setRevoked(true);
                userTokenRepository.save(oldest);
            }
        }
    }
}
