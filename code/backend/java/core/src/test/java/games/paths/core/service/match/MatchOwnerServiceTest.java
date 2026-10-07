package games.paths.core.service.match;

import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.model.auth.AdminUserView;
import games.paths.core.model.match.MatchOwnerMoveResult;
import games.paths.core.port.match.CharacterReadPort;
import games.paths.core.port.match.MatchLogWriterPort;
import games.paths.core.port.match.MatchOwnerPort.MatchOwnerException;
import games.paths.core.port.match.MatchOwnerPort.MatchOwnerException.Code;
import games.paths.core.port.match.MatchPersistencePort;
import games.paths.core.port.match.UserDirectoryPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** MatchOwnerService (v0.41.6): resolution order, every refusal, UNCHANGED, repair and the move itself. */
@DisplayName("MatchOwnerService (v0.41.6)")
class MatchOwnerServiceTest {

    private static final String MATCH_UUID = "m-1";
    private static final String NEW_UUID = "11111111-2222-3333-4444-555555555555";
    private static final Instant NOW = Instant.parse("2026-10-03T10:00:00Z");

    private MatchPersistencePort persistence;
    private CharacterReadPort characters;
    private UserDirectoryPort users;
    private MatchLogWriterPort logWriter;
    private MatchOwnerService service;
    private GamingMatchEntity match;

    private static AdminUserView user(long id, String uuid, String username, String role, Integer state,
                                      String expires) {
        return new AdminUserView(id, uuid, username, null, username + "@x.it", role, state, expires,
                null, null, 0);
    }

    private static final AdminUserView OLD = user(1, "old-uuid", "alice", "PLAYER", 6, null);
    private static final AdminUserView TARGET = user(2, NEW_UUID, "bob", "PLAYER", 6, "2027-01-01T00:00:00Z");

    private static GamingCharacterInstanceEntity character(long idUser) {
        GamingCharacterInstanceEntity c = new GamingCharacterInstanceEntity();
        c.setIdUser(idUser);
        return c;
    }

    @BeforeEach
    void setUp() {
        persistence = mock(MatchPersistencePort.class);
        characters = mock(CharacterReadPort.class);
        users = mock(UserDirectoryPort.class);
        logWriter = mock(MatchLogWriterPort.class);
        service = new MatchOwnerService(persistence, characters, users, logWriter, Clock.fixed(NOW, ZoneOffset.UTC));
        match = new GamingMatchEntity();
        match.setId(10L);
        match.setUuid(MATCH_UUID);
        match.setIdStory(7L);
        match.setStatus("RUNNING");
        match.setCurrentClock(4);
        match.setIdUserCreator(1L);
        when(persistence.findMatchByUuid(MATCH_UUID)).thenReturn(Optional.of(match));
        when(characters.findCharactersByMatchId(10L)).thenReturn(List.of(character(1)));
        when(users.findById(1L)).thenReturn(Optional.of(OLD));
        when(users.findById(2L)).thenReturn(Optional.of(TARGET));
        when(users.findByUuid(NEW_UUID)).thenReturn(Optional.of(TARGET));
        when(users.findByEmail(anyString())).thenReturn(List.of());
        when(users.findByUsername(anyString())).thenReturn(List.of());
        when(users.findByUsername("bob")).thenReturn(List.of(TARGET));
        when(persistence.changeOwner(10L, 2L)).thenReturn(1);
        when(persistence.countMatchesByUserCreator(anyLong())).thenReturn(3L);
    }

    private Code codeOf(Runnable call) {
        return assertThrows(MatchOwnerException.class, call::run).getCode();
    }

    private void assertNothingWritten() {
        verify(persistence, never()).changeOwner(anyLong(), anyLong());
        verify(logWriter, never()).write(anyLong(), any(), any(), anyInt(), anyString());
    }

    // ── owner / findUser ────────────────────────────────────────────────────

    @Test
    @DisplayName("owner answers the creator with its match count")
    void owner() {
        AdminUserView v = service.owner(MATCH_UUID);
        assertEquals("alice", v.username());
        assertEquals(3L, v.matchCount());
        verify(persistence).countMatchesByUserCreator(1L);
    }

    @Test
    @DisplayName("owner: blank uuid 400, unknown match 404, a vanished or null creator USER_NOT_FOUND")
    void ownerErrors() {
        assertEquals(Code.INVALID_INPUT, codeOf(() -> service.owner(" ")));
        assertEquals(Code.INVALID_INPUT, codeOf(() -> service.owner(null)));
        assertEquals(Code.MATCH_NOT_FOUND, codeOf(() -> service.owner("nope")));
        when(users.findById(1L)).thenReturn(Optional.empty());
        assertEquals(Code.USER_NOT_FOUND, codeOf(() -> service.owner(MATCH_UUID)));
        match.setIdUserCreator(null);
        assertEquals(Code.USER_NOT_FOUND, codeOf(() -> service.owner(MATCH_UUID)));
    }

