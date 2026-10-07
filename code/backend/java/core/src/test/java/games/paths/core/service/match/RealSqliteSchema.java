package games.paths.core.service.match;

import org.springframework.core.io.FileSystemResource;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.jdbc.datasource.init.ScriptUtils;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

/** v0.41.4 test helper: an in-memory SQLite with every versioned migration of adapter-sqlite applied. */
final class RealSqliteSchema {

    static final Path MIGRATIONS = Path.of("..", "adapter-sqlite", "src", "main", "resources", "db", "migration", "v0");

    private RealSqliteSchema() {
    }

    static SingleConnectionDataSource create() throws IOException, SQLException {
        SingleConnectionDataSource dataSource = new SingleConnectionDataSource("jdbc:sqlite::memory:", true);
        List<Path> files;
        try (Stream<Path> s = Files.list(MIGRATIONS)) {
            files = s.filter(p -> p.getFileName().toString().endsWith(".sql")).sorted(Comparator.comparing(
                    RealSqliteSchema::version, RealSqliteSchema::compareVersions)).toList();
        }
        try (Connection c = dataSource.getConnection()) {
            for (Path file : files) {
                ScriptUtils.executeSqlScript(c, new FileSystemResource(file));
            }
        }
        return dataSource;
    }

    private static int[] version(Path p) {
        String v = p.getFileName().toString().substring(1).split("__")[0];
        return Arrays.stream(v.split("\\.")).mapToInt(Integer::parseInt).toArray();
    }

    private static int compareVersions(int[] a, int[] b) {
        for (int i = 0; i < Math.min(a.length, b.length); i++) {
            if (a[i] != b[i]) {
                return Integer.compare(a[i], b[i]);
            }
        }
        return Integer.compare(a.length, b.length);
    }
}
