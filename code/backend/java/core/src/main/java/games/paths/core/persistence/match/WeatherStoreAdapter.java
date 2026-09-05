package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingCharacterInstanceEntityId;
import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.match.LogEventsEntity;
import games.paths.core.entity.match.LogWeatherEntity;
import games.paths.core.entity.story.WeatherRuleEntity;
import games.paths.core.port.match.WeatherStorePort;
import games.paths.core.repository.match.GamingCharacterInstanceRepository;
import games.paths.core.repository.match.GamingMatchRepository;
import games.paths.core.repository.match.LogEventsRepository;
import games.paths.core.repository.match.LogWeatherRepository;
import games.paths.core.repository.story.WeatherRuleRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * WeatherStoreAdapter - JPA adapter implementing {@link WeatherStorePort} for
 * the Step 27 weather selection engine.
 */
@Repository
@Transactional
public class WeatherStoreAdapter implements WeatherStorePort {

    private final GamingMatchRepository matchRepository;
    private final GamingCharacterInstanceRepository characterRepository;
    private final WeatherRuleRepository weatherRuleRepository;
    private final LogWeatherRepository logWeatherRepository;
    private final LogEventsRepository logEventsRepository;
    private final games.paths.core.port.story.StoryReadPort storyReadPort;

    public WeatherStoreAdapter(GamingMatchRepository matchRepository,
                               GamingCharacterInstanceRepository characterRepository,
                               WeatherRuleRepository weatherRuleRepository,
                               LogWeatherRepository logWeatherRepository,
                               LogEventsRepository logEventsRepository,
                               games.paths.core.port.story.StoryReadPort storyReadPort) {
        this.matchRepository = matchRepository;
        this.characterRepository = characterRepository;
        this.weatherRuleRepository = weatherRuleRepository;
        this.logWeatherRepository = logWeatherRepository;
        this.logEventsRepository = logEventsRepository;
        this.storyReadPort = storyReadPort;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<WeatherMatchContext> loadContext(long idMatch) {
        GamingMatchEntity m = matchRepository.findById(idMatch).orElse(null);
        if (m == null || m.getIdStory() == null) {
            return Optional.empty();
        }
        return Optional.of(new WeatherMatchContext(
                m.getIdStory(), nz(m.getCurrentClock()), m.getRngSeed()));
    }

    @Override
    @Transactional(readOnly = true)
    public List<WeatherRuleView> findActiveWeatherRules(long idStory) {
        List<WeatherRuleView> out = new ArrayList<>();
        for (WeatherRuleEntity w : weatherRuleRepository.findByIdStory(idStory)) {
            if (w.getActive() == null || w.getActive() == 0) {
                continue;
            }
            out.add(toView(w));
        }
        return out;
    }

    @Override
    @Transactional(readOnly = true)
    public List<WeatherCharacter> findCharacters(long idMatch) {
        List<WeatherCharacter> out = new ArrayList<>();
        for (GamingCharacterInstanceEntity c : characterRepository.findByIdMatch(idMatch)) {
            out.add(new WeatherCharacter(c.getId(), nz(c.getEnergy()), nz(c.getEnergyMax())));
        }
        return out;
    }

    @Override
    public void updateCharacterEnergy(long idMatch, long idCharacter, int energy) {
        characterRepository.findById(new GamingCharacterInstanceEntityId(idCharacter, idMatch))
                .ifPresent(c -> {
                    c.setEnergy(energy);
                    characterRepository.save(c);
                });
    }

    @Override
    public void setCurrentWeather(long idMatch, Long idWeather) {
        matchRepository.findById(idMatch).ifPresent(m -> {
            m.setIdCurrentWeather(idWeather);
            matchRepository.save(m);
        });
    }

    @Override
    public void insertLogWeather(long idMatch, int clock, Long idWeather) {
        LogWeatherEntity e = new LogWeatherEntity();
        e.setId(logWeatherRepository.findMaxId() + 1);
        e.setIdMatch(idMatch);
        e.setClock(clock);
        e.setIdWeather(idWeather);
        logWeatherRepository.save(e);
    }

    @Override
    public void logWeatherEvent(long idMatch, Integer idEvent, String message) {
        LogEventsEntity e = new LogEventsEntity();
        e.setId(logEventsRepository.findMaxId() + 1);
        e.setIdMatch(idMatch);
        e.setIdEvent(idEvent == null ? null : idEvent.longValue());
        e.setLogMessage(message);
        logEventsRepository.save(e);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<CurrentWeatherView> findCurrentWeather(long idMatch) {
        GamingMatchEntity m = matchRepository.findById(idMatch).orElse(null);
        if (m == null || m.getIdStory() == null || m.getIdCurrentWeather() == null) {
            return Optional.empty();
        }
        Long idWeather = m.getIdCurrentWeather();
        for (WeatherRuleEntity w : weatherRuleRepository.findByIdStory(m.getIdStory())) {
            if (idWeather.equals(w.getId())) {
                return Optional.of(new CurrentWeatherView(
                        w.getId(), w.getUuid(), m.getIdStory(), w.getIdCard(),
                        w.getIdTextName(), w.getDeltaEnergy(),
                        w.getCostMoveSafeLocation(), w.getCostMoveNotSafeLocation(),
                        nz(m.getCurrentClock())));
            }
        }
        return Optional.empty();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<CurrentWeatherView> findCurrentWeatherByMatchUuid(String matchUuid) {
        return matchRepository.findByUuid(matchUuid)
                .flatMap(m -> findCurrentWeather(m.getId()));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Long> findRngSeed(String matchUuid) {
        return matchRepository.findByUuid(matchUuid).map(GamingMatchEntity::getRngSeed);
    }

    @Override
    @Transactional(readOnly = true)
    public List<WeatherLogView> findWeatherLog(String matchUuid) {
        GamingMatchEntity m = matchRepository.findByUuid(matchUuid).orElse(null);
        if (m == null) {
            return List.of();
        }
        // Build an id → (uuid, idTextName) lookup for the story's weather rules.
        java.util.Map<Long, WeatherRuleEntity> rulesById = new java.util.HashMap<>();
        if (m.getIdStory() != null) {
            for (WeatherRuleEntity w : weatherRuleRepository.findByIdStory(m.getIdStory())) {
                rulesById.put(w.getId(), w);
            }
        }
        List<WeatherLogView> out = new ArrayList<>();
        for (LogWeatherEntity l : logWeatherRepository.findByIdMatchOrderByClockAsc(m.getId())) {
            WeatherRuleEntity w = l.getIdWeather() == null ? null : rulesById.get(l.getIdWeather());
            out.add(new WeatherLogView(
                    l.getId(), l.getUuid(), nz(l.getClock()), l.getIdWeather(),
                    w == null ? null : w.getUuid(),
                    w == null ? null : w.getIdTextName(),
                    l.getTimestampStart()));
        }
        return out;
    }

    @Override
    @Transactional(readOnly = true)
    public List<WeatherRuleSummary> findWeatherRulesForMatch(String matchUuid) {
        GamingMatchEntity m = matchRepository.findByUuid(matchUuid).orElse(null);
        if (m == null || m.getIdStory() == null) {
            return List.of();
        }
        Long current = m.getIdCurrentWeather();
        Long idStory = m.getIdStory();
        List<WeatherRuleSummary> out = new ArrayList<>();
        for (WeatherRuleEntity w : weatherRuleRepository.findByIdStory(idStory)) {
            out.add(new WeatherRuleSummary(
                    w.getId(), w.getUuid(), w.getIdTextName(),
                    resolveWeatherName(idStory, w.getIdTextName(), w.getIdCard()),
                    w.getProbability(), w.getDeltaEnergy(),
                    w.getCostMoveSafeLocation(), w.getCostMoveNotSafeLocation(),
                    w.getActive() != null && w.getActive() != 0,
                    current != null && current.equals(w.getId()),
                    // The verdict needs the registry; WeatherSelectionService fills it in.
                    w.getConditionKey(), w.getConditionKeyValue(),
                    w.getRegistryValueOperatorCondition(), false));
        }
        return out;
    }

    /**
     * Resolve a weather rule's display name: the id_text_name text first, and
     * when that is absent the title text of the weather's card (id_card).
     */
    private String resolveWeatherName(Long idStory, Integer idTextName, Integer idCard) {
        String name = resolveText(idStory, idTextName);
        if (name != null) {
            return name;
        }
        if (idCard != null) {
            return storyReadPort.findCardByStoryIdAndCardId(idStory, idCard.longValue())
                    .map(c -> resolveText(idStory, c.getIdTextTitle()))
                    .orElse(null);
        }
        return null;
    }

    private String resolveText(Long idStory, Integer idText) {
        if (idText == null) {
            return null;
        }
        return storyReadPort.findTextByStoryIdTextAndLang(idStory, idText, "en")
                .map(games.paths.core.entity.story.TextEntity::getShortText)
                .orElse(null);
    }

    private static WeatherRuleView toView(WeatherRuleEntity w) {
        return new WeatherRuleView(
                w.getId(), w.getUuid(), nz(w.getProbability()), nz(w.getPriority()),
                w.getTimeFrom(), w.getTimeTo(), w.getConditionKey(), w.getConditionKeyValue(),
                w.getRegistryValueOperatorCondition(), w.getDeltaEnergy(), w.getIdEvent(),
                w.getCostMoveSafeLocation(), w.getCostMoveNotSafeLocation(), w.getIdTextName());
    }

    private static int nz(Integer v) {
        return v == null ? 0 : v;
    }
}
