package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.match.GamingStateLocationsEntity;
import games.paths.core.entity.match.GamingStateRegistryEntity;
import games.paths.core.port.match.MatchPersistencePort;
import games.paths.core.repository.match.GamingBackpackResourcesRepository;
import games.paths.core.repository.match.GamingCharacterInstanceRepository;
import games.paths.core.repository.match.GamingCharacterTraitsRepository;
import games.paths.core.repository.match.GamingInventoryItemsRepository;
import games.paths.core.repository.match.GamingMatchRepository;
import games.paths.core.repository.match.GamingStateLocationsRepository;
import games.paths.core.repository.match.GamingStateRegistryRepository;
import games.paths.core.repository.match.GamingStoryProgressRepository;
import games.paths.core.repository.match.LogChoicesExecutedRepository;
import games.paths.core.repository.match.LogEventsRepository;
import games.paths.core.repository.match.LogItemUsageRepository;
import games.paths.core.repository.match.LogMovementRepository;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * MatchPersistenceAdapter - JPA adapter implementing the
 * {@link MatchPersistencePort}. Step 19 — single-player match write side.
 *
 * <p>Step 21 — match deletion also removes the per-match character rows
 * (instance / backpack / traits) so robot-test and admin deletes leave no
 * orphans on SQLite, where foreign-key cascades are not enforced.</p>
 */
@Repository
@Transactional
public class MatchPersistenceAdapter implements MatchPersistencePort {

    private final GamingMatchRepository matchRepository;
    private final GamingStateLocationsRepository locationsRepository;
    private final GamingStateRegistryRepository registryRepository;
    private final GamingCharacterInstanceRepository characterRepository;
    private final GamingBackpackResourcesRepository backpackRepository;
    private final GamingCharacterTraitsRepository characterTraitsRepository;
    private final GamingInventoryItemsRepository inventoryRepository;
    private final LogEventsRepository logEventsRepository;
    private final LogMovementRepository logMovementRepository;
    private final LogChoicesExecutedRepository logChoicesRepository;
    private final LogItemUsageRepository logItemUsageRepository;
    private final GamingStoryProgressRepository storyProgressRepository;

    @SuppressWarnings("java:S107") // one collaborator per table a match delete has to clear
    public MatchPersistenceAdapter(GamingMatchRepository matchRepository,
                                   GamingStateLocationsRepository locationsRepository,
                                   GamingStateRegistryRepository registryRepository,
                                   GamingCharacterInstanceRepository characterRepository,
                                   GamingBackpackResourcesRepository backpackRepository,
                                   GamingCharacterTraitsRepository characterTraitsRepository,
                                   GamingInventoryItemsRepository inventoryRepository,
                                   LogEventsRepository logEventsRepository,
                                   LogMovementRepository logMovementRepository,
                                   LogChoicesExecutedRepository logChoicesRepository,
                                   LogItemUsageRepository logItemUsageRepository,
                                   GamingStoryProgressRepository storyProgressRepository) {
        this.matchRepository = matchRepository;
        this.locationsRepository = locationsRepository;
        this.registryRepository = registryRepository;
        this.characterRepository = characterRepository;
        this.backpackRepository = backpackRepository;
        this.characterTraitsRepository = characterTraitsRepository;
        this.inventoryRepository = inventoryRepository;
        this.logEventsRepository = logEventsRepository;
        this.logMovementRepository = logMovementRepository;
        this.logChoicesRepository = logChoicesRepository;
        this.logItemUsageRepository = logItemUsageRepository;
        this.storyProgressRepository = storyProgressRepository;
    }

