package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.match.GamingStateRegistryEntity;
import games.paths.core.entity.match.LogWeatherEntity;
import games.paths.core.entity.story.WeatherRuleEntity;
import games.paths.core.port.match.WeatherStorePort.CurrentWeatherView;
import games.paths.core.port.match.WeatherStorePort.WeatherCharacter;
import games.paths.core.port.match.WeatherStorePort.WeatherLogView;
import games.paths.core.port.match.WeatherStorePort.WeatherRuleView;
import games.paths.core.repository.match.GamingCharacterInstanceRepository;
import games.paths.core.repository.match.GamingMatchRepository;
import games.paths.core.repository.match.GamingStateRegistryRepository;
import games.paths.core.repository.match.LogEventsRepository;
import games.paths.core.repository.match.LogWeatherRepository;
import games.paths.core.repository.story.WeatherRuleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class WeatherStoreAdapterTest {

    private GamingMatchRepository matchRepository;
    private GamingCharacterInstanceRepository characterRepository;
    private WeatherRuleRepository weatherRuleRepository;
    private LogWeatherRepository logWeatherRepository;
    private LogEventsRepository logEventsRepository;
    private games.paths.core.port.story.StoryReadPort storyReadPort;
    private WeatherStoreAdapter adapter;

    @BeforeEach
    void setUp() {
        matchRepository = mock(GamingMatchRepository.class);
        characterRepository = mock(GamingCharacterInstanceRepository.class);
        weatherRuleRepository = mock(WeatherRuleRepository.class);
        logWeatherRepository = mock(LogWeatherRepository.class);
        logEventsRepository = mock(LogEventsRepository.class);
        storyReadPort = mock(games.paths.core.port.story.StoryReadPort.class);
        adapter = new WeatherStoreAdapter(matchRepository, characterRepository,
                weatherRuleRepository, logWeatherRepository, logEventsRepository, storyReadPort);
    }

    private static GamingMatchEntity match(long id, Long idStory) {
        GamingMatchEntity m = new GamingMatchEntity();
        m.setId(id);
        m.setIdStory(idStory);
        m.setCurrentClock(3);
        m.setRngSeed(42L);
        return m;
    }

    private static WeatherRuleEntity rule(long id, int active) {
        WeatherRuleEntity w = new WeatherRuleEntity();
        w.setId(id);
        w.setIdStory(7L);
        w.setUuid("w-" + id);
        w.setActive(active);
        w.setProbability(50);
        w.setPriority(1);
        w.setDeltaEnergy(-2);
        w.setCostMoveSafeLocation(1);
        w.setCostMoveNotSafeLocation(2);
        w.setIdTextName(123);
        w.setIdCard(55);
        return w;
    }

    @Test
    void loadContext_unknownMatch_empty() {
        when(matchRepository.findById(1L)).thenReturn(Optional.empty());
        assertTrue(adapter.loadContext(1L).isEmpty());
    }

    @Test
    void loadContext_returnsStoryClockAndSeed() {
        when(matchRepository.findById(1L)).thenReturn(Optional.of(match(1L, 7L)));
        var ctx = adapter.loadContext(1L).orElseThrow();
        assertEquals(7L, ctx.idStory());
        assertEquals(3, ctx.currentClock());
        assertEquals(42L, ctx.rngSeed());
    }

    @Test
    void findActiveWeatherRules_filtersInactive() {
        when(weatherRuleRepository.findByIdStory(7L)).thenReturn(List.of(
                rule(1, 1), rule(2, 0), rule(3, 1)));
        List<WeatherRuleView> rules = adapter.findActiveWeatherRules(7L);
        assertEquals(2, rules.size());
        assertEquals(1L, rules.get(0).id());
        assertEquals(3L, rules.get(1).id());
    }


    @Test
    void findCharacters_mapsEnergyAndCap() {
        GamingCharacterInstanceEntity c = new GamingCharacterInstanceEntity();
        c.setId(10L);
        c.setEnergy(20);
        c.setEnergyMax(50);
        when(characterRepository.findByIdMatch(1L)).thenReturn(List.of(c));
        List<WeatherCharacter> out = adapter.findCharacters(1L);
        assertEquals(1, out.size());
        assertEquals(20, out.get(0).energy());
        assertEquals(50, out.get(0).energyMax());
    }

    @Test
    void setCurrentWeather_savesMatch() {
        GamingMatchEntity m = match(1L, 7L);
        when(matchRepository.findById(1L)).thenReturn(Optional.of(m));
        adapter.setCurrentWeather(1L, 9L);
        assertEquals(9L, m.getIdCurrentWeather());
        verify(matchRepository).save(m);
    }

    @Test
    void insertLogWeather_assignsNextId() {
        when(logWeatherRepository.findMaxId()).thenReturn(4L);
        adapter.insertLogWeather(1L, 2, 9L);
        verify(logWeatherRepository).save(argThat((LogWeatherEntity e) ->
                e.getId() == 5L && e.getIdMatch() == 1L && e.getClock() == 2 && e.getIdWeather() == 9L));
    }

    @Test
    void logWeatherEvent_assignsNextIdAndEvent() {
        when(logEventsRepository.findMaxId()).thenReturn(7L);
        adapter.logWeatherEvent(1L, 55, "boom");
        verify(logEventsRepository).save(any());
    }

    @Test
    void findCurrentWeather_resolvesRule() {
        GamingMatchEntity m = match(1L, 7L);
        m.setIdCurrentWeather(2L);
        when(matchRepository.findById(1L)).thenReturn(Optional.of(m));
        when(weatherRuleRepository.findByIdStory(7L)).thenReturn(List.of(rule(1, 1), rule(2, 1)));

        CurrentWeatherView v = adapter.findCurrentWeather(1L).orElseThrow();
        assertEquals(2L, v.idWeather());
        assertEquals("w-2", v.uuid());
        assertEquals(7L, v.idStory());
        assertEquals(55, v.idCard());
        assertEquals(-2, v.deltaEnergy());
        assertEquals(3, v.currentClock());
    }

    @Test
    void findWeatherRulesForMatch_flagsActiveAndCurrent() {
        GamingMatchEntity m = match(1L, 7L);
        m.setIdCurrentWeather(2L);
        when(matchRepository.findByUuid("m-1")).thenReturn(Optional.of(m));
        when(weatherRuleRepository.findByIdStory(7L)).thenReturn(List.of(rule(1, 1), rule(2, 0)));
        // rule.idTextName is 123 → resolve to "Storm" via the story texts
        games.paths.core.entity.story.TextEntity txt = new games.paths.core.entity.story.TextEntity();
        txt.setShortText("Storm");
        when(storyReadPort.findTextByStoryIdTextAndLang(7L, 123, "en")).thenReturn(Optional.of(txt));

        var rules = adapter.findWeatherRulesForMatch("m-1");
        assertEquals(2, rules.size());
        assertTrue(rules.get(0).active());
        assertFalse(rules.get(0).current());
        assertEquals("Storm", rules.get(0).name());      // resolved from id_text_name
        assertEquals(1, rules.get(0).costMoveSafeLocation());
        assertEquals(2, rules.get(0).costMoveNotSafeLocation());
        assertFalse(rules.get(1).active());   // active=0
        assertTrue(rules.get(1).current());    // id 2 is the match's current
    }

    @Test
    void findWeatherRulesForMatch_nameFallsBackToCardTitle() {
        GamingMatchEntity m = match(1L, 7L);
        when(matchRepository.findByUuid("m-1")).thenReturn(Optional.of(m));
        WeatherRuleEntity w = rule(1, 1);
        w.setIdTextName(null);  // no name text → fall back to the card title
        when(weatherRuleRepository.findByIdStory(7L)).thenReturn(List.of(w));
        games.paths.core.entity.story.CardEntity card = new games.paths.core.entity.story.CardEntity();
        card.setIdTextTitle(900);
        when(storyReadPort.findCardByStoryIdAndCardId(7L, 55L)).thenReturn(Optional.of(card));
        games.paths.core.entity.story.TextEntity title = new games.paths.core.entity.story.TextEntity();
        title.setShortText("Clear Skies");
        when(storyReadPort.findTextByStoryIdTextAndLang(7L, 900, "en")).thenReturn(Optional.of(title));

        var rules = adapter.findWeatherRulesForMatch("m-1");
        assertEquals("Clear Skies", rules.get(0).name());
    }

    @Test
    void findWeatherRulesForMatch_unknownMatch_empty() {
        when(matchRepository.findByUuid("x")).thenReturn(Optional.empty());
        assertTrue(adapter.findWeatherRulesForMatch("x").isEmpty());
    }

    @Test
    void findCurrentWeather_noneSet_empty() {
        GamingMatchEntity m = match(1L, 7L); // idCurrentWeather null
        when(matchRepository.findById(1L)).thenReturn(Optional.of(m));
        assertTrue(adapter.findCurrentWeather(1L).isEmpty());
    }

    @Test
    void findCurrentWeatherByMatchUuid_delegates() {
        GamingMatchEntity m = match(1L, 7L);
        m.setIdCurrentWeather(1L);
        when(matchRepository.findByUuid("m-1")).thenReturn(Optional.of(m));
        when(matchRepository.findById(1L)).thenReturn(Optional.of(m));
        when(weatherRuleRepository.findByIdStory(7L)).thenReturn(List.of(rule(1, 1)));
        assertTrue(adapter.findCurrentWeatherByMatchUuid("m-1").isPresent());
    }

    @Test
    void findRngSeed_andUnknown() {
        when(matchRepository.findByUuid("m-1")).thenReturn(Optional.of(match(1L, 7L)));
        assertEquals(Optional.of(42L), adapter.findRngSeed("m-1"));
        when(matchRepository.findByUuid("x")).thenReturn(Optional.empty());
        assertTrue(adapter.findRngSeed("x").isEmpty());
    }

    @Test
    void findWeatherLog_joinsRuleData() {
        GamingMatchEntity m = match(1L, 7L);
        when(matchRepository.findByUuid("m-1")).thenReturn(Optional.of(m));
        when(weatherRuleRepository.findByIdStory(7L)).thenReturn(List.of(rule(9, 1)));
        LogWeatherEntity l = new LogWeatherEntity();
        l.setId(1L);
        l.setIdMatch(1L);
        l.setUuid("l-1");
        l.setClock(0);
        l.setIdWeather(9L);
        when(logWeatherRepository.findByIdMatchOrderByClockAsc(1L)).thenReturn(List.of(l));

        List<WeatherLogView> log = adapter.findWeatherLog("m-1");
        assertEquals(1, log.size());
        assertEquals("w-9", log.get(0).weatherUuid());
        assertEquals(123, log.get(0).idTextName());
    }

    @Test
    void findWeatherLog_unknownMatch_empty() {
        when(matchRepository.findByUuid("x")).thenReturn(Optional.empty());
        assertTrue(adapter.findWeatherLog("x").isEmpty());
    }

    // === Rows the join cannot resolve, and the null-tolerant edges ===

    @Test
    void loadContext_matchWithoutStory_empty() {
        when(matchRepository.findById(1L)).thenReturn(Optional.of(match(1L, null)));
        assertTrue(adapter.loadContext(1L).isEmpty());
    }

    @Test
    void loadContext_nullClockCountsAsZero() {
        GamingMatchEntity m = match(1L, 7L);
        m.setCurrentClock(null);
        when(matchRepository.findById(1L)).thenReturn(Optional.of(m));

        assertEquals(0, adapter.loadContext(1L).orElseThrow().currentClock());
    }

    @Test
    void findActiveWeatherRules_skipsRulesWithNoActiveFlagAtAll() {
        WeatherRuleEntity noFlag = rule(9, 1);
        noFlag.setActive(null);
        when(weatherRuleRepository.findByIdStory(7L)).thenReturn(List.of(noFlag));

        assertTrue(adapter.findActiveWeatherRules(7L).isEmpty());
    }



    @Test
    void updateCharacterEnergy_savesTheNewValue() {
        GamingCharacterInstanceEntity c = new GamingCharacterInstanceEntity();
        c.setId(5L);
        c.setEnergy(3);
        when(characterRepository.findById(any())).thenReturn(Optional.of(c));

        adapter.updateCharacterEnergy(1L, 5L, 8);

        assertEquals(8, c.getEnergy());
        verify(characterRepository).save(c);
    }

    @Test
    void updateCharacterEnergy_unknownCharacterSavesNothing() {
        when(characterRepository.findById(any())).thenReturn(Optional.empty());

        adapter.updateCharacterEnergy(1L, 5L, 8);

        verify(characterRepository, never()).save(any());
    }

    @Test
    void logWeatherEvent_acceptsAWeatherWithNoEventAttached() {
        when(logEventsRepository.findMaxId()).thenReturn(3L);

        adapter.logWeatherEvent(1L, null, "weather changed");

        verify(logEventsRepository).save(argThat(e -> e.getIdEvent() == null && e.getId() == 4L));
    }

    @Test
    void findCurrentWeather_currentIdWithNoMatchingRule_empty() {
        GamingMatchEntity m = match(1L, 7L);
        m.setIdCurrentWeather(99L);
        when(matchRepository.findById(1L)).thenReturn(Optional.of(m));
        when(weatherRuleRepository.findByIdStory(7L)).thenReturn(List.of(rule(9, 1)));

        assertTrue(adapter.findCurrentWeather(1L).isEmpty());
    }

    @Test
    void findWeatherLog_rowWithoutAWeatherKeepsTheRuleFieldsNull() {
        GamingMatchEntity m = match(1L, null);
        when(matchRepository.findByUuid("m-1")).thenReturn(Optional.of(m));
        LogWeatherEntity l = new LogWeatherEntity();
        l.setId(1L);
        l.setIdMatch(1L);
        l.setUuid("l-1");
        when(logWeatherRepository.findByIdMatchOrderByClockAsc(1L)).thenReturn(List.of(l));

        WeatherLogView view = adapter.findWeatherLog("m-1").get(0);

        assertEquals(0, view.clock());
        assertNull(view.weatherUuid());
        assertNull(view.idTextName());
    }

    @Test
    void findWeatherRulesForMatch_namesTheRuleAfterItsCardWhenItHasNoOwnText() {
        GamingMatchEntity m = match(1L, 7L);
        m.setIdCurrentWeather(9L);
        when(matchRepository.findByUuid("m-1")).thenReturn(Optional.of(m));
        WeatherRuleEntity w = rule(9, 1);
        when(weatherRuleRepository.findByIdStory(7L)).thenReturn(List.of(w));
        games.paths.core.entity.story.CardEntity card = new games.paths.core.entity.story.CardEntity();
        card.setIdTextTitle(456);
        when(storyReadPort.findTextByStoryIdTextAndLang(7L, 123, "en")).thenReturn(Optional.empty());
        when(storyReadPort.findCardByStoryIdAndCardId(7L, 55L)).thenReturn(Optional.of(card));
        games.paths.core.entity.story.TextEntity title = new games.paths.core.entity.story.TextEntity();
        title.setShortText("Storm");
        when(storyReadPort.findTextByStoryIdTextAndLang(7L, 456, "en")).thenReturn(Optional.of(title));

        var summary = adapter.findWeatherRulesForMatch("m-1").get(0);

        assertEquals("Storm", summary.name());
        assertTrue(summary.active());
        assertTrue(summary.current());
    }

    @Test
    void findWeatherRulesForMatch_leavesTheNameNullWhenThereIsNeitherTextNorCard() {
        when(matchRepository.findByUuid("m-1")).thenReturn(Optional.of(match(1L, 7L)));
        WeatherRuleEntity w = rule(9, 0);
        w.setIdCard(null);
        when(weatherRuleRepository.findByIdStory(7L)).thenReturn(List.of(w));
        when(storyReadPort.findTextByStoryIdTextAndLang(7L, 123, "en")).thenReturn(Optional.empty());

        var summary = adapter.findWeatherRulesForMatch("m-1").get(0);

        assertNull(summary.name());
        assertFalse(summary.active());
        assertFalse(summary.current());
    }

    @Test
    void findWeatherRulesForMatch_matchWithoutStory_empty() {
        when(matchRepository.findByUuid("m-1")).thenReturn(Optional.of(match(1L, null)));
        assertTrue(adapter.findWeatherRulesForMatch("m-1").isEmpty());
    }
}
