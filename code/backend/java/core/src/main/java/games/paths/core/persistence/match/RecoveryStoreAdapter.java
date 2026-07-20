package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingCharacterInstanceEntityId;
import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.match.GamingStateLocationsEntity;
import games.paths.core.entity.match.GamingStateLocationsEntityId;
import games.paths.core.entity.match.LogEventsEntity;
import games.paths.core.entity.story.ClassBonusEntity;
import games.paths.core.entity.story.LocationEntity;
import games.paths.core.entity.story.StoryDifficultyEntity;
import games.paths.core.port.match.RecoveryStorePort;
import games.paths.core.port.story.StoryReadPort;
import games.paths.core.repository.match.GamingCharacterInstanceRepository;
import games.paths.core.repository.match.GamingMatchRepository;
import games.paths.core.repository.match.GamingStateLocationsRepository;
import games.paths.core.repository.match.LogEventsRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * RecoveryStoreAdapter - JPA adapter implementing {@link RecoveryStorePort} for
 * the Step 26 time-start recovery engine.
 */
@Repository
@Transactional
public class RecoveryStoreAdapter implements RecoveryStorePort {

    private final GamingMatchRepository matchRepository;
    private final GamingCharacterInstanceRepository characterRepository;
    private final GamingStateLocationsRepository stateLocationsRepository;
    private final LogEventsRepository logEventsRepository;
    private final StoryReadPort storyReadPort;

    public RecoveryStoreAdapter(GamingMatchRepository matchRepository,
                                GamingCharacterInstanceRepository characterRepository,
                                GamingStateLocationsRepository stateLocationsRepository,
                                LogEventsRepository logEventsRepository,
                                StoryReadPort storyReadPort) {
        this.matchRepository = matchRepository;
        this.characterRepository = characterRepository;
        this.stateLocationsRepository = stateLocationsRepository;
        this.logEventsRepository = logEventsRepository;
        this.storyReadPort = storyReadPort;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<RecoveryMatchContext> loadContext(long idMatch) {
        GamingMatchEntity m = matchRepository.findById(idMatch).orElse(null);
        if (m == null || m.getIdStory() == null) {
            return Optional.empty();
        }
        int difficultyEnergy = 0;
        if (m.getIdDifficulty() != null) {
            for (StoryDifficultyEntity d : storyReadPort.findDifficultiesByStoryId(m.getIdStory())) {
                if (m.getIdDifficulty().equals(d.getId())) {
                    difficultyEnergy = nz(d.getEnergy());
                    break;
                }
            }
        }
        return Optional.of(new RecoveryMatchContext(m.getIdStory(), difficultyEnergy,
                nz(m.getCurrentClock())));
    }

    @Override
    @Transactional(readOnly = true)
    public List<RecoveryCharacter> findCharacters(long idMatch) {
        List<RecoveryCharacter> out = new ArrayList<>();
        for (GamingCharacterInstanceEntity c : characterRepository.findByIdMatch(idMatch)) {
            out.add(new RecoveryCharacter(
                    c.getId(), c.getUuid(), c.getIdClass(), c.getIdLocation(),
                    nz(c.getDexterity()), nz(c.getIntelligence()), nz(c.getConstitution()),
                    nz(c.getEnergy()), nz(c.getLife()), nz(c.getSad()),
                    nz(c.getEnergyMax()), nz(c.getLifeMax()), nz(c.getSadMax()),
                    Boolean.TRUE.equals(c.getIsComa())));
        }
        return out;
    }

    @Override
    @Transactional(readOnly = true)
    public List<LocationSafety> findLocationSafety(long idStory) {
        List<LocationSafety> out = new ArrayList<>();
        for (LocationEntity l : storyReadPort.findLocationsByStoryId(idStory)) {
            out.add(new LocationSafety(
                    l.getId(), nz(l.getSecureParam()), l.getCounterTime(), l.getIdEventIfCounterZero()));
        }
        return out;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ClassBonusView> findClassBonuses(long idStory) {
        List<ClassBonusView> out = new ArrayList<>();
        for (ClassBonusEntity b : storyReadPort.findClassBonusesByStoryId(idStory)) {
            if (b.getIdClass() == null) continue;
            out.add(new ClassBonusView(b.getIdClass().longValue(), b.getStatistic(), nz(b.getValue())));
        }
        return out;
    }

    @Override
    @Transactional(readOnly = true)
    public List<StateLocationView> findStateLocations(long idMatch) {
        List<StateLocationView> out = new ArrayList<>();
        for (GamingStateLocationsEntity s : stateLocationsRepository.findByIdMatch(idMatch)) {
            out.add(new StateLocationView(s.getIdLocation(), nz(s.getClockCounter()), nz(s.getFlagAlreadyActived())));
        }
        return out;
    }

    @Override
    public void updateCharacterStats(long idMatch, long idCharacter, int energy, int life, int sad) {
        characterRepository.findById(new GamingCharacterInstanceEntityId(idCharacter, idMatch))
                .ifPresent(c -> {
                    c.setEnergy(energy);
                    c.setLife(life);
                    c.setSad(sad);
                    characterRepository.save(c);
                });
    }

    @Override
    public void insertStateLocation(long idMatch, long idLocation, int clockCounter) {
        GamingStateLocationsEntity e = new GamingStateLocationsEntity();
        e.setIdMatch(idMatch);
        e.setIdLocation(idLocation);
        e.setFlagAlreadyActived(0);
        e.setClockCounter(clockCounter);
        stateLocationsRepository.save(e);
    }

    @Override
    public void updateStateLocationCounter(long idMatch, long idLocation, int newClockCounter) {
        stateLocationsRepository.findById(new GamingStateLocationsEntityId(idMatch, idLocation))
                .ifPresent(s -> {
                    s.setClockCounter(newClockCounter);
                    stateLocationsRepository.save(s);
                });
    }

    @Override
    public void markStateLocationActivated(long idMatch, long idLocation) {
        stateLocationsRepository.findById(new GamingStateLocationsEntityId(idMatch, idLocation))
                .ifPresent(s -> {
                    s.setFlagAlreadyActived(1);
                    stateLocationsRepository.save(s);
                });
    }

    @Override
    public void logRecovery(long idMatch, long idCharacter, String message) {
        LogEventsEntity e = new LogEventsEntity();
        e.setId(logEventsRepository.findMaxId() + 1);
        e.setIdMatch(idMatch);
        e.setIdCharacterMatch(idCharacter);
        e.setLogMessage(message);
        logEventsRepository.save(e);
    }

    @Override
    public void logCounterZero(long idMatch, long idLocation, Integer idEventIfCounterZero, String message) {
        LogEventsEntity e = new LogEventsEntity();
        e.setId(logEventsRepository.findMaxId() + 1);
        e.setIdMatch(idMatch);
        e.setIdEvent(idEventIfCounterZero == null ? null : idEventIfCounterZero.longValue());
        e.setLogMessage(message);
        logEventsRepository.save(e);
    }

    private static int nz(Integer v) {
        return v == null ? 0 : v;
    }
}
