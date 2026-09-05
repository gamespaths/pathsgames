package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingStateRegistryEntity;
import games.paths.core.port.match.RegistryStorePort.RegistryRow;
import games.paths.core.repository.match.GamingStateRegistryRepository;
import games.paths.core.repository.match.LogEventsRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@DisplayName("RegistryStoreAdapter (Step 36)")
class RegistryStoreAdapterTest {

    private GamingStateRegistryRepository repository;
    private LogEventsRepository logEventsRepository;
    private games.paths.core.repository.match.GamingMatchRepository matchRepository;
    private RegistryStoreAdapter adapter;

    @BeforeEach
    void setUp() {
        repository = mock(GamingStateRegistryRepository.class);
        logEventsRepository = mock(LogEventsRepository.class);
        matchRepository = mock(games.paths.core.repository.match.GamingMatchRepository.class);
        adapter = new RegistryStoreAdapter(repository, logEventsRepository, matchRepository);
    }

    private static GamingStateRegistryEntity multi(Long id, String key, String s, Integer i) {
        GamingStateRegistryEntity e = entity(id, key, s, i);
        e.setMultiValue(1);
        return e;
    }

    private static GamingStateRegistryEntity entity(Long id, String key, String s, Integer i) {
        GamingStateRegistryEntity e = new GamingStateRegistryEntity();
        e.setId(id);
        e.setIdMatch(1L);
        e.setUuid("u-" + key);
        e.setKey(key);
        e.setStringValue(s);
        e.setIntValue(i);
        return e;
    }

    @Test
    @DisplayName("findByMatch maps every column onto the row record")
    void findByMatchMapsColumns() {
        GamingStateRegistryEntity e = entity(2L, "flag", "yes", null);
        e.setIdCharacter(3L);
        e.setIdEvent(12L);
        e.setIdChoice(9L);
        e.setClock(5);
        when(repository.findByIdMatch(1L)).thenReturn(List.of(e));

        List<RegistryRow> rows = adapter.findByMatch(1L);

        assertEquals(1, rows.size());
        RegistryRow r = rows.get(0);
        assertEquals(2L, r.id());
        assertEquals("u-flag", r.uuid());
        assertEquals("flag", r.key());
        assertEquals("yes", r.stringValue());
        assertNull(r.intValue());
        assertEquals(3L, r.idCharacter());
        assertEquals(12L, r.idEvent());
        assertEquals(9L, r.idChoice());
        assertEquals(5, r.clock());
    }

    @Test
    @DisplayName("findByMatchAndKey answers every row of the key; a null key is empty")
    void findByMatchAndKey() {
        when(repository.findByIdMatchAndKey(1L, "count"))
                .thenReturn(List.of(entity(1L, "count", null, 7)));
        assertEquals(7, adapter.findByMatchAndKey(1L, "count").get(0).intValue());
        assertTrue(adapter.findByMatchAndKey(1L, null).isEmpty());
        verify(repository, never()).findByIdMatchAndKey(1L, null);
    }

    @Test
    @DisplayName("Step 36.1: a multi key answers every member, not just the first")
    void findByMatchAndKeyAnswersTheWholeSet() {
        when(repository.findByIdMatchAndKey(1L, "clues")).thenReturn(List.of(
                multi(1L, "clues", "A", null), multi(2L, "clues", "B", null)));

        assertEquals(List.of("A", "B"), adapter.findByMatchAndKey(1L, "clues").stream()
                .map(r -> r.stringValue()).toList());
    }

    @Test
    @DisplayName("upsert overwrites the existing key in place")
    void upsertUpdatesExisting() {
        GamingStateRegistryEntity existing = entity(4L, "count", "old", null);
        when(repository.findByIdMatchAndKey(1L, "count")).thenReturn(List.of(existing));

        adapter.upsert(1L, "count", null, 42, 3L, 12L, 9L, 5);

        assertEquals(42, existing.getIntValue());
        assertNull(existing.getStringValue());
        assertEquals(3L, existing.getIdCharacter());
        assertEquals(12L, existing.getIdEvent());
        assertEquals(9L, existing.getIdChoice());
        assertEquals(5, existing.getClock());
        verify(repository).save(existing);
    }

    @Test
    @DisplayName("upsert inserts a new key with the next free id")
    void upsertInsertsWithNextId() {
        when(repository.findByIdMatchAndKey(1L, "fresh")).thenReturn(List.of());
        when(repository.findByIdMatch(1L)).thenReturn(List.of(
                entity(2L, "other", "x", null), entity(4L, "with-id", "y", null)));

        adapter.upsert(1L, "fresh", "hello", null, 3L, 12L, null, 6);

        ArgumentCaptor<GamingStateRegistryEntity> cap =
                ArgumentCaptor.forClass(GamingStateRegistryEntity.class);
        verify(repository).save(cap.capture());
        GamingStateRegistryEntity row = cap.getValue();
        assertEquals(5L, row.getId());
        assertEquals(1L, row.getIdMatch());
        assertEquals("fresh", row.getKey());
        assertEquals("hello", row.getStringValue());
        assertEquals(6, row.getClock());
    }

    @Test
    @DisplayName("a match with no rows yet starts its ids at 1")
    void upsertFirstIdIsOne() {
        when(repository.findByIdMatchAndKey(1L, "first")).thenReturn(List.of());
        when(repository.findByIdMatch(1L)).thenReturn(List.of());

        adapter.upsert(1L, "first", "v", null, null, null, null, 0);

        ArgumentCaptor<GamingStateRegistryEntity> cap =
                ArgumentCaptor.forClass(GamingStateRegistryEntity.class);
        verify(repository).save(cap.capture());
        assertEquals(1L, cap.getValue().getId());
    }

