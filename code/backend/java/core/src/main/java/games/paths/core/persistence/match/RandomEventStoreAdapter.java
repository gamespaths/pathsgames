package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.story.ChoiceEntity;
import games.paths.core.entity.story.EventEntity;
import games.paths.core.entity.story.GlobalRandomEventEntity;
import games.paths.core.port.match.RandomEventStorePort;
import games.paths.core.port.story.StoryReadPort;
import games.paths.core.repository.match.GamingMatchRepository;
import games.paths.core.repository.match.LogEventsRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * RandomEventStoreAdapter - JPA adapter of {@link RandomEventStorePort} (Step 39).
 */
@Repository
@Transactional(readOnly = true)
public class RandomEventStoreAdapter implements RandomEventStorePort {

    private final GamingMatchRepository matchRepository;
    private final StoryReadPort storyReadPort;
    private final LogEventsRepository logEventsRepository;

    public RandomEventStoreAdapter(GamingMatchRepository matchRepository,
                                   StoryReadPort storyReadPort,
                                   LogEventsRepository logEventsRepository) {
        this.matchRepository = matchRepository;
        this.storyReadPort = storyReadPort;
        this.logEventsRepository = logEventsRepository;
    }

    @Override
    public Optional<RandomEventMatchContext> loadContext(long idMatch) {
        GamingMatchEntity m = matchRepository.findById(idMatch).orElse(null);
        if (m == null || m.getIdStory() == null) {
            return Optional.empty();
        }
        int clock = m.getCurrentClock() == null ? 0 : m.getCurrentClock();
        return Optional.of(new RandomEventMatchContext(m.getIdStory(), clock, m.getRngSeed(), m.getStatus()));
    }

    @Override
    public List<RandomEventRuleView> findRandomEvents(long idStory) {
        List<RandomEventRuleView> out = new ArrayList<>();
        List<GlobalRandomEventEntity> rows = storyReadPort.findGlobalRandomEventsByStoryId(idStory);
        if (rows == null || rows.isEmpty()) {
            return out;
        }
        Map<Long, EventEntity> events = new HashMap<>();
        for (EventEntity e : storyReadPort.findEventsByStoryId(idStory)) {
            events.put(e.getId(), e);
        }
        Set<Long> withChoices = new HashSet<>();
        for (ChoiceEntity c : storyReadPort.findChoicesByStoryId(idStory)) {
            if (c.getIdEvent() != null) {
                withChoices.add(c.getIdEvent().longValue());
            }
        }
        for (GlobalRandomEventEntity r : rows) {
            EventEntity event = r.getIdEvent() == null ? null : events.get(r.getIdEvent().longValue());
            out.add(new RandomEventRuleView(r.getId(), r.getIdEvent(),
                    r.getProbability() == null ? 0 : r.getProbability(),
                    r.getConditionKey(), r.getConditionValue(), r.getRegistryValueOperatorCondition(),
                    event != null, event == null ? null : event.getType(),
                    event != null && withChoices.contains(event.getId())));
        }
        return out;
    }

    @Override
    public Set<Long> findConsumedEventIds(long idMatch) {
        return EventExecutionStoreAdapter.consumedEventIds(logEventsRepository, idMatch);
    }
}
