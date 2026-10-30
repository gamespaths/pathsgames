package games.paths.core.service.auth;

import games.paths.core.model.auth.AdminActions;
import games.paths.core.model.auth.AdminUserItem;
import games.paths.core.model.auth.AuthException;
import games.paths.core.model.auth.UserIdentity;
import games.paths.core.model.auth.UserStates;
import games.paths.core.model.auth.UserStatus;
import games.paths.core.port.auth.AdminInterventionPort;
import games.paths.core.port.auth.UserAdminPersistencePort;
import games.paths.core.port.auth.UserStatePort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** AccountGuardService (v1.7.0 step 10): banned hashes, end of suspension, armed re-link; SubjectHasher. */
class AccountGuardServiceTest {

    private UserAdminPersistencePort persistence;
    private AdminInterventionPort log;
    private UserStatePort userState;
    private final SubjectHasher hasher = new SubjectHasher("pepper");
    private AccountGuardService guard;

    @BeforeEach
    void setUp() {
        persistence = mock(UserAdminPersistencePort.class);
        log = mock(AdminInterventionPort.class);
        userState = mock(UserStatePort.class);
        guard = new AccountGuardService(persistence, log, userState, hasher);
        guard.setClock(Clock.fixed(Instant.parse("2026-10-22T10:00:00Z"), ZoneOffset.UTC));
    }

    private static UserStatus status(int state) {
        return new UserStatus(7L, "u-7", "google_u7", "alice", "PLAYER", state, "en");
    }

    private void suspendedUntil(String until) {
        when(persistence.findByUuid("u-7")).thenReturn(Optional.of(new AdminUserItem(7L, "u-7", "alice", 3, "PLAYER",
                "GOOGLE", null, null, until)));
    }

    @Test
    void bannedSubjectOrEmailIsRefused() {
        when(persistence.isBanned(hasher.subject("sub"), hasher.email("A@gmail.com"))).thenReturn(true);
        AuthException e = assertThrows(AuthException.class, () -> guard.checkNotBanned("sub", "A@gmail.com"));
        assertEquals(AuthException.Code.ACCOUNT_DISABLED, e.getCode());
        assertDoesNotThrow(() -> guard.checkNotBanned("other", "b@gmail.com"));
    }

    @Test
    void anEndedSuspensionUnblocksAndLogsASystemAction() {
        suspendedUntil("2026-10-22T09:00:00Z");
        UserStatus admitted = guard.admit(status(UserStates.BLOCKED));
        assertEquals(UserStates.ACTIVE, admitted.state());
        verify(persistence).updateStateAndSuspension(7L, UserStates.ACTIVE, null);
        verify(userState).evict("u-7");
        verify(log).record(AdminActions.SYSTEM, AdminActions.UNBLOCK, "u-7", AccountGuardService.AUTO_UNBLOCK_REASON);
    }

    @Test
    void anActiveSuspensionAnswersAccountDisabledWithTheDate() {
        suspendedUntil("2026-11-01T00:00:00Z");
        AuthException e = assertThrows(AuthException.class, () -> guard.admit(status(UserStates.BLOCKED)));
        assertEquals(AuthException.Code.ACCOUNT_DISABLED, e.getCode());
        assertEquals("2026-11-01T00:00:00Z", e.getSuspendedUntil());
        verifyNoInteractions(log);
    }

    @Test
    void blockedWithoutDateBannedAndDeletingAreRefused() {
        suspendedUntil("not a date");
        assertNull(assertThrows(AuthException.class, () -> guard.admit(status(UserStates.BLOCKED))).getSuspendedUntil());
        when(persistence.findByUuid("u-7")).thenReturn(Optional.empty());
        assertThrows(AuthException.class, () -> guard.admit(status(UserStates.BLOCKED)));
        assertThrows(AuthException.class, () -> guard.admit(status(UserStates.BANNED)));
        assertEquals(AuthException.Code.ACCOUNT_DELETION_IN_PROGRESS,
                assertThrows(AuthException.class, () -> guard.admit(status(UserStates.DELETING))).getCode());
        assertEquals(UserStates.ACTIVE, guard.admit(status(UserStates.ACTIVE)).state());
        assertNull(AccountGuardService.parse(null));
        assertNull(AccountGuardService.parse(" "));
    }

    @Test
    void relinkOnlyWhenArmed() {
        UserIdentity identity = new UserIdentity(3L, 7L, "GOOGLE", "old", "a@gmail.com", null, null, null, null,
                null, null);
        assertFalse(guard.relink(identity, "new"));
        when(persistence.isRelinkPending(7L)).thenReturn(true);
        assertTrue(guard.relink(identity, "new"));
        verify(persistence).replaceIdentitySubject(3L, 7L, "new");
        assertFalse(guard.relink(null, "new"));
        assertFalse(guard.relink(new UserIdentity(null, 7L, "GOOGLE", "o", "e", null, null, null, null, null, null),
                "n"));
        assertFalse(guard.relink(new UserIdentity(3L, null, "GOOGLE", "o", "e", null, null, null, null, null, null),
                "n"));
    }

    @Test
    void hasherIsStableNormalisesEmailsAndDependsOnThePepper() {
        assertEquals(hasher.email(" A@Gmail.com "), hasher.email("a@gmail.com"));
        assertEquals(64, hasher.subject("sub").length());
        assertNotEquals(hasher.subject("sub"), new SubjectHasher("other").subject("sub"));
        assertEquals(new SubjectHasher(null).subject("s"), new SubjectHasher(SubjectHasher.DEFAULT_PEPPER).subject("s"));
        assertEquals(new SubjectHasher(" ").subject("s"), new SubjectHasher(SubjectHasher.DEFAULT_PEPPER).subject("s"));
        assertNull(hasher.subject(null));
        assertNull(hasher.subject(" "));
        assertNull(hasher.email(null));
        assertNull(hasher.email(""));
    }

    @Test
    void authExceptionCarriesTheSuspensionEnd() {
        assertNull(new AuthException(AuthException.Code.ACCOUNT_DISABLED, "x").getSuspendedUntil());
        assertNull(new AuthException(AuthException.Code.ACCOUNT_DISABLED, "x", new RuntimeException()).getSuspendedUntil());
    }
}
