package games.paths.core.model.auth;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests of the v1.2.0 auth models: error codes, state rules, profile and display name, toString redaction.
 */
class AuthModelsTest {

    private static GoogleIdentityClaims claims(String name, String given, String family) {
        return new GoogleIdentityClaims("sub-1", "mario.rossi@gmail.com", true, name, given, family,
                "https://lh3.googleusercontent.com/p", "it", "n", "https://accounts.google.com", "client", 2L, 1L);
    }

    @Test
    void authExceptionCarriesCodeAndStatus() {
        AuthException e = new AuthException(AuthException.Code.IDENTITY_MISMATCH, "m");
        assertEquals(AuthException.Code.IDENTITY_MISMATCH, e.getCode());
        assertEquals(409, e.getCode().httpStatus());
        assertEquals("m", e.getMessage());
        Throwable cause = new IllegalStateException();
        assertSame(cause, new AuthException(AuthException.Code.PROVIDER_UNAVAILABLE, "x", cause).getCause());
        assertEquals(503, AuthException.Code.GOOGLE_DISABLED.httpStatus());
    }

    @Test
    void requireUsable() {
        UserStates.requireUsable(UserStates.ACTIVE);
        UserStates.requireUsable(UserStates.GUEST);
        assertEquals(AuthException.Code.ACCOUNT_DISABLED, assertThrows(AuthException.class,
                () -> UserStates.requireUsable(UserStates.BLOCKED)).getCode());
        assertEquals(AuthException.Code.ACCOUNT_DISABLED, assertThrows(AuthException.class,
                () -> UserStates.requireUsable(UserStates.BANNED)).getCode());
        assertEquals(AuthException.Code.ACCOUNT_DELETION_IN_PROGRESS, assertThrows(AuthException.class,
                () -> UserStates.requireUsable(UserStates.DELETING)).getCode());
    }

    @Test
    void userStatusFlags() {
        UserStatus admin = new UserStatus(1, "u", "admin_x", "boss", "ADMIN", 2, "en");
        UserStatus guest = new UserStatus(2, "g", "guest_x", "guest_x", "PLAYER", 6, "en");
        assertTrue(admin.isAdmin());
        assertFalse(admin.isGuest());
        assertTrue(guest.isGuest());
        assertFalse(guest.isAdmin());
    }

    @Test
    void displayNameRule() {
        UserIdentity both = UserIdentity.fromGoogle(claims("Full", "Mario", "Rossi"), "m@gmail.com", "t");
        assertEquals("Mario Rossi", UserProfile.displayNameOf(both, "nick"));
        UserIdentity given = UserIdentity.fromGoogle(claims("Full", "Mario", " "), "m@gmail.com", "t");
        assertEquals("Mario", UserProfile.displayNameOf(given, "nick"));
        UserIdentity family = UserIdentity.fromGoogle(claims("Full", null, "Rossi"), "m@gmail.com", "t");
        assertEquals("Rossi", UserProfile.displayNameOf(family, "nick"));
        UserIdentity nameOnly = UserIdentity.fromGoogle(claims(" Full ", null, null), "m@gmail.com", "t");
        assertEquals("Full", UserProfile.displayNameOf(nameOnly, "nick"));
        UserIdentity none = UserIdentity.fromGoogle(claims(null, null, null), "m@gmail.com", "t");
        assertEquals("nick", UserProfile.displayNameOf(none, "nick"));
        assertEquals("nick", UserProfile.displayNameOf(null, "nick"));
    }

    @Test
    void profileAccountTypes() {
        UserIdentity identity = UserIdentity.fromGoogle(claims("F", "Mario", "Rossi"), "m@gmail.com", "t");
        UserStatus player = new UserStatus(1, "u", "google_x", "mario", "PLAYER", 2, "it");
        UserProfile google = UserProfile.of(player, identity);
        assertEquals(UserProfile.TYPE_GOOGLE, google.accountType());
        assertEquals("https://lh3.googleusercontent.com/p", google.pictureUrl());
        assertEquals("Mario Rossi", google.displayName());
        assertEquals(UserProfile.TYPE_GUEST,
                UserProfile.of(new UserStatus(2, "g", "guest_x", "guest_x", "PLAYER", 6, "en"), null).accountType());
        UserProfile internal = UserProfile.of(new UserStatus(3, "a", "admin_x", "boss", "ADMIN", 2, "en"), null);
        assertEquals(UserProfile.TYPE_INTERNAL, internal.accountType());
        assertNull(internal.pictureUrl());
        assertFalse(google.toString().contains("Rossi"));
    }

    @Test
    void toStringNeverCarriesPersonalData() {
        GoogleIdentityClaims c = claims("Mario Rossi", "Mario", "Rossi");
        UserIdentity identity = new UserIdentity(1L, 2L, "GOOGLE", "sub", "mario@gmail.com", "Mario Rossi", "Mario",
                "Rossi", "pic", "it", "t");
        NewUser user = new NewUser("uuid", "google_x", "mario", "mario@gmail.com", "PLAYER", 2, "en");
        UserProfile profile = new UserProfile("uuid", "google_x", "mario", "Mario Rossi", "pic", "PLAYER", 2, "en",
                "GOOGLE");
        AuthenticatedSession session = new AuthenticatedSession(profile, "a", "r", 1L, 2L, true, null, 0);
        GoogleLoginCommand command = new GoogleLoginCommand("tok", "nonce", "it", null, null);
        AdminBootstrapResult admin = new AdminBootstrapResult("uuid", "admin_x", "boss", true, "secret-token", 5L);
        for (Object o : List.of(c, identity, user, profile, session, command, admin)) {
            String text = o.toString();
            assertFalse(text.contains("mario@gmail.com"), text);
            assertFalse(text.contains("Rossi"), text);
            assertFalse(text.contains("secret-token"), text);
            assertFalse(text.contains("tok'"), text);
        }
    }

    @Test
    void smallRecords() {
        assertEquals(0, MergeResult.none().movedMatches());
        assertTrue(MergeResult.none().cancelledMatchIds().isEmpty());
        MatchOwnership m = new MatchOwnership(1L, "u", 2L, "RUNNING", "t");
        assertEquals(2L, m.storyId());
        StoredRefreshToken t = new StoredRefreshToken(1L, 2L, true, "e", "r");
        assertTrue(t.revoked());
        assertEquals(1L, new AuthenticatedSession(null, "a", "r", 1L, 2L, false, "g", 3).accessTokenExpiresAt());
    }

    @Test
    void cancelledMatchUuidsDefaultToEmpty() {
        assertTrue(MergeResult.none().cancelledMatchUuids().isEmpty());
        assertTrue(new MergeResult(1, List.of(4L)).cancelledMatchUuids().isEmpty());
        assertTrue(new MergeResult(1, null, null).cancelledMatchIds().isEmpty());
        assertEquals(List.of("m"), new MergeResult(1, List.of(4L), List.of("m")).cancelledMatchUuids());
        assertTrue(new AuthenticatedSession(null, "a", "r", 1L, 2L, false, "g", 3).cancelledMatchUuids().isEmpty());
        assertTrue(new AuthenticatedSession(null, "a", "r", 1L, 2L, false, "g", 3, null).cancelledMatchUuids().isEmpty());
        assertEquals(List.of("x"),
                new AuthenticatedSession(null, "a", "r", 1L, 2L, false, "g", 1, List.of("x")).cancelledMatchUuids());
    }
}
