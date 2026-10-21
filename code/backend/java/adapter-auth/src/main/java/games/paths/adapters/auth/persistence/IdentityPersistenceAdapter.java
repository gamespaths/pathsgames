package games.paths.adapters.auth.persistence;

import games.paths.adapters.auth.entity.UserEntity;
import games.paths.adapters.auth.entity.UserIdentityEntity;
import games.paths.adapters.auth.repository.IdTokenSeenRepository;
import games.paths.adapters.auth.repository.UserIdentityRepository;
import games.paths.adapters.auth.repository.UserRepository;
import games.paths.adapters.auth.repository.UserTokenRepository;
import games.paths.core.model.auth.NewUser;
import games.paths.core.model.auth.UserIdentity;
import games.paths.core.model.auth.UserStatus;
import games.paths.core.port.auth.IdentityPersistencePort;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * IdentityPersistenceAdapter - v1.2.0 {@link IdentityPersistencePort} on users, users_identities and
 * auth_id_token_seen; a unique-index clash on insert becomes a DuplicateUserException.
 */
@Repository
@Transactional
public class IdentityPersistenceAdapter implements IdentityPersistencePort {

    private final UserRepository users;
    private final UserIdentityRepository identities;
    private final UserTokenRepository tokens;
    private final IdTokenSeenRepository seen;
    private final JdbcTemplate jdbc;

