package games.paths.adapters.rest.dto;

import games.paths.core.port.match.TurnCyclePort;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Response for {@code GET /api/match/{uuid}/turn-sequence} and
 * {@code POST /api/matches/{uuid}/start} (Step 24).
 */
public class TurnSequenceResponse {

    private String matchUuid;
    private int currentClock;
    private String status;
    private String activeCharacterUuid;
    private List<TurnQueueEntryResponse> queue;

    public static TurnSequenceResponse fromModel(TurnCyclePort.TurnSequenceResult m) {
        TurnSequenceResponse r = new TurnSequenceResponse();
        r.matchUuid = m.matchUuid();
        r.currentClock = m.currentClock();
        r.status = m.status();
        r.activeCharacterUuid = m.activeCharacterUuid();
        r.queue = m.queue().stream()
                .map(TurnQueueEntryResponse::fromModel)
                .collect(Collectors.toList());
        return r;
    }

    public String getMatchUuid() { return matchUuid; }
    public int getCurrentClock() { return currentClock; }
    public String getStatus() { return status; }
    public String getActiveCharacterUuid() { return activeCharacterUuid; }
    public List<TurnQueueEntryResponse> getQueue() { return queue; }
}
