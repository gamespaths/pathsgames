package games.paths.adapters.auth.persistence;

import games.paths.adapters.auth.entity.UserEntity;
import games.paths.adapters.auth.repository.UserRepository;
import games.paths.core.model.auth.MatchOwnership;
import games.paths.core.model.auth.NewUser;
import games.paths.core.model.auth.UserIdentity;
import games.paths.core.model.auth.UserStatus;
import games.paths.core.port.auth.IdentityPersistencePort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
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
 * v1.2.0 the identity, merge and token adapters on a real SQLite schema with the V0 and V1 migrations
 * (V1.2.0: users_identities, dropped columns, unique email and nickname, replay store).
 */
@DataJpaTest(properties = {
        "spring.datasource.driver-class-name=org.sqlite.JDBC",
        "spring.datasource.hikari.maximum-pool-size=1",
        "spring.jpa.database-platform=org.hibernate.community.dialect.SQLiteDialect",
        "spring.jpa.hibernate.ddl-auto=none",
        "spring.flyway.enabled=true",
        "spring.flyway.locations=classpath:db/migration/v0,classpath:db/migration/v1"
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({IdentityPersistenceAdapter.class, GuestMergePersistenceAdapter.class, TokenPersistenceAdapter.class})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class IdentitySqliteIntegrationTest {

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
    private IdentityPersistenceAdapter identities;
    @Autowired
    private GuestMergePersistenceAdapter merge;
    @Autowired
    private TokenPersistenceAdapter tokens;

    private JdbcTemplate jdbc;

    @BeforeEach
    void freshRows() {
        jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("PRAGMA foreign_keys = OFF");
        for (String table : List.of("users_identities", "auth_id_token_seen", "chat_messages", "gaming_user_sessions",
                "gaming_character_instance", "gaming_match", "users_tokens", "users")) {
            jdbc.update("DELETE FROM " + table);
        }
    }

    private static UserIdentity google(String sub, String email) {
        return new UserIdentity(null, null, "GOOGLE", sub, email, "Mario Rossi", "Mario", "Rossi", "pic", "it", "t");
    }

    private long user(String uuid, String nickname, String email) {
        return identities.createUser(new NewUser(uuid, "google_" + uuid.substring(0, 8), nickname, email, "PLAYER", 2,
                "en"), email == null ? null : google("sub-" + uuid, email));
    }

    @Test
    void theMigrationDroppedThePasswordColumns() {
        List<String> columns = jdbc.queryForList("SELECT name FROM pragma_table_info('users')", String.class);
        assertFalse(columns.contains("password_hash"));
        assertFalse(columns.contains("google_id_sso"));
        assertTrue(columns.contains("email_address"));
        assertTrue(jdbc.queryForList("SELECT name FROM pragma_table_info('users_tokens')", String.class)
                .contains("ts_rotated"));
    }

    @Test
    void createFindAndUpdateAGoogleUser() {
        long id = user("11111111-aaaa", "mario", "Mario@Gmail.com");
        UserIdentity found = identities.findIdentityByEmail("GOOGLE", "MARIO@gmail.com").orElseThrow();
        assertEquals(id, found.userId());
        assertEquals("mario@gmail.com", found.email());
        assertEquals("sub-11111111-aaaa", found.subject());
        assertEquals(1, identities.findIdentitiesOfUser(id).size());
        UserStatus status = identities.findUserByUuid("11111111-aaaa").orElseThrow();
        assertEquals("mario", status.nickname());
        assertEquals(id, identities.findUserByEmail("mario@gmail.com").orElseThrow().id());
        assertEquals(id, identities.findUserByNickname("mario").orElseThrow().id());
        assertTrue(identities.findUserById(id).isPresent());
        assertTrue(identities.nicknameExists("mario"));
        assertFalse(identities.nicknameExists("luigi"));
        assertTrue(identities.findUserByUuid(null).isEmpty());
        assertTrue(identities.findUserByEmail(null).isEmpty());
        assertTrue(identities.findIdentityByEmail("GOOGLE", null).isEmpty());

        identities.updateIdentityProfile(found.id(), new UserIdentity(null, null, "GOOGLE", "x", "x", "M", "Luigi",
                "Verdi", "pic2", "en", "t2"));
        UserIdentity updated = identities.findIdentitiesOfUser(id).get(0);
        assertEquals("Luigi", updated.givenName());
        assertEquals("mario@gmail.com", updated.email());
        identities.updateLastAccess(id);
        identities.updateState(id, 7);
        assertEquals(List.of(id), identities.findUserIdsByState(7, 10));
    }

    @Test
    void uniqueNicknameAndEmailBecomeDuplicateUserExceptions() {
        user("22222222-aaaa", "mario", "mario@gmail.com");
        assertEquals("nickname", assertThrows(IdentityPersistencePort.DuplicateUserException.class,
                () -> user("33333333-aaaa", "mario", "other@gmail.com")).getField());
        assertEquals("email", assertThrows(IdentityPersistencePort.DuplicateUserException.class,
                () -> user("44444444-aaaa", "luigi", "mario@gmail.com")).getField());
        long admin = identities.createUser(new NewUser("55555555-aaaa", "admin_55555555", "boss", null, "ADMIN", 2, "en"),
                null);
        assertEquals("email", assertThrows(IdentityPersistencePort.DuplicateUserException.class,
                () -> identities.createIdentity(admin, google("s", "mario@gmail.com"))).getField());
        identities.createIdentity(admin, google("s2", "boss@gmail.com"));
        assertEquals(1, identities.findIdentitiesOfUser(admin).size());
        assertEquals("other", IdentityPersistenceAdapter.fieldOf(new DataIntegrityViolationException("x")));
        org.springframework.dao.DataAccessException notAClash = new org.springframework.dao.QueryTimeoutException("slow");
        assertSame(notAClash, IdentityPersistenceAdapter.duplicateOr(notAClash));
    }

    @Test
    void replayStoreRefusesASecondUse() {
        assertTrue(identities.markIdTokenSeen("h1", "2020-01-01T00:00:00Z"));
        assertFalse(identities.markIdTokenSeen("h1", "2020-01-01T00:00:00Z"));
        assertTrue(identities.markIdTokenSeen("h2", "2999-01-01T00:00:00Z"));
        assertEquals(1, identities.deleteExpiredIdTokens("2026-01-01T00:00:00Z"));
    }

    @Test
    void inactiveUsersAndRobotUsers() {
        long idle = user("66666666-aaaa", "robottest.idle", "idle@gmail.com");
        long fresh = user("77777777-aaaa", "fresh", "fresh@gmail.com");
        jdbc.update("UPDATE users SET ts_last_access = '2020-01-01T00:00:00Z' WHERE id = ?", idle);
        assertEquals(List.of(idle), identities.findInactiveIdentityUserIds("2024-01-01T00:00:00Z", 10));
        assertEquals(List.of(idle), identities.findNonGuestUserIdsByNicknameLike("robottest%"));
        identities.deleteUserFully(idle);
        assertTrue(identities.findUserById(idle).isEmpty());
        assertTrue(identities.findUserById(fresh).isPresent());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM users_identities WHERE id_user = ?", Integer.class, idle));
    }

    @Test
    void guestMergeMovesMatchesCancelsAndDeletesTheGuest() {
        long target = user("88888888-aaaa", "mario", "mario@gmail.com");
        jdbc.update("INSERT INTO users (id, uuid, username, nickname, role, state) VALUES (900, 'g-900', 'guest_900',"
                + " 'guest_900', 'PLAYER', 6)");
        jdbc.update("INSERT INTO users_tokens (id_user, refresh_token, expires_at) VALUES (900, 'h', '2999-01-01')");
        jdbc.update("INSERT INTO gaming_match (id, uuid, id_story, id_difficulty, id_user_creator, status, ts_update)"
                + " VALUES (100, 'm-100', 1, 1, 900, 'RUNNING', '2026-10-02T00:00:00Z')");
        jdbc.update("INSERT INTO gaming_match (id, uuid, id_story, id_difficulty, id_user_creator, status, ts_update)"
                + " VALUES (101, 'm-101', 1, 1, ?, 'RUNNING', '2026-10-01T00:00:00Z')", target);
        jdbc.update("INSERT INTO gaming_character_instance (id, id_match, id_user, id_character_template)"
                + " VALUES (200, 100, 900, 1)");

        List<MatchOwnership> guestMatches = merge.matchesOfUser(900L);
        assertEquals("m-100", guestMatches.get(0).uuid());
        assertEquals(1, merge.applyMerge(900L, target, List.of(101L), "2026-10-19T00:00:00Z"));

        assertEquals(target, jdbc.queryForObject("SELECT id_user_creator FROM gaming_match WHERE id = 100", Long.class));
        assertEquals("2026-10-02T00:00:00Z", jdbc.queryForObject("SELECT ts_update FROM gaming_match WHERE id = 100",
                String.class));
        assertEquals("CANCELLED", jdbc.queryForObject("SELECT status FROM gaming_match WHERE id = 101", String.class));
        assertEquals(target, jdbc.queryForObject("SELECT id_user FROM gaming_character_instance WHERE id = 200", Long.class));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE id = 900", Integer.class));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM users_tokens WHERE id_user = 900", Integer.class));
        assertEquals(0, merge.applyMerge(901L, target, null, "t"));
    }

    @Test
    void hashedRefreshTokenRotation() {
        long id = user("99999999-aaaa", "mario", "mario@gmail.com");
        tokens.storeRefreshToken(id, "hash-1", "2999-01-01T00:00:00Z");
        long tokenId = tokens.findRefreshToken("hash-1", null).orElseThrow().id();
        tokens.markRotated(tokenId, "2026-10-19T00:00:00Z");
        assertEquals("2026-10-19T00:00:00Z", tokens.findRefreshToken("hash-1", null).orElseThrow().tsRotated());
        jdbc.update("INSERT INTO users_tokens (id_user, refresh_token, expires_at) VALUES (?, 'clear', '2999')", id);
        assertTrue(tokens.findRefreshToken("hash-2", "clear").isPresent());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM users_tokens WHERE refresh_token = 'hash-2'",
                Integer.class));
    }

    private static Path tempDatabase() {
        try {
            Path file = Files.createTempFile("pathsgames-identity", ".sqlite");
            file.toFile().deleteOnExit();
            return file;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
