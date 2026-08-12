package games.paths.core.model.match;

/**
 * MatchLocationState - Domain model for one row of {@code gaming_state_locations}.
 * Step 19: returned inside {@link MatchDetail} so the player can see the runtime
 * counters per location.
 *
 * <p>On the player-facing info endpoint only ALREADY-VISITED locations are
 * projected (visited = character positions ∪ movement log, the same set that
 * {@code GET /locations} returns). The admin info endpoint keeps every location
 * so the console can render the full runtime table.</p>
 */
public class MatchLocationState {

    private Long idLocation;
    private String uuid;
    private Integer flagAlreadyActived;
    /** Step 33 — the party has entered this location at least once. */
    private Integer flagVisited;
    private Integer clockCounter;

    public MatchLocationState() {
    }

    public Long getIdLocation() { return idLocation; }
    public void setIdLocation(Long idLocation) { this.idLocation = idLocation; }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public Integer getFlagAlreadyActived() { return flagAlreadyActived; }
    public void setFlagAlreadyActived(Integer flagAlreadyActived) { this.flagAlreadyActived = flagAlreadyActived; }

    public Integer getFlagVisited() { return flagVisited; }
    public void setFlagVisited(Integer flagVisited) { this.flagVisited = flagVisited; }

    public Integer getClockCounter() { return clockCounter; }
    public void setClockCounter(Integer clockCounter) { this.clockCounter = clockCounter; }
}
