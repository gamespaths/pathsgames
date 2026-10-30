package games.paths.adapters.auth.persistence;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** v1.11.0 the edge branches of {@link UserAdminPersistenceAdapter} and {@link AdminInterventionAdapter}. */
class UserAdminPersistenceAdapterBranchesTest {

    private JdbcTemplate jdbc;
    private UserAdminPersistenceAdapter adapter;

    @BeforeEach
    void setUp() {
        jdbc = mock(JdbcTemplate.class);
        adapter = new UserAdminPersistenceAdapter(jdbc);
    }

    @Test
    @DisplayName("A half cursor (no uuid) adds no keyset condition, on both list orders")
    @SuppressWarnings("unchecked")
    void halfCursorIsIgnored() {
        adapter.listByNickname(null, null, "mario", null, 10);
        adapter.listByLastAccess(2, "2026-10-01T00:00:00Z", null, 10);
        verify(jdbc, times(2)).query(argThat((String sql) -> !sql.contains(" OR (")), any(RowMapper.class),
                any(Object[].class));
    }

    @Test
    @DisplayName("A blank or missing email is empty; relink_pending NULL, 0 or missing is false")
    void emailAndRelink() {
        when(jdbc.queryForList(anyString(), eq(String.class), eq(1L))).thenReturn(List.of(" "));
        when(jdbc.queryForList(anyString(), eq(String.class), eq(2L))).thenReturn(Collections.emptyList());
        assertTrue(adapter.findEmail(1L).isEmpty());
        assertTrue(adapter.findEmail(2L).isEmpty());
        when(jdbc.queryForList(anyString(), eq(Integer.class), eq(1L))).thenReturn(Arrays.asList((Integer) null));
        when(jdbc.queryForList(anyString(), eq(Integer.class), eq(2L))).thenReturn(Collections.emptyList());
        when(jdbc.queryForList(anyString(), eq(Integer.class), eq(3L))).thenReturn(List.of(0));
        when(jdbc.queryForList(anyString(), eq(Integer.class), eq(4L))).thenReturn(List.of(1));
        assertFalse(adapter.isRelinkPending(1L));
        assertFalse(adapter.isRelinkPending(2L));
        assertFalse(adapter.isRelinkPending(3L));
        assertTrue(adapter.isRelinkPending(4L));
    }

    @Test
    @DisplayName("Ban hashes: none or already stored by another user insert nothing; a null count reads as zero")
    void bannedHashes() {
        adapter.storeBannedHashes("u-1", null, null);
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq("taken"))).thenReturn(1);
        adapter.storeBannedHashes("u-1", "taken", null);
        adapter.storeBannedHashes("u-1", null, "taken");
        verify(jdbc, never()).update(startsWith("INSERT"), any(Object[].class));
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq("free"))).thenReturn(null);
        adapter.storeBannedHashes("u-1", "free", "taken");
        verify(jdbc).update(startsWith("INSERT"), eq("u-1"), eq("free"), isNull(), anyString());
        assertFalse(adapter.isBanned("free", null));
        assertTrue(adapter.isBanned(null, "taken"));
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq("u-none"))).thenReturn(null);
        assertFalse(adapter.hasBannedHashes("u-none"));
    }

    @Test
    @DisplayName("An intervention without an admin uuid is logged as UNKNOWN")
    void unknownAdmin() {
        AdminInterventionAdapter log = new AdminInterventionAdapter(jdbc);
        log.record(" ", "BAN", "u-1", "reason");
        log.record(null, "BAN", "u-1", "reason");
        verify(jdbc, times(2)).update(eq(AdminInterventionAdapter.INSERT), anyString(), anyString(), eq("UNKNOWN"),
                eq("BAN"), eq("u-1"), eq("reason"));
    }
}
