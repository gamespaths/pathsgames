package games.paths.core.service.auth;

import games.paths.core.model.auth.AdminActions;
import games.paths.core.model.auth.AdminUserActionResult;
import games.paths.core.model.auth.AdminUserDetail;
import games.paths.core.model.auth.AdminUserItem;
import games.paths.core.model.auth.AdminUserListFilter;
import games.paths.core.model.auth.AdminUserPage;
import games.paths.core.model.auth.UserAdminException;
import games.paths.core.model.auth.UserIdentity;
import games.paths.core.model.auth.UserStates;
import games.paths.core.model.auth.UserStats;
import games.paths.core.model.match.MatchStatuses;
import games.paths.core.port.auth.AccountPort;
import games.paths.core.port.auth.AdminInterventionPort;
import games.paths.core.port.auth.IdentityPersistencePort;
import games.paths.core.port.auth.TokenPersistencePort;
import games.paths.core.port.auth.UserAdminPersistencePort;
import games.paths.core.port.auth.UserStatePort;
import games.paths.core.port.match.MatchCommandPort;
import games.paths.core.port.match.MatchPersistencePort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** UserAdminService (v1.7.0 step 10): list rules, actions, refusals and the intervention log. */
class UserAdminServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-22T10:00:00Z");
    private static final SubjectHasher HASHER = new SubjectHasher("pepper");

    private IdentityPersistencePort identities;
    private UserAdminPersistencePort persistence;
    private TokenPersistencePort tokens;
    private UserStatePort userState;
    private AdminInterventionPort log;
    private MatchPersistencePort matches;
    private MatchCommandPort commands;
    private AccountPort accounts;
    private UserAdminService service;

    @BeforeEach
    void setUp() {
        identities = mock(IdentityPersistencePort.class);
        persistence = mock(UserAdminPersistencePort.class);
        tokens = mock(TokenPersistencePort.class);
        userState = mock(UserStatePort.class);
        log = mock(AdminInterventionPort.class);
        matches = mock(MatchPersistencePort.class);
        commands = mock(MatchCommandPort.class);
        accounts = mock(AccountPort.class);
        service = new UserAdminService(identities, persistence, tokens, userState, log, HASHER, matches, commands,
                accounts);
        service.setClock(Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private static AdminUserItem user(int state, String role) {
        return new AdminUserItem(7L, "u-7", "Alice", state, role, "GOOGLE", "2026-01-01", "2026-10-01", null);
    }

    private void known(AdminUserItem item) {
        when(persistence.findByUuid("u-7")).thenReturn(Optional.of(item));
    }

    private void googleIdentity() {
        when(identities.findIdentitiesOfUser(7L)).thenReturn(List.of(new UserIdentity(3L, 7L, "GOOGLE", "sub-7",
                "alice@gmail.com", null, null, null, null, null, null)));
    }

    // ── list ──

    @Test
    void defaultViewIsActiveUsersByLastAccessWithCursor() {
        AdminUserItem a = user(2, "PLAYER");
        AdminUserItem b = new AdminUserItem(8L, "u-8", "bob", 2, "PLAYER", "GOOGLE", null, null, null);
        when(persistence.listByLastAccess(UserStates.ACTIVE, null, null, 2)).thenReturn(List.of(a, b));
        AdminUserPage page = service.list(new AdminUserListFilter(null, null, null, null, 1));
        assertEquals(List.of(a), page.items());
        assertEquals(1, page.limit());
        String[] cursor = UserAdminService.decodeCursor(page.nextCursor());
        assertArrayEquals(new String[]{"2026-10-01", "u-7"}, cursor);
        service.list(new AdminUserListFilter(null, null, null, page.nextCursor(), 1));
        verify(persistence).listByLastAccess(UserStates.ACTIVE, "2026-10-01", "u-7", 2);
    }

    @Test
    void lastPageWithoutAccessHasNoCursorAndNullFilter() {
        when(persistence.listByLastAccess(UserStates.ACTIVE, null, null, 51)).thenReturn(List.of());
        AdminUserPage page = service.list(null);
        assertNull(page.nextCursor());
        assertEquals(50, page.limit());
    }

    @Test
    void stateOrNicknameUsesTheAlphabeticalOrder() {
        AdminUserItem a = user(3, "PLAYER");
        AdminUserItem b = new AdminUserItem(8L, "u-8", null, 3, "PLAYER", "GOOGLE", null, null, null);
        when(persistence.listByNickname(3, "al", null, null, 2)).thenReturn(List.of(a, b));
        AdminUserPage page = service.list(new AdminUserListFilter(" ", " AL ", "3", "%%%", 1));
        assertArrayEquals(new String[]{"alice", "u-7"}, UserAdminService.decodeCursor(page.nextCursor()));
        when(persistence.listByNickname(null, "x", null, null, 201)).thenReturn(List.of());
        assertTrue(service.list(new AdminUserListFilter(null, "x", null, null, 999)).items().isEmpty());
        when(persistence.listByNickname(4, "", null, null, 2)).thenReturn(List.of(b, a));
        assertArrayEquals(new String[]{"", "u-8"},
                UserAdminService.decodeCursor(service.list(new AdminUserListFilter(null, null, "4", null, 1)).nextCursor()));
    }

    @Test
    void emailIsExactAndLowercaseAndHonoursTheState() {
        when(persistence.findByEmail("alice@gmail.com")).thenReturn(Optional.of(user(2, "PLAYER")));
        assertEquals(1, service.list(new AdminUserListFilter(" Alice@Gmail.com ", null, null, null, null)).items().size());
        assertEquals(0, service.list(new AdminUserListFilter("alice@gmail.com", null, "3", null, null)).items().size());
        assertEquals(1, service.list(new AdminUserListFilter("alice@gmail.com", null, "2", null, null)).items().size());
        assertTrue(service.list(new AdminUserListFilter("nobody@gmail.com", null, null, null, 0)).items().isEmpty());
    }

    @Test
    void guestsAndBadStatesAreNotListable() {
        for (String state : new String[]{"6", "0", "8", "x"}) {
            UserAdminException e = assertThrows(UserAdminException.class,
                    () -> service.list(new AdminUserListFilter(null, null, state, null, null)));
            assertEquals(UserAdminException.Code.INVALID_INPUT, e.getCode());
        }
    }

    @Test
    void cursorHelpers() {
        assertNull(UserAdminService.decodeCursor(null));
        assertNull(UserAdminService.decodeCursor(UserAdminService.encodeCursor("x", "").replace("fA", "")));
        assertNull(UserAdminService.decodeCursor(java.util.Base64.getUrlEncoder().encodeToString("nosep".getBytes())));
        assertNull(UserAdminService.decodeCursor(java.util.Base64.getUrlEncoder().encodeToString("key|".getBytes())));
        assertEquals("", UserAdminService.nicknameKey(null));
        assertEquals(400, UserAdminException.Code.SUSPEND_UNTIL_INVALID.httpStatus());
    }

    // ── detail ──

    @Test
    void detailCarriesIdentitiesStatsSessionsAndFlags() {
        known(user(3, "PLAYER"));
        googleIdentity();
        when(accounts.stats("u-7")).thenReturn(new UserStats(1, 1, 0, 5, 2));
        when(tokens.countActiveTokensByUserId(7L)).thenReturn(2);
        when(persistence.isRelinkPending(7L)).thenReturn(true);
        when(persistence.hasBannedHashes("u-7")).thenReturn(false);
        AdminUserDetail d = service.detail("u-7");
        assertEquals("GOOGLE", d.accountType());
        assertEquals(2, d.sessions());
        assertTrue(d.relinkPending());
        assertEquals(1, d.identities().size());
        assertEquals(1, d.stats().matchesCompleted());
        assertNull(service.detail("missing"));
    }

    @Test
    void detailOfAGuestWithoutTheAccountPort() {
        service = new UserAdminService(identities, persistence, tokens, userState, log, HASHER, matches, commands,
                null);
        known(user(6, "PLAYER"));
        AdminUserDetail d = service.detail("u-7");
        assertEquals("GUEST", d.accountType());
        assertEquals(UserStats.EMPTY, d.stats());
    }

    // ── ban ──

    @Test
    void banWritesHashesRevokesEvictsBansActiveMatchesAndLogs() {
        known(user(2, "PLAYER"));
        googleIdentity();
        when(persistence.findEmail(7L)).thenReturn(Optional.empty());
        when(matches.findMatchUuidsByUserCreator(7L, MatchStatuses.ACTIVE)).thenReturn(List.of("m-1", "m-2"));
        when(commands.updateMatch("m-1", MatchStatuses.BANNED, null, AdminActions.BAN))
                .thenReturn(MatchCommandPort.UpdateOutcome.UPDATED);
        when(commands.updateMatch("m-2", MatchStatuses.BANNED, null, AdminActions.BAN))
                .thenReturn(MatchCommandPort.UpdateOutcome.NOT_FOUND);
        AdminUserActionResult r = service.ban("adm", "u-7", " spam ");
        assertEquals(UserStates.BANNED, r.state());
        assertEquals(List.of("m-1"), r.bannedMatchUuids());
        verify(persistence).storeBannedHashes("u-7", HASHER.subject("sub-7"), HASHER.email("alice@gmail.com"));
        verify(persistence).updateStateAndSuspension(7L, UserStates.BANNED, null);
        verify(tokens).revokeAllUserTokens(7L, games.paths.core.model.auth.RevokeReasons.ADMIN);
        verify(tokens).setSessionsValidAfter(eq(7L), anyString());
        verify(userState).evict("u-7");
        verify(log).record("adm", AdminActions.BAN, "u-7", "spam");
    }

    @Test
    void banOfADeletingUserKeepsState7AndUsesTheStoredEmail() {
        known(user(7, "PLAYER"));
        when(identities.findIdentitiesOfUser(7L)).thenReturn(List.of());
        when(persistence.findEmail(7L)).thenReturn(Optional.of("old@gmail.com"));
        when(matches.findMatchUuidsByUserCreator(anyLong(), any())).thenReturn(List.of());
        AdminUserActionResult r = service.ban("adm", "u-7", "fraud");
        assertEquals(UserStates.DELETING, r.state());
        verify(persistence).storeBannedHashes("u-7", null, HASHER.email("old@gmail.com"));
        verify(persistence).updateStateAndSuspension(7L, UserStates.DELETING, null);
    }

    @Test
    void banRefusals() {
        assertCode(UserAdminException.Code.INVALID_INPUT, () -> service.ban("adm", "u-7", " "));
        assertCode(UserAdminException.Code.INVALID_INPUT, () -> service.ban("adm", "u-7", "x".repeat(501)));
        assertCode(UserAdminException.Code.USER_NOT_FOUND, () -> service.ban("adm", null, "r"));
        assertCode(UserAdminException.Code.USER_NOT_FOUND, () -> service.ban("adm", "u-9", "r"));
        known(user(6, "PLAYER"));
        assertCode(UserAdminException.Code.GUEST_NOT_BANNABLE, () -> service.ban("adm", "u-7", "r"));
        known(user(2, "ADMIN"));
        assertCode(UserAdminException.Code.ADMIN_NOT_BANNABLE, () -> service.ban("adm", "u-7", "r"));
        known(user(4, "PLAYER"));
        assertCode(UserAdminException.Code.INVALID_STATE_TRANSITION, () -> service.ban("adm", "u-7", "r"));
        verifyNoInteractions(log, tokens);
    }

    // ── suspend ──

    @Test
    void suspendSetsTheDateRevokesAndLogs() {
        known(user(2, "PLAYER"));
        AdminUserActionResult r = service.suspend("adm", "u-7", "2026-11-01T00:00:00Z", "rude");
        assertEquals("2026-11-01T00:00:00Z", r.suspendedUntil());
        verify(persistence).updateStateAndSuspension(7L, UserStates.BLOCKED, "2026-11-01T00:00:00Z");
        verify(tokens).revokeAllUserTokens(7L, games.paths.core.model.auth.RevokeReasons.ADMIN);
        verify(tokens).setSessionsValidAfter(eq(7L), anyString());
        verify(log).record("adm", AdminActions.SUSPEND, "u-7", "rude");
        known(user(3, "PLAYER"));
        assertEquals("2026-12-01T00:00:00Z", service.suspend("adm", "u-7", "2026-12-01", "again").suspendedUntil());
    }

    @Test
    void suspendRefusals() {
        known(user(2, "PLAYER"));
        assertCode(UserAdminException.Code.SUSPEND_UNTIL_INVALID, () -> service.suspend("a", "u-7", null, "r"));
        assertCode(UserAdminException.Code.SUSPEND_UNTIL_INVALID, () -> service.suspend("a", "u-7", "soon", "r"));
        assertCode(UserAdminException.Code.SUSPEND_UNTIL_INVALID,
                () -> service.suspend("a", "u-7", "2026-10-21T00:00:00Z", "r"));
        assertCode(UserAdminException.Code.SUSPEND_UNTIL_INVALID, () -> service.suspend("a", "u-7", "2027-02-01", "r"));
        known(user(4, "PLAYER"));
        assertCode(UserAdminException.Code.INVALID_STATE_TRANSITION,
                () -> service.suspend("a", "u-7", "2026-11-01", "r"));
        known(user(2, "ADMIN"));
        assertCode(UserAdminException.Code.ADMIN_NOT_BANNABLE, () -> service.suspend("a", "u-7", "2026-11-01", "r"));
        verifyNoInteractions(log);
    }

    // ── unblock, relink, deletion ──

    @Test
    void unblockRemovesHashesAndLogsButLeavesMatches() {
        known(user(4, "PLAYER"));
        AdminUserActionResult r = service.unblock("adm", "u-7", "appeal");
        assertEquals(UserStates.ACTIVE, r.state());
        verify(persistence).updateStateAndSuspension(7L, UserStates.ACTIVE, null);
        verify(persistence).deleteBannedHashes("u-7");
        verify(userState).evict("u-7");
        verify(log).record("adm", AdminActions.UNBLOCK, "u-7", "appeal");
        verifyNoInteractions(commands);
        known(user(2, "PLAYER"));
        assertCode(UserAdminException.Code.INVALID_STATE_TRANSITION, () -> service.unblock("adm", "u-7", "r"));
    }

    @Test
    void relinkArmsTheFlagForAGoogleUserOnly() {
        known(user(2, "PLAYER"));
        googleIdentity();
        assertTrue(service.relinkSubject("adm", "u-7", "new phone").relinkPending());
        verify(persistence).setRelinkPending(7L, true);
        verify(log).record("adm", AdminActions.RELINK_SUBJECT, "u-7", "new phone");
        when(identities.findIdentitiesOfUser(7L)).thenReturn(List.of(new UserIdentity(3L, 7L, "OTHER", "s", "e",
                null, null, null, null, null, null)));
        assertCode(UserAdminException.Code.INVALID_STATE_TRANSITION, () -> service.relinkSubject("a", "u-7", "r"));
        known(user(6, "PLAYER"));
        assertCode(UserAdminException.Code.INVALID_STATE_TRANSITION, () -> service.relinkSubject("a", "u-7", "r"));
        known(user(7, "PLAYER"));
        assertCode(UserAdminException.Code.INVALID_STATE_TRANSITION, () -> service.relinkSubject("a", "u-7", "r"));
    }

    @Test
    void deleteOldUserGoesToState7() {
        known(user(2, "PLAYER"));
        assertEquals(UserStates.DELETING, service.deleteUser("adm", "u-7", "mismatch").state());
        verify(identities).updateState(7L, UserStates.DELETING);
        verify(tokens).revokeAllUserTokens(7L, games.paths.core.model.auth.RevokeReasons.ADMIN);
        verify(tokens).setSessionsValidAfter(eq(7L), anyString());
        verify(log).record("adm", AdminActions.DELETE_OLD_USER, "u-7", "mismatch");
        known(user(7, "PLAYER"));
        assertCode(UserAdminException.Code.INVALID_STATE_TRANSITION, () -> service.deleteUser("a", "u-7", "r"));
    }

    @Test
    void purgeRemovesRowsOlderThan24Months() {
        when(log.deleteOlderThan("2024-10-22T10:00:00Z")).thenReturn(3);
        assertEquals(3, service.purgeInterventionLog());
    }

    private static void assertCode(UserAdminException.Code code, org.junit.jupiter.api.function.Executable call) {
        assertEquals(code, assertThrows(UserAdminException.class, call).getCode());
    }
}
