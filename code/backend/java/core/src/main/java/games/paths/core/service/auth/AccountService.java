package games.paths.core.service.auth;

import games.paths.core.model.auth.AuthException;
import games.paths.core.model.auth.GoogleIdentityClaims;
import games.paths.core.model.auth.UserIdentity;
import games.paths.core.model.auth.UserProfile;
import games.paths.core.model.auth.UserStates;
import games.paths.core.model.auth.UserStatus;
import games.paths.core.port.auth.AccountPort;
import games.paths.core.port.auth.GoogleTokenVerifierPort;
import games.paths.core.port.auth.IdentityPersistencePort;
import games.paths.core.port.auth.TokenPersistencePort;
import games.paths.core.port.auth.UserStatePort;
import games.paths.core.port.match.MatchPersistencePort;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.logging.Logger;

/**
 * AccountService - v1.2.0 profile of GET /api/auth/me, DELETE /api/auth/me (fresh Google token, state 7)
 * and the chunked, idempotent jobs: deletion of state-7 users and 24-month inactivity retirement.
 */
public class AccountService implements AccountPort {

    private static final Logger LOGGER = Logger.getLogger(AccountService.class.getName());
    public static final long FRESH_TOKEN_SECONDS = 300;
    public static final int DEFAULT_CHUNK = 100;
    public static final int DEFAULT_RETENTION_MONTHS = 24;

    private final IdentityPersistencePort identities;
    private final GoogleTokenVerifierPort verifier;
    private final TokenPersistencePort tokens;
    private final MatchPersistencePort matches;
    private final UserStatePort userState;
    private int chunk = DEFAULT_CHUNK;
    private int retentionMonths = DEFAULT_RETENTION_MONTHS;
    private Clock clock = Clock.systemUTC();

    public AccountService(IdentityPersistencePort identities, GoogleTokenVerifierPort verifier,
                          TokenPersistencePort tokens, MatchPersistencePort matches, UserStatePort userState) {
        this.identities = identities;
        this.verifier = verifier;
        this.tokens = tokens;
        this.matches = matches;
        this.userState = userState;
    }

    /** Users per job run and the inactivity bound; zero or less keeps the default. */
    public void configure(int chunk, int retentionMonths) {
        this.chunk = chunk > 0 ? chunk : DEFAULT_CHUNK;
        this.retentionMonths = retentionMonths > 0 ? retentionMonths : DEFAULT_RETENTION_MONTHS;
    }

    void setClock(Clock clock) {
        this.clock = clock;
    }

    @Override
    public Optional<UserProfile> profile(String userUuid) {
        return identities.findUserByUuid(userUuid).map(user -> UserProfile.of(user, googleIdentity(user.id())));
    }

    @Override
    public void requestDeletion(String userUuid, String idToken, String nonce) {
        if (idToken == null || idToken.isBlank()) {
            throw new AuthException(AuthException.Code.FRESH_TOKEN_REQUIRED, "A fresh Google sign-in is required");
        }
        UserStatus user = identities.findUserByUuid(userUuid).orElseThrow(() ->
                new AuthException(AuthException.Code.INVALID_TOKEN, "Unknown user"));
        UserStates.requireUsable(user.state());
        UserIdentity identity = googleIdentity(user.id());
        if (identity == null) {
            throw new AuthException(AuthException.Code.NOT_A_GOOGLE_ACCOUNT, "Only Google accounts can be deleted");
        }
        Instant now = clock.instant();
        GoogleIdentityClaims claims = verifier.verify(idToken);
        GoogleLoginService.checkClaims(claims, verifier.clientId(), blankToNull(nonce), now);
        if (now.getEpochSecond() - claims.issuedAt() > FRESH_TOKEN_SECONDS) {
            throw new AuthException(AuthException.Code.FRESH_TOKEN_REQUIRED, "Sign in with Google again");
        }
        String email = GoogleLoginService.checkEmail(claims);
        if (!identity.subject().equals(claims.subject()) || !identity.email().equals(email)) {
            throw new AuthException(AuthException.Code.IDENTITY_MISMATCH, "The Google account is not this user");
        }
        if (!identities.markIdTokenSeen(TokenHasher.sha256(idToken),
                Instant.ofEpochSecond(claims.expiresAt()).toString())) {
            throw new AuthException(AuthException.Code.TOKEN_REPLAYED, "This Google token was already used");
        }
        identities.updateState(user.id(), UserStates.DELETING);
        tokens.revokeAllUserTokens(user.id());
        userState.evict(user.uuid());
    }

    @Override
    public int runDeletionJob() {
        List<Long> ids = identities.findUserIdsByState(UserStates.DELETING, chunk);
        int deleted = 0;
        for (Long id : ids) {
            // Matches first (the creator FK), then identities, tokens and the user: a rerun resumes here.
            matches.deleteMatchesByUserCreatorIds(List.of(id));
            identities.deleteUserFully(id);
            deleted++;
        }
        identities.deleteExpiredIdTokens(clock.instant().toString());
        if (deleted > 0) {
            LOGGER.info("[ACCOUNT DELETION] " + deleted + " users removed");
        }
        return deleted;
    }

    @Override
    public int retireInactiveUsers() {
        String bound = clock.instant().atOffset(ZoneOffset.UTC).minusMonths(retentionMonths).toInstant().toString();
        List<Long> ids = identities.findInactiveIdentityUserIds(bound, chunk);
        for (Long id : ids) {
            identities.updateState(id, UserStates.DELETING);
            identities.findUserById(id).ifPresent(u -> userState.evict(u.uuid()));
        }
        return ids.size();
    }

    private UserIdentity googleIdentity(long userId) {
        return identities.findIdentitiesOfUser(userId).stream()
                .filter(i -> UserIdentity.PROVIDER_GOOGLE.equals(i.provider()))
                .findFirst().orElse(null);
    }

    private static String blankToNull(String text) {
        return text == null || text.isBlank() ? null : text;
    }
}
