package games.paths.core.model.match;

/**
 * MatchRegistryEntry - Domain model for one row of {@code gaming_state_registry}.
 * Step 19: returned inside {@link MatchDetail}.
 */
public class MatchRegistryEntry {

    private String uuid;
    private String key;
    private String stringValue;
    private Integer intValue;

    public MatchRegistryEntry() {
    }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public String getKey() { return key; }
    public void setKey(String key) { this.key = key; }

    public String getStringValue() { return stringValue; }
    public void setStringValue(String stringValue) { this.stringValue = stringValue; }

    public Integer getIntValue() { return intValue; }
    public void setIntValue(Integer intValue) { this.intValue = intValue; }
}
