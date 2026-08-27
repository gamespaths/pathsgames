package games.paths.core.service.story;

import games.paths.core.entity.story.ClassBonusEntity;
import games.paths.core.entity.story.ClassEntity;
import games.paths.core.entity.story.StoryDifficultyEntity;
import games.paths.core.entity.story.StoryEntity;
import games.paths.core.entity.story.TraitEntity;
import games.paths.core.model.story.ClassInfo;
import games.paths.core.model.story.DifficultyInfo;
import games.paths.core.model.story.StoryDetail;
import games.paths.core.model.story.TraitInfo;
import games.paths.core.port.story.StoryQueryPort.TraitsForClassResult;
import games.paths.core.port.story.StoryReadPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * The stat columns of difficulties and traits are nullable, and the read model fills a
 * documented default in for each null. This suite pins both sides of every fallback, plus
 * the class/class-bonus join and the class filter of Step 23.
 */
class StoryQueryServiceDefaultsTest {

    private StoryReadPort readPort;
    private StoryQueryService service;

    @BeforeEach
    void setUp() {
        readPort = mock(StoryReadPort.class);
        service = new StoryQueryService(readPort);
        StoryEntity story = new StoryEntity();
        story.setId(1L);
        story.setUuid("story-uuid");
        when(readPort.findStoryByUuid("story-uuid")).thenReturn(Optional.of(story));
    }

    private static StoryDifficultyEntity difficulty(String uuid, Integer everyStat) {
        StoryDifficultyEntity d = new StoryDifficultyEntity();
        d.setUuid(uuid);
        d.setExpCost(everyStat);
        d.setMaxWeight(everyStat);
        d.setMinCharacter(everyStat);
        d.setMaxCharacter(everyStat);
        d.setCostHelpComa(everyStat);
        d.setCostMaxCharacteristics(everyStat);
        d.setNumberMaxFreeAction(everyStat);
        d.setLife(everyStat);
        d.setEnergy(everyStat);
        d.setSad(everyStat);
        d.setDexterity(everyStat);
        d.setIntelligence(everyStat);
        d.setConstitution(everyStat);
        d.setWeight(everyStat);
        return d;
    }

    private static TraitEntity trait(String uuid, Integer everyStat, Integer permitted, Integer prohibited) {
        TraitEntity t = new TraitEntity();
        t.setUuid(uuid);
        t.setIdClassPermitted(permitted);
        t.setIdClassProhibited(prohibited);
        t.setCostPositive(everyStat);
        t.setCostNegative(everyStat);
        t.setLife(everyStat);
        t.setEnergy(everyStat);
        t.setSad(everyStat);
        t.setDexterity(everyStat);
        t.setIntelligence(everyStat);
        t.setConstitution(everyStat);
        t.setWeight(everyStat);
        return t;
    }

    private static ClassEntity clazz(long id, String uuid) {
        ClassEntity c = new ClassEntity();
        c.setId(id);
        c.setUuid(uuid);
        return c;
    }

    private static ClassBonusEntity bonus(String uuid, Integer idClass, String statistic, Integer value) {
        ClassBonusEntity b = new ClassBonusEntity();
        b.setUuid(uuid);
        b.setIdClass(idClass);
        b.setStatistic(statistic);
        b.setValue(value);
        return b;
    }

    // === Difficulty stat defaults ===

    @Test
    void difficultyStatsFallBackToTheirDefaultsWhenTheColumnIsNull() {
        when(readPort.findDifficultiesByStoryId(1L)).thenReturn(List.of(difficulty("diff-null", null)));

        DifficultyInfo d = service.getStoryByUuid("story-uuid", "en").difficulties().get(0);

        assertEquals(5, d.getExpCost());
        assertEquals(10, d.getMaxWeight());
        assertEquals(1, d.getMinCharacter());
        assertEquals(4, d.getMaxCharacter());
        assertEquals(3, d.getCostHelpComa());
        assertEquals(3, d.getCostMaxCharacteristics());
        assertEquals(1, d.getNumberMaxFreeAction());
        assertEquals(100, d.getLife());
        assertEquals(100, d.getEnergy());
        assertEquals(0, d.getSad());
        assertEquals(10, d.getDexterity());
        assertEquals(10, d.getIntelligence());
        assertEquals(10, d.getConstitution());
        assertEquals(10, d.getWeight());
    }

