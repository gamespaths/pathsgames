package games.paths.adapters.rest.dto;

import games.paths.core.port.match.TimeAdvancementPort;

import java.util.ArrayList;
import java.util.List;

/**
 * Response for {@code POST /api/gameplay/{uuidMatch}/action/sleep} (Step 25 +
 * Step 26 recovery recap).
 */
public class SleepActionResponse {

    private String matchUuid;
    private String characterUuid;
    private boolean isSleeping;
    private boolean timeEndTriggered;
    private int currentClock;
    private List<RecoveryItem> recovery = new ArrayList<>();

    public static SleepActionResponse fromModel(TimeAdvancementPort.SleepResult m) {
        SleepActionResponse r = new SleepActionResponse();
        r.matchUuid = m.matchUuid();
        r.characterUuid = m.characterUuid();
        r.isSleeping = m.isSleeping();
        r.timeEndTriggered = m.timeEndTriggered();
        r.currentClock = m.currentClock();
        if (m.recovery() != null) {
            for (TimeAdvancementPort.RecoveryItem item : m.recovery()) {
                r.recovery.add(new RecoveryItem(item.characterUuid(),
                        item.energyDelta(), item.lifeDelta(), item.sadDelta()));
            }
        }
        return r;
    }

    public String getMatchUuid() { return matchUuid; }
    public String getCharacterUuid() { return characterUuid; }
    public boolean getIsSleeping() { return isSleeping; }
    public boolean isTimeEndTriggered() { return timeEndTriggered; }
    public int getCurrentClock() { return currentClock; }
    public List<RecoveryItem> getRecovery() { return recovery; }

    /** Per-character recovery summary (Step 26). */
    public static class RecoveryItem {
        private final String characterUuid;
        private final int energyDelta;
        private final int lifeDelta;
        private final int sadDelta;

        public RecoveryItem(String characterUuid, int energyDelta, int lifeDelta, int sadDelta) {
            this.characterUuid = characterUuid;
            this.energyDelta = energyDelta;
            this.lifeDelta = lifeDelta;
            this.sadDelta = sadDelta;
        }

        public String getCharacterUuid() { return characterUuid; }
        public int getEnergyDelta() { return energyDelta; }
        public int getLifeDelta() { return lifeDelta; }
        public int getSadDelta() { return sadDelta; }
    }
}