    public IdentityPersistenceAdapter(UserRepository users, UserIdentityRepository identities,
                                      UserTokenRepository tokens, IdTokenSeenRepository seen, JdbcTemplate jdbc) {
        this.users = users;
        this.identities = identities;
        this.tokens = tokens;
        this.seen = seen;
        this.jdbc = jdbc;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<UserIdentity> findIdentityByEmail(String provider, String email) {
        if (email == null) {
            return Optional.empty();
        }
        return identities.findByProviderAndEmail(provider, email.toLowerCase(Locale.ROOT))
                .map(IdentityPersistenceAdapter::toIdentity);
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserIdentity> findIdentitiesOfUser(long userId) {
        return identities.findByIdUserOrderByIdAsc(userId).stream().map(IdentityPersistenceAdapter::toIdentity)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<UserStatus> findUserById(long userId) {
        return users.findById(userId).map(IdentityPersistenceAdapter::toStatus);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<UserStatus> findUserByUuid(String uuid) {
        if (uuid == null || uuid.isBlank()) {
            return Optional.empty();
        }
        return users.findByUuid(uuid).map(IdentityPersistenceAdapter::toStatus);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<UserStatus> findUserByNickname(String nickname) {
        return users.findFirstByNickname(nickname).map(IdentityPersistenceAdapter::toStatus);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<UserStatus> findUserByEmail(String email) {
        if (email == null) {
            return Optional.empty();
        }
        return users.findFirstByEmailAddress(email.toLowerCase(Locale.ROOT)).map(IdentityPersistenceAdapter::toStatus);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean nicknameExists(String nickname) {
        return users.existsByNickname(nickname);
    }

    @Override
    public long createUser(NewUser user, UserIdentity identity) {
        try {
            UserEntity entity = new UserEntity();
            entity.setUuid(user.uuid());
            entity.setUsername(user.username());
            entity.setNickname(user.nickname());
            entity.setEmailAddress(user.emailAddress() == null ? null : user.emailAddress().toLowerCase(Locale.ROOT));
            entity.setRole(user.role());
            entity.setState(user.state());
            entity.setLanguage(user.language());
            entity.setTsLastAccess(Instant.now().toString());
            long id = users.saveAndFlush(entity).getId();
            if (identity != null) {
                identities.saveAndFlush(toEntity(id, identity));
            }
            return id;
        } catch (DataAccessException clash) {
            throw duplicateOr(clash);
        }
    }

    /** SQLite reports a unique clash as a generic JDBC error, PostgreSQL as an integrity violation. */
    static RuntimeException duplicateOr(DataAccessException e) {
        Throwable cause = e.getMostSpecificCause();
        String message = String.valueOf(cause == null ? e.getMessage() : cause.getMessage()).toLowerCase(Locale.ROOT);
        if (e instanceof DataIntegrityViolationException || message.contains("unique") || message.contains("duplicate")) {
            return new DuplicateUserException(fieldOf(e));
        }
        return e;
    }

    /** Which unique index refused the insert, read from the driver message of SQLite or PostgreSQL. */
    static String fieldOf(DataAccessException clash) {
        Throwable cause = clash.getMostSpecificCause();
        String message = String.valueOf(cause == null ? clash.getMessage() : cause.getMessage());
        if (message.contains("nickname")) {
            return "nickname";
        }
        if (message.contains("email")) {
            return "email";
        }
        return "other";
    }

    @Override
    public void createIdentity(long userId, UserIdentity identity) {
        try {
            identities.saveAndFlush(toEntity(userId, identity));
        } catch (DataAccessException clash) {
            throw duplicateOr(clash);
        }
    }

    @Override
    public void updateIdentityProfile(long identityId, UserIdentity profile) {
        identities.findById(identityId).ifPresent(e -> {
            e.setProfileName(profile.profileName());
            e.setGivenName(profile.givenName());
            e.setFamilyName(profile.familyName());
            e.setPictureUrl(profile.pictureUrl());
            e.setLocale(profile.locale());
            e.setTsProfileUpdate(profile.tsProfileUpdate());
            identities.save(e);
        });
    }

    @Override
    public void updateLastAccess(long userId) {
        users.findById(userId).ifPresent(u -> {
            u.setTsLastAccess(Instant.now().toString());
            users.save(u);
        });
    }

    @Override
    public void updateState(long userId, int state) {
        users.findById(userId).ifPresent(u -> {
            u.setState(state);
            users.save(u);
        });
    }

    @Override
    public boolean markIdTokenSeen(String tokenHash, String expiresAt) {
        // ON CONFLICT DO NOTHING (SQLite and PostgreSQL): a replay inserts nothing, atomically
        return jdbc.update("INSERT INTO auth_id_token_seen (token_hash, expires_at, ts_insert) VALUES (?, ?, ?)"
                + " ON CONFLICT (token_hash) DO NOTHING", tokenHash, expiresAt, Instant.now().toString()) == 1;
    }

    @Override
    public int deleteExpiredIdTokens(String now) {
        return seen.deleteExpired(now);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Long> findUserIdsByState(int state, int limit) {
        return GuestBatchDelete.toLongs(users.findIdsByState(state, limit));
    }

    @Override
    @Transactional(readOnly = true)
    public List<Long> findInactiveIdentityUserIds(String lastAccessBefore, int limit) {
        return GuestBatchDelete.toLongs(users.findInactiveIdentityUserIds(lastAccessBefore, limit));
    }

    @Override
    public void deleteUserFully(long userId) {
        identities.deleteByIdUser(userId);
        tokens.deleteByIdUser(userId);
        jdbc.update("DELETE FROM gaming_user_sessions WHERE id_user = ?", userId);
        jdbc.update("DELETE FROM chat_messages WHERE id_user = ?", userId);
        users.deleteById(userId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Long> findNonGuestUserIdsByNicknameLike(String pattern) {
        return GuestBatchDelete.toLongs(users.findNonGuestIdsByNicknameLike(pattern));
    }

    static UserStatus toStatus(UserEntity u) {
        return new UserStatus(u.getId(), u.getUuid(), u.getUsername(), u.getNickname(), u.getRole(),
                u.getState() == null ? 0 : u.getState(), u.getLanguage());
    }

    static UserIdentity toIdentity(UserIdentityEntity e) {
        return new UserIdentity(e.getId(), e.getIdUser(), e.getProvider(), e.getProviderSubject(), e.getEmail(),
                e.getProfileName(), e.getGivenName(), e.getFamilyName(), e.getPictureUrl(), e.getLocale(),
                e.getTsProfileUpdate());
    }

    private static UserIdentityEntity toEntity(long userId, UserIdentity identity) {
        UserIdentityEntity e = new UserIdentityEntity();
        e.setIdUser(userId);
        e.setProvider(identity.provider());
        e.setProviderSubject(identity.subject());
        e.setEmail(identity.email() == null ? null : identity.email().toLowerCase(Locale.ROOT));
        e.setProfileName(identity.profileName());
        e.setGivenName(identity.givenName());
        e.setFamilyName(identity.familyName());
        e.setPictureUrl(identity.pictureUrl());
        e.setLocale(identity.locale());
        e.setTsProfileUpdate(identity.tsProfileUpdate());
        return e;
    }
}
