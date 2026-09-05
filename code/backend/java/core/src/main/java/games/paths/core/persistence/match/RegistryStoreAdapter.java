package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingStateRegistryEntity;
import games.paths.core.entity.match.LogEventsEntity;
import games.paths.core.port.match.RegistryStorePort;
import games.paths.core.repository.match.GamingStateRegistryRepository;
import games.paths.core.repository.match.LogEventsRepository;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * RegistryStoreAdapter - JPA adapter for {@link RegistryStorePort}, the single writer and
 * reader of {@code gaming_state_registry}. Step 36; Step 36.1 made a key able to own several
 * rows, one per value of its set.
 */
@Repository
public class RegistryStoreAdapter implements RegistryStorePort {

    private final GamingStateRegistryRepository registryRepository;
    private final LogEventsRepository logEventsRepository;
    private final games.paths.core.repository.match.GamingMatchRepository matchRepository;

    public RegistryStoreAdapter(GamingStateRegistryRepository registryRepository,
                                LogEventsRepository logEventsRepository,
                                games.paths.core.repository.match.GamingMatchRepository matchRepository) {
        this.registryRepository = registryRepository;
        this.logEventsRepository = logEventsRepository;
        this.matchRepository = matchRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public java.util.Optional<long[]> findMatchAndStoryIdByUuid(String matchUuid) {
        if (matchUuid == null || matchUuid.isBlank()) {
            return java.util.Optional.empty();
        }
        return matchRepository.findByUuid(matchUuid)
                .filter(m -> m.getId() != null && m.getIdStory() != null)
                .map(m -> new long[]{m.getId(), m.getIdStory()});
    }

    @Override
    @Transactional(readOnly = true)
    public List<RegistryRow> findByMatch(long idMatch) {
        List<RegistryRow> out = new ArrayList<>();
        for (GamingStateRegistryEntity r : registryRepository.findByIdMatch(idMatch)) {
            out.add(toRow(r));
        }
        return out;
    }

    @Override
    @Transactional(readOnly = true)
    public List<RegistryRow> findByMatchAndKey(long idMatch, String key) {
        if (key == null) {
            return List.of();
        }
        List<RegistryRow> out = new ArrayList<>();
        for (GamingStateRegistryEntity r : registryRepository.findByIdMatchAndKey(idMatch, key)) {
            out.add(toRow(r));
        }
        return out;
    }

    @Override
    @Transactional
    public void upsert(long idMatch, String key, String stringValue, Integer intValue,
                       Long idCharacter, Long idEvent, Long idChoice, Integer clock) {
        List<GamingStateRegistryEntity> rows = registryRepository.findByIdMatchAndKey(idMatch, key);
        GamingStateRegistryEntity row = rows.isEmpty() ? null : rows.get(0);
        if (row == null) {
            row = new GamingStateRegistryEntity();
            row.setId(nextId(idMatch));
            row.setIdMatch(idMatch);
            row.setKey(key);
            row.setMultiValue(0);
        }
        row.setStringValue(stringValue);
        row.setIntValue(intValue);
        row.setIdCharacter(idCharacter);
        row.setIdEvent(idEvent);
        row.setIdChoice(idChoice);
        row.setClock(clock);
        registryRepository.save(row);
    }

    @Override
    @Transactional
    public void insertValue(long idMatch, String key, String stringValue, Integer intValue,
                            Long idCharacter, Long idEvent, Long idChoice, Integer clock) {
        GamingStateRegistryEntity row = new GamingStateRegistryEntity();
        row.setId(nextId(idMatch));
        row.setIdMatch(idMatch);
        row.setKey(key);
        row.setMultiValue(1);
        row.setStringValue(stringValue);
        row.setIntValue(intValue);
        row.setIdCharacter(idCharacter);
        row.setIdEvent(idEvent);
        row.setIdChoice(idChoice);
        row.setClock(clock);
        registryRepository.save(row);
    }

    @Override
    @Transactional
    public void deleteValue(long idMatch, String key, String stringValue, Integer intValue) {
        for (GamingStateRegistryEntity r : registryRepository.findByIdMatchAndKey(idMatch, key)) {
            if (Objects.equals(r.getStringValue(), stringValue)
                    && Objects.equals(r.getIntValue(), intValue)) {
                registryRepository.delete(r);
                return;
            }
        }
    }

    @Override
    @Transactional
    public void insertAll(long idMatch, List<RegistryRow> rows) {
        if (rows == null || rows.isEmpty()) {
            return;
        }
        List<GamingStateRegistryEntity> entities = new ArrayList<>();
        long nextId = 1L;
        for (RegistryRow r : rows) {
            GamingStateRegistryEntity e = new GamingStateRegistryEntity();
            e.setId(nextId++);
            e.setIdMatch(idMatch);
            e.setKey(r.key());
            e.setStringValue(r.stringValue());
            e.setIntValue(r.intValue());
            e.setMultiValue(r.isMulti() ? 1 : 0);
            entities.add(e);
        }
        registryRepository.saveAll(entities);
    }

    @Override
    @Transactional
    public void deleteByMatchIdIn(List<Long> matchIds) {
        if (matchIds == null || matchIds.isEmpty()) {
            return;
        }
        registryRepository.deleteByMatchIdIn(matchIds);
    }

    @Override
    @Transactional
    public void logChange(long idMatch, Long idCharacter, Long idEvent, Long idChoice,
                          Integer clock, String message) {
        LogEventsEntity e = new LogEventsEntity();
        e.setId(logEventsRepository.findMaxId() + 1);
        e.setIdMatch(idMatch);
        e.setIdCharacterMatch(idCharacter);
        e.setIdEvent(idEvent);
        e.setIdChoise(idChoice);
        e.setClock(clock);
        e.setLogMessage(message);
        logEventsRepository.save(e);
    }

    private long nextId(long idMatch) {
        return registryRepository.findByIdMatch(idMatch).stream()
                .map(GamingStateRegistryEntity::getId)
                .filter(Objects::nonNull)
                .mapToLong(Long::longValue).max().orElse(0L) + 1L;
    }

    private static RegistryRow toRow(GamingStateRegistryEntity r) {
        return new RegistryRow(r.getId(), r.getUuid(), r.getKey(), r.getStringValue(),
                r.getIntValue(), r.getIdCharacter(), r.getIdEvent(), r.getIdChoice(), r.getClock(),
                r.getMultiValue());
    }
}
