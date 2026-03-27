package games.paths.launcher;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/**
 * PathsGameApplication - Spring Boot entry point.
 * Scans all games.paths.* packages to pick up adapters.
 */
@SpringBootApplication
@ComponentScan(basePackages = {"games.paths"})
@EntityScan(basePackages = {"games.paths"})
@EnableJpaRepositories(basePackages = {"games.paths"})
public class PathsGameApplication {
    public static void main(String[] args) {
        SpringApplication.run(PathsGameApplication.class, args);
    }
}