    /** Removes the per-match character rows (traits, inventory, backpack, instance) for the given match ids. */
    private void deleteCharacterState(List<Long> matchIds) {
        characterTraitsRepository.deleteByMatchIdIn(matchIds);
        inventoryRepository.deleteByMatchIdIn(matchIds);
        backpackRepository.deleteByMatchIdIn(matchIds);
        // log_events and log_movements reference the character instances (FK enforced on
        // PostgreSQL), so they must be cleared before the instances themselves are deleted.
        logEventsRepository.deleteByMatchIdIn(matchIds);
        logMovementRepository.deleteByMatchIdIn(matchIds);
        // Step 34 — log_item_usage has the same character FK, same ordering constraint.
        logItemUsageRepository.deleteByMatchIdIn(matchIds);
        // Step 32 — the choice history and the milestone rows. They hang off the match, not
        // off a character, but SQLite does not enforce the schema's ON DELETE CASCADE, so a
        // delete that skipped them would leave orphans behind on the dev database.
        logChoicesRepository.deleteByMatchIdIn(matchIds);
        storyProgressRepository.deleteByMatchIdIn(matchIds);
        characterRepository.deleteByMatchIdIn(matchIds);
    }

    @Override
    public GamingMatchEntity saveMatch(GamingMatchEntity entity) {
        return matchRepository.save(entity);
    }

    @Override
    public Optional<GamingMatchEntity> findMatchByUuid(String uuid) {
        return matchRepository.findByUuid(uuid);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean hasActiveMatchForStory(Long userId, Long storyId, List<String> statuses) {
        if (userId == null || storyId == null || statuses == null || statuses.isEmpty()) {
            return false;
        }
        return matchRepository.existsByIdUserCreatorAndIdStoryAndStatusIn(userId, storyId, statuses);
    }

    @Override
    public void saveLocations(List<GamingStateLocationsEntity> entities) {
        if (entities == null || entities.isEmpty()) {
            return;
        }
        locationsRepository.saveAll(entities);
    }

    @Override
    public void saveRegistry(List<GamingStateRegistryEntity> entities) {
        if (entities == null || entities.isEmpty()) {
            return;
        }
        registryRepository.saveAll(entities);
    }

    @Override
    public int deleteMatchesByNameLike(String nameLikePattern) {
        // Locate the matching matches, remove their derived runtime state
        // (locations + registry) first, then delete the matches themselves.
        // Explicit child deletion keeps the operation correct on SQLite, where
        // foreign-key cascades are not enforced.
        List<Long> matchIds = matchRepository.findMatchIdsByNameLike(nameLikePattern);
        if (matchIds.isEmpty()) {
            return 0;
        }
        // Break the match → current-turn-character FK before deleting the
        // character rows (enforced on PostgreSQL; a no-op on SQLite).
        matchRepository.clearCurrentTurnByMatchIdIn(matchIds);
        deleteCharacterState(matchIds);
        locationsRepository.deleteByMatchIdIn(matchIds);
        registryRepository.deleteByMatchIdIn(matchIds);
        return matchRepository.deleteByNameLike(nameLikePattern);
    }

    @Override
    public boolean updateMatchFields(String uuid, String status, String name) {
        Optional<GamingMatchEntity> opt = matchRepository.findByUuid(uuid);
        if (opt.isEmpty()) {
            return false;
        }
        GamingMatchEntity match = opt.get();
        if (status != null) {
            match.setStatus(status);
        }
        if (name != null) {
            match.setName(name);
        }
        matchRepository.save(match);
        return true;
    }

    @Override
    public boolean deleteMatchByUuid(String uuid) {
        Optional<GamingMatchEntity> opt = matchRepository.findByUuid(uuid);
        if (opt.isEmpty()) {
            return false;
        }
        // Remove the derived runtime state (characters + locations + registry) first.
        List<Long> matchIds = List.of(opt.get().getId());
        // Break the match → current-turn-character FK before deleting the
        // character rows (enforced on PostgreSQL; a no-op on SQLite).
        matchRepository.clearCurrentTurnByMatchIdIn(matchIds);
        deleteCharacterState(matchIds);
        locationsRepository.deleteByMatchIdIn(matchIds);
        registryRepository.deleteByMatchIdIn(matchIds);
        matchRepository.delete(opt.get());
        return true;
    }
}
