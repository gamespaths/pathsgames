package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingCharacterInstanceEntityId;
import games.paths.core.entity.match.LogEventsEntity;
import games.paths.core.port.match.EdgeStateStorePort;
import games.paths.core.repository.match.GamingCharacterInstanceRepository;
import games.paths.core.repository.match.LogEventsRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/**
 * EdgeStateStoreAdapter - JPA adapter implementing {@link EdgeStateStorePort} for the Step 30
 * edge states.
 *
 * <p>Shared by the three services that can push a character over an edge: event execution,
 * time-start recovery and the admin change-stats command.</p>
 */
@Repository
@Transactional
public class EdgeStateStoreAdapter implements EdgeStateStorePort {

    private final GamingCharacterInstanceRepository characterRepository;
    private final LogEventsRepository logEventsRepository;

    public EdgeStateStoreAdapter(GamingCharacterInstanceRepository characterRepository,
                                 LogEventsRepository logEventsRepository) {
        this.characterRepository = characterRepository;
        this.logEventsRepository = logEventsRepository;
    }

    @Override
    public void setComa(long idMatch, long idCharacter, int clockInComa) {
        characterRepository.findById(new GamingCharacterInstanceEntityId(idCharacter, idMatch))
                .ifPresent(c -> {
                    c.setIsComa(true);
                    c.setIsSleeping(true);
                    c.setClockInComa(clockInComa);
                    characterRepository.save(c);
                });
    }

    @Override
    public void setSleeping(long idMatch, long idCharacter) {
        characterRepository.findById(new GamingCharacterInstanceEntityId(idCharacter, idMatch))
                .ifPresent(c -> {
                    c.setIsSleeping(true);
                    characterRepository.save(c);
                });
    }

    @Override
    public void clearComa(long idMatch, long idCharacter) {
        characterRepository.findById(new GamingCharacterInstanceEntityId(idCharacter, idMatch))
                .ifPresent(c -> {
                    c.setIsComa(false);
                    characterRepository.save(c);
                });
    }

    @Override
    public void logEdgeState(long idMatch, Long idCharacter, Long idEvent, int clock, String message) {
        LogEventsEntity e = new LogEventsEntity();
        e.setId(logEventsRepository.findMaxId() + 1);
        e.setIdMatch(idMatch);
        e.setIdCharacterMatch(idCharacter);
        e.setIdEvent(idEvent);
        e.setClock(clock);
        e.setLogMessage(message);
        logEventsRepository.save(e);
    }
}
