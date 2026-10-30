package games.paths.core.service.auth;

import games.paths.core.model.auth.AdminBootstrapResult;
import games.paths.core.model.auth.AuthException;
import games.paths.core.model.auth.NewUser;
import games.paths.core.model.auth.UserStatus;
import games.paths.core.port.auth.IdentityPersistencePort;
import games.paths.core.port.auth.JwtPort;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Duration;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests of {@link AdminBootstrapService}: a real admin user, reused by nickname, token lifetime.
 */
class AdminBootstrapServiceTest {

    private final IdentityPersistencePort identities = mock(IdentityPersistencePort.class);
    private final JwtPort jwt = mock(JwtPort.class);

    @Test
    void createsTheAdminWithTheConfiguredLifetime() {
        when(identities.findUserByNickname("owner")).thenReturn(Optional.empty());
        when(identities.createUser(any(), isNull())).thenReturn(5L);
        when(jwt.generateAccessToken(anyString(), anyString(), eq("ADMIN"), eq(Duration.ofDays(30)))).thenReturn("tok");

        AdminBootstrapResult r = new AdminBootstrapService(identities, jwt, 30).createAdmin(" owner ");

        ArgumentCaptor<NewUser> user = ArgumentCaptor.forClass(NewUser.class);
        verify(identities).createUser(user.capture(), isNull());
        assertEquals("ADMIN", user.getValue().role());
        assertEquals(2, user.getValue().state());
        assertTrue(user.getValue().username().startsWith("admin_"));
        assertTrue(r.created());
        assertEquals("tok", r.accessToken());
        assertEquals("owner", r.nickname());
    }

    @Test
    void sameNicknameReusesTheAdmin() {
        when(identities.findUserByNickname("owner")).thenReturn(Optional.of(
                new UserStatus(5L, "uuid", "admin_x", "owner", "ADMIN", 2, "en")));
        when(jwt.generateAccessToken(eq("uuid"), eq("admin_x"), eq("ADMIN"), eq(Duration.ofDays(365)))).thenReturn("t2");
        AdminBootstrapResult r = new AdminBootstrapService(identities, jwt, 0).createAdmin("owner");
        assertFalse(r.created());
        assertEquals("t2", r.accessToken());
        verify(identities, never()).createUser(any(), any());
    }

    @Test
    void refusals() {
        AdminBootstrapService service = new AdminBootstrapService(identities, jwt, 365);
        assertEquals(AuthException.Code.INVALID_REQUEST,
                assertThrows(AuthException.class, () -> service.createAdmin(null)).getCode());
        assertEquals(AuthException.Code.INVALID_REQUEST,
                assertThrows(AuthException.class, () -> service.createAdmin("a b")).getCode());
        when(identities.findUserByNickname("mario")).thenReturn(Optional.of(
                new UserStatus(5L, "u", "google_x", "mario", "PLAYER", 2, "en")));
        assertEquals(AuthException.Code.NICKNAME_TAKEN,
                assertThrows(AuthException.class, () -> service.createAdmin("mario")).getCode());
        when(identities.findUserByNickname("banned")).thenReturn(Optional.of(
                new UserStatus(6L, "u", "admin_x", "banned", "ADMIN", 4, "en")));
        assertEquals(AuthException.Code.ACCOUNT_DISABLED,
                assertThrows(AuthException.class, () -> service.createAdmin("banned")).getCode());
    }
}
