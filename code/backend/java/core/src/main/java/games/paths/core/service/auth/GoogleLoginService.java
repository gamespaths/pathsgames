package games.paths.core.service.auth;

import games.paths.core.model.auth.AuthException;
import games.paths.core.model.auth.AuthenticatedSession;
import games.paths.core.model.auth.GoogleIdentityClaims;
import games.paths.core.model.auth.GoogleLoginCommand;
import games.paths.core.model.auth.MergeResult;
import games.paths.core.model.auth.NewUser;
import games.paths.core.model.auth.UserIdentity;
import games.paths.core.model.auth.UserProfile;
import games.paths.core.model.auth.UserStates;
import games.paths.core.model.auth.UserStatus;
import games.paths.core.port.auth.AccountGuardPort;
import games.paths.core.port.auth.GoogleLoginPort;
import games.paths.core.port.auth.GoogleTokenVerifierPort;
import games.paths.core.port.auth.GuestPersistencePort;
import games.paths.core.port.auth.IdentityPersistencePort;
import games.paths.core.port.auth.JwtPort;
import games.paths.core.port.auth.TokenPersistencePort;
import games.paths.core.port.auth.UserStatePort;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * GoogleLoginService - v1.2.0 POST /api/auth/google: checks the GIS ID token (aud, iss, exp, nonce,
 * replay, verified gmail.com email, sub + email pair), finds or creates the user, merges the guest.
 */
public class GoogleLoginService implements GoogleLoginPort {

    public static final Set<String> GOOGLE_ISSUERS = Set.of("accounts.google.com", "https://accounts.google.com");
    public static final String ALLOWED_DOMAIN = "gmail.com";
    static final Set<String> LANGUAGES = Set.of("en", "it");
    static final int CREATE_ATTEMPTS = 5;

    private final GoogleTokenVerifierPort verifier;
    private final IdentityPersistencePort identities;
    private final JwtPort jwtPort;
    private final TokenPersistencePort tokens;
    private final GuestPersistencePort guests;
    private final GuestMergeService mergeService;
    private final boolean enabled;
    private final int maxTokensPerUser;
    private UserStatePort userState;
    private AccountGuardPort guard;
    private Clock clock = Clock.systemUTC();

    @SuppressWarnings("java:S107")
    public GoogleLoginService(GoogleTokenVerifierPort verifier, IdentityPersistencePort identities, JwtPort jwtPort,
                              TokenPersistencePort tokens, GuestPersistencePort guests,
                              GuestMergeService mergeService, boolean enabled, int maxTokensPerUser) {
        this.verifier = verifier;
        this.identities = identities;
        this.jwtPort = jwtPort;
        this.tokens = tokens;
        this.guests = guests;
        this.mergeService = mergeService;
        this.enabled = enabled;
        this.maxTokensPerUser = maxTokensPerUser;
    }

    public void setUserState(UserStatePort userState) {
        this.userState = userState;
    }

    /** v1.7.0 banned hashes, end of a suspension and the armed re-link (step 10). */
    public void setAccountGuard(AccountGuardPort guard) {
        this.guard = guard;
    }

    void setClock(Clock clock) {
        this.clock = clock;
    }

    @Override
    public boolean isEnabled() {
        return enabled;
    }

    @Override
    public String clientId() {
        return verifier.clientId();
    }

