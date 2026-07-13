package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingCharacterInstanceEntityId;
import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.match.GamingTurnQueueEntity;
import games.paths.core.entity.match.LogClockHistoryEntity;
import games.paths.core.entity.story.StoryEntity;
import games.paths.core.entity.story.TextEntity;
import games.paths.core.port.match.TurnCycleStorePort;
import games.paths.core.repository.match.GamingCharacterInstanceRepository;
import games.paths.core.repository.match.GamingMatchRepository;
import games.paths.core.repository.match.GamingTurnQueueRepository;
import games.paths.core.entity.match.LogEventsEntity;
import games.paths.core.repository.match.LogClockHistoryRepository;
import games.paths.core.repository.match.LogEventsRepository;
import games.paths.core.repository.story.StoryRepository;
import games.paths.core.repository.story.TextRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * TurnCycleStoreAdapter - JPA adapter implementing {@link TurnCycleStorePort}
 * over gaming_match / gaming_character_instance / gaming_turn_queue (Step 24).
 */
@Repository
@Transactional
public class TurnCycleStoreAdapter implements TurnCycleStorePort {

    private final GamingMatchRepository matchRepository;
    private final GamingCharacterInstanceRepository characterRepository;
    private final GamingTurnQueueRepository turnQueueRepository;
    private final LogClockHistoryRepository logClockHistoryRepository;
    private final LogEventsRepository logEventsRepository;
    private final StoryRepository storyRepository;
    private final TextRepository textRepository;

    public TurnCycleStoreAdapter(GamingMatchRepository matchRepository,
                                 GamingCharacterInstanceRepository characterRepository,
                                 GamingTurnQueueRepository turnQueueRepository,
                                 LogClockHistoryRepository logClockHistoryRepository,
                                 LogEventsRepository logEventsRepository,
                                 StoryRepository storyRepository,
                                 TextRepository textRepository) {
        this.matchRepository = matchRepository;
        this.characterRepository = characterRepository;
        this.turnQueueRepository = turnQueueRepository;
        this.logClockHistoryRepository = logClockHistoryRepository;
        this.logEventsRepository = logEventsRepository;
        this.storyRepository = storyRepository;
        this.textRepository = textRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<MatchView> findMatchByUuid(String uuid) {
        return matchRepository.findByUuid(uuid).map(m -> new MatchView(
                m.getId(), m.getUuid(), m.getStatus(),
                m.getCurrentClock() == null ? 0 : m.getCurrentClock(),
                m.getIdUserCreator(), m.getIdCharacterCurrentTurn()));
    }

    @Override
    @Transactional(readOnly = true)
    public List<CharacterTurnView> findCharactersByMatchId(long idMatch) {
        List<CharacterTurnView> out = new ArrayList<>();
        for (GamingCharacterInstanceEntity c : characterRepository.findByIdMatch(idMatch)) {
            out.add(toView(c));
        }
        return out;
    }

    private static CharacterTurnView toView(GamingCharacterInstanceEntity c) {
        return new CharacterTurnView(
                c.getId(), c.getUuid(), c.getIdUser(),
                nz(c.getDexterity()), nz(c.getIntelligence()),
                nz(c.getConstitution()), nz(c.getLife()),
                nz(c.getEnergy()), Boolean.TRUE.equals(c.getIsSleeping()));
    }

    @Override
    public void replaceQueue(long idMatch, List<QueueRow> rows) {
        turnQueueRepository.deleteByIdMatch(idMatch);
        List<GamingTurnQueueEntity> entities = new ArrayList<>();
        for (QueueRow r : rows) {
            GamingTurnQueueEntity e = new GamingTurnQueueEntity();
            e.setIdMatch(idMatch);
            e.setIdCharacterMatch(r.idCharacterMatch());
            e.setClock(r.clock());
            e.setPriority(r.priority());
            e.setStatus(r.status());
            e.setPassCounter(r.passCounter());
            e.setTimestampStart(r.timestampStart());
            e.setTimestampEnd(r.timestampEnd());
            entities.add(e);
        }
        turnQueueRepository.saveAll(entities);
    }

    @Override
    @Transactional(readOnly = true)
    public List<QueueRow> findQueueByMatchId(long idMatch) {
        List<QueueRow> out = new ArrayList<>();
        for (GamingTurnQueueEntity e : turnQueueRepository.findByIdMatchOrderByPriorityDesc(idMatch)) {
            out.add(new QueueRow(e.getIdCharacterMatch(), e.getUuid(), nz(e.getClock()),
                    e.getPriority() == null ? 0L : e.getPriority(), e.getStatus(),
                    nz(e.getPassCounter()), e.getTimestampStart(), e.getTimestampEnd()));
        }
        return out;
    }

    @Override
    public void saveQueueRow(long idMatch, QueueRow row) {
        GamingTurnQueueEntity e = turnQueueRepository
                .findByIdMatchAndIdCharacterMatch(idMatch, row.idCharacterMatch())
                .orElse(null);
        if (e == null) return;
        e.setStatus(row.status());
        e.setPassCounter(row.passCounter());
        e.setPriority(row.priority());
        e.setClock(row.clock());
        e.setTimestampStart(row.timestampStart());
        e.setTimestampEnd(row.timestampEnd());
        turnQueueRepository.save(e);
    }

    @Override
    public void updateMatchStatusAndTurn(long idMatch, String status, Long idCharacterCurrentTurn) {
        GamingMatchEntity m = matchRepository.findById(idMatch).orElse(null);
        if (m == null) return;
        if (status != null) m.setStatus(status);
        m.setIdCharacterCurrentTurn(idCharacterCurrentTurn);
        matchRepository.save(m);
    }

    // ── Step 25: time advancement & clock cycle ─────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public Optional<CharacterTurnView> findCharacterByMatchAndUser(long idMatch, long idUser) {
        return characterRepository.findByIdMatchAndIdUser(idMatch, idUser)
                .map(TurnCycleStoreAdapter::toView);
    }

