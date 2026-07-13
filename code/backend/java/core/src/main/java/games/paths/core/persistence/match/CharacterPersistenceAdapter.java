package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingBackpackResourcesEntity;
import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingCharacterTraitsEntity;
import games.paths.core.port.match.CharacterPersistencePort;
import games.paths.core.repository.match.GamingBackpackResourcesRepository;
import games.paths.core.repository.match.GamingCharacterInstanceRepository;
import games.paths.core.repository.match.GamingCharacterTraitsRepository;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * CharacterPersistenceAdapter - JPA adapter implementing the
 * {@link CharacterPersistencePort}. Step 21 — character join write side.
 */
@Repository
@Transactional
public class CharacterPersistenceAdapter implements CharacterPersistencePort {

    private final GamingCharacterInstanceRepository characterRepository;
    private final GamingBackpackResourcesRepository backpackRepository;
    private final GamingCharacterTraitsRepository traitsRepository;

    public CharacterPersistenceAdapter(GamingCharacterInstanceRepository characterRepository,
                                       GamingBackpackResourcesRepository backpackRepository,
                                       GamingCharacterTraitsRepository traitsRepository) {
        this.characterRepository = characterRepository;
        this.backpackRepository = backpackRepository;
        this.traitsRepository = traitsRepository;
    }

    @Override
    public GamingCharacterInstanceEntity saveCharacter(GamingCharacterInstanceEntity entity) {
        return characterRepository.save(entity);
    }

    @Override
    public void saveBackpack(GamingBackpackResourcesEntity entity) {
        if (entity == null) {
            return;
        }
        backpackRepository.save(entity);
    }

    @Override
    public void saveTraits(List<GamingCharacterTraitsEntity> entities) {
        if (entities == null || entities.isEmpty()) {
            return;
        }
        traitsRepository.saveAll(entities);
    }

    @Override
    public Optional<GamingCharacterInstanceEntity> findCharacterByMatchIdAndUserId(Long matchId, Long userId) {
        if (matchId == null || userId == null) {
            return Optional.empty();
        }
        return characterRepository.findByIdMatchAndIdUser(matchId, userId);
    }

    @Override
    public int countCharactersByMatchId(Long matchId) {
        if (matchId == null) {
            return 0;
        }
        return (int) characterRepository.countByIdMatch(matchId);
    }

    @Override
    public void updateCharacterStats(Long matchId, Long characterId,
                                     Integer dex, Integer intel, Integer con,
                                     Integer energy, Integer life, Integer sad) {
        characterRepository.findByIdMatchAndId(matchId, characterId).ifPresent(entity -> {
            if (dex    != null) entity.setDexterity(dex);
            if (intel  != null) entity.setIntelligence(intel);
            if (con    != null) entity.setConstitution(con);
            if (energy != null) entity.setEnergy(energy);
            if (life   != null) entity.setLife(life);
            if (sad    != null) entity.setSad(sad);
            characterRepository.save(entity);
        });
    }

    @Override
    public void updateBackpackStats(Long matchId, Long characterId,
                                    Integer food, Integer magic, Integer coin) {
        backpackRepository.findByIdMatchAndIdCharacterMatch(matchId, characterId).ifPresent(entity -> {
            if (food  != null) entity.setFood(food);
            if (magic != null) entity.setMagic(magic);
            if (coin  != null) entity.setCoin(coin);
            backpackRepository.save(entity);
        });
    }
}
