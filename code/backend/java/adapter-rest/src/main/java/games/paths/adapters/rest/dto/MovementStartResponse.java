package games.paths.adapters.rest.dto;

import games.paths.core.port.match.MovementPort;

/**
 * Response for {@code POST /api/gameplay/{uuidMatch}/movements/start} (Step 28).
 */
public class MovementStartResponse {

    private String matchUuid;
    private String characterUuid;
    private Long fromLocationId;
    private String fromLocationUuid;
    private long toLocationId;
    private String toLocationUuid;
    private int energySpent;
    private int newEnergy;
    private int currentClock;

    public static MovementStartResponse fromModel(MovementPort.MovementResult m) {
        MovementStartResponse r = new MovementStartResponse();
        r.matchUuid = m.matchUuid();
        r.characterUuid = m.characterUuid();
        r.fromLocationId = m.fromLocationId();
        r.fromLocationUuid = m.fromLocationUuid();
        r.toLocationId = m.toLocationId();
        r.toLocationUuid = m.toLocationUuid();
        r.energySpent = m.energySpent();
        r.newEnergy = m.newEnergy();
        r.currentClock = m.currentClock();
        return r;
    }

    public String getMatchUuid() { return matchUuid; }
    public String getCharacterUuid() { return characterUuid; }
    public Long getFromLocationId() { return fromLocationId; }
    public String getFromLocationUuid() { return fromLocationUuid; }
    public long getToLocationId() { return toLocationId; }
    public String getToLocationUuid() { return toLocationUuid; }
    public int getEnergySpent() { return energySpent; }
    public int getNewEnergy() { return newEnergy; }
    public int getCurrentClock() { return currentClock; }
}