    @Test
    @DisplayName("findUser: a uuid hit wins, its count is filled")
    void findByUuid() {
        assertEquals(3L, service.findUser(" " + NEW_UUID + " ").matchCount());
        verify(users, never()).findByEmail(anyString());
    }

    @Test
    @DisplayName("findUser: uuid miss falls back to email, then username")
    void fallbacks() {
        String unknownUuid = "99999999-2222-3333-4444-555555555555";
        when(users.findByUuid(unknownUuid)).thenReturn(Optional.empty());
        when(users.findByUsername(unknownUuid)).thenReturn(List.of(OLD));
        assertEquals("alice", service.findUser(unknownUuid).username());
        when(users.findByEmail("bob@x.it")).thenReturn(List.of(TARGET));
        assertEquals("bob", service.findUser("bob@x.it").username());
        assertEquals("bob", service.findUser("bob").username());
        verify(users, never()).findByUuid("bob");
    }

    @Test
    @DisplayName("findUser: blank 400, nobody 404, two emails or two usernames USER_AMBIGUOUS")
    void findErrors() {
        assertEquals(Code.INVALID_INPUT, codeOf(() -> service.findUser("")));
        assertEquals(Code.USER_NOT_FOUND, codeOf(() -> service.findUser("ghost")));
        when(users.findByEmail("dup@x.it")).thenReturn(List.of(OLD, TARGET));
        assertEquals(Code.USER_AMBIGUOUS, codeOf(() -> service.findUser("dup@x.it")));
        when(users.findByUsername("twin")).thenReturn(List.of(OLD, TARGET));
        assertEquals(Code.USER_AMBIGUOUS, codeOf(() -> service.findUser("twin")));
        when(users.findByEmail("nil")).thenReturn(null);
        assertEquals(Code.USER_NOT_FOUND, codeOf(() -> service.findUser("nil")));
    }

    @Test
    @DisplayName("a 36-char string that is not a uuid is not looked up by uuid")
    void notAUuid() {
        String fake = "zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz";
        assertEquals(Code.USER_NOT_FOUND, codeOf(() -> service.findUser(fake)));
        verify(users, never()).findByUuid(fake);
        assertEquals(Code.USER_NOT_FOUND, codeOf(() -> service.findUser("1-1-1-1-1")));
        verify(users, never()).findByUuid("1-1-1-1-1");
    }

    // ── move ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("moves creator and characters, writes one ADMIN OWNER_CHANGED row")
    void moves() {
        MatchOwnerMoveResult r = service.move(MATCH_UUID, "bob");
        assertEquals(MatchOwnerMoveResult.MOVED, r.status());
        assertEquals(MATCH_UUID, r.matchUuid());
        assertEquals(new MatchOwnerMoveResult.Owner("old-uuid", "alice"), r.previousOwner());
        assertEquals(new MatchOwnerMoveResult.Owner(NEW_UUID, "bob"), r.owner());
        assertEquals(1, r.charactersMoved());
        verify(persistence).changeOwner(10L, 2L);
        verify(persistence).hasActiveMatchForStory(eq(2L), eq(7L), anyList());
        verify(logWriter).write(10L, null, null, 4,
                "ADMIN_OWNER_CHANGED from=alice/old-uuid to=bob/" + NEW_UUID);
    }

    @Test
    @DisplayName("a missing previous owner, a null clock and no log writer still move")
    void movesWithoutPreviousOwner() {
        when(users.findById(1L)).thenReturn(Optional.empty());
        match.setCurrentClock(null);
        MatchOwnerMoveResult r = service.move(MATCH_UUID, "bob");
        assertNull(r.previousOwner().uuid());
        verify(logWriter).write(10L, null, null, 0, "ADMIN_OWNER_CHANGED from=null/null to=bob/" + NEW_UUID);
        MatchOwnerService quiet = new MatchOwnerService(persistence, characters, users, null);
        assertEquals(MatchOwnerMoveResult.MOVED, quiet.move(MATCH_UUID, "bob").status());
    }

    @Test
    @DisplayName("same owner owning every character: UNCHANGED, nothing written")
    void unchanged() {
        match.setIdUserCreator(2L);
        when(characters.findCharactersByMatchId(10L)).thenReturn(List.of(character(2)));
        MatchOwnerMoveResult r = service.move(MATCH_UUID, NEW_UUID);
        assertEquals(MatchOwnerMoveResult.UNCHANGED, r.status());
        assertEquals(0, r.charactersMoved());
        assertNothingWritten();
        verify(persistence, never()).hasActiveMatchForStory(any(), any(), anyList());
    }

    @Test
    @DisplayName("a half-written move (creator moved, character not, or the reverse) is repaired")
    void repairs() {
        match.setIdUserCreator(2L);
        when(characters.findCharactersByMatchId(10L)).thenReturn(List.of(character(1)));
        when(persistence.hasActiveMatchForStory(eq(2L), eq(7L), anyList())).thenReturn(true);
        assertEquals(MatchOwnerMoveResult.MOVED, service.move(MATCH_UUID, "bob").status());
        when(persistence.hasActiveMatchForStory(eq(2L), eq(7L), anyList())).thenReturn(false);
        match.setIdUserCreator(1L);
        when(characters.findCharactersByMatchId(10L)).thenReturn(List.of(character(2)));
        assertEquals(MatchOwnerMoveResult.MOVED, service.move(MATCH_UUID, "bob").status());
        verify(persistence, times(2)).changeOwner(10L, 2L);
    }

