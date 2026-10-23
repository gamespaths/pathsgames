package games.paths.adapters.auth.persistence;

import games.paths.adapters.auth.entity.UserEntity;
import games.paths.adapters.auth.entity.UserTokenEntity;
import games.paths.adapters.auth.repository.UserRepository;
import games.paths.adapters.auth.repository.UserTokenRepository;
import games.paths.core.model.auth.RevokeReasons;
import games.paths.core.model.auth.StoredRefreshToken;
import games.paths.core.model.auth.UserStatus;
import games.paths.core.port.auth.TokenPersistencePort;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * TokenPersistenceAdapter - Database adapter for refresh tokens (users_tokens) with Spring Data JPA.
 * v1.2.0 the column holds the SHA-256 hash; a clear value still found is rewritten as hash.
 * v1.7.0 every revocation stores its reason; ts_update is the revocation time of the 7-day purge.
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
    public Optional<StoredRefreshToken> findRefreshToken(String tokenHash, String legacyClearToken) {
        return findEntity(tokenHash, legacyClearToken).map(t -> new StoredRefreshToken(t.getId(), t.getIdUser(),
                Boolean.TRUE.equals(t.getRevoked()), t.getExpiresAt(), t.getTsRotated(), t.getRevokedReason()));
    }

    /** By hash, else by the clear value of a token stored before v1.2.0 (then rewritten as hash). */
    private Optional<UserTokenEntity> findEntity(String tokenHash, String legacyClearToken) {
        if (tokenHash == null) {
            return Optional.empty();
        }
        Optional<UserTokenEntity> byHash = userTokenRepository.findByRefreshToken(tokenHash);
        if (byHash.isPresent() || legacyClearToken == null) {
            return byHash;
        }
        Optional<UserTokenEntity> byClear = userTokenRepository.findByRefreshToken(legacyClearToken);
        byClear.ifPresent(t -> {
            t.setRefreshToken(tokenHash);
            userTokenRepository.save(t);
        });
        return byClear;
    }

    @Override
    public void markRotated(long tokenId, String now) {
        userTokenRepository.findById(tokenId).ifPresent(t -> {
            t.setRevoked(true);
            t.setTsRotated(now);
            t.setRevokedReason(RevokeReasons.ROTATED);
            userTokenRepository.save(t);
        });
    }

    @Override
    public boolean revokeRefreshToken(String tokenHash, String legacyClearToken) {
        Optional<UserTokenEntity> opt = findEntity(tokenHash, legacyClearToken);
        if (opt.isEmpty() || Boolean.TRUE.equals(opt.get().getRevoked())) {
            return false;
        }
        UserTokenEntity token = opt.get();
        token.setRevoked(true);
        token.setRevokedReason(RevokeReasons.LOGOUT);
        userTokenRepository.save(token);
        return true;
    }

    @Override
    public int revokeAllUserTokens(long userId, String reason) {
        return userTokenRepository.revokeAllByUserId(userId, Instant.now().toString(), reason);
    }

    @Override
    @Transactional(readOnly = true)
    public int countActiveTokensIssuedAfter(long userId, String issuedAfter) {
        return userTokenRepository.countActiveTokensIssuedAfter(userId, Instant.now().toString(), issuedAfter);
    }

    @Override
    @Transactional(readOnly = true)
    public int countActiveTokensByUserId(long userId) {
        return userTokenRepository.countActiveTokensByUserId(userId, Instant.now().toString());
    }

    @Override
    public void storeRefreshToken(long userId, String tokenHash, String expiresAt) {
        UserTokenEntity token = new UserTokenEntity();
        token.setIdUser(userId);
        token.setRefreshToken(tokenHash);
        token.setExpiresAt(expiresAt);
        userTokenRepository.save(token);
    }

    @Override
    @Transactional(readOnly = true)
    public long findUserIdByUuid(String userUuid) {
        return userRepository.findByUuid(userUuid).map(UserEntity::getId).orElse(-1L);
    }

    @Override
    public void revokeOldestTokensIfLimitExceeded(long userId, int maxTokens) {
        List<UserTokenEntity> activeTokens = userTokenRepository.findActiveTokensByUserIdOrderByTsInsertAsc(userId);
        int excess = activeTokens.size() - maxTokens;
        for (int i = 0; i < excess; i++) {
            UserTokenEntity oldest = activeTokens.get(i);
            oldest.setRevoked(true);
            oldest.setRevokedReason(RevokeReasons.LIMIT);
            userTokenRepository.save(oldest);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<UserStatus> findUserById(long userId) {
        return userRepository.findById(userId).map(IdentityPersistenceAdapter::toStatus);
    }

    @Override
    public void updateLastAccess(long userId) {
        userRepository.findById(userId).ifPresent(user -> {
            user.setTsLastAccess(Instant.now().toString());
            userRepository.save(user);
        });
    }

    @Override
    public void setSessionsValidAfter(long userId, String validAfter) {
        userRepository.updateSessionsValidAfter(userId, validAfter);
    }

    @Override
    public int deleteShortLivedRevokedTokens(String revokedBefore) {
        return userTokenRepository.deleteShortLivedRevoked(revokedBefore);
    }
}
