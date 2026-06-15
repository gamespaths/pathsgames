package games.paths.adapters.rest.dto;

import games.paths.core.port.match.TimeAdvancementPort;

/**
 * Response for {@code POST /api/gameplay/{uuidMatch}/action/sleep} (Step 25).
 */
public class SleepActionResponse {

    private String matchUuid;
    private String characterUuid;
    private boolean isSleeping;
    private boolean timeEndTriggered;
    private int currentClock;

    public static SleepActionResponse fromModel(TimeAdvancementPort.SleepResult m) {
        SleepActionResponse r = new SleepActionResponse();
        r.matchUuid = m.matchUuid();
        r.characterUuid = m.characterUuid();
        r.isSleeping = m.isSleeping();
        r.timeEndTriggered = m.timeEndTriggered();
        r.currentClock = m.currentClock();
        return r;
    }

    public String getMatchUuid() { return matchUuid; }
    public String getCharacterUuid() { return characterUuid; }
    public boolean getIsSleeping() { return isSleeping; }
    public boolean isTimeEndTriggered() { return timeEndTriggered; }
    public int getCurrentClock() { return currentClock; }
}