    @Override
    public void setCharacterSleeping(long idMatch, long idCharacter, boolean sleeping) {
        characterRepository.findById(new GamingCharacterInstanceEntityId(idCharacter, idMatch))
                .ifPresent(c -> {
                    c.setIsSleeping(sleeping);
                    characterRepository.save(c);
                });
    }

    @Override
    public void wakeAllCharacters(long idMatch) {
        List<GamingCharacterInstanceEntity> characters = characterRepository.findByIdMatch(idMatch);
        for (GamingCharacterInstanceEntity c : characters) {
            if (Boolean.TRUE.equals(c.getIsSleeping())) {
                c.setIsSleeping(false);
            }
        }
        characterRepository.saveAll(characters);
    }

    @Override
    public void setAllCharactersSleeping(long idMatch) {
        List<GamingCharacterInstanceEntity> characters = characterRepository.findByIdMatch(idMatch);
        for (GamingCharacterInstanceEntity c : characters) {
            c.setIsSleeping(true);
        }
        characterRepository.saveAll(characters);
    }

    @Override
    public int incrementMatchClock(long idMatch) {
        GamingMatchEntity m = matchRepository.findById(idMatch).orElse(null);
        if (m == null) return 0;
        int newClock = nz(m.getCurrentClock()) + 1;
        m.setCurrentClock(newClock);
        matchRepository.save(m);
        return newClock;
    }

    @Override
    public void insertClockHistory(long idMatch, int clock) {
        LogClockHistoryEntity e = new LogClockHistoryEntity();
        e.setId(logClockHistoryRepository.findMaxId() + 1);
        e.setIdMatch(idMatch);
        e.setClock(clock);
        String now = java.time.Instant.now().toString();
        e.setTimestampStart(now);
        logClockHistoryRepository.save(e);
    }

    @Override
    public void logSleep(long idMatch, long idCharacter, int clock) {
        LogEventsEntity e = new LogEventsEntity();
        e.setId(logEventsRepository.findMaxId() + 1);
        e.setIdMatch(idMatch);
        e.setIdCharacterMatch(idCharacter);
        e.setClock(clock);
        e.setLogMessage("ACTION_SLEEP");
        logEventsRepository.save(e);
    }

    @Override
    @Transactional(readOnly = true)
    public ClockLabels findStoryClockLabels(long idMatch, String lang) {
        GamingMatchEntity m = matchRepository.findById(idMatch).orElse(null);
        if (m == null || m.getIdStory() == null) {
            return new ClockLabels(null, null);
        }
        StoryEntity story = storyRepository.findById(m.getIdStory()).orElse(null);
        if (story == null) {
            return new ClockLabels(null, null);
        }
        String singular = resolveText(story.getId(), story.getIdTextClockSingular(), lang);
        String plural = resolveText(story.getId(), story.getIdTextClockPlural(), lang);
        return new ClockLabels(singular, plural);
    }

    private String resolveText(Long idStory, Integer idText, String lang) {
        if (idStory == null || idText == null) return null;
        String effectiveLang = (lang != null && !lang.isBlank()) ? lang : "en";
        String text = firstShortText(idStory, idText, effectiveLang);
        if (text == null && !"en".equals(effectiveLang)) {
            text = firstShortText(idStory, idText, "en");
        }
        return text;
    }

    private String firstShortText(Long idStory, Integer idText, String lang) {
        List<TextEntity> texts = textRepository.findByIdStoryAndIdTextAndLang(idStory, idText, lang);
        return texts.isEmpty() ? null : texts.get(0).getShortText();
    }

    private static int nz(Integer v) {
        return v == null ? 0 : v;
    }
}
