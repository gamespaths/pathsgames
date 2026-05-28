package games.paths.core.model.match;

import java.util.ArrayList;
import java.util.List;

/**
 * MatchDetail - Domain model returned by {@code MatchQueryPort.getMatchInfo}.
 *
 * <p>Step 19 — embeds the match summary, the runtime location & registry state,
 * and the events/choices currently available for the player.</p>
 */
public class MatchDetail {

    private MatchSummary match;
    private Long currentLocationId;
    private String currentLocationUuid;
    private String currentLocationName;
    private List<MatchLocationState> locations = new ArrayList<>();
    private List<MatchRegistryEntry> registry = new ArrayList<>();
    private List<MatchEventOption> events = new ArrayList<>();
    private List<MatchEventOption> choices = new ArrayList<>();

    public MatchDetail() {
    }

    public MatchSummary getMatch() { return match; }
    public void setMatch(MatchSummary match) { this.match = match; }

    public Long getCurrentLocationId() { return currentLocationId; }
    public void setCurrentLocationId(Long currentLocationId) { this.currentLocationId = currentLocationId; }

    public String getCurrentLocationUuid() { return currentLocationUuid; }
    public void setCurrentLocationUuid(String currentLocationUuid) { this.currentLocationUuid = currentLocationUuid; }

    public String getCurrentLocationName() { return currentLocationName; }
    public void setCurrentLocationName(String currentLocationName) { this.currentLocationName = currentLocationName; }

    public List<MatchLocationState> getLocations() { return locations; }
    public void setLocations(List<MatchLocationState> locations) {
        this.locations = locations != null ? locations : new ArrayList<>();
    }

    public List<MatchRegistryEntry> getRegistry() { return registry; }
    public void setRegistry(List<MatchRegistryEntry> registry) {
        this.registry = registry != null ? registry : new ArrayList<>();
    }

    public List<MatchEventOption> getEvents() { return events; }
    public void setEvents(List<MatchEventOption> events) {
        this.events = events != null ? events : new ArrayList<>();
    }

    public List<MatchEventOption> getChoices() { return choices; }
    public void setChoices(List<MatchEventOption> choices) {
        this.choices = choices != null ? choices : new ArrayList<>();
    }
}
