package games.paths.core.repository.story;

import games.paths.core.entity.story.MissionStepEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * MissionStepRepository - Spring Data JPA repository for the "list_missions_steps" table.
 * Provides CRUD + custom query methods for mission step management.
 */
@Repository
public interface MissionStepRepository extends JpaRepository<MissionStepEntity, Long> {

    List<MissionStepEntity> findByIdStory(Long idStory);

    @Modifying
    @Transactional
    void deleteByIdStory(Long idStory);
}
