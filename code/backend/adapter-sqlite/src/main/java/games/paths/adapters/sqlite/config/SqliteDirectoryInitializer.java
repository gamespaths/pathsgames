package games.paths.adapters.sqlite.config;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Ensures the parent directory for the SQLite database file exists
 * before Spring Boot auto-configures the DataSource and Flyway.
 *
 * <p>The database path is configurable via the property {@code game.database.path},
 * defaulting to {@code ~/.paths.games/database.sqlite}.</p>
 */
@Configuration
public class SqliteDirectoryInitializer {

    private static final Logger log = LoggerFactory.getLogger(SqliteDirectoryInitializer.class);

    @Value("${game.database.path:${user.home}/.paths.games/database.sqlite}")
    private String databasePath;

    @PostConstruct
    public void ensureDatabaseDirectoryExists() throws IOException {
        Path dbPath = Paths.get(databasePath);
        Path parentDir = dbPath.getParent();
        if (parentDir != null && !Files.exists(parentDir)) {
            Files.createDirectories(parentDir);
            log.info("Created SQLite database directory: {}", parentDir);
        }
        log.info("SQLite database path: {}", dbPath.toAbsolutePath());
    }
}
