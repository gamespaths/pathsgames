package games.paths.core.service.story;

import games.paths.core.entity.story.*;
import games.paths.core.model.story.StoryValidationReport;
import games.paths.core.port.story.StoryReadPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Drives {@code validateStory(Long)} so the DB-backed graph builder
 * ({@code buildFromReadPort}) and every collector run against the relational
 * entities (the import/map path is covered by {@link StoryValidatorServiceTest}).
 */
class StoryValidatorServiceDbPathTest {

    private StoryReadPort readPort;
    private StoryValidatorService service;

    @BeforeEach
    void setUp() {
        readPort = mock(StoryReadPort.class);
        service = new StoryValidatorService(readPort);
    }

    private LocationEntity loc(long id) {
        LocationEntity e = new LocationEntity();
        e.setId(id);
        return e;
    }

    private EventEntity event(long id, Integer next) {
        EventEntity e = new EventEntity();
        e.setId(id);
        e.setIdEventNext(next);
        return e;
    }

    private ChoiceEntity choice(long id) {
        ChoiceEntity c = new ChoiceEntity();
        c.setId(id);
        c.setIdEvent(1);
        // No idLocation: since Step 31 (R8) a choice binds to an event only.
        c.setOtherwiseFlag(1);
        return c;
    }

    private void stubValidStory() {
        when(readPort.findLocationsByStoryId(1L)).thenReturn(List.of(loc(1), loc(2)));
        when(readPort.findEventsByStoryId(1L)).thenReturn(List.of(event(1, null), event(2, 1)));
        ItemEntity item = new ItemEntity();
        item.setId(1L);
        when(readPort.findItemsByStoryId(1L)).thenReturn(List.of(item));
        when(readPort.findChoicesByStoryId(1L)).thenReturn(List.of(choice(1)));
        ClassEntity cls = new ClassEntity();
        cls.setId(1L);
        when(readPort.findClassesByStoryId(1L)).thenReturn(List.of(cls));
        MissionEntity mission = new MissionEntity();
        mission.setConditionKey("k");
        mission.setConditionValue("1");
        mission.setId(1L);
        when(readPort.findMissionsByStoryId(1L)).thenReturn(List.of(mission));

        KeyEntity key = new KeyEntity();
        key.setName("CHAPTER");
        when(readPort.findKeysByStoryId(1L)).thenReturn(List.of(key));

        ChoiceEffectEntity ce = new ChoiceEffectEntity();
        ce.setId(1L);
        ce.setIdChoices(1);
        when(readPort.findChoiceEffectsByStoryId(1L)).thenReturn(List.of(ce));

        ChoiceConditionEntity cc = new ChoiceConditionEntity();
        cc.setId(1L);
        cc.setIdChoices(1);
        cc.setType("KEYS");
        cc.setKey("CHAPTER");
        when(readPort.findChoiceConditionsByStoryId(1L)).thenReturn(List.of(cc));

        EventEffectEntity ee = new EventEffectEntity();
        ee.setId(1L);
        ee.setIdEvent(1);
        when(readPort.findEventEffectsByStoryId(1L)).thenReturn(List.of(ee));

        ItemEffectEntity ie = new ItemEffectEntity();
        ie.setId(1L);
        ie.setIdItem(1);
        when(readPort.findItemEffectsByStoryId(1L)).thenReturn(List.of(ie));

        ClassBonusEntity cb = new ClassBonusEntity();
        cb.setId(1L);
        cb.setIdClass(1);
        when(readPort.findClassBonusesByStoryId(1L)).thenReturn(List.of(cb));

        MissionStepEntity ms = new MissionStepEntity();
        ms.setId(1L);
        ms.setIdMission(1);
        ms.setConditionKey("k");
        ms.setConditionValue("1");
        when(readPort.findMissionStepsByStoryId(1L)).thenReturn(List.of(ms));

        WeatherRuleEntity wr = new WeatherRuleEntity();
        wr.setId(1L);
        wr.setIdEvent(1);
        when(readPort.findWeatherRulesByStoryId(1L)).thenReturn(List.of(wr));

        GlobalRandomEventEntity gr = new GlobalRandomEventEntity();
        gr.setId(1L);
        // Step 39 - R11: a random event names a choice-free event (event 1 owns choice 1).
        gr.setIdEvent(2);
        when(readPort.findGlobalRandomEventsByStoryId(1L)).thenReturn(List.of(gr));

        LocationNeighborEntity n = new LocationNeighborEntity();
        n.setId(1L);
        n.setIdLocationFrom(1);
        n.setIdLocationTo(2);
        n.setDirection("N");
        when(readPort.findLocationNeighborsByStoryId(1L)).thenReturn(List.of(n));

        TraitEntity tr = new TraitEntity();
        tr.setId(1L);
        when(readPort.findTraitsByStoryId(1L)).thenReturn(List.of(tr));

        CharacterTemplateEntity ct = new CharacterTemplateEntity();
        ct.setIdTipo(1L);
        ct.setLifeMax(10);
        ct.setEnergyMax(10);
        ct.setDexterityStart(1);
        ct.setIntelligenceStart(1);
        ct.setConstitutionStart(1);
        ct.setSadMax(0);
        when(readPort.findCharacterTemplatesByStoryId(1L)).thenReturn(List.of(ct));
    }

    @Test
    void validateStory_dbPath_validStoryHasNoErrors() {
        stubValidStory();
        StoryValidationReport report = service.validateStory(1L);
        assertTrue(report.isValid(), () -> "expected valid but got: " + report.getErrors());
    }