    @Test
    @DisplayName("Step 36.1: insertValue adds a member and stamps the mirror")
    void insertValueStampsTheMirror() {
        when(repository.findByIdMatch(1L)).thenReturn(List.of(multi(2L, "clues", "A", null)));

        adapter.insertValue(1L, "clues", "B", null, 3L, 12L, null, 6);

        ArgumentCaptor<GamingStateRegistryEntity> cap =
                ArgumentCaptor.forClass(GamingStateRegistryEntity.class);
        verify(repository).save(cap.capture());
        assertEquals(3L, cap.getValue().getId());
        assertEquals("B", cap.getValue().getStringValue());
        // The mirror is what the partial unique index reads, and what decides how this match
        // writes the key from now on.
        assertEquals(1, cap.getValue().getMultiValue());
    }

    @Test
    @DisplayName("Step 36.1: deleteValue removes the one row holding that member")
    void deleteValueRemovesOneMember() {
        GamingStateRegistryEntity a = multi(1L, "clues", "A", null);
        GamingStateRegistryEntity b = multi(2L, "clues", "B", null);
        when(repository.findByIdMatchAndKey(1L, "clues")).thenReturn(List.of(a, b));

        adapter.deleteValue(1L, "clues", "B", null);

        verify(repository).delete(b);
        verify(repository, never()).delete(a);
    }

    @Test
    @DisplayName("Step 36.1: deleting a member the key does not hold touches nothing")
    void deleteValueMissingMember() {
        when(repository.findByIdMatchAndKey(1L, "clues"))
                .thenReturn(List.of(multi(1L, "clues", "A", null)));

        adapter.deleteValue(1L, "clues", "Z", null);

        verify(repository, never()).delete(any(GamingStateRegistryEntity.class));
    }

    @Test
    @DisplayName("Step 36.1: a member matching on one column only is not the same member")
    void deleteValueMatchesBothColumns() {
        when(repository.findByIdMatchAndKey(1L, "clues"))
                .thenReturn(List.of(multi(1L, "clues", null, 2)));

        adapter.deleteValue(1L, "clues", null, 3);

        verify(repository, never()).delete(any(GamingStateRegistryEntity.class));
    }

    @Test
    @DisplayName("Step 36.1: insertAll carries each seeded row's own mirror")
    void insertAllCarriesTheMirror() {
        adapter.insertAll(9L, List.of(RegistryRow.of("single", "x", null, false),
                RegistryRow.of("clues", "A", null, true)));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<GamingStateRegistryEntity>> cap = ArgumentCaptor.forClass(List.class);
        verify(repository).saveAll(cap.capture());
        assertEquals(0, cap.getValue().get(0).getMultiValue());
        assertEquals(1, cap.getValue().get(1).getMultiValue());
    }

    @Test
    @DisplayName("insertAll numbers the seeded rows from 1")
    void insertAllNumbersFromOne() {
        adapter.insertAll(9L, List.of(RegistryRow.of("a", "x", null), RegistryRow.of("b", null, 2)));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<GamingStateRegistryEntity>> cap = ArgumentCaptor.forClass(List.class);
        verify(repository).saveAll(cap.capture());
        List<GamingStateRegistryEntity> saved = cap.getValue();
        assertEquals(2, saved.size());
        assertEquals(1L, saved.get(0).getId());
        assertEquals(9L, saved.get(0).getIdMatch());
        assertEquals("a", saved.get(0).getKey());
        assertEquals(2L, saved.get(1).getId());
        assertEquals(2, saved.get(1).getIntValue());
    }

    @Test
    @DisplayName("nothing to insert or delete touches the repository")
    void emptyWritesAreNoOps() {
        adapter.insertAll(9L, null);
        adapter.insertAll(9L, List.of());
        adapter.deleteByMatchIdIn(null);
        adapter.deleteByMatchIdIn(List.of());
        verify(repository, never()).saveAll(any());
        verify(repository, never()).deleteByMatchIdIn(any());
    }

    @Test
    @DisplayName("logChange writes one log_events row carrying the whole provenance")
    void logChangeWritesTheAuditRow() {
        when(logEventsRepository.findMaxId()).thenReturn(11L);

        adapter.logChange(1L, 3L, 12L, 9L, 5, "REGISTRY_CHANGE gate null -> OPEN");

        ArgumentCaptor<games.paths.core.entity.match.LogEventsEntity> cap =
                ArgumentCaptor.forClass(games.paths.core.entity.match.LogEventsEntity.class);
        verify(logEventsRepository).save(cap.capture());
        games.paths.core.entity.match.LogEventsEntity row = cap.getValue();
        assertEquals(12L, row.getId());
        assertEquals(1L, row.getIdMatch());
        assertEquals(3L, row.getIdCharacterMatch());
        assertEquals(12L, row.getIdEvent());
        assertEquals(9L, row.getIdChoise());
        assertEquals(5, row.getClock());
        assertEquals("REGISTRY_CHANGE gate null -> OPEN", row.getLogMessage());
    }

    @Test
    @DisplayName("deleteByMatchIdIn hands the ids to the repository")
    void deleteDelegates() {
        adapter.deleteByMatchIdIn(List.of(1L, 2L));
        verify(repository).deleteByMatchIdIn(List.of(1L, 2L));
    }
}
