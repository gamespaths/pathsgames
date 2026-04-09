package games.paths.launcher;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

@SpringBootTest
class PathsGameApplicationTest {

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
