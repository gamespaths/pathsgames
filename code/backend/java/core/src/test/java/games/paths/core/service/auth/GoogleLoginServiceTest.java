package games.paths.core.service.auth;

import games.paths.core.model.auth.AuthException;
import games.paths.core.model.auth.AuthenticatedSession;
import games.paths.core.model.auth.GoogleIdentityClaims;
import games.paths.core.model.auth.GoogleLoginCommand;
import games.paths.core.model.auth.MergeResult;
import games.paths.core.model.auth.NewUser;
import games.paths.core.model.auth.UserIdentity;
import games.paths.core.model.auth.UserStatus;
import games.paths.core.port.auth.GoogleTokenVerifierPort;
import games.paths.core.port.auth.GuestPersistencePort;
import games.paths.core.port.auth.IdentityPersistencePort;
import games.paths.core.port.auth.JwtPort;
import games.paths.core.port.auth.TokenPersistencePort;
import games.paths.core.port.auth.UserStatePort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests of {@link GoogleLoginService}: token checks (aud, iss, exp, nonce, replay), email rules,
 * identity mismatch, state refusals, user creation with nickname retry, profile refresh and guest merge.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class GoogleLoginServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-19T10:00:00Z");
    private static final String CLIENT = "client.apps.googleusercontent.com";

    @Mock private GoogleTokenVerifierPort verifier;
    @Mock private IdentityPersistencePort identities;
    @Mock private JwtPort jwt;
    @Mock private TokenPersistencePort tokens;
    @Mock private GuestPersistencePort guests;
    @Mock private GuestMergeService merge;
    @Mock private UserStatePort userState;

    private GoogleLoginService service;

    @BeforeEach
    void setUp() {
        service = new GoogleLoginService(verifier, identities, jwt, tokens, guests, merge, true, 5);
        service.setClock(Clock.fixed(NOW, ZoneOffset.UTC));
        service.setUserState(userState);
        when(verifier.clientId()).thenReturn(CLIENT);
        when(identities.markIdTokenSeen(anyString(), anyString())).thenReturn(true);
        when(jwt.generateAccessToken(anyString(), anyString(), anyString())).thenReturn("access");
        when(jwt.generateRefreshToken(anyString())).thenReturn("refresh");
        when(jwt.getRefreshTokenExpirationMs()).thenReturn(NOW.plusSeconds(600).toEpochMilli());
        when(jwt.getAccessTokenExpirationMs()).thenReturn(NOW.plusSeconds(60).toEpochMilli());
    }

    private static GoogleIdentityClaims claims(String sub, String email, boolean verified, String aud, String iss,
                                               long exp, String nonce) {
        return new GoogleIdentityClaims(sub, email, verified, "Mario Rossi", "Mario", "Rossi", "pic", "it-IT",
                nonce, iss, aud, exp, NOW.getEpochSecond());
    }

    private static GoogleIdentityClaims good() {
        return claims("sub-1", "Mario.Rossi+x@Gmail.com", true, CLIENT, "https://accounts.google.com",
                NOW.getEpochSecond() + 600, "nonce");
    }

    private static GoogleLoginCommand cmd() {
        return new GoogleLoginCommand("id-token", "nonce", null, null, null);
    }

    private AuthException.Code refused(GoogleIdentityClaims c) {
        when(verifier.verify("id-token")).thenReturn(c);
        return assertThrows(AuthException.class, () -> service.login(cmd())).getCode();
    }

    @Test
    void disabledOrMissingInput() {
        GoogleLoginService off = new GoogleLoginService(verifier, identities, jwt, tokens, guests, merge, false, 5);
        assertFalse(off.isEnabled());
        assertEquals(AuthException.Code.GOOGLE_DISABLED,
                assertThrows(AuthException.class, () -> off.login(cmd())).getCode());
        assertEquals(AuthException.Code.INVALID_REQUEST,
                assertThrows(AuthException.class, () -> service.login(null)).getCode());
        assertEquals(AuthException.Code.INVALID_REQUEST, assertThrows(AuthException.class,
                () -> service.login(new GoogleLoginCommand(" ", "n", null, null, null))).getCode());
        assertEquals(AuthException.Code.INVALID_REQUEST, assertThrows(AuthException.class,
                () -> service.login(new GoogleLoginCommand("t", null, null, null, null))).getCode());
        assertTrue(service.isEnabled());
        assertEquals(CLIENT, service.clientId());
    }

    @Test
    void tokenClaimChecks() {
        long exp = NOW.getEpochSecond() + 600;
        assertEquals(AuthException.Code.INVALID_TOKEN,
                refused(claims(null, "a@gmail.com", true, CLIENT, "accounts.google.com", exp, "nonce")));
        assertEquals(AuthException.Code.INVALID_TOKEN,
                refused(claims("s", "a@gmail.com", true, "other", "accounts.google.com", exp, "nonce")));
        assertEquals(AuthException.Code.INVALID_TOKEN,
                refused(claims("s", "a@gmail.com", true, CLIENT, "https://evil.example", exp, "nonce")));
        assertEquals(AuthException.Code.INVALID_TOKEN,
                refused(claims("s", "a@gmail.com", true, CLIENT, "accounts.google.com", NOW.getEpochSecond(), "nonce")));
        assertEquals(AuthException.Code.INVALID_NONCE,
                refused(claims("s", "a@gmail.com", true, CLIENT, "accounts.google.com", exp, "other")));
        assertThrows(AuthException.class, () -> GoogleLoginService.checkClaims(null, CLIENT, null, NOW));
        assertThrows(AuthException.class, () -> GoogleLoginService.checkClaims(good(), null, null, NOW));
        verify(identities, never()).createUser(any(), any());
    }

    @Test
    void emailRules() {
        long exp = NOW.getEpochSecond() + 600;
        String iss = "accounts.google.com";
        assertEquals(AuthException.Code.EMAIL_NOT_VERIFIED,
                refused(claims("s", "a@gmail.com", false, CLIENT, iss, exp, "nonce")));
        assertEquals(AuthException.Code.EMAIL_NOT_VERIFIED,
                refused(claims("s", " ", true, CLIENT, iss, exp, "nonce")));
        assertEquals(AuthException.Code.EMAIL_DOMAIN_NOT_ALLOWED,
                refused(claims("s", "a@googlemail.com", true, CLIENT, iss, exp, "nonce")));
        assertEquals(AuthException.Code.EMAIL_DOMAIN_NOT_ALLOWED,
                refused(claims("s", "a@company.com", true, CLIENT, iss, exp, "nonce")));
        assertEquals(AuthException.Code.EMAIL_DOMAIN_NOT_ALLOWED,
                refused(claims("s", "@gmail.com", true, CLIENT, iss, exp, "nonce")));
        verify(identities, never()).markIdTokenSeen(anyString(), anyString());
        verify(identities, never()).createUser(any(), any());
    }

    @Test
    void identityMismatchWritesNothing() {
        when(identities.findIdentityByEmail("GOOGLE", "mario.rossi+x@gmail.com")).thenReturn(Optional.of(
                new UserIdentity(1L, 9L, "GOOGLE", "other-sub", "mario.rossi+x@gmail.com", null, null, null, null,
                        null, null)));
        assertEquals(AuthException.Code.IDENTITY_MISMATCH, refused(good()));
        verify(identities, never()).markIdTokenSeen(anyString(), anyString());
    }

    @Test
    void deletingOrDisabledUserIsRefused() {
        when(identities.findIdentityByEmail(anyString(), anyString())).thenReturn(Optional.of(
                new UserIdentity(1L, 9L, "GOOGLE", "sub-1", "x", null, null, null, null, null, null)));
        when(identities.findUserById(9L)).thenReturn(Optional.of(new UserStatus(9L, "u", "g", "n", "PLAYER", 7, "en")));
        assertEquals(AuthException.Code.ACCOUNT_DELETION_IN_PROGRESS, refused(good()));
        when(identities.findUserById(9L)).thenReturn(Optional.of(new UserStatus(9L, "u", "g", "n", "PLAYER", 4, "en")));
        assertEquals(AuthException.Code.ACCOUNT_DISABLED, refused(good()));
        when(identities.findUserById(9L)).thenReturn(Optional.empty());
        assertEquals(AuthException.Code.INVALID_TOKEN, refused(good()));
    }

    @Test
    void replayIsRefused() {
        when(identities.markIdTokenSeen(anyString(), anyString())).thenReturn(false);
        assertEquals(AuthException.Code.TOKEN_REPLAYED, refused(good()));
        verify(identities, never()).createUser(any(), any());
    }

    @Test
    void newUserGetsNicknameAndProfile() {
        when(verifier.verify("id-token")).thenReturn(good());
        when(identities.nicknameExists("mario.rossi")).thenReturn(true);
        when(identities.createUser(any(), any())).thenReturn(42L);

        AuthenticatedSession s = service.login(cmd());

        ArgumentCaptor<NewUser> user = ArgumentCaptor.forClass(NewUser.class);
        ArgumentCaptor<UserIdentity> identity = ArgumentCaptor.forClass(UserIdentity.class);
        verify(identities).createUser(user.capture(), identity.capture());
        assertEquals("mario.rossi#2", user.getValue().nickname());
        assertTrue(user.getValue().username().startsWith("google_"));
        assertEquals("mario.rossi+x@gmail.com", user.getValue().emailAddress());
        assertEquals("it", user.getValue().language());
        assertEquals("sub-1", identity.getValue().subject());
        assertTrue(s.newUser());
        assertEquals("Mario Rossi", s.profile().displayName());
        assertEquals("GOOGLE", s.profile().accountType());
        assertEquals("access", s.accessToken());
        verify(tokens).storeRefreshToken(eq(42L), eq(TokenHasher.sha256("refresh")), anyString());
        verify(tokens).revokeOldestTokensIfLimitExceeded(42L, 5);
        verify(identities).updateLastAccess(42L);
        verify(identities).markIdTokenSeen(eq(TokenHasher.sha256("id-token")), anyString());
    }

    @Test
    void nicknameRaceRetriesWithTheNextSuffix() {
        when(verifier.verify("id-token")).thenReturn(good());
        when(identities.createUser(any(), any()))
                .thenThrow(new IdentityPersistencePort.DuplicateUserException("nickname"))
                .thenReturn(7L);
        service.login(cmd());
        ArgumentCaptor<NewUser> user = ArgumentCaptor.forClass(NewUser.class);
        verify(identities, times(2)).createUser(user.capture(), any());
        assertEquals("mario.rossi", user.getAllValues().get(0).nickname());
        assertEquals("mario.rossi#2", user.getAllValues().get(1).nickname());
    }

    @Test
    void nicknameRaceGivesUpAfterFiveAttempts() {
        when(verifier.verify("id-token")).thenReturn(good());
        when(identities.nicknameExists(anyString())).thenAnswer(i -> ((String) i.getArgument(0)).contains("#"));
        when(identities.createUser(any(), any())).thenThrow(new IdentityPersistencePort.DuplicateUserException("nickname"));
        assertEquals(AuthException.Code.NICKNAME_TAKEN,
                assertThrows(AuthException.class, () -> service.login(cmd())).getCode());
    }

    @Test
    void concurrentFirstLoginUsesTheWinner() {
        when(verifier.verify("id-token")).thenReturn(good());
        UserIdentity winner = new UserIdentity(3L, 8L, "GOOGLE", "sub-1", "e", null, null, null, null, null, null);
        when(identities.findIdentityByEmail(anyString(), anyString())).thenReturn(Optional.empty(), Optional.of(winner));
        when(identities.createUser(any(), any())).thenThrow(new IdentityPersistencePort.DuplicateUserException("email"));
        when(identities.findUserById(8L)).thenReturn(Optional.of(new UserStatus(8L, "u8", "google_8", "m", "PLAYER", 2, "en")));
        assertEquals("u8", service.login(cmd()).profile().userUuid());
    }

    @Test
    void concurrentFirstLoginWithoutWinnerAsksToRetry() {
        when(verifier.verify("id-token")).thenReturn(good());
        when(identities.findIdentityByEmail(anyString(), anyString())).thenReturn(Optional.empty());
        when(identities.createUser(any(), any())).thenThrow(new IdentityPersistencePort.DuplicateUserException("other"));
        assertEquals(AuthException.Code.INVALID_REQUEST,
                assertThrows(AuthException.class, () -> service.login(cmd())).getCode());
    }

    @Test
    void knownUserProfileIsRefreshed() {
        when(verifier.verify("id-token")).thenReturn(good());
        when(identities.findIdentityByEmail(anyString(), anyString())).thenReturn(Optional.of(
                new UserIdentity(3L, 8L, "GOOGLE", "sub-1", "e", null, null, null, null, null, null)));
        when(identities.findUserById(8L)).thenReturn(Optional.of(new UserStatus(8L, "u8", "google_8", "m", "PLAYER", 2, "en")));
        AuthenticatedSession s = service.login(cmd());
        assertFalse(s.newUser());
        verify(identities).updateIdentityProfile(eq(3L), any());
        verify(identities, never()).createUser(any(), any());
    }

    @Test
    void userWithEmailButNoIdentityIsLinked() {
        when(verifier.verify("id-token")).thenReturn(good());
        when(identities.findUserByEmail("mario.rossi+x@gmail.com")).thenReturn(Optional.of(
                new UserStatus(8L, "u8", "imported", "m", "PLAYER", 2, "en")));
        service.login(cmd());
        verify(identities).createIdentity(eq(8L), any());
        when(identities.findUserByEmail(anyString())).thenReturn(Optional.of(
                new UserStatus(8L, "u8", "imported", "m", "PLAYER", 3, "en")));
        assertEquals(AuthException.Code.ACCOUNT_DISABLED,
                assertThrows(AuthException.class, () -> service.login(cmd())).getCode());
    }

    @Test
    void guestOfTheBearerIsMerged() {
        when(verifier.verify("id-token")).thenReturn(good());
        when(identities.createUser(any(), any())).thenReturn(42L);
        when(jwt.validateToken("guest-access")).thenReturn(true);
        when(jwt.parseToken("guest-access")).thenReturn(Map.of("type", "access", "sub", "g-uuid"));
        when(identities.findUserByUuid("g-uuid")).thenReturn(Optional.of(
                new UserStatus(5L, "g-uuid", "guest_x", "guest_x", "PLAYER", 6, "en")));
        when(merge.merge(5L, 42L)).thenReturn(new MergeResult(2, List.of(10L)));

        AuthenticatedSession s = service.login(new GoogleLoginCommand("id-token", "nonce", "en", "guest-access", null));

        assertEquals("g-uuid", s.mergedGuestUuid());
        assertEquals(1, s.cancelledMatches());
        verify(userState).evict("g-uuid");
    }

    @Test
    void guestOfTheCookieIsMergedWhenTheBearerIsNotAGuest() {
        when(verifier.verify("id-token")).thenReturn(good());
        when(identities.createUser(any(), any())).thenReturn(42L);
        when(jwt.validateToken("other-access")).thenReturn(true);
        when(jwt.parseToken("other-access")).thenReturn(Map.of("type", "access", "sub", "admin"));
        when(identities.findUserByUuid("admin")).thenReturn(Optional.of(
                new UserStatus(1L, "admin", "a", "a", "ADMIN", 2, "en")));
        when(guests.findGuestByCookieToken(eq(TokenHasher.sha256("cookie")), eq("cookie")))
                .thenReturn(Map.of("id", 6L, "uuid", "g6"));
        when(merge.merge(6L, 42L)).thenReturn(MergeResult.none());

        AuthenticatedSession s = service.login(new GoogleLoginCommand("id-token", "nonce", null, "other-access", "cookie"));
        assertEquals("g6", s.mergedGuestUuid());
    }

    @Test
    void noGuestNoMerge() {
        when(verifier.verify("id-token")).thenReturn(good());
        when(identities.createUser(any(), any())).thenReturn(42L);
        when(jwt.validateToken("bad")).thenReturn(false);
        when(guests.findGuestByCookieToken(anyString(), any())).thenReturn(null);
        AuthenticatedSession s = service.login(new GoogleLoginCommand("id-token", "nonce", null, "bad", "cookie"));
        assertNull(s.mergedGuestUuid());
        when(jwt.validateToken("refresh-like")).thenReturn(true);
        when(jwt.parseToken("refresh-like")).thenReturn(Map.of("type", "refresh"));
        when(guests.findGuestByCookieToken(anyString(), any())).thenReturn(Map.of("uuid", "x"));
        assertNull(service.login(new GoogleLoginCommand("id-token", "nonce", null, "refresh-like", "c")).mergedGuestUuid());
        verify(merge, never()).merge(anyLong(), anyLong());
    }

    @Test
    void guestThatIsTheUserItselfIsNotMerged() {
        when(verifier.verify("id-token")).thenReturn(good());
        when(identities.createUser(any(), any())).thenReturn(5L);
        when(guests.findGuestByCookieToken(anyString(), any())).thenReturn(Map.of("id", 5L, "uuid", "same"));
        service.setUserState(null);
        assertNull(service.login(new GoogleLoginCommand("id-token", "nonce", null, null, "c")).mergedGuestUuid());
    }

    @Test
    void languagePreference() {
        assertEquals("it", GoogleLoginService.language(" IT ", "en"));
        assertEquals("en", GoogleLoginService.language("fr", "en-GB"));
        assertEquals("it", GoogleLoginService.language(null, "it"));
        assertEquals("en", GoogleLoginService.language(null, "de"));
        assertEquals("en", GoogleLoginService.language(null, "x"));
        assertEquals("en", GoogleLoginService.language(null, null));
    }
}
