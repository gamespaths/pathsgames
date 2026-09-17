package games.paths.core.persistence.match;

import games.paths.core.entity.match.LogEventsEntity;
import games.paths.core.port.match.ExperienceStorePort;
import games.paths.core.repository.match.GamingCharacterInstanceRepository;
import games.paths.core.repository.match.GamingMatchRepository;
import games.paths.core.repository.match.LogEventsRepository;
import games.paths.core.repository.story.LocationRepository;
import games.paths.core.repository.story.StoryDifficultyRepository;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * ExperienceStoreAdapter - JPA adapter implementing {@link ExperienceStorePort}. Step 38.
 */
@Repository
@Transactional
public class ExperienceStoreAdapter implements ExperienceStorePort {

    private final GamingMatchRepository matchRepository;
    private final GamingCharacterInstanceRepository characterRepository;
    private final LocationRepository locationRepository;
    private final StoryDifficultyRepository difficultyRepository;
    private final LogEventsRepository logEventsRepository;

    public ExperienceStoreAdapter(GamingMatchRepository matchRepository,
                                  GamingCharacterInstanceRepository characterRepository,
                                  LocationRepository locationRepository,
                                  StoryDifficultyRepository difficultyRepository,
                                  LogEventsRepository logEventsRepository) {
        this.matchRepository = matchRepository;
        this.characterRepository = characterRepository;
        this.locationRepository = locationRepository;
        this.difficultyRepository = difficultyRepository;
        this.logEventsRepository = logEventsRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<MatchExpView> findMatchByUuid(String matchUuid) {
        return matchRepository.findByUuid(matchUuid)
                .map(m -> new MatchExpView(m.getId(), m.getUuid(), m.getStatus(), m.getIdStory(),
                        m.getIdDifficulty(), m.getExpCost(), nz(m.getCurrentClock()),
                        m.getIdCharacterCurrentTurn()));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<CharacterExpView> findCharacterByMatchAndUser(long idMatch, long idUser) {
        return characterRepository.findByIdMatchAndIdUser(idMatch, idUser)
                .map(c -> new CharacterExpView(c.getId(), c.getUuid(),
                        nz(c.getDexterity()), nz(c.getIntelligence()), nz(c.getConstitution()), nz(c.getExp()),
                        Boolean.TRUE.equals(c.getIsSleeping()), Boolean.TRUE.equals(c.getIsComa()),
                        c.getIdLocation()));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Integer> findLocationSecureParam(long idStory, long idLocation) {
        return locationRepository.findByIdStoryAndId(idStory, idLocation).map(l -> nz(l.getSecureParam()));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<DifficultyExpView> findDifficulty(long idStory, long idDifficulty) {
        return difficultyRepository.findByIdStoryAndId(idStory, idDifficulty)
                .map(d -> new DifficultyExpView(d.getExpCost(), d.getExpCostBase(), d.getMaxStatValue()));
    }

    @Override
    public void updateCharacter(long idMatch, long idCharacter, int dexterity, int intelligence,
                                int constitution, int exp) {
        characterRepository.findByIdMatchAndId(idMatch, idCharacter).ifPresent(c -> {
            c.setDexterity(dexterity);
            c.setIntelligence(intelligence);
            c.setConstitution(constitution);
            c.setExp(Math.max(0, exp));
            characterRepository.save(c);
        });
    }

    @Override
    public void logExpUse(long idMatch, long idCharacter, int clock, String message) {
        LogEventsEntity e = new LogEventsEntity();
        e.setId(logEventsRepository.findMaxId() + 1);
        e.setIdMatch(idMatch);
        e.setIdCharacterMatch(idCharacter);
        e.setClock(clock);
        e.setLogMessage(message);
        logEventsRepository.save(e);
    }

    private static int nz(Integer v) {
        return v != null ? v : 0;
    }
}
