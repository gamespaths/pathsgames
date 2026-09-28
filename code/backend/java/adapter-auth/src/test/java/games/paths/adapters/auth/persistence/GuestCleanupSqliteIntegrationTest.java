package games.paths.adapters.auth.persistence;

import games.paths.adapters.auth.entity.UserEntity;
import games.paths.adapters.auth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataAccessException;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import javax.sql.DataSource;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * v0.41.0 — the expired-guest fix on a real SQLite schema (Flyway migrations) with
 * PRAGMA foreign_keys=ON: a referenced guest is kept, the unguarded delete would fail.
 */
@DataJpaTest(properties = {
        "spring.datasource.driver-class-name=org.sqlite.JDBC",
        "spring.datasource.hikari.maximum-pool-size=1",
        "spring.jpa.database-platform=org.hibernate.community.dialect.SQLiteDialect",
        "spring.jpa.hibernate.ddl-auto=none",
        "spring.flyway.enabled=true",
        "spring.flyway.locations=classpath:db/migration/v0"
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({GuestPersistenceAdapter.class, GuestAdminPersistenceAdapter.class})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class GuestCleanupSqliteIntegrationTest {

    private static final Path DB = tempDatabase();
    private static final String PAST = "2020-01-01T00:00:00Z";
    private static final String FUTURE = "2999-01-01T00:00:00Z";

    @SpringBootConfiguration
    @EntityScan(basePackageClasses = UserEntity.class)
    @EnableJpaRepositories(basePackageClasses = UserRepository.class)
    static class TestApp {
    }

    @DynamicPropertySource
    static void sqlite(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> "jdbc:sqlite:" + DB);
        registry.add("game.database.path", DB::toString);
    }

    @Autowired
    private DataSource dataSource;
    @Autowired
    private GuestPersistenceAdapter guestAdapter;
    @Autowired
    private GuestAdminPersistenceAdapter adminAdapter;

    private JdbcTemplate jdbc;

    @BeforeEach
    void freshRows() {
        jdbc = new JdbcTemplate(dataSource);
        // Fixtures go in with the pragma off: the story-side FKs of this schema are not enforceable
        jdbc.execute("PRAGMA foreign_keys = OFF");
        for (String table : List.of("chat_messages", "gaming_user_sessions", "gaming_character_instance",
                "gaming_match", "users_tokens", "users")) {
            jdbc.update("DELETE FROM " + table);
        }
    }

    @Test
    void expiredCleanupKeepsEveryReferencedGuestWithForeignKeysOn() {
        long free = guest("free", PAST);
        long creator = guest("creator", PAST);
        long player = guest("player", PAST);
        long online = guest("online", PAST);
        long chatter = guest("chatter", PAST);
        long alive = guest("alive", FUTURE);
        token(free);
        token(creator);
        jdbc.update("INSERT INTO gaming_match (id, id_story, id_difficulty, id_user_creator) VALUES (100, 1, 1, ?)", creator);
        jdbc.update("INSERT INTO gaming_character_instance (id, id_match, id_user, id_character_template) VALUES (200, 100, ?, 1)", player);
        jdbc.update("INSERT INTO gaming_user_sessions (id, id_match, id_user) VALUES (300, 100, ?)", online);
        jdbc.update("INSERT INTO chat_messages (id, id_match, id_user, message) VALUES (400, 100, ?, 'hi')", chatter);
        foreignKeysOn();

        assertEquals(1, guestAdapter.deleteExpiredGuests());

        assertEquals(List.of(creator, player, online, chatter, alive), userIds());
        assertEquals(List.of(creator), tokenOwners());
        // The pre-0.41.0 delete of a referenced guest is exactly what the database refuses.
        assertThrows(DataAccessException.class, () -> jdbc.update("DELETE FROM users WHERE id = ?", creator));
    }

    @Test
    void staleWithoutReferencesSeesOnlyUnreferencedGuestsAndHonoursTheCap() {
        long one = guest("one", FUTURE);
        long two = guest("two", FUTURE);
        long owner = guest("owner", FUTURE);
        jdbc.update("INSERT INTO gaming_match (id, id_story, id_difficulty, id_user_creator) VALUES (101, 1, 1, ?)", owner);
        foreignKeysOn();
        String bound = "2021-01-01T00:00:00Z";
        assertTrue(adminAdapter.findStaleGuestIdsWithoutReferences(bound, 10).isEmpty());

        guestAdapter.backdateGuest(one, PAST);
        guestAdapter.backdateGuest(two, PAST);
        guestAdapter.backdateGuest(owner, PAST);

        assertEquals(List.of(one, two), adminAdapter.findStaleGuestIdsWithoutReferences(bound, 10));
        assertEquals(List.of(one), adminAdapter.findStaleGuestIdsWithoutReferences(bound, 1));
        assertEquals(PAST, jdbc.queryForObject("SELECT ts_registration FROM users WHERE id = ?", String.class, one));
        assertEquals(2, adminAdapter.deleteGuestsByIds(List.of(one, two)));
        assertEquals(0, adminAdapter.deleteExpiredGuests());
        assertEquals(List.of(owner), userIds());
    }

    private void foreignKeysOn() {
        jdbc.execute("PRAGMA foreign_keys = ON");
        assertEquals(1, jdbc.queryForObject("PRAGMA foreign_keys", Integer.class));
    }

    private long guest(String name, String expiresAt) {
        jdbc.update("INSERT INTO users (username, state, guest_expires_at, ts_registration, ts_last_access)"
                + " VALUES (?, 6, ?, '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z')", "robottest_" + name, expiresAt);
        return jdbc.queryForObject("SELECT id FROM users WHERE username = ?", Long.class, "robottest_" + name);
    }

    private void token(long userId) {
        jdbc.update("INSERT INTO users_tokens (id_user, refresh_token, expires_at) VALUES (?, 'rt', ?)", userId, FUTURE);
    }

    private List<Long> userIds() {
        return jdbc.queryForList("SELECT id FROM users ORDER BY id", Long.class);
    }

    private List<Long> tokenOwners() {
        return jdbc.queryForList("SELECT id_user FROM users_tokens ORDER BY id_user", Long.class);
    }

    private static Path tempDatabase() {
        try {
            Path file = Files.createTempFile("pathsgames-guest-cleanup", ".sqlite");
            file.toFile().deleteOnExit();
            return file;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