    @Test
    @DisplayName("400 on a blank user or uuid, 404 on unknown match or user, 409 ambiguous")
    void inputErrors() {
        assertEquals(Code.INVALID_INPUT, codeOf(() -> service.move(MATCH_UUID, " ")));
        assertEquals(Code.INVALID_INPUT, codeOf(() -> service.move(MATCH_UUID, null)));
        assertEquals(Code.INVALID_INPUT, codeOf(() -> service.move("", "bob")));
        assertEquals(Code.MATCH_NOT_FOUND, codeOf(() -> service.move("nope", "bob")));
        assertEquals(Code.USER_NOT_FOUND, codeOf(() -> service.move(MATCH_UUID, "ghost")));
        assertNothingWritten();
    }

    @ParameterizedTest
    @ValueSource(strings = {"ENDED", "GAMEOVER"})
    @DisplayName("a terminated match is refused with MATCH_TERMINATED")
    void terminated(String status) {
        match.setStatus(status);
        assertEquals(Code.MATCH_TERMINATED, codeOf(() -> service.move(MATCH_UUID, "bob")));
        assertNothingWritten();
    }

    @Test
    @DisplayName("more than one character: MATCH_MULTI_CHARACTER")
    void multiCharacter() {
        when(characters.findCharactersByMatchId(10L)).thenReturn(List.of(character(1), character(3)));
        assertEquals(Code.MATCH_MULTI_CHARACTER, codeOf(() -> service.move(MATCH_UUID, "bob")));
        when(characters.findCharactersByMatchId(10L)).thenReturn(List.of(character(1), character(2)));
        assertEquals(Code.MATCH_MULTI_CHARACTER, codeOf(() -> service.move(MATCH_UUID, "bob")));
        assertNothingWritten();
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 3, 4, 5})
    @DisplayName("a non-active state is refused with USER_NOT_ALLOWED")
    void notAllowedStates(int state) {
        when(users.findByUsername("carl")).thenReturn(List.of(user(3, "c", "carl", "PLAYER", state, null)));
        assertEquals(Code.USER_NOT_ALLOWED, codeOf(() -> service.move(MATCH_UUID, "carl")));
        assertNothingWritten();
    }

    @Test
    @DisplayName("an ADMIN or a null state is USER_NOT_ALLOWED, an expired guest USER_EXPIRED")
    void refusals() {
        when(users.findByUsername("root")).thenReturn(List.of(user(3, "r", "root", "ADMIN", 2, null)));
        assertEquals(Code.USER_NOT_ALLOWED, codeOf(() -> service.move(MATCH_UUID, "root")));
        when(users.findByUsername("nul")).thenReturn(List.of(user(4, "n", "nul", "PLAYER", null, null)));
        assertEquals(Code.USER_NOT_ALLOWED, codeOf(() -> service.move(MATCH_UUID, "nul")));
        when(users.findByUsername("old")).thenReturn(List.of(user(5, "o", "old", "PLAYER", 6, "2026-01-01T00:00:00Z")));
        MatchOwnerException ex = assertThrows(MatchOwnerException.class, () -> service.move(MATCH_UUID, "old"));
        assertEquals(Code.USER_EXPIRED, ex.getCode());
        assertTrue(ex.getMessage().contains("expired"));
        assertNothingWritten();
    }

    @Test
    @DisplayName("an imported guest without expiry and an active player are valid targets")
    void validTargets() {
        when(users.findByUsername("imp")).thenReturn(List.of(user(6, "i", "imp", "PLAYER", 6, null)));
        when(persistence.changeOwner(10L, 6L)).thenReturn(1);
        assertEquals(MatchOwnerMoveResult.MOVED, service.move(MATCH_UUID, "imp").status());
        when(users.findByUsername("reg")).thenReturn(List.of(user(7, "g", "reg", "PLAYER", 2, null)));
        assertEquals(MatchOwnerMoveResult.MOVED, service.move(MATCH_UUID, "reg").status());
    }

    @Test
    @DisplayName("the target owning an active match on the story: ACTIVE_MATCH_ALREADY_EXISTS")
    void activeConflict() {
        when(persistence.hasActiveMatchForStory(eq(2L), eq(7L), anyList())).thenReturn(true);
        assertEquals(Code.ACTIVE_MATCH_ALREADY_EXISTS, codeOf(() -> service.move(MATCH_UUID, "bob")));
        assertNothingWritten();
    }

    @Test
    @DisplayName("the default constructor uses the system clock")
    void defaultClock() {
        MatchOwnerService real = new MatchOwnerService(persistence, characters, users, logWriter);
        assertEquals(MatchOwnerMoveResult.MOVED, real.move(MATCH_UUID, "bob").status());
    }
}
