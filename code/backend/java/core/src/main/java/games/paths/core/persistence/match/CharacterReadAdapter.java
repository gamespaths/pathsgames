package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingBackpackResourcesEntity;
import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingCharacterTraitsEntity;
import games.paths.core.port.match.CharacterReadPort;
import games.paths.core.repository.match.GamingBackpackResourcesRepository;
import games.paths.core.repository.match.GamingCharacterInstanceRepository;
import games.paths.core.repository.match.GamingCharacterTraitsRepository;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * CharacterReadAdapter - JPA adapter implementing the {@link CharacterReadPort}.
 * Step 21 — read-only views of the per-match character state.
 */
@Repository
@Transactional(readOnly = true)
public class CharacterReadAdapter implements CharacterReadPort {

    private final GamingCharacterInstanceRepository characterRepository;
    private final GamingBackpackResourcesRepository backpackRepository;
    private final GamingCharacterTraitsRepository traitsRepository;

    public CharacterReadAdapter(GamingCharacterInstanceRepository characterRepository,
                                GamingBackpackResourcesRepository backpackRepository,
                                GamingCharacterTraitsRepository traitsRepository) {
        this.characterRepository = characterRepository;
        this.backpackRepository = backpackRepository;
        this.traitsRepository = traitsRepository;
    }

    @Override
    public List<GamingCharacterInstanceEntity> findCharactersByMatchId(Long matchId) {
        if (matchId == null) {
            return List.of();
        }
        return characterRepository.findByIdMatch(matchId);
    }

    @Override
    public Optional<GamingCharacterInstanceEntity> findCharacterByMatchIdAndUuid(Long matchId, String uuid) {
        if (matchId == null || uuid == null || uuid.isBlank()) {
            return Optional.empty();
        }
        return characterRepository.findByIdMatchAndUuid(matchId, uuid);
    }

    @Override
    public Optional<GamingBackpackResourcesEntity> findBackpack(Long matchId, Long characterId) {
        if (matchId == null || characterId == null) {
            return Optional.empty();
        }
        return backpackRepository.findByIdMatchAndIdCharacterMatch(matchId, characterId);
    }

    @Override
    public List<GamingCharacterTraitsEntity> findTraits(Long matchId, Long characterId) {
        if (matchId == null || characterId == null) {
            return List.of();
        }
        return traitsRepository.findByIdMatchAndIdCharacterMatch(matchId, characterId);
    }
}
