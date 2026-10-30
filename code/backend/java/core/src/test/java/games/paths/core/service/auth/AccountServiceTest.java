package games.paths.core.service.auth;

import games.paths.core.model.auth.AuthException;
import games.paths.core.model.auth.GoogleIdentityClaims;
import games.paths.core.model.auth.UserIdentity;
import games.paths.core.model.auth.UserProfile;
import games.paths.core.model.auth.UserStatus;
import games.paths.core.port.auth.GoogleTokenVerifierPort;
import games.paths.core.port.auth.IdentityPersistencePort;
import games.paths.core.port.auth.TokenPersistencePort;
import games.paths.core.port.auth.UserStatePort;
import games.paths.core.port.match.MatchPersistencePort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests of {@link AccountService}: profile, DELETE /api/auth/me fresh-token rules, deletion job
 * (chunked, idempotent) and the 24-month retention.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AccountServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-19T10:00:00Z");
    private static final String CLIENT = "client";

    @Mock private IdentityPersistencePort identities;
    @Mock private GoogleTokenVerifierPort verifier;
    @Mock private TokenPersistencePort tokens;
    @Mock private MatchPersistencePort matches;
    @Mock private UserStatePort userState;

    private AccountService service;
    private final UserStatus user = new UserStatus(8L, "u8", "google_8", "mario", "PLAYER", 2, "it");
    private final UserIdentity identity = new UserIdentity(1L, 8L, "GOOGLE", "sub-1", "mario@gmail.com",
            "Mario Rossi", "Mario", "Rossi", "pic", "it", "t");

    @BeforeEach
    void setUp() {
        service = new AccountService(identities, verifier, tokens, matches, userState);
        service.setClock(Clock.fixed(NOW, ZoneOffset.UTC));
        when(verifier.clientId()).thenReturn(CLIENT);
        when(identities.findUserByUuid("u8")).thenReturn(Optional.of(user));
        when(identities.findIdentitiesOfUser(8L)).thenReturn(List.of(identity));
        when(identities.markIdTokenSeen(anyString(), anyString())).thenReturn(true);
    }

    private static GoogleIdentityClaims claims(String sub, String email, long iat) {
        return new GoogleIdentityClaims(sub, email, true, null, null, null, null, null, "n",
                "accounts.google.com", CLIENT, NOW.getEpochSecond() + 600, iat);
    }

    private AuthException.Code refusal(String token, String nonce) {
        return assertThrows(AuthException.class, () -> service.requestDeletion("u8", token, nonce)).getCode();
    }

    @Test
    void profileOfGoogleAndMissingUser() {
        UserProfile p = service.profile("u8").orElseThrow();
        assertEquals("Mario Rossi", p.displayName());
        assertEquals("GOOGLE", p.accountType());
        when(identities.findUserByUuid("x")).thenReturn(Optional.empty());
        assertTrue(service.profile("x").isEmpty());
    }

    @Test
    void deletionNeedsAFreshTokenOfTheSameAccount() {
        assertEquals(AuthException.Code.FRESH_TOKEN_REQUIRED, refusal(null, null));
        assertEquals(AuthException.Code.FRESH_TOKEN_REQUIRED, refusal(" ", null));
        when(verifier.verify("old")).thenReturn(claims("sub-1", "mario@gmail.com", NOW.getEpochSecond() - 301));
        assertEquals(AuthException.Code.FRESH_TOKEN_REQUIRED, refusal("old", null));
        when(verifier.verify("other")).thenReturn(claims("sub-2", "mario@gmail.com", NOW.getEpochSecond()));
        assertEquals(AuthException.Code.IDENTITY_MISMATCH, refusal("other", null));
        when(verifier.verify("mail")).thenReturn(claims("sub-1", "luigi@gmail.com", NOW.getEpochSecond()));
        assertEquals(AuthException.Code.IDENTITY_MISMATCH, refusal("mail", null));
        when(verifier.verify("nonce")).thenReturn(claims("sub-1", "mario@gmail.com", NOW.getEpochSecond()));
        assertEquals(AuthException.Code.INVALID_NONCE, refusal("nonce", "wrong"));
        verify(identities, never()).updateState(anyLong(), anyInt());
    }

    @Test
    void deletionRefusals() {
        when(identities.findUserByUuid("gone")).thenReturn(Optional.empty());
        assertEquals(AuthException.Code.INVALID_TOKEN, assertThrows(AuthException.class,
                () -> service.requestDeletion("gone", "t", null)).getCode());
        when(identities.findIdentitiesOfUser(8L)).thenReturn(List.of());
        assertEquals(AuthException.Code.NOT_A_GOOGLE_ACCOUNT, refusal("t", null));
        when(identities.findUserByUuid("u8")).thenReturn(Optional.of(
                new UserStatus(8L, "u8", "g", "m", "PLAYER", 7, "en")));
        assertEquals(AuthException.Code.ACCOUNT_DELETION_IN_PROGRESS, refusal("t", null));
    }

    @Test
    void replayedDeletionTokenIsRefused() {
        when(verifier.verify("t")).thenReturn(claims("sub-1", "mario@gmail.com", NOW.getEpochSecond()));
        when(identities.markIdTokenSeen(anyString(), anyString())).thenReturn(false);
        assertEquals(AuthException.Code.TOKEN_REPLAYED, refusal("t", ""));
    }

    @Test
    void deletionSetsStateSevenAndRevokesEverything() {
        when(verifier.verify("t")).thenReturn(claims("sub-1", "Mario@Gmail.com", NOW.getEpochSecond() - 60));
        service.requestDeletion("u8", "t", "n");
        verify(identities).updateState(8L, 7);
        verify(tokens).revokeAllUserTokens(8L);
        verify(userState).evict("u8");
    }

    @Test
    void deletionJobRemovesMatchesThenUser() {
        service.configure(2, 0);
        when(identities.findUserIdsByState(7, 2)).thenReturn(List.of(3L, 4L));
        assertEquals(2, service.runDeletionJob());
        verify(matches).deleteMatchesByUserCreatorIds(List.of(3L));
        verify(identities).deleteUserFully(4L);
        verify(identities).deleteExpiredIdTokens(NOW.toString());
        when(identities.findUserIdsByState(7, 2)).thenReturn(List.of());
        assertEquals(0, service.runDeletionJob());
    }

    @Test
    void retentionMovesIdleUsersToDeleting() {
        service.configure(0, 24);
        when(identities.findInactiveIdentityUserIds("2024-10-19T10:00:00Z", 100)).thenReturn(List.of(8L, 9L));
        when(identities.findUserById(8L)).thenReturn(Optional.of(user));
        when(identities.findUserById(9L)).thenReturn(Optional.empty());
        assertEquals(2, service.retireInactiveUsers());
        verify(identities).updateState(8L, 7);
        verify(identities).updateState(9L, 7);
        verify(userState).evict("u8");
    }
}
