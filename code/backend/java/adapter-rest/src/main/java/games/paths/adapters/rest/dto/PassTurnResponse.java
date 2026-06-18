package games.paths.adapters.rest.dto;

import games.paths.core.port.match.TurnCyclePort;

/**
 * Response for {@code POST /api/gameplay/{uuid}/action/pass} (Step 24).
 */
public class PassTurnResponse {

    private String matchUuid;
    private String passedCharacterUuid;
    private String nextActiveCharacterUuid;
    private String status;

    public static PassTurnResponse fromModel(TurnCyclePort.PassResult m) {
        PassTurnResponse r = new PassTurnResponse();
        r.matchUuid = m.matchUuid();
        r.passedCharacterUuid = m.passedCharacterUuid();
        r.nextActiveCharacterUuid = m.nextActiveCharacterUuid();
        r.status = m.status();
        return r;
    }

    public String getMatchUuid() { return matchUuid; }
    public String getPassedCharacterUuid() { return passedCharacterUuid; }
    public String getNextActiveCharacterUuid() { return nextActiveCharacterUuid; }
    public String getStatus() { return status; }
}
