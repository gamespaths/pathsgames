package games.paths.adapters.sqlite.kpi;

import games.paths.core.persistence.match.KpiStoreAdapter;
import games.paths.core.port.match.KpiPort;
import games.paths.core.service.match.KpiService;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.*;

/**
 * v0.41.2 — the KPI counters on the real SQLite schema (every Flyway migration, V0.41.2 included):
 * the ON CONFLICT upsert, the uuid lookups and the report of today.
 */
class KpiSqliteIntegrationTest {

    private Path db;
    private SingleConnectionDataSource dataSource;
    private JdbcTemplate jdbc;
    private KpiService service;

    @BeforeEach
    void migrate() throws IOException {
        db = Files.createTempFile("pathsgames-kpi-", ".sqlite");
        dataSource = new SingleConnectionDataSource("jdbc:sqlite:" + db, true);
        Flyway.configure().dataSource(dataSource).locations("classpath:db/migration/v0").load().migrate();
        jdbc = new JdbcTemplate(dataSource);
        service = new KpiService(new KpiStoreAdapter(jdbc));
        jdbc.update("INSERT INTO list_stories (id, uuid) VALUES (9, 'story-kpi')");
        jdbc.update("INSERT INTO list_locations (id, uuid, id_story) VALUES (3, 'loc-kpi', 9)");
        jdbc.update("INSERT INTO users (id, username) VALUES (42, 'robottest_kpi')");
        jdbc.update("INSERT INTO gaming_match (id, uuid, id_story, id_difficulty, id_user_creator, status,"
                + " current_clock, name) VALUES (1, 'm-kpi', 9, 1, 42, 'RUNNING', 0, 'robottest')");
    }

    @AfterEach
    void close() throws IOException {
        dataSource.destroy();
        Files.deleteIfExists(db);
    }

    @Test
    void countsAndReportsOnTheRealSchema() {
        service.recordForMatch(1L, KpiPort.Metric.MATCH_STARTED, null, 1);
        service.recordForMatch(1L, KpiPort.Metric.MATCH_STARTED, null, 1);
        service.record("story-kpi", KpiPort.Metric.MATCH_COMPLETED, null, 1);
        service.record("story-kpi", KpiPort.Metric.DURATION_MS, null, 90_000);
        service.recordLocationVisit(1L, 9L, 3L);

        assertEquals(4, jdbc.queryForObject("SELECT COUNT(*) FROM system_kpi_daily", Integer.class));
        String today = LocalDate.now(ZoneOffset.UTC).toString();
        KpiPort.KpiReport report = service.report("story-kpi", today, today, "total");
        KpiPort.KpiRow row = report.rows().get(0);
        assertEquals(2, row.matchesStarted());
        assertEquals(1, row.matchesCompleted());
        assertEquals(0.5, row.completionRate());
        assertEquals(1.5, row.avgDurationMinutes());
        assertEquals("loc-kpi", report.locations().get(0).uuid());
    }
}
