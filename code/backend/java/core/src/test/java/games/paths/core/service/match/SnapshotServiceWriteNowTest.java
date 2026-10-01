package games.paths.core.service.match;

import games.paths.core.port.match.SnapshotPort;
import games.paths.core.port.match.SnapshotStorePort;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** v0.41.4 — SnapshotService.writeNow: the "Imported at clock N" snapshot, written even with snapshots off. */
@DisplayName("SnapshotService.writeNow (v0.41.4)")
class SnapshotServiceWriteNowTest {

    @Test
    void writesWithTheGivenDescriptionAndPrunesOnlyWhenKeepIsSet() {
        SnapshotStorePort store = mock(SnapshotStorePort.class);
        when(store.findMatchById(1L)).thenReturn(Optional.of(new SnapshotStorePort.MatchRef(1L, "m", 9L, "PAUSED", 3)));
        when(store.readState(1L)).thenReturn(Map.of());
        when(store.logMarks(1L)).thenReturn(Map.of());
        when(store.list(1L)).thenReturn(List.of(new SnapshotStorePort.StoredSnapshot(1L, "s-1", 3, "LIGHT", "t",
                "Imported at clock 3", 1, null, "c")), List.of());
        SnapshotService off = new SnapshotService(store, 0);
        assertEquals("s-1", off.writeNow(1L, "Imported at clock 3"));
        verify(store).insert(any());
        verify(store, never()).prune(anyLong(), anyInt());
        assertNull(off.writeNow(1L, "again"));
        SnapshotService on = new SnapshotService(store, 4);
        on.writeNow(1L, "x");
        verify(store).prune(1L, 4);
        SnapshotPort.SnapshotException ex = assertThrows(SnapshotPort.SnapshotException.class, () -> on.writeNow(2L, "x"));
        assertEquals(SnapshotPort.SnapshotException.Code.MATCH_NOT_FOUND, ex.getCode());
    }
}
