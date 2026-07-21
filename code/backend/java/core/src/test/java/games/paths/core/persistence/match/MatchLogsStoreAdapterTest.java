package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.match.LogClockHistoryEntity;
import games.paths.core.entity.match.LogEventsEntity;
import games.paths.core.entity.match.LogMovementEntity;
import games.paths.core.entity.match.LogWeatherEntity;
import games.paths.core.entity.story.CharacterTemplateEntity;
import games.paths.core.entity.story.LocationEntity;
import games.paths.core.entity.story.WeatherRuleEntity;
import games.paths.core.port.match.MatchLogsStorePort.CharacterLogView;
import games.paths.core.port.match.MatchLogsStorePort.ClockLogEntry;
import games.paths.core.port.match.MatchLogsStorePort.EventLogEntry;
import games.paths.core.port.match.MatchLogsStorePort.MatchSummary;
import games.paths.core.port.match.MatchLogsStorePort.MovementLogEntry;
import games.paths.core.port.match.MatchLogsStorePort.WeatherLogEntry;
import games.paths.core.repository.match.GamingCharacterInstanceRepository;
import games.paths.core.repository.match.GamingMatchRepository;
import games.paths.core.repository.match.LogClockHistoryRepository;
import games.paths.core.repository.match.LogEventsRepository;
import games.paths.core.repository.match.LogMovementRepository;
import games.paths.core.repository.match.LogWeatherRepository;
import games.paths.core.repository.story.CharacterTemplateRepository;
import games.paths.core.repository.story.LocationRepository;
import games.paths.core.repository.story.WeatherRuleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * MatchLogsStoreAdapter — the Step 28.7 read-only adapter over the four append-only log
 * tables plus the v0.28.7 story enrichment lookups.
 */
class MatchLogsStoreAdapterTest {

    private GamingMatchRepository matchRepository;
    private LogWeatherRepository logWeatherRepository;
    private LogMovementRepository logMovementRepository;
    private LogClockHistoryRepository logClockHistoryRepository;
    private LogEventsRepository logEventsRepository;
    private WeatherRuleRepository weatherRuleRepository;
    private LocationRepository locationRepository;
    private CharacterTemplateRepository characterTemplateRepository;
    private GamingCharacterInstanceRepository characterInstanceRepository;
    private MatchLogsStoreAdapter adapter;

    @BeforeEach
    void setUp() {
        matchRepository = mock(GamingMatchRepository.class);
        logWeatherRepository = mock(LogWeatherRepository.class);
        logMovementRepository = mock(LogMovementRepository.class);
        logClockHistoryRepository = mock(LogClockHistoryRepository.class);
        logEventsRepository = mock(LogEventsRepository.class);
        weatherRuleRepository = mock(WeatherRuleRepository.class);
        locationRepository = mock(LocationRepository.class);
        characterTemplateRepository = mock(CharacterTemplateRepository.class);
        characterInstanceRepository = mock(GamingCharacterInstanceRepository.class);
        adapter = new MatchLogsStoreAdapter(matchRepository, logWeatherRepository,
                logMovementRepository, logClockHistoryRepository, logEventsRepository,
                weatherRuleRepository, locationRepository, characterTemplateRepository,
                characterInstanceRepository);
    }

    @Test
    void findMatchByUuid_mapsSummary() {
        GamingMatchEntity m = new GamingMatchEntity();
        m.setId(1L);
        m.setUuid("match-uuid");
        m.setCurrentClock(7);
        m.setIdUserCreator(4L);
        m.setIdStory(9L);
        when(matchRepository.findByUuid("match-uuid")).thenReturn(Optional.of(m));

        Optional<MatchSummary> out = adapter.findMatchByUuid("match-uuid");

        assertTrue(out.isPresent());
        assertEquals(1L, out.get().id());
        assertEquals("match-uuid", out.get().uuid());
        assertEquals(7, out.get().currentClock());
        assertEquals(4L, out.get().idUserCreator());
        assertEquals(9L, out.get().idStory());
    }

    @Test
    void findMatchByUuid_nullClockBecomesZero_andMissingIsEmpty() {
        GamingMatchEntity m = new GamingMatchEntity();
        m.setId(2L);
        m.setUuid("no-clock");
        m.setCurrentClock(null);
        m.setIdUserCreator(1L);
        m.setIdStory(1L);
        when(matchRepository.findByUuid("no-clock")).thenReturn(Optional.of(m));
        assertEquals(0, adapter.findMatchByUuid("no-clock").orElseThrow().currentClock());

        when(matchRepository.findByUuid("nope")).thenReturn(Optional.empty());
        assertTrue(adapter.findMatchByUuid("nope").isEmpty());
    }

    @Test
    void findWeatherLog_mapsRows() {
        LogWeatherEntity l = new LogWeatherEntity();
        l.setId(11L);
        l.setClock(3);
        l.setIdWeather(55L);
        l.setTimestampStart("2026-01-01T00:00:00");
        when(logWeatherRepository.findByIdMatchOrderByClockAsc(1L)).thenReturn(List.of(l));

        List<WeatherLogEntry> out = adapter.findWeatherLog(1L);

        assertEquals(1, out.size());
        assertEquals(11L, out.get(0).id());
        assertEquals(3, out.get(0).clock());
        assertEquals(55L, out.get(0).idWeather());
        assertEquals("2026-01-01T00:00:00", out.get(0).timestamp());
    }

