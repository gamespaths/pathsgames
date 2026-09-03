package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingStateRegistryEntity;
import games.paths.core.port.match.RegistryStorePort;
import games.paths.core.entity.match.LogEventsEntity;
import games.paths.core.repository.match.GamingStateRegistryRepository;
import games.paths.core.repository.match.LogEventsRepository;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * RegistryStoreAdapter - JPA adapter for {@link RegistryStorePort}, the single writer and
 * reader of {@code gaming_state_registry}. Step 36.
 */
@Repository
public class RegistryStoreAdapter implements RegistryStorePort {

    private final GamingStateRegistryRepository registryRepository;
    private final LogEventsRepository logEventsRepository;

    public RegistryStoreAdapter(GamingStateRegistryRepository registryRepository,
                                LogEventsRepository logEventsRepository) {
        this.registryRepository = registryRepository;
        this.logEventsRepository = logEventsRepository;
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
    public Optional<RegistryRow> findByMatchAndKey(long idMatch, String key) {
        if (key == null) {
            return Optional.empty();
        }
        return registryRepository.findByIdMatchAndKey(idMatch, key).map(RegistryStoreAdapter::toRow);
    }

    @Override
    @Transactional
    public void upsert(long idMatch, String key, String stringValue, Integer intValue,
                       Long idCharacter, Long idEvent, Long idChoice, Integer clock) {
        GamingStateRegistryEntity row = registryRepository.findByIdMatchAndKey(idMatch, key)
                .orElse(null);
        if (row == null) {
            row = new GamingStateRegistryEntity();
            row.setId(nextId(idMatch));
            row.setIdMatch(idMatch);
            row.setKey(key);
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
                .filter(java.util.Objects::nonNull)
                .mapToLong(Long::longValue).max().orElse(0L) + 1L;
    }

    private static RegistryRow toRow(GamingStateRegistryEntity r) {
        return new RegistryRow(r.getId(), r.getUuid(), r.getKey(), r.getStringValue(),
                r.getIntValue(), r.getIdCharacter(), r.getIdEvent(), r.getIdChoice(), r.getClock());
    }
}
