package games.paths.core.persistence.match;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** v0.41.4 — the edges of MatchExportStoreAdapter (the round trip covers the main path on the real schema). */
@DisplayName("MatchExportStoreAdapter (v0.41.4)")
class MatchExportStoreAdapterTest {

    private SingleConnectionDataSource dataSource;
    private MatchExportStoreAdapter adapter;

    @BeforeEach
    void setUp() {
        dataSource = new SingleConnectionDataSource("jdbc:sqlite::memory:", true);
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, uuid TEXT, username TEXT, password_hash TEXT,"
                + " email_address TEXT)");
        jdbc.update("INSERT INTO users (id, uuid, username, password_hash, email_address)"
                + " VALUES (1, 'u-1', 'a', 'secret', 'Boss@Example.org')");
        jdbc.execute("CREATE TABLE gaming_match (id INTEGER PRIMARY KEY, uuid TEXT)");
        adapter = new MatchExportStoreAdapter(jdbc, t -> 1L);
    }

    @AfterEach
    void tearDown() {
        dataSource.destroy();
    }

    @Test
    void emptyInputsAndUnknownRows() {
        assertEquals(Map.of(), adapter.usersByIds(List.of()));
        assertEquals(Map.of(), adapter.usersByIds(null));
        assertEquals(List.of(), adapter.activeMatchesOf(List.of(), 1L, "m"));
        assertEquals(List.of(), adapter.activeMatchesOf(null, 1L, null));
        assertFalse(adapter.matchExists("nope"));
        assertTrue(adapter.userByEmail(null).isEmpty());
        assertTrue(adapter.userByEmail(" ").isEmpty());
        adapter.deleteMatchFully("nope");
        assertEquals("sqlite", adapter.dialect());
        assertEquals("sqlite", adapter.dialect());
    }

    @Test
    void theEmailMatchIgnoresCase() {
        Map<String, Object> found = adapter.userByEmail(" boss@example.ORG ").orElseThrow();
        assertEquals("u-1", found.get("uuid"));
        assertFalse(found.containsKey("password_hash"));
        assertTrue(adapter.userByEmail("other@example.org").isEmpty());
    }

    @Test
    void safeUserDropsSecrets() {
        Map<String, Object> safe = MatchExportStoreAdapter.safeUser(Map.of("id", 1, "uuid", "u", "password_hash", "x",
                "guest_cookie_token", "t", "google_id_sso", "g", "email_address", "e"));
        assertEquals(Map.of("id", 1, "uuid", "u", "email_address", "e"), safe);
    }

    @Test
    void guards() {
        assertThrows(IllegalArgumentException.class, () -> MatchExportStoreAdapter.logTable("users"));
        assertThrows(IllegalArgumentException.class, () -> MatchExportStoreAdapter.identifier("x; DROP"));
        assertThrows(IllegalArgumentException.class, () -> MatchExportStoreAdapter.identifier(null));
        assertEquals("\"key\"", MatchExportStoreAdapter.quote("key"));
        assertEquals("postgresql", MatchExportStoreAdapter.dialectOf("PostgreSQL"));
        assertEquals("sqlite", MatchExportStoreAdapter.dialectOf(null));
        JdbcTemplate broken = mock(JdbcTemplate.class);
        when(broken.execute(any(org.springframework.jdbc.core.ConnectionCallback.class)))
                .thenThrow(new IllegalStateException("down"));
        assertEquals("sqlite", new MatchExportStoreAdapter(broken, t -> 1L).dialect());
    }
}