    @Override
    public AuthenticatedSession login(GoogleLoginCommand cmd) {
        if (!enabled) {
            throw new AuthException(AuthException.Code.GOOGLE_DISABLED, "Google sign-in is disabled on this server");
        }
        if (cmd == null || isBlank(cmd.idToken()) || isBlank(cmd.nonce())) {
            throw new AuthException(AuthException.Code.INVALID_REQUEST, "idToken and nonce are required");
        }
        Instant now = clock.instant();
        GoogleIdentityClaims claims = verifier.verify(cmd.idToken());
        checkClaims(claims, verifier.clientId(), cmd.nonce(), now);
        String email = checkEmail(claims);
        if (guard != null) {
            guard.checkNotBanned(claims.subject(), email);
        }

        Optional<UserIdentity> existing = identities.findIdentityByEmail(UserIdentity.PROVIDER_GOOGLE, email);
        UserStatus known;
        if (existing.isPresent()) {
            known = knownUser(existing.get(), claims);
        } else {
            // A user with this email but no identity yet (an old import): the email identifies it.
            known = identities.findUserByEmail(email).orElse(null);
            if (known != null) {
                known = admit(known);
            }
        }
        markSeen(cmd.idToken(), claims);

        String nowIso = now.toString();
        UserIdentity profile = UserIdentity.fromGoogle(claims, email, nowIso);
        boolean created = known == null;
        UserStatus user;
        if (created) {
            user = createGoogleUser(claims, email, language(cmd.language(), claims.locale()), nowIso);
        } else if (existing.isPresent()) {
            identities.updateIdentityProfile(existing.get().id(), profile);
            user = known;
        } else {
            identities.createIdentity(known.id(), profile);
            user = known;
        }
        identities.updateLastAccess(user.id());

        String mergedGuest = null;
        int cancelled = 0;
        List<String> cancelledUuids = List.of();
        Map<String, Object> guest = resolveGuest(cmd);
        if (guest != null && ((Number) guest.get("id")).longValue() != user.id()) {
            MergeResult merge = mergeService.merge(((Number) guest.get("id")).longValue(), user.id());
            mergedGuest = (String) guest.get("uuid");
            cancelled = merge.cancelledMatchIds().size();
            cancelledUuids = merge.cancelledMatchUuids();
            if (userState != null) {
                userState.evict(mergedGuest);
            }
        }

        String accessToken = jwtPort.generateAccessToken(user.uuid(), user.username(), user.role());
        String refreshToken = jwtPort.generateRefreshToken(user.uuid());
        long refreshExpiresMs = jwtPort.getRefreshTokenExpirationMs();
        tokens.storeRefreshToken(user.id(), TokenHasher.sha256(refreshToken),
                Instant.ofEpochMilli(refreshExpiresMs).toString());
        tokens.revokeOldestTokensIfLimitExceeded(user.id(), maxTokensPerUser);

        return new AuthenticatedSession(UserProfile.of(user, profile), accessToken, refreshToken,
                jwtPort.getAccessTokenExpirationMs(), refreshExpiresMs, created, mergedGuest, cancelled,
                cancelledUuids);
    }

    /** aud, iss, exp and (when expected) nonce of a verified token; throws INVALID_TOKEN / INVALID_NONCE. */
    static void checkClaims(GoogleIdentityClaims c, String clientId, String expectedNonce, Instant now) {
        if (c == null || isBlank(c.subject())) {
            throw new AuthException(AuthException.Code.INVALID_TOKEN, "The Google token has no subject");
        }
        if (clientId == null || !clientId.equals(c.audience())) {
            throw new AuthException(AuthException.Code.INVALID_TOKEN, "The Google token audience is wrong");
        }
        if (!GOOGLE_ISSUERS.contains(c.issuer())) {
            throw new AuthException(AuthException.Code.INVALID_TOKEN, "The Google token issuer is wrong");
        }
        if (c.expiresAt() <= now.getEpochSecond()) {
            throw new AuthException(AuthException.Code.INVALID_TOKEN, "The Google token is expired");
        }
        if (expectedNonce != null && !expectedNonce.equals(c.nonce())) {
            throw new AuthException(AuthException.Code.INVALID_NONCE, "The login nonce does not match");
        }
    }

    /** The lowercase email of a verified gmail.com account; nothing is written before this passes. */
    static String checkEmail(GoogleIdentityClaims c) {
        if (!c.emailVerified() || isBlank(c.email())) {
            throw new AuthException(AuthException.Code.EMAIL_NOT_VERIFIED, "The Google email is not verified");
        }
        String email = c.email().trim().toLowerCase(Locale.ROOT);
        int at = email.lastIndexOf('@');
        if (at <= 0 || !ALLOWED_DOMAIN.equals(email.substring(at + 1))) {
            throw new AuthException(AuthException.Code.EMAIL_DOMAIN_NOT_ALLOWED, "Only Gmail accounts are accepted");
        }
        return email;
    }

    /** Stores the token hash until its exp; a second use is a replay. */
    void markSeen(String idToken, GoogleIdentityClaims claims) {
        String expiresAt = Instant.ofEpochSecond(claims.expiresAt()).toString();
        if (!identities.markIdTokenSeen(TokenHasher.sha256(idToken), expiresAt)) {
            throw new AuthException(AuthException.Code.TOKEN_REPLAYED, "This Google token was already used");
        }
    }

