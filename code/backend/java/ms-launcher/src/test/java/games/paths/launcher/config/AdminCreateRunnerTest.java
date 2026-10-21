package games.paths.launcher.config;

import games.paths.core.model.auth.AdminBootstrapResult;
import games.paths.core.port.auth.AdminBootstrapPort;
import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultApplicationArguments;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests of {@link AdminCreateRunner} (v1.2.0 --paths.admin.create).
 */
class AdminCreateRunnerTest {

    @Test
    void printsUserAndTokenOnStdout() {
        AdminBootstrapPort port = mock(AdminBootstrapPort.class);
        when(port.createAdmin("owner")).thenReturn(new AdminBootstrapResult("uuid-1", "admin_uuid1", "owner", true,
                "signed-token", 0L));
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        new AdminCreateRunner(port, new PrintStream(out, true, StandardCharsets.UTF_8))
                .run(new DefaultApplicationArguments("--paths.admin.create=owner"));
        String text = out.toString(StandardCharsets.UTF_8);
        assertTrue(text.contains("ADMIN_USER_UUID=uuid-1"));
        assertTrue(text.contains("ADMIN_TOKEN=signed-token"));
        assertTrue(text.contains("ADMIN_CREATED=true"));
        assertNotNull(new AdminCreateRunner(port));
    }

    @Test
    void requestedOnlyWithTheArgument() {
        assertTrue(AdminCreateRunner.requested(new String[]{"--x", "--paths.admin.create=owner"}));
        assertFalse(AdminCreateRunner.requested(new String[]{"--x", null}));
        assertFalse(AdminCreateRunner.requested(null));
    }
}
