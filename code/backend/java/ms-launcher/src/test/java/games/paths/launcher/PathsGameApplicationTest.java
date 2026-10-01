package games.paths.launcher;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

@SpringBootTest
class PathsGameApplicationTest {

    // v0.41.4 — the match export/import port and its admin controller are wired.
    @org.springframework.beans.factory.annotation.Autowired
    private games.paths.core.port.match.MatchExportPort matchExportPort;

    @org.springframework.beans.factory.annotation.Autowired
    private games.paths.adapters.admin.controller.match.MatchExportAdminController matchExportAdminController;

    @Test
    void matchExport_isWired() {
        org.junit.jupiter.api.Assertions.assertNotNull(matchExportPort);
        org.junit.jupiter.api.Assertions.assertNotNull(matchExportAdminController);
    }

    @Test
    void contextLoads() {
        // Verifies the Spring application context starts correctly
    }

    @Test
    void main_shouldStartApplication() {
        // Call main() with web-server and Flyway disabled to avoid port conflicts
        // with the context already loaded by @SpringBootTest.
        // Verifies the method is callable and raises no unchecked exception.
        assertDoesNotThrow(() ->
            PathsGameApplication.main(new String[]{
                "--spring.main.web-application-type=none",
                "--spring.flyway.enabled=false"
            })
        );
    }
}
