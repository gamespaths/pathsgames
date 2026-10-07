package games.paths.core.persistence.match;

import games.paths.core.entity.match.LogEventsEntity;
import games.paths.core.model.match.LogTable;
import games.paths.core.port.match.LogIdPort;
import games.paths.core.port.match.MatchLogWriterPort;
import games.paths.core.repository.match.LogEventsRepository;
import jakarta.persistence.EntityManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * MatchLogWriterAdapter - v0.41.1 JPA adapter of {@link MatchLogWriterPort}: log_events rows
 * and the per-match row count behind the admin logCount and the log-size WARN (check only).
 */
@Repository
@Transactional
public class MatchLogWriterAdapter implements MatchLogWriterPort {

    private static final Logger log = LoggerFactory.getLogger(MatchLogWriterAdapter.class);
    private static final Pattern SAFE_IDENTIFIER = Pattern.compile("[a-z_][a-z0-9_]*");
    static final String COUNT_SQL = buildCountQuery();

    private static String buildCountQuery() {
        return "SELECT " + Arrays.stream(LogTable.values())
                .map(t -> "(SELECT COUNT(*) FROM " + quoteIdentifier(t.tableName()) + " WHERE id_match = :idMatch)")
                .collect(Collectors.joining(" + "));
    }

    private final LogEventsRepository logEventsRepository;
    private final LogIdPort logIds;
    private final EntityManager entityManager;
    private final long warnRows;
    private final Set<Long> warned = ConcurrentHashMap.newKeySet();

    public MatchLogWriterAdapter(LogEventsRepository logEventsRepository, LogIdPort logIds,
                                 EntityManager entityManager,
                                 @Value("${game.logs.warn-rows:5000}") long warnRows) {
        this.logEventsRepository = logEventsRepository;
        this.logIds = logIds;
        this.entityManager = entityManager;
        this.warnRows = warnRows;
    }

    private static String quoteIdentifier(String name) {
        if (name == null || !SAFE_IDENTIFIER.matcher(name).matches()) {
            throw new IllegalArgumentException("Not a plain identifier: " + name);
        }
        return name;
    }

    @Override
    public void write(long idMatch, Long idCharacter, Long idEvent, int clock, String message) {
        LogEventsEntity e = new LogEventsEntity();
        e.setId(logIds.nextId(LogTable.EVENTS));
        e.setIdMatch(idMatch);
        e.setIdCharacterMatch(idCharacter);
        e.setIdEvent(idEvent);
        e.setClock(clock);
        e.setLogMessage(message);
        logEventsRepository.save(e);
    }

    @Override
    @Transactional(readOnly = true)
    public long countRows(long idMatch) {
        Object raw = entityManager.createNativeQuery(COUNT_SQL)
                .setParameter("idMatch", idMatch).getSingleResult();
        long count = raw instanceof Number n ? n.longValue() : 0L;
        if (warnRows > 0 && count >= warnRows && warned.add(idMatch)) {
            log.warn("LOG_SIZE match {} has {} log rows (warn threshold {})", idMatch, count, warnRows);
        }
        return count;
    }
}
