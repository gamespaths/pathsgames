package games.paths.adapters.sqlite.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link SqliteDirectoryInitializer}.
 *
 * <p>The class is instantiated directly (no Spring context) and the private
 * {@code databasePath} field is injected via reflection, mirroring what
 * {@code @Value} would do at runtime.</p>
 */
class SqliteDirectoryInitializerTest {

    private SqliteDirectoryInitializer initializer;

    @BeforeEach
    void setUp() {
        initializer = new SqliteDirectoryInitializer();
    }

    // -------------------------------------------------------------------------
    // Helper: inject databasePath via reflection
    // -------------------------------------------------------------------------

    private void setDatabasePath(String path) throws Exception {
        Field field = SqliteDirectoryInitializer.class.getDeclaredField("databasePath");
        field.setAccessible(true);
        field.set(initializer, path);
    }

    // -------------------------------------------------------------------------
    // Tests
    // -------------------------------------------------------------------------

    /**
     * Directory does not exist yet → must be created.
     */
    @Test
    void ensureDatabaseDirectoryExists_shouldCreateDirectory_whenMissing(@TempDir Path tempDir) throws Exception {
        Path dbFile = tempDir.resolve("newsubdir/database.sqlite");
        setDatabasePath(dbFile.toString());

        assertDoesNotThrow(() -> initializer.ensureDatabaseDirectoryExists());

        assertTrue(Files.exists(dbFile.getParent()),
                "Parent directory should have been created");
    }

    /**
     * Directory already exists → no exception, no duplicate creation.
     */
    @Test
    void ensureDatabaseDirectoryExists_shouldNotFail_whenDirectoryAlreadyExists(@TempDir Path tempDir) throws Exception {
        // tempDir itself already exists — use it as parent
        Path dbFile = tempDir.resolve("database.sqlite");
        setDatabasePath(dbFile.toString());

        assertDoesNotThrow(() -> initializer.ensureDatabaseDirectoryExists());

        assertTrue(Files.exists(tempDir), "Pre-existing directory should still be present");
    }

    /**
     * Nested path with multiple missing levels → createDirectories must handle it.
     */
    @Test
    void ensureDatabaseDirectoryExists_shouldCreateNestedDirectories(@TempDir Path tempDir) throws Exception {
        Path dbFile = tempDir.resolve("a/b/c/database.sqlite");
        setDatabasePath(dbFile.toString());

        assertDoesNotThrow(() -> initializer.ensureDatabaseDirectoryExists());

        assertTrue(Files.exists(dbFile.getParent()),
                "Full nested directory chain should have been created");
    }

    /**
     * Path without a parent segment (just a filename) → getParent() returns null,
     * the method must handle it gracefully without NullPointerException.
     */
    @Test
    void ensureDatabaseDirectoryExists_shouldHandleNullParent() throws Exception {
        // A relative filename with no parent path component
        setDatabasePath("database.sqlite");

        assertDoesNotThrow(() -> initializer.ensureDatabaseDirectoryExists());
    }

    /**
     * Calling ensureDatabaseDirectoryExists() twice must be idempotent.
     */
    @Test
    void ensureDatabaseDirectoryExists_shouldBeIdempotent(@TempDir Path tempDir) throws Exception {
        Path dbFile = tempDir.resolve("idempotent/database.sqlite");
        setDatabasePath(dbFile.toString());

        assertDoesNotThrow(() -> initializer.ensureDatabaseDirectoryExists());
        assertDoesNotThrow(() -> initializer.ensureDatabaseDirectoryExists());

        assertTrue(Files.exists(dbFile.getParent()));
    }

    /**
     * After initialization the directory must be a directory (not a file).
     */
    @Test
    void ensureDatabaseDirectoryExists_createdPathMustBeDirectory(@TempDir Path tempDir) throws Exception {
        Path dbFile = tempDir.resolve("dircheck/database.sqlite");
        setDatabasePath(dbFile.toString());

        initializer.ensureDatabaseDirectoryExists();

        assertTrue(Files.isDirectory(dbFile.getParent()),
                "Created path must be a directory, not a regular file");
    }
}
