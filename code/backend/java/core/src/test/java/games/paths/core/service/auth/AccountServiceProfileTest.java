package games.paths.core.service.auth;

import games.paths.core.model.auth.AuthException;
import games.paths.core.model.auth.UserPreferences;
import games.paths.core.model.auth.UserStats;
import games.paths.core.model.auth.UserStatus;
import games.paths.core.model.match.MatchStatusTotals;
import games.paths.core.model.match.MatchStatuses;
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

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** v1.7.0 the statistics and the preferences of GET / PATCH /api/auth/me in {@link AccountService}. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AccountServiceProfileTest {

    @Mock private IdentityPersistencePort identities;
    @Mock private GoogleTokenVerifierPort verifier;
    @Mock private TokenPersistencePort tokens;
    @Mock private MatchPersistencePort matches;
    @Mock private UserStatePort userState;

    private AccountService service;
    private final UserStatus google = new UserStatus(8L, "u8", "google_8", "mario", "PLAYER", 2, "it");
    private final UserStatus guest = new UserStatus(9L, "g9", "guest_9", "guest_9", "PLAYER", 6, "en");

    @BeforeEach
    void setUp() {
        service = new AccountService(identities, verifier, tokens, matches, userState);
        when(identities.findUserByUuid("u8")).thenReturn(Optional.of(google));
        when(identities.findUserByUuid("g9")).thenReturn(Optional.of(guest));
        when(identities.findUserByUuid("x")).thenReturn(Optional.empty());
    }

    @Test
    void statsCountOnlyThePlayedStatuses() {
        when(matches.totalsByStatus(8L, MatchStatuses.PLAYED)).thenReturn(List.of(
                new MatchStatusTotals("RUNNING", 2, 1000, 5), new MatchStatusTotals("ENDED", 1, 500, 7),
                new MatchStatusTotals("GAMEOVER", 1, 200, 3), new MatchStatusTotals("CANCELLED", 4, 9999, 99)));
        assertEquals(new UserStats(4, 1, 1, 1700, 15), service.stats("u8"));
        assertEquals(UserStats.EMPTY, service.stats("x"));
    }

    @Test
    void guestsGetTheSameStatistics() {
        when(matches.totalsByStatus(9L, MatchStatuses.PLAYED)).thenReturn(List.of(
                new MatchStatusTotals("PAUSED", 1, 300, 2)));
        assertEquals(new UserStats(1, 0, 0, 300, 2), service.stats("g9"));
    }

    @Test
    void preferencesReadLanguageAndTheme() {
        when(identities.findThemeSelected(8L)).thenReturn(Optional.of("high-contrast"));
        UserPreferences p = service.preferences("u8").orElseThrow();
        assertEquals("it", p.language());
        assertTrue(p.highContrast());
        when(identities.findThemeSelected(9L)).thenReturn(Optional.empty());
        assertEquals("default", service.preferences("g9").orElseThrow().theme());
        assertTrue(service.preferences("x").isEmpty());
    }

    @Test
    void updateSavesAPartialBodyAndEvictsTheUser() {
        when(identities.findThemeSelected(8L)).thenReturn(Optional.of("default"));
        UserPreferences p = service.updatePreferences("u8", "en", null);
        verify(identities).updatePreferences(8L, "en", null);
        verify(userState).evict("u8");
        assertEquals(new UserPreferences("en", "default"), p);
        UserPreferences t = service.updatePreferences("u8", null, "high-contrast");
        assertEquals(new UserPreferences("it", "high-contrast"), t);
    }

    @Test
    void updateRefusesGuestsUnknownUsersAndBadValues() {
        assertEquals(AuthException.Code.GOOGLE_ACCOUNT_REQUIRED,
                assertThrows(AuthException.class, () -> service.updatePreferences("g9", "en", null)).getCode());
        assertEquals(AuthException.Code.INVALID_TOKEN,
                assertThrows(AuthException.class, () -> service.updatePreferences("x", "en", null)).getCode());
        assertEquals(AuthException.Code.INVALID_REQUEST,
                assertThrows(AuthException.class, () -> service.updatePreferences("u8", null, null)).getCode());
        assertEquals(AuthException.Code.INVALID_REQUEST,
                assertThrows(AuthException.class, () -> service.updatePreferences("u8", "fr", null)).getCode());
        assertEquals(AuthException.Code.INVALID_REQUEST,
                assertThrows(AuthException.class, () -> service.updatePreferences("u8", null, "neon")).getCode());
        verify(identities, never()).updatePreferences(anyLong(), any(), any());
        assertEquals(403, AuthException.Code.GOOGLE_ACCOUNT_REQUIRED.httpStatus());
    }

    @Test
    void theListsAreConfigurable() {
        assertEquals(List.of("en", "it"), service.supportedLanguages());
        assertEquals(List.of("default", "high-contrast"), service.supportedThemes());
        service.configurePreferences(List.of("en", "it", "fr"), List.of("default", "sepia"));
        assertEquals("fr", service.updatePreferences("u8", "fr", "sepia").language());
        service.configurePreferences(null, List.of());
        assertEquals(UserPreferences.DEFAULT_LANGUAGES, service.supportedLanguages());
        assertEquals(UserPreferences.DEFAULT_THEMES, service.supportedThemes());
    }
}