    @Test
    void findWeatherLog_emptyWhenNoRows() {
        when(logWeatherRepository.findByIdMatchOrderByClockAsc(99L)).thenReturn(List.of());
        assertTrue(adapter.findWeatherLog(99L).isEmpty());
    }

    @Test
    void findMovementLog_mapsRows() {
        LogMovementEntity l = new LogMovementEntity();
        l.setId(21L);
        l.setIdCharacterMatch(5L);
        l.setIdLocationFrom(100L);
        l.setIdLocationTo(200L);
        l.setEnergy(4);
        l.setTsInsert("2026-01-02T00:00:00");
        when(logMovementRepository.findByIdMatch(1L)).thenReturn(List.of(l));

        List<MovementLogEntry> out = adapter.findMovementLog(1L);

        assertEquals(1, out.size());
        MovementLogEntry e = out.get(0);
        assertEquals(21L, e.id());
        assertEquals(5L, e.idCharacterMatch());
        assertEquals(100L, e.idLocationFrom());
        assertEquals(200L, e.idLocationTo());
        assertEquals(4, e.energyCost());
        assertEquals("2026-01-02T00:00:00", e.timestamp());
    }

    @Test
    void findClockLog_mapsRows() {
        LogClockHistoryEntity l = new LogClockHistoryEntity();
        l.setId(31L);
        l.setClock(12);
        l.setTimestampStart("2026-01-03T00:00:00");
        when(logClockHistoryRepository.findByIdMatchOrderByClockAsc(1L)).thenReturn(List.of(l));

        List<ClockLogEntry> out = adapter.findClockLog(1L);

        assertEquals(1, out.size());
        assertEquals(31L, out.get(0).id());
        assertEquals(12, out.get(0).clock());
        assertEquals("2026-01-03T00:00:00", out.get(0).timestamp());
    }

    @Test
    void findEventLog_mapsRows() {
        LogEventsEntity l = new LogEventsEntity();
        l.setId(41L);
        l.setIdCharacterMatch(6L);
        l.setClock(2);
        l.setTimestamp("2026-01-04T00:00:00");
        l.setLogMessage("EVENT_EXECUTED#7");
        when(logEventsRepository.findByIdMatchOrderByIdAsc(1L)).thenReturn(List.of(l));

        List<EventLogEntry> out = adapter.findEventLog(1L);

        assertEquals(1, out.size());
        EventLogEntry e = out.get(0);
        assertEquals(41L, e.id());
        assertEquals(6L, e.idCharacterMatch());
        assertEquals(2, e.clock());
        assertEquals("2026-01-04T00:00:00", e.timestamp());
        assertEquals("EVENT_EXECUTED#7", e.logMessage());
    }

    @Test
    void findWeatherIdCards_mapsIdToCard() {
        WeatherRuleEntity w = new WeatherRuleEntity();
        w.setId(1L);
        w.setIdCard(101);
        WeatherRuleEntity w2 = new WeatherRuleEntity();
        w2.setId(2L);
        w2.setIdCard(null);
        when(weatherRuleRepository.findByIdStory(9L)).thenReturn(List.of(w, w2));

        Map<Long, Integer> out = adapter.findWeatherIdCards(9L);

        assertEquals(2, out.size());
        assertEquals(101, out.get(1L));
        assertNull(out.get(2L));
        assertTrue(out.containsKey(2L));
    }

    @Test
    void findLocationIdCards_mapsIdToCard() {
        LocationEntity l = new LocationEntity();
        l.setId(50L);
        l.setIdCard(202);
        when(locationRepository.findByIdStory(9L)).thenReturn(List.of(l));

        assertEquals(Map.of(50L, 202), adapter.findLocationIdCards(9L));
    }

    @Test
    void findCharacterTemplateIdCards_keysOnIdTipo() {
        CharacterTemplateEntity c = new CharacterTemplateEntity();
        c.setIdTipo(70L);
        c.setIdCard(303);
        when(characterTemplateRepository.findByIdStory(9L)).thenReturn(List.of(c));

        assertEquals(Map.of(70L, 303), adapter.findCharacterTemplateIdCards(9L));
    }

    @Test
    void findCharactersByMatch_mapsInstances() {
        GamingCharacterInstanceEntity c = new GamingCharacterInstanceEntity();
        c.setId(80L);
        c.setUuid("char-uuid");
        c.setIdCharacterTemplate(70L);
        when(characterInstanceRepository.findByIdMatch(1L)).thenReturn(List.of(c));

        Map<Long, CharacterLogView> out = adapter.findCharactersByMatch(1L);

        assertEquals(1, out.size());
        CharacterLogView v = out.get(80L);
        assertEquals(80L, v.id());
        assertEquals("char-uuid", v.uuid());
        assertEquals(70L, v.idCharacterTemplate());
    }

    @Test
    void enrichmentLookups_emptyWhenStoryHasNothing() {
        when(weatherRuleRepository.findByIdStory(4L)).thenReturn(List.of());
        when(locationRepository.findByIdStory(4L)).thenReturn(List.of());
        when(characterTemplateRepository.findByIdStory(4L)).thenReturn(List.of());
        when(characterInstanceRepository.findByIdMatch(4L)).thenReturn(List.of());

        assertTrue(adapter.findWeatherIdCards(4L).isEmpty());
        assertTrue(adapter.findLocationIdCards(4L).isEmpty());
        assertTrue(adapter.findCharacterTemplateIdCards(4L).isEmpty());
        assertTrue(adapter.findCharactersByMatch(4L).isEmpty());
    }
}
