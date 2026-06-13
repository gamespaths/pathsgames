package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.match.GamingTurnQueueEntity;
import games.paths.core.port.match.TurnCycleStorePort;
import games.paths.core.repository.match.GamingCharacterInstanceRepository;
import games.paths.core.repository.match.GamingMatchRepository;
import games.paths.core.repository.match.GamingTurnQueueRepository;
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

    public TurnCycleStoreAdapter(GamingMatchRepository matchRepository,
                                 GamingCharacterInstanceRepository characterRepository,
                                 GamingTurnQueueRepository turnQueueRepository) {
        this.matchRepository = matchRepository;
        this.characterRepository = characterRepository;
        this.turnQueueRepository = turnQueueRepository;
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
            out.add(new CharacterTurnView(
                    c.getId(), c.getUuid(), c.getIdUser(),
                    nz(c.getDexterity()), nz(c.getIntelligence()),
                    nz(c.getConstitution()), nz(c.getLife())));
        }
        return out;
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

    private static int nz(Integer v) {
        return v == null ? 0 : v;
    }
}