    @Test
    void validateStory_dbPath_flagsDanglingReferences() {
        stubValidStory();
        // a choice referencing a non-existent event/location
        ChoiceEntity broken = new ChoiceEntity();
        broken.setId(2L);
        broken.setIdEvent(999);
        broken.setIdLocation(888);
        when(readPort.findChoicesByStoryId(1L)).thenReturn(List.of(choice(1), broken));
        StoryValidationReport report = service.validateStory(1L);
        assertFalse(report.isValid());
        assertFalse(report.getErrors().isEmpty());
    }

    @Test
    void validateStory_dbPath_flagsChoiceWithoutEvent() {
        stubValidStory();
        // Step 31 (R8): a choice with no idEvent is orphaned even if otherwise-flagged.
        ChoiceEntity orphan = new ChoiceEntity();
        orphan.setId(2L);
        orphan.setOtherwiseFlag(1);
        when(readPort.findChoicesByStoryId(1L)).thenReturn(List.of(choice(1), orphan));
        StoryValidationReport report = service.validateStory(1L);
        assertTrue(report.getErrors().stream()
                .anyMatch(e -> "R8_CHOICE_EVENT".equals(e.rule()) && "2".equals(e.entityId())));
    }

    @Test
    void validateStory_dbPath_flagsChoiceWithLocation() {
        stubValidStory();
        // The location EXISTS, so only R8 can flag it — the deprecated binding itself.
        ChoiceEntity located = new ChoiceEntity();
        located.setId(2L);
        located.setIdEvent(1);
        located.setIdLocation(1);
        located.setOtherwiseFlag(1);
        when(readPort.findChoicesByStoryId(1L)).thenReturn(List.of(choice(1), located));
        StoryValidationReport report = service.validateStory(1L);
        assertTrue(report.getErrors().stream()
                .anyMatch(e -> "R8_CHOICE_EVENT".equals(e.rule()) && "idLocation".equals(e.field())));
    }

    @Test
    void validateStory_dbPath_emptyStoryDoesNotThrow() {
        // all readPort.find* return empty lists by Mockito default
        StoryValidationReport report = service.validateStory(2L);
        assertNotNull(report);
    }

    @Test
    @DisplayName("Step 37 - a mission with no condition key is reported, but only on validateStory")
    void missionConditionIsReportedNotEnforced() {
        MissionEntity mission = new MissionEntity();
        mission.setId(1L);
        when(readPort.findMissionsByStoryId(1L)).thenReturn(List.of(mission));

        StoryValidationReport report = service.validateStory(1L);

        assertTrue(report.getErrors().stream()
                .anyMatch(e -> "R10_MISSION_CONDITION".equals(e.rule())),
                "the author's own validate pass must say the mission is dead");

        // Import must NOT fail on it: every backend ignores such a row rather than refusing
        // it, and a story already carrying one has to stay importable.
        Map<String, Object> data = new java.util.HashMap<>();
        data.put("missions", List.of(Map.of("id", 1)));
        assertTrue(service.validateImportData(data).getErrors().stream()
                .noneMatch(e -> "R10_MISSION_CONDITION".equals(e.rule())));
    }
    private GlobalRandomEventEntity random(long id, Integer idEvent, int probability) {
        GlobalRandomEventEntity r = new GlobalRandomEventEntity();
        r.setId(id);
        r.setIdEvent(idEvent);
        r.setProbability(probability);
        return r;
    }

    @Test
    @DisplayName("Step 39 - R11 from the DB: choices and weather effects, plus the >100 warning")
    void randomEventsFromDb() {
        EventEffectEntity weatherEffect = new EventEffectEntity();
        weatherEffect.setId(1L);
        weatherEffect.setIdEvent(2);
        weatherEffect.setIdWeather(1);
        WeatherRuleEntity weather = new WeatherRuleEntity();
        weather.setId(1L);
        when(readPort.findEventsByStoryId(1L)).thenReturn(List.of(event(1, null), event(2, null)));
        when(readPort.findChoicesByStoryId(1L)).thenReturn(List.of(choice(1)));
        when(readPort.findEventEffectsByStoryId(1L)).thenReturn(List.of(weatherEffect));
        when(readPort.findWeatherRulesByStoryId(1L)).thenReturn(List.of(weather));
        when(readPort.findGlobalRandomEventsByStoryId(1L)).thenReturn(List.of(
                random(1, 1, 70), random(2, 2, 60)));

        StoryValidationReport report = service.validateStory(1L);

        List<String> r11 = report.getErrors().stream()
                .filter(e -> "R11_RANDOM_EVENT".equals(e.rule())).map(e -> e.message()).toList();
        assertEquals(2, r11.size());
        assertTrue(r11.get(0).contains("owns choices"));
        assertTrue(r11.get(1).contains("weather effect"));
        assertEquals(1, report.getWarnings().size());
        assertTrue(report.getWarnings().get(0).message().contains("130"));
    }

    @Test
    @DisplayName("Step 39 - a total of exactly 100 is no warning")
    void randomEventsAtHundredNoWarning() {
        when(readPort.findEventsByStoryId(1L)).thenReturn(List.of(event(1, null)));
        when(readPort.findGlobalRandomEventsByStoryId(1L)).thenReturn(List.of(
                random(1, 1, 60), random(2, 1, 40)));

        StoryValidationReport report = service.validateStory(1L);

        assertTrue(report.getWarnings().isEmpty());
        assertTrue(report.getErrors().stream().noneMatch(e -> "R11_RANDOM_EVENT".equals(e.rule())));
    }
}
