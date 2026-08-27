package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.LogEventsEntity;
import games.paths.core.repository.match.GamingCharacterInstanceRepository;
import games.paths.core.repository.match.LogEventsRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * EdgeStateStoreAdapter (Step 30) — the coma/sleep flag writes and the log_events rows.
 */
@DisplayName("EdgeStateStoreAdapter (Step 30)")
class EdgeStateStoreAdapterTest {

    private GamingCharacterInstanceRepository characterRepository;
    private LogEventsRepository logEventsRepository;
    private EdgeStateStoreAdapter adapter;

    @BeforeEach
    void setUp() {
        characterRepository = mock(GamingCharacterInstanceRepository.class);
        logEventsRepository = mock(LogEventsRepository.class);
        adapter = new EdgeStateStoreAdapter(characterRepository, logEventsRepository);
        when(logEventsRepository.findMaxId()).thenReturn(41L);
    }

    private GamingCharacterInstanceEntity character() {
        GamingCharacterInstanceEntity c = new GamingCharacterInstanceEntity();
        c.setId(3L);
        c.setIsComa(false);
        c.setIsSleeping(false);
        c.setClockInComa(0);
        return c;
    }

    private GamingCharacterInstanceEntity saved() {
        ArgumentCaptor<GamingCharacterInstanceEntity> c =
                ArgumentCaptor.forClass(GamingCharacterInstanceEntity.class);
        verify(characterRepository).save(c.capture());
        return c.getValue();
    }

    @Test
    @DisplayName("setComa raises both flags AND stamps the clock — the Step 29 gap")
    void setComaStampsTheClock() {
        when(characterRepository.findById(any())).thenReturn(Optional.of(character()));

        adapter.setComa(1L, 3L, 12);

        GamingCharacterInstanceEntity c = saved();
        assertAll(
                () -> assertTrue(c.getIsComa()),
                () -> assertTrue(c.getIsSleeping(), "a comatose character is also asleep"),
                () -> assertEquals(12, c.getClockInComa()));
    }

    @Test
    @DisplayName("setSleeping raises sleep alone, leaving coma untouched")
    void setSleepingDoesNotComa() {
        when(characterRepository.findById(any())).thenReturn(Optional.of(character()));

        adapter.setSleeping(1L, 3L);

        GamingCharacterInstanceEntity c = saved();
        assertTrue(c.getIsSleeping());
        assertEquals(false, c.getIsComa(), "a sadness overflow is not a coma");
    }

    @Test
    @DisplayName("clearComa lowers is_coma and leaves is_sleeping alone")
    void clearComaLowersTheFlag() {
        GamingCharacterInstanceEntity c = character();
        c.setIsComa(true);
        c.setIsSleeping(true);
        when(characterRepository.findById(any())).thenReturn(Optional.of(c));

        adapter.clearComa(1L, 3L);

        GamingCharacterInstanceEntity saved = saved();
        assertEquals(false, saved.getIsComa());
        assertTrue(saved.getIsSleeping(), "waking is the recovery's job, not this write's");
    }

    @Test
    @DisplayName("A missing character is a no-op, not a crash")
    void missingCharacterIsIgnored() {
        when(characterRepository.findById(any())).thenReturn(Optional.empty());

        adapter.setComa(1L, 3L, 12);
        adapter.setSleeping(1L, 3L);
        adapter.clearComa(1L, 3L);

        verify(characterRepository, never()).save(any());
    }

    @Test
    @DisplayName("logEdgeState allocates the next id and carries the nullable ids through")
    void logEdgeStateWritesTheRow() {
        adapter.logEdgeState(1L, 3L, 9L, 5, "COMA 3");

        ArgumentCaptor<LogEventsEntity> c = ArgumentCaptor.forClass(LogEventsEntity.class);
        verify(logEventsRepository).save(c.capture());
        LogEventsEntity e = c.getValue();
        assertAll(
                () -> assertEquals(42L, e.getId(), "max id plus one"),
                () -> assertEquals(1L, e.getIdMatch()),
                () -> assertEquals(3L, e.getIdCharacterMatch()),
                () -> assertEquals(9L, e.getIdEvent()),
                () -> assertEquals(5, e.getClock()),
                () -> assertEquals("COMA 3", e.getLogMessage()));
    }

    @Test
    @DisplayName("A party-wide row belongs to no character and no event")
    void logEdgeStateAcceptsNulls() {
        adapter.logEdgeState(1L, null, null, 5, "ALL_PLAYER_COMA 1");

        ArgumentCaptor<LogEventsEntity> c = ArgumentCaptor.forClass(LogEventsEntity.class);
        verify(logEventsRepository).save(c.capture());
        assertAll(
                () -> assertNull(c.getValue().getIdCharacterMatch()),
                () -> assertNull(c.getValue().getIdEvent()));
    }
}
