package games.paths.adapters.rest.dto;

import games.paths.core.port.match.TurnCyclePort;

/**
 * One turn-queue entry as exposed by the turn-sequence / start endpoints (Step 24).
 */
public class TurnQueueEntryResponse {

    private String characterUuid;
    private long idCharacter;
    private String name;
    private long priority;
    private int clock;
    private String status;
    private int passCounter;
    private String timestampStart;
    private String timestampEnd;

    public static TurnQueueEntryResponse fromModel(TurnCyclePort.TurnEntry e) {
        TurnQueueEntryResponse r = new TurnQueueEntryResponse();
        r.characterUuid = e.characterUuid();
        r.idCharacter = e.idCharacter();
        r.name = e.name();
        r.priority = e.priority();
        r.clock = e.clock();
        r.status = e.status();
        r.passCounter = e.passCounter();
        r.timestampStart = e.timestampStart();
        r.timestampEnd = e.timestampEnd();
        return r;
    }

    public String getCharacterUuid() { return characterUuid; }
    public long getIdCharacter() { return idCharacter; }
    public String getName() { return name; }
    public long getPriority() { return priority; }
    public int getClock() { return clock; }
    public String getStatus() { return status; }
    public int getPassCounter() { return passCounter; }
    public String getTimestampStart() { return timestampStart; }
    public String getTimestampEnd() { return timestampEnd; }
}
