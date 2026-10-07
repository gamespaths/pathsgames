package games.paths.core.repository.story;

import games.paths.core.entity.story.WeatherRuleEntity;
import games.paths.core.entity.story.StoryScopedEntityId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * WeatherRuleRepository - Spring Data JPA repository for the "list_weather_rules" table.
 * Provides CRUD + custom query methods for weather rule management.
 */
@Repository
public interface WeatherRuleRepository extends JpaRepository<WeatherRuleEntity, StoryScopedEntityId> {

    List<WeatherRuleEntity> findByIdStory(Long idStory);

    @Modifying
    @Transactional
    void deleteByIdStory(Long idStory);

    Optional<WeatherRuleEntity> findByIdStoryAndUuid(Long idStory, String uuid);

    @Modifying
    @Transactional
    void deleteByUuid(String uuid);

    /**
     * v0.35.8 — clears the rule → event reference before the story's events are deleted:
     * the events go first, and a rule still naming one blocks their delete.
     */
    @Modifying
    @Transactional
    @Query("update WeatherRuleEntity w set w.idEvent = null where w.idStory = :idStory")
    void clearRuleEvents(@Param("idStory") Long idStory);
}
