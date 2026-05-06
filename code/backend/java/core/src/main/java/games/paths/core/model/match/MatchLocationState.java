package games.paths.core.model.match;

/**
 * MatchLocationState - Domain model for one row of {@code gaming_state_locations}.
 * Step 19: returned inside {@link MatchDetail} so the player can see the runtime
 * counters per location.
 */
public class MatchLocationState {

    private Long idLocation;
    private String uuid;
    private Integer flagAlreadyActived;
    private Integer clockCounter;
    private String name;

    public MatchLocationState() {
    }

    public Long getIdLocation() { return idLocation; }
    public void setIdLocation(Long idLocation) { this.idLocation = idLocation; }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public Integer getFlagAlreadyActived() { return flagAlreadyActived; }
    public void setFlagAlreadyActived(Integer flagAlreadyActived) { this.flagAlreadyActived = flagAlreadyActived; }

    public Integer getClockCounter() { return clockCounter; }
    public void setClockCounter(Integer clockCounter) { this.clockCounter = clockCounter; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
}