    @Test
    void difficultyStatsKeepTheAuthoredValueWhenThereIsOne() {
        when(readPort.findDifficultiesByStoryId(1L)).thenReturn(List.of(difficulty("diff-set", 7)));

        DifficultyInfo d = service.getStoryByUuid("story-uuid", "en").difficulties().get(0);

        assertEquals(7, d.getExpCost());
        assertEquals(7, d.getLife());
        assertEquals(7, d.getEnergy());
        assertEquals(7, d.getSad());
        assertEquals(7, d.getDexterity());
        assertEquals(7, d.getIntelligence());
        assertEquals(7, d.getConstitution());
        assertEquals(7, d.getWeight());
    }

    // === Class ↔ class-bonus join ===

    @Test
    void aClassCollectsOnlyItsOwnBonusesAndDefaultsANullValueToZero() {
        when(readPort.findClassesByStoryId(1L)).thenReturn(List.of(clazz(1L, "class-uuid")));
        when(readPort.findClassBonusesByStoryId(1L)).thenReturn(List.of(
                bonus("bonus-mine", 1, "LIFE", 5),
                bonus("bonus-null-value", 1, "ENERGY", null),
                bonus("bonus-other-class", 2, "LIFE", 9),
                bonus("bonus-orphan", null, "LIFE", 9)));

        StoryDetail detail = service.getStoryByUuid("story-uuid", "en");
        ClassInfo cl = detail.classes().get(0);

        assertEquals(2, cl.bonuses().size());
        assertEquals("bonus-mine", cl.bonuses().get(0).uuid());
        assertEquals(5, cl.bonuses().get(0).value());
        assertEquals(0, cl.bonuses().get(1).value());
    }

    // === Step 23: traits filtered by class ===

    @Test
    void traitsForClassRejectABlankStoryOrClassUuid() {
        assertEquals(TraitsForClassResult.Status.STORY_NOT_FOUND,
                service.listTraitsForClass("  ", "class-uuid", "en").status());
        assertEquals(TraitsForClassResult.Status.CLASS_NOT_FOUND,
                service.listTraitsForClass("story-uuid", "  ", "en").status());
    }

    @Test
    void traitsForClassKeepsThePermittedOnesAndDropsTheProhibitedOnes() {
        when(readPort.findClassByStoryIdAndUuid(1L, "class-uuid"))
                .thenReturn(Optional.of(clazz(3L, "class-uuid")));
        when(readPort.findTraitsByStoryId(1L)).thenReturn(List.of(
                trait("open", null, null, null),                 // no restriction at all
                trait("permitted-here", null, 3, null),          // permitted for this class
                trait("permitted-elsewhere", null, 4, null),     // permitted for another class
                trait("prohibited-here", null, null, 3),         // prohibited for this class
                trait("prohibited-elsewhere", null, null, 4)));  // prohibited elsewhere

        TraitsForClassResult result = service.listTraitsForClass("story-uuid", "class-uuid", "en");

        assertEquals(TraitsForClassResult.Status.OK, result.status());
        assertEquals(List.of("open", "permitted-here", "prohibited-elsewhere"),
                result.traits().stream().map(TraitInfo::getUuid).toList());
    }

    @Test
    void traitStatsFallBackToZeroWhenTheColumnIsNull() {
        when(readPort.findClassByStoryIdAndUuid(1L, "class-uuid"))
                .thenReturn(Optional.of(clazz(3L, "class-uuid")));
        when(readPort.findTraitsByStoryId(1L)).thenReturn(List.of(trait("bare", null, null, null)));

        TraitInfo t = service.listTraitsForClass("story-uuid", "class-uuid", "en").traits().get(0);

        assertEquals(0, t.getCostPositive());
        assertEquals(0, t.getCostNegative());
        assertEquals(0, t.getLife());
        assertEquals(0, t.getEnergy());
        assertEquals(0, t.getSad());
        assertEquals(0, t.getDexterity());
        assertEquals(0, t.getIntelligence());
        assertEquals(0, t.getConstitution());
        assertEquals(0, t.getWeight());
    }

    @Test
    void traitStatsKeepTheAuthoredValueWhenThereIsOne() {
        when(readPort.findClassByStoryIdAndUuid(1L, "class-uuid"))
                .thenReturn(Optional.of(clazz(3L, "class-uuid")));
        when(readPort.findTraitsByStoryId(1L)).thenReturn(List.of(trait("full", 4, null, null)));

        TraitInfo t = service.listTraitsForClass("story-uuid", "class-uuid", "en").traits().get(0);

        assertEquals(4, t.getCostPositive());
        assertEquals(4, t.getLife());
        assertEquals(4, t.getEnergy());
        assertEquals(4, t.getSad());
        assertEquals(4, t.getDexterity());
        assertEquals(4, t.getIntelligence());
        assertEquals(4, t.getConstitution());
        assertEquals(4, t.getWeight());
    }
}
