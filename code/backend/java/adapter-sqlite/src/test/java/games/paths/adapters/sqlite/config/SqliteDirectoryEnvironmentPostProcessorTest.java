package games.paths.adapters.sqlite.config;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.StandardEnvironment;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class SqliteDirectoryEnvironmentPostProcessorTest {

    @Test
    void createsParentDirectoryWhenMissing(@TempDir Path tempDir) throws Exception {
        Path parent = tempDir.resolve("a/b/c");
        Path dbPath = parent.resolve("database.sqlite");

        ConfigurableEnvironment env = new StandardEnvironment();
        env.getPropertySources().addFirst(new MapPropertySource("test", Map.of(
                "game.database.path", dbPath.toString()
        )));

        var pp = new SqliteDirectoryEnvironmentPostProcessor();
        pp.postProcessEnvironment(env, null);

        assertTrue(Files.exists(parent) && Files.isDirectory(parent), "Parent directory should be created");
    }

    @Test
    void doesNotFailWhenParentAlreadyExists(@TempDir Path tempDir) {
        Path parent = tempDir.resolve("existing/dir");
        Path dbPath = parent.resolve("database.sqlite");

        // create parent ahead of time
        assertDoesNotThrow(() -> Files.createDirectories(parent));

        ConfigurableEnvironment env = new StandardEnvironment();
        env.getPropertySources().addFirst(new MapPropertySource("test", Map.of(
                "game.database.path", dbPath.toString()
        )));

        var pp = new SqliteDirectoryEnvironmentPostProcessor();
        assertDoesNotThrow(() -> pp.postProcessEnvironment(env, null));
        assertTrue(Files.exists(parent) && Files.isDirectory(parent));
    }

    @Test
    void handlesRelativePathWithoutParent() {
        ConfigurableEnvironment env = new StandardEnvironment();
        env.getPropertySources().addFirst(new MapPropertySource("test", Map.of(
                "game.database.path", "database.sqlite"
        )));

        var pp = new SqliteDirectoryEnvironmentPostProcessor();
        assertDoesNotThrow(() -> pp.postProcessEnvironment(env, null));
    }

    @Test
    void handlesIOExceptionQuietly(@TempDir Path tempDir) throws Exception {
        Path readOnlyDir = tempDir.resolve("readonly");
        Files.createDirectory(readOnlyDir);
        readOnlyDir.toFile().setReadOnly();

        Path dbPath = readOnlyDir.resolve("subdir/database.sqlite");

        ConfigurableEnvironment env = new StandardEnvironment();
        env.getPropertySources().addFirst(new MapPropertySource("test", Map.of(
                "game.database.path", dbPath.toString()
        )));

        var pp = new SqliteDirectoryEnvironmentPostProcessor();
        assertDoesNotThrow(() -> pp.postProcessEnvironment(env, null));
        
        readOnlyDir.toFile().setWritable(true);
    }
}
