package games.paths.launcher;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

/**
 * PathsGameApplication - Spring Boot entry point.
 * Scans all games.paths.* packages to pick up adapters.
 */
@SpringBootApplication
@ComponentScan(basePackages = {"games.paths"})
public class PathsGameApplication {
    public static void main(String[] args) {
        SpringApplication.run(PathsGameApplication.class, args);
    }
}
