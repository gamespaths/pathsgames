package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingStateLocationsEntityId;
import games.paths.core.entity.match.LogEventsEntity;
import games.paths.core.entity.match.LogMovementEntity;
import games.paths.core.entity.story.LocationEntity;
import games.paths.core.port.match.LocationEntryStorePort;
import games.paths.core.port.story.StoryReadPort;
import games.paths.core.repository.match.GamingCharacterInstanceRepository;
import games.paths.core.repository.match.GamingStateLocationsRepository;
import games.paths.core.repository.match.LogEventsRepository;
import games.paths.core.repository.match.LogMovementRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * LocationEntryStoreAdapter - JPA adapter implementing {@link LocationEntryStorePort}
 * for the Step 33 location engine.
 */
@Repository
@Transactional
public class LocationEntryStoreAdapter implements LocationEntryStorePort {

    private final GamingStateLocationsRepository stateLocationsRepository;
    private final GamingCharacterInstanceRepository characterRepository;
    private final LogEventsRepository logEventsRepository;
    private final LogMovementRepository logMovementRepository;
    private final StoryReadPort storyReadPort;

    public LocationEntryStoreAdapter(GamingStateLocationsRepository stateLocationsRepository,
                                     GamingCharacterInstanceRepository characterRepository,
                                     LogEventsRepository logEventsRepository,
                                     LogMovementRepository logMovementRepository,
                                     StoryReadPort storyReadPort) {
        this.stateLocationsRepository = stateLocationsRepository;
        this.characterRepository = characterRepository;
        this.logEventsRepository = logEventsRepository;
        this.logMovementRepository = logMovementRepository;
        this.storyReadPort = storyReadPort;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<LocationTriggerView> findLocationTriggers(long idStory, long idLocation) {
        for (LocationEntity l : storyReadPort.findLocationsByStoryId(idStory)) {
            if (l.getId() != null && l.getId().longValue() == idLocation) {
                return Optional.of(new LocationTriggerView(
                        idLocation,
                        l.getIdCard(),
                        l.getIdEventIfFirstTime(),
                        l.getIdEventNotFirstTime(),
                        l.getIdEventIfCharacterEnterEmptyLocation(),
                        l.getIdEventIfCharacterStartTime(),
                        l.getIdEventIfCounterZero(),
                        l.getPriorityAutomaticEvent()));
            }
        }
        return Optional.empty();
    }

    @Override
    @Transactional(readOnly = true)
    public int findFlagVisited(long idMatch, long idLocation) {
        return stateLocationsRepository.findById(new GamingStateLocationsEntityId(idMatch, idLocation))
                .map(s -> nz(s.getFlagVisited()))
                .orElse(0);
    }

    @Override
    public void markStateLocationVisited(long idMatch, long idLocation) {
        stateLocationsRepository.findById(new GamingStateLocationsEntityId(idMatch, idLocation))
                .ifPresent(s -> {
                    if (nz(s.getFlagVisited()) == 1) {
                        return;
                    }
                    s.setFlagVisited(1);
                    stateLocationsRepository.save(s);
                });
    }

    @Override
    @Transactional(readOnly = true)
    public int countOtherCharactersAtLocation(long idMatch, long idLocation, long exceptIdCharacter) {
        int count = 0;
        for (GamingCharacterInstanceEntity c : characterRepository.findByIdMatch(idMatch)) {
            if (c.getId() == null || c.getId() == exceptIdCharacter) {
                continue;
            }
            if (c.getIdLocation() != null && c.getIdLocation().longValue() == idLocation) {
                count++;
            }
        }
        return count;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Long> findNominalActorAtLocation(long idMatch, long idLocation) {
        Long lowest = null;
        for (GamingCharacterInstanceEntity c : characterRepository.findByIdMatch(idMatch)) {
            if (c.getId() == null || c.getIdLocation() == null) {
                continue;
            }
            if (c.getIdLocation().longValue() != idLocation) {
                continue;
            }
            if (lowest == null || c.getId() < lowest) {
                lowest = c.getId();
            }
        }
        return Optional.ofNullable(lowest);
    }

    @Override
    public void logAutomaticEvent(long idMatch, Long idCharacter, long idLocation, Long idEvent,
                                  Integer clock, String message) {
        LogEventsEntity e = new LogEventsEntity();
        e.setId(logEventsRepository.findMaxId() + 1);
        e.setIdMatch(idMatch);
        e.setIdCharacterMatch(idCharacter);
        e.setIdLocation(idLocation);
        e.setIdEvent(idEvent);
        e.setClock(clock);
        e.setLogMessage(message);
        logEventsRepository.save(e);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Long> findVisitedLocationIds(long idMatch) {
        Set<Long> ids = new LinkedHashSet<>();
        for (GamingCharacterInstanceEntity c : characterRepository.findByIdMatch(idMatch)) {
            if (c.getIdLocation() != null) {
                ids.add(c.getIdLocation());
            }
        }
        for (LogMovementEntity l : logMovementRepository.findByIdMatch(idMatch)) {
            if (l.getIdLocationFrom() != null) {
                ids.add(l.getIdLocationFrom());
            }
            if (l.getIdLocationTo() != null) {
                ids.add(l.getIdLocationTo());
            }
        }
        return new ArrayList<>(ids);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Long> findCharacterLocation(long idMatch, long idCharacter) {
        return characterRepository.findByIdMatchAndId(idMatch, idCharacter)
                .map(GamingCharacterInstanceEntity::getIdLocation);
    }

    private static int nz(Integer v) {
        return v == null ? 0 : v;
    }
}
