package games.paths.adapters.sqlite.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

public class SqliteDirectoryEnvironmentPostProcessor implements EnvironmentPostProcessor {

    private static final Logger log = LoggerFactory.getLogger(SqliteDirectoryEnvironmentPostProcessor.class);

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        String defaultPath = System.getProperty("user.home") + "/.paths.games/database.sqlite";
        String databasePath = environment.getProperty("game.database.path", defaultPath);

        Path dbPath = Paths.get(databasePath);
        Path parent = dbPath.getParent();
        if (parent != null) {
            try {
                if (!Files.exists(parent)) {
                    Files.createDirectories(parent);
                    log.info("Created SQLite database directory (early): {}", parent);
                }
            } catch (IOException e) {
                log.warn("Unable to create SQLite parent directory {}: {}", parent, e.getMessage());
            }
        }
    }
}
