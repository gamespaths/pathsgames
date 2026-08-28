package games.paths.adapters.rest.dto;

import games.paths.core.port.match.MovementPort;

import java.util.ArrayList;
import java.util.List;

/**
 * Response for {@code POST /api/gameplay/{uuidMatch}/movements/start} (Step 28).
 *
 * <p>Step 33 added {@code automaticEvents}: what the destination did about the arrival. The
 * board already has the new location for its left page; these belong on the right.</p>
 *
 * <p>v0.35.6 added {@code edgeState}: an arrival can kill, and the Step 30 verdict of the
 * whole arrival rides here in the very shape execute-event answers.</p>
 */
public class MovementStartResponse {

    private String matchUuid;
    private String characterUuid;
    private Long fromLocationId;
    private String fromLocationUuid;
    private long toLocationId;
    private String toLocationUuid;
    private int energySpent;
    /** v0.35.3 — the edge's resource price, and the backpack after it. */
    private int foodSpent;
    private int magicSpent;
    private int coinSpent;
    private int newEnergy;
    private int newFood;
    private int newMagic;
    private int newCoin;
    private int currentClock;
    private List<AutomaticEventResponse> automaticEvents = new ArrayList<>();
    private ExecuteEventResponse.EdgeStateOutcomeDto edgeState;

    public static MovementStartResponse fromModel(MovementPort.MovementResult m) {
        MovementStartResponse r = new MovementStartResponse();
        r.matchUuid = m.matchUuid();
        r.characterUuid = m.characterUuid();
        r.fromLocationId = m.fromLocationId();
        r.fromLocationUuid = m.fromLocationUuid();
        r.toLocationId = m.toLocationId();
        r.toLocationUuid = m.toLocationUuid();
        r.energySpent = m.energySpent();
        r.foodSpent = m.foodSpent();
        r.magicSpent = m.magicSpent();
        r.coinSpent = m.coinSpent();
        r.newEnergy = m.newEnergy();
        r.newFood = m.newFood();
        r.newMagic = m.newMagic();
        r.newCoin = m.newCoin();
        r.currentClock = m.currentClock();
        r.automaticEvents = AutomaticEventResponse.fromModels(m.automaticEvents());
        r.edgeState = ExecuteEventResponse.EdgeStateOutcomeDto.fromModel(m.edgeState());
        return r;
    }

    public String getMatchUuid() { return matchUuid; }
    public String getCharacterUuid() { return characterUuid; }
    public Long getFromLocationId() { return fromLocationId; }
    public String getFromLocationUuid() { return fromLocationUuid; }
    public long getToLocationId() { return toLocationId; }
    public String getToLocationUuid() { return toLocationUuid; }
    public int getEnergySpent() { return energySpent; }
    public int getFoodSpent() { return foodSpent; }
    public int getMagicSpent() { return magicSpent; }
    public int getCoinSpent() { return coinSpent; }
    public int getNewEnergy() { return newEnergy; }
    public int getNewFood() { return newFood; }
    public int getNewMagic() { return newMagic; }
    public int getNewCoin() { return newCoin; }
    public int getCurrentClock() { return currentClock; }
    public List<AutomaticEventResponse> getAutomaticEvents() { return automaticEvents; }
    public ExecuteEventResponse.EdgeStateOutcomeDto getEdgeState() { return edgeState; }
}
