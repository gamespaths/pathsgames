package games.paths.adapters.auth.persistence;

import games.paths.adapters.auth.entity.UserEntity;
import games.paths.adapters.auth.repository.UserRepository;
import games.paths.core.model.auth.AdminUserItem;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
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

/** v1.7.0 step 10: the admin users list, suspension, re-link, banned hashes and the intervention log on SQLite. */
@DataJpaTest(properties = {
        "spring.datasource.driver-class-name=org.sqlite.JDBC",
        "spring.datasource.hikari.maximum-pool-size=1",
        "spring.jpa.database-platform=org.hibernate.community.dialect.SQLiteDialect",
        "spring.jpa.hibernate.ddl-auto=none",
        "spring.flyway.enabled=true",
        "spring.flyway.locations=classpath:db/migration/v0,classpath:db/migration/v1"
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({UserAdminPersistenceAdapter.class, AdminInterventionAdapter.class})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class UserAdminSqliteIntegrationTest {

    private static final Path DB = tempDatabase();

    @SpringBootConfiguration
    @EntityScan(basePackageClasses = UserEntity.class)
    @EnableJpaRepositories(basePackageClasses = UserRepository.class)
    static class TestApp {
        @Bean
        JdbcTemplate jdbcTemplate(DataSource dataSource) {
            return new JdbcTemplate(dataSource);
        }
    }

    @DynamicPropertySource
    static void sqlite(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> "jdbc:sqlite:" + DB);
    }

    @Autowired
    private DataSource dataSource;
    @Autowired
    private UserAdminPersistenceAdapter adapter;
    @Autowired
    private AdminInterventionAdapter log;

    private JdbcTemplate jdbc;

    @BeforeEach
    void freshRows() {
        jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("PRAGMA foreign_keys = OFF");
        for (String table : List.of("users_identities", "users_banned_subjects", "admin_intervention_log",
                "users_tokens", "gaming_match", "users")) {
            jdbc.update("DELETE FROM " + table);
        }
        user(1, "u-1", "Alice", 2, "PLAYER", "alice@gmail.com", "2026-10-03");
        user(2, "u-2", "alberto", 2, "PLAYER", "alberto@gmail.com", "2026-10-05");
        user(3, "u-3", "bob_x", 3, "PLAYER", null, "2026-10-01");
        user(4, "u-4", "guest_1", 6, "PLAYER", null, "2026-10-09");
        user(5, "u-5", "admin", 2, "ADMIN", null, null);
        jdbc.update("INSERT INTO users_identities (uuid, id_user, provider, provider_subject, email)"
                + " VALUES ('i-1', 1, 'GOOGLE', 'sub-1', 'alice@gmail.com')");
    }

    private void user(long id, String uuid, String nickname, int state, String role, String email, String access) {
        jdbc.update("INSERT INTO users (id, uuid, username, nickname, state, role, email_address, ts_last_access)"
                + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)", id, uuid, "user_" + id, nickname, state, role, email, access);
    }

    private static List<String> uuids(List<AdminUserItem> items) {
        return items.stream().map(AdminUserItem::uuid).toList();
    }

    @Test
    void nicknamePrefixIsCaseInsensitiveAlphabeticalAndKeyset() {
        List<AdminUserItem> al = adapter.listByNickname(null, "al", null, null, 10);
        assertEquals(List.of("u-2", "u-1"), uuids(al));
        assertEquals("GOOGLE", al.get(1).accountType());
        assertEquals("INTERNAL", al.get(0).accountType());
        assertEquals(List.of("u-1"), uuids(adapter.listByNickname(null, "al", "alberto", "u-2", 10)));
        assertEquals(List.of("u-3"), uuids(adapter.listByNickname(null, "bob_", null, null, 10)));
        assertEquals(List.of(), uuids(adapter.listByNickname(null, "bo%", null, null, 10)));
        assertEquals(List.of("u-5", "u-2", "u-1"), uuids(adapter.listByNickname(2, "", null, null, 10)));
        assertEquals(List.of("u-3"), uuids(adapter.listByNickname(3, null, null, null, 10)));
    }

    @Test
    void lastAccessIsNewestFirstWithKeysetAndNoGuests() {
        assertEquals(List.of("u-2", "u-1", "u-5"), uuids(adapter.listByLastAccess(2, null, null, 10)));
        assertEquals(List.of("u-1", "u-5"), uuids(adapter.listByLastAccess(2, "2026-10-05", "u-2", 10)));
        assertEquals(List.of("u-2"), uuids(adapter.listByLastAccess(2, null, null, 1)));
    }

    @Test
    void emailUuidAndFields() {
        assertEquals("u-1", adapter.findByEmail("alice@gmail.com").orElseThrow().uuid());
        assertTrue(adapter.findByEmail("nobody@gmail.com").isEmpty());
        assertTrue(adapter.findByUuid("missing").isEmpty());
        assertEquals("alice@gmail.com", adapter.findEmail(1).orElseThrow());
        assertTrue(adapter.findEmail(3).isEmpty());
        adapter.updateStateAndSuspension(3, 3, "2026-11-01T00:00:00Z");
        assertEquals("2026-11-01T00:00:00Z", adapter.findByUuid("u-3").orElseThrow().suspendedUntil());
        adapter.updateStateAndSuspension(3, 2, null);
        AdminUserItem back = adapter.findByUuid("u-3").orElseThrow();
        assertEquals(2, back.state());
        assertNull(back.suspendedUntil());
    }

    @Test
    void relinkFlagAndSubjectReplacement() {
        assertFalse(adapter.isRelinkPending(1));
        assertFalse(adapter.isRelinkPending(99));
        adapter.setRelinkPending(1, true);
        assertTrue(adapter.isRelinkPending(1));
        long identityId = jdbc.queryForObject("SELECT id FROM users_identities WHERE uuid = 'i-1'", Long.class);
        adapter.replaceIdentitySubject(identityId, 1, "sub-new");
        assertFalse(adapter.isRelinkPending(1));
        assertEquals("sub-new", jdbc.queryForObject("SELECT provider_subject FROM users_identities WHERE id = ?",
                String.class, identityId));
    }

    @Test
    void bannedHashesOneRowPerUserSharedHashesKept() {
        adapter.storeBannedHashes("u-1", "hs1", "he1");
        assertTrue(adapter.isBanned("hs1", null));
        assertTrue(adapter.isBanned(null, "he1"));
        assertFalse(adapter.isBanned("x", "y"));
        assertFalse(adapter.isBanned(null, null));
        assertTrue(adapter.hasBannedHashes("u-1"));
        adapter.storeBannedHashes("u-1", "hs1", "he1");
        adapter.storeBannedHashes("u-2", "hs1", "he2");
        adapter.storeBannedHashes("u-3", "hs1", "he1");
        assertFalse(adapter.hasBannedHashes("u-3"));
        assertEquals(1, adapter.deleteBannedHashes("u-1"));
        assertFalse(adapter.isBanned("hs1", "he1"));
        assertTrue(adapter.isBanned(null, "he2"));
    }

    @Test
    void interventionLogWritesAndPurges() {
        log.record("adm", "BAN", "u-1", "spam");
        log.record(null, "UNBLOCK", "u-1", "ok");
        assertEquals(2, jdbc.queryForObject("SELECT COUNT(*) FROM admin_intervention_log", Integer.class));
        assertEquals("UNKNOWN", jdbc.queryForObject(
                "SELECT admin_uuid FROM admin_intervention_log WHERE action = 'UNBLOCK'", String.class));
        jdbc.update("UPDATE admin_intervention_log SET ts_insert = '2020-01-01T00:00:00Z' WHERE action = 'BAN'");
        assertEquals(1, log.deleteOlderThan("2024-10-22T00:00:00Z"));
        assertEquals("a\\\\b\\%c\\_", UserAdminPersistenceAdapter.escapeLike("a\\b%c_"));
    }

    private static Path tempDatabase() {
        try {
            Path file = Files.createTempFile("pathsgames-useradmin-", ".sqlite");
            file.toFile().deleteOnExit();
            return file;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