    /** The device preference, else the Google locale, else English. */
    static String language(String preferred, String locale) {
        if (preferred != null && LANGUAGES.contains(preferred.trim().toLowerCase(Locale.ROOT))) {
            return preferred.trim().toLowerCase(Locale.ROOT);
        }
        if (locale != null && locale.length() >= 2) {
            String lang = locale.substring(0, 2).toLowerCase(Locale.ROOT);
            if (LANGUAGES.contains(lang)) {
                return lang;
            }
        }
        return "en";
    }

    private UserStatus createGoogleUser(GoogleIdentityClaims claims, String email, String language, String now) {
        String base = NicknameGenerator.base(email);
        int start = 1;
        for (int attempt = 0; attempt < CREATE_ATTEMPTS; attempt++) {
            String uuid = UUID.randomUUID().toString();
            String nickname = NicknameGenerator.firstFree(base, start, identities::nicknameExists, uuid);
            NewUser user = new NewUser(uuid, "google_" + uuid.substring(0, 8), nickname, email,
                    UserStates.ROLE_PLAYER, UserStates.ACTIVE, language);
            try {
                long id = identities.createUser(user, UserIdentity.fromGoogle(claims, email, now));
                return new UserStatus(id, uuid, user.username(), nickname, user.role(), user.state(), language);
            } catch (IdentityPersistencePort.DuplicateUserException clash) {
                if (!"nickname".equals(clash.getField())) {
                    // A concurrent first login of the same account won the email: use that user.
                    UserIdentity winner = identities.findIdentityByEmail(UserIdentity.PROVIDER_GOOGLE, email)
                            .orElseThrow(() -> new AuthException(AuthException.Code.INVALID_REQUEST,
                                    "Concurrent sign-in, retry"));
                    return knownUser(winner, claims);
                }
                start = suffixOf(nickname, base) + 1;
            }
        }
        throw new AuthException(AuthException.Code.NICKNAME_TAKEN, "No free nickname, retry");
    }

    /** The user of an identity found by email: same sub, usable state; else IDENTITY_MISMATCH / refusal. */
    private UserStatus knownUser(UserIdentity identity, GoogleIdentityClaims claims) {
        if (!claims.subject().equals(identity.subject()) && (guard == null || !guard.relink(identity, claims.subject()))) {
            throw new AuthException(AuthException.Code.IDENTITY_MISMATCH,
                    "This email belongs to another Google account: contact support");
        }
        UserStatus user = identities.findUserById(identity.userId()).orElseThrow(() ->
                new AuthException(AuthException.Code.INVALID_TOKEN, "Identity without user"));
        return admit(user);
    }

    /** The state check; with the guard a suspension that ended unblocks the user. */
    private UserStatus admit(UserStatus user) {
        if (guard != null) {
            return guard.admit(user);
        }
        UserStates.requireUsable(user.state());
        return user;
    }

    private static int suffixOf(String nickname, String base) {
        if (nickname.equals(base)) {
            return 1;
        }
        try {
            return Integer.parseInt(nickname.substring(base.length() + 1));
        } catch (RuntimeException notNumbered) {
            return NicknameGenerator.MAX_SUFFIX;
        }
    }

    /** The guest of the bearer token, else of the guest cookie; null when there is none. */
    private Map<String, Object> resolveGuest(GoogleLoginCommand cmd) {
        if (!isBlank(cmd.guestAccessToken()) && jwtPort.validateToken(cmd.guestAccessToken())) {
            Map<String, Object> claims = jwtPort.parseToken(cmd.guestAccessToken());
            if (claims != null && "access".equals(claims.get("type"))) {
                Optional<UserStatus> guest = identities.findUserByUuid((String) claims.get("sub"));
                if (guest.isPresent() && guest.get().isGuest()) {
                    return Map.of("id", guest.get().id(), "uuid", guest.get().uuid());
                }
            }
        }
        if (!isBlank(cmd.guestCookieToken())) {
            Map<String, Object> guest = guests.findGuestByCookieToken(TokenHasher.sha256(cmd.guestCookieToken()),
                    TokenHasher.legacy(cmd.guestCookieToken(), clock.instant()));
            if (guest != null && guest.get("id") != null) {
                return guest;
            }
        }
        return null;
    }

    private static boolean isBlank(String text) {
        return text == null || text.isBlank();
    }
}
