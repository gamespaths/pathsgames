package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.LogClockHistoryEntity;
import games.paths.core.entity.match.LogEventsEntity;
import games.paths.core.entity.match.LogMovementEntity;
import games.paths.core.entity.match.LogWeatherEntity;
import games.paths.core.entity.story.CharacterTemplateEntity;
import games.paths.core.entity.story.EventEntity;
import games.paths.core.entity.story.LocationEntity;
import games.paths.core.entity.story.WeatherRuleEntity;
import games.paths.core.port.match.MatchLogsStorePort;
import games.paths.core.repository.match.GamingCharacterInstanceRepository;
import games.paths.core.repository.match.GamingMatchRepository;
import games.paths.core.repository.match.LogClockHistoryRepository;
import games.paths.core.repository.match.LogEventsRepository;
import games.paths.core.repository.match.LogMovementRepository;
import games.paths.core.repository.match.LogWeatherRepository;
import games.paths.core.repository.story.CharacterTemplateRepository;
import games.paths.core.repository.story.EventRepository;
import games.paths.core.repository.story.LocationRepository;
import games.paths.core.repository.story.WeatherRuleRepository;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * MatchLogsStoreAdapter - JPA adapter implementing {@link MatchLogsStorePort}
 * for the Step 28.7 match logs endpoint. Reads from the four append-only log tables
 * and the gaming_match table (for ownership/clock metadata), plus the story-scoped
 * lookups that enrich the entries with cards and characters (v0.28.7). v0.30.3 adds
 * {@link #findEventIdCards(long)} so EVENT entries carry the triggered event's own card.
 */
@Repository
@Transactional(readOnly = true)
public class MatchLogsStoreAdapter implements MatchLogsStorePort {

    private final GamingMatchRepository matchRepository;
    private final LogWeatherRepository logWeatherRepository;
    private final LogMovementRepository logMovementRepository;
    private final LogClockHistoryRepository logClockHistoryRepository;
    private final LogEventsRepository logEventsRepository;
    private final WeatherRuleRepository weatherRuleRepository;
    private final LocationRepository locationRepository;
    private final CharacterTemplateRepository characterTemplateRepository;
    private final GamingCharacterInstanceRepository characterInstanceRepository;
    private final EventRepository eventRepository;

    public MatchLogsStoreAdapter(GamingMatchRepository matchRepository,
                                 LogWeatherRepository logWeatherRepository,
                                 LogMovementRepository logMovementRepository,
                                 LogClockHistoryRepository logClockHistoryRepository,
                                 LogEventsRepository logEventsRepository,
                                 WeatherRuleRepository weatherRuleRepository,
                                 LocationRepository locationRepository,
                                 CharacterTemplateRepository characterTemplateRepository,
                                 GamingCharacterInstanceRepository characterInstanceRepository,
                                 EventRepository eventRepository) {
        this.matchRepository = matchRepository;
        this.logWeatherRepository = logWeatherRepository;
        this.logMovementRepository = logMovementRepository;
        this.logClockHistoryRepository = logClockHistoryRepository;
        this.logEventsRepository = logEventsRepository;
        this.weatherRuleRepository = weatherRuleRepository;
        this.locationRepository = locationRepository;
        this.characterTemplateRepository = characterTemplateRepository;
        this.characterInstanceRepository = characterInstanceRepository;
        this.eventRepository = eventRepository;
    }

    @Override
    public Optional<MatchSummary> findMatchByUuid(String uuid) {
        return matchRepository.findByUuid(uuid)
                .map(m -> new MatchSummary(m.getId(), m.getUuid(),
                        m.getCurrentClock() == null ? 0 : m.getCurrentClock(),
                        m.getIdUserCreator(), m.getIdStory()));
    }

    @Override
    public List<WeatherLogEntry> findWeatherLog(long idMatch) {
        List<WeatherLogEntry> out = new ArrayList<>();
        for (LogWeatherEntity l : logWeatherRepository.findByIdMatchOrderByClockAsc(idMatch)) {
            out.add(new WeatherLogEntry(l.getId(), l.getClock(), l.getIdWeather(),
                    l.getTimestampStart()));
        }
        return out;
    }

    @Override
    public List<MovementLogEntry> findMovementLog(long idMatch) {
        List<MovementLogEntry> out = new ArrayList<>();
        for (LogMovementEntity l : logMovementRepository.findByIdMatch(idMatch)) {
            out.add(new MovementLogEntry(l.getId(), l.getIdCharacterMatch(),
                    l.getIdLocationFrom(), l.getIdLocationTo(), l.getEnergy(),
                    l.getTsInsert(), l.getFood(), l.getMagic(), l.getCoin()));
        }
        return out;
    }

    @Override
    public List<ClockLogEntry> findClockLog(long idMatch) {
        List<ClockLogEntry> out = new ArrayList<>();
        for (LogClockHistoryEntity l : logClockHistoryRepository.findByIdMatchOrderByClockAsc(idMatch)) {
            out.add(new ClockLogEntry(l.getId(), l.getClock(), l.getTimestampStart()));
        }
        return out;
    }

    @Override
    public List<EventLogEntry> findEventLog(long idMatch) {
        List<EventLogEntry> out = new ArrayList<>();
        for (LogEventsEntity l : logEventsRepository.findByIdMatchOrderByIdAsc(idMatch)) {
            out.add(new EventLogEntry(l.getId(), l.getIdCharacterMatch(),
                    l.getClock(), l.getTimestamp(), l.getLogMessage(), l.getIdEvent(),
                    l.getIdLocation(), l.getEnergy(), l.getFood(), l.getMagic(), l.getCoin()));
        }
        return out;
    }

    @Override
    public Map<Long, Integer> findWeatherIdCards(long idStory) {
        Map<Long, Integer> out = new LinkedHashMap<>();
        for (WeatherRuleEntity w : weatherRuleRepository.findByIdStory(idStory)) {
            out.put(w.getId(), w.getIdCard());
        }
        return out;
    }

    @Override
    public Map<Long, Integer> findLocationIdCards(long idStory) {
        Map<Long, Integer> out = new LinkedHashMap<>();
        for (LocationEntity l : locationRepository.findByIdStory(idStory)) {
            out.put(l.getId(), l.getIdCard());
        }
        return out;
    }

    @Override
    public Map<Long, Integer> findCharacterTemplateIdCards(long idStory) {
        Map<Long, Integer> out = new LinkedHashMap<>();
        // The character template's own id column is `id_tipo` (mapped to idTipo).
        for (CharacterTemplateEntity c : characterTemplateRepository.findByIdStory(idStory)) {
            out.put(c.getIdTipo(), c.getIdCard());
        }
        return out;
    }

    @Override
    public Map<Long, Integer> findEventIdCards(long idStory) {
        Map<Long, Integer> out = new LinkedHashMap<>();
        for (EventEntity e : eventRepository.findByIdStory(idStory)) {
            out.put(e.getId(), e.getIdCard());
        }
        return out;
    }

    @Override
    public Map<Long, CharacterLogView> findCharactersByMatch(long idMatch) {
        Map<Long, CharacterLogView> out = new LinkedHashMap<>();
        for (GamingCharacterInstanceEntity c : characterInstanceRepository.findByIdMatch(idMatch)) {
            out.put(c.getId(), new CharacterLogView(c.getId(), c.getUuid(),
                    c.getIdCharacterTemplate()));
        }
        return out;
    }
}
