package games.paths.core.repository.story;

import games.paths.core.entity.story.WeatherRuleEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * WeatherRuleRepository - Spring Data JPA repository for the "list_weather_rules" table.
 * Provides CRUD + custom query methods for weather rule management.
 */
@Repository
public interface WeatherRuleRepository extends JpaRepository<WeatherRuleEntity, Long> {

    List<WeatherRuleEntity> findByIdStory(Long idStory);

    @Modifying
    @Transactional
    void deleteByIdStory(Long idStory);
}
