package games.paths.core.port.match;

import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.match.GamingStateLocationsEntity;
import games.paths.core.entity.match.GamingStateRegistryEntity;

import java.util.List;
import java.util.Optional;

/**
 * MatchPersistencePort - Outbound port used by command services to
 * persist a new match and its derived runtime state.
 */
public interface MatchPersistencePort {

    GamingMatchEntity saveMatch(GamingMatchEntity entity);

    Optional<GamingMatchEntity> findMatchByUuid(String uuid);

    /**
     * v0.32.1 — true when {@code userId} already owns a match on {@code storyId}
     * whose status is one of {@code statuses}. Used by match creation to refuse a
     * duplicate active match instead of silently opening a second one.
     *
     * @param userId   the creator's numeric id
     * @param storyId  the story's numeric id
     * @param statuses the statuses that count as occupying the slot
     * @return {@code false} when any argument is null or no such match exists
     */
    boolean hasActiveMatchForStory(Long userId, Long storyId, List<String> statuses);

    void saveLocations(List<GamingStateLocationsEntity> entities);

    void saveRegistry(List<GamingStateRegistryEntity> entities);

    /**
     * Deletes all matches whose name matches the given SQL LIKE pattern,
     * together with their derived runtime state (locations and registry rows).
     * Used by the dev-only test-data cleanup to remove matches created by
     * automated test runs.
     *
     * @param nameLikePattern an SQL LIKE pattern (e.g. {@code "robottest%"})
     * @return the number of matches removed
     */
    int deleteMatchesByNameLike(String nameLikePattern);

    /**
     * Updates the status and/or name of a single match.
     *
     * @param uuid   the match uuid
     * @param status the new status, or {@code null} to leave it unchanged
     * @param name   the new name, or {@code null} to leave it unchanged
     * @return {@code false} when no match has the given uuid
     */
    boolean updateMatchFields(String uuid, String status, String name);

    /**
     * Deletes a single match by uuid together with its derived runtime state
     * (locations and registry rows).
     *
     * @param uuid the match uuid
     * @return {@code false} when no match has the given uuid
     */
    boolean deleteMatchByUuid(String uuid);
}
