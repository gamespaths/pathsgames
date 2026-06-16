package games.paths.adapters.rest.dto;

import games.paths.core.model.match.CharacterInstanceInfo;
import games.paths.core.model.match.EventInfo;
import games.paths.core.model.match.LocationInfo;
import games.paths.core.model.match.LocationNeighborInfo;
import games.paths.core.model.match.MatchDetail;
import games.paths.core.model.match.MatchEventOption;
import games.paths.core.model.match.MatchLocationState;
import games.paths.core.model.match.MatchRegistryEntry;

import java.util.ArrayList;
import java.util.List;

/**
 * MatchInfoResponse - JSON projection of {@link MatchDetail}.
 * Step 19 — body returned by GET /api/match/&#123;uuid&#125;/info.
 */
public class MatchInfoResponse {

    private MatchSummaryResponse match;
    private Long currentLocationId;
    private String currentLocationUuid;
    private String currentLocationName;
    private List<LocationStateDto> locations = new ArrayList<>();
    private List<RegistryEntryDto> registry = new ArrayList<>();
    private List<EventOptionDto> events = new ArrayList<>();
    private List<EventOptionDto> choices = new ArrayList<>();
    private List<CharacterSummaryResponse> players = new ArrayList<>();
    private List<LocationInfoDto> locationsActive = new ArrayList<>();

    public MatchInfoResponse() {
    }

    public static MatchInfoResponse fromModel(MatchDetail d) {
        if (d == null) return null;
        MatchInfoResponse r = new MatchInfoResponse();
        r.match = MatchSummaryResponse.fromModel(d.getMatch());
        r.currentLocationId = d.getCurrentLocationId();
        r.currentLocationUuid = d.getCurrentLocationUuid();
        r.currentLocationName = d.getCurrentLocationName();
        for (MatchLocationState s : d.getLocations()) {
            r.locations.add(LocationStateDto.fromModel(s));
        }
        for (MatchRegistryEntry e : d.getRegistry()) {
            r.registry.add(RegistryEntryDto.fromModel(e));
        }
        for (MatchEventOption e : d.getEvents()) {
            r.events.add(EventOptionDto.fromModel(e));
        }
        for (MatchEventOption c : d.getChoices()) {
            r.choices.add(EventOptionDto.fromModel(c));
        }
        for (CharacterInstanceInfo p : d.getPlayers()) {
            r.players.add(CharacterSummaryResponse.fromModel(p));
        }
        for (LocationInfo l : d.getLocationsActive()) {
            r.locationsActive.add(LocationInfoDto.fromModel(l));
        }
        return r;
    }

    public MatchSummaryResponse getMatch() { return match; }
    public void setMatch(MatchSummaryResponse match) { this.match = match; }

    public Long getCurrentLocationId() { return currentLocationId; }
    public void setCurrentLocationId(Long currentLocationId) { this.currentLocationId = currentLocationId; }

    public String getCurrentLocationUuid() { return currentLocationUuid; }
    public void setCurrentLocationUuid(String currentLocationUuid) { this.currentLocationUuid = currentLocationUuid; }

    public String getCurrentLocationName() { return currentLocationName; }
    public void setCurrentLocationName(String currentLocationName) { this.currentLocationName = currentLocationName; }

    public List<LocationStateDto> getLocations() { return locations; }
    public void setLocations(List<LocationStateDto> locations) { this.locations = locations; }

    public List<RegistryEntryDto> getRegistry() { return registry; }
    public void setRegistry(List<RegistryEntryDto> registry) { this.registry = registry; }

    public List<EventOptionDto> getEvents() { return events; }
    public void setEvents(List<EventOptionDto> events) { this.events = events; }

    public List<EventOptionDto> getChoices() { return choices; }
    public void setChoices(List<EventOptionDto> choices) { this.choices = choices; }

    public List<CharacterSummaryResponse> getPlayers() { return players; }
    public void setPlayers(List<CharacterSummaryResponse> players) { this.players = players; }

    public List<LocationInfoDto> getLocationsActive() { return locationsActive; }
    public void setLocationsActive(List<LocationInfoDto> locationsActive) { this.locationsActive = locationsActive; }

    public static class LocationStateDto {
        private Long idLocation;
        private String uuid;
        private Integer flagAlreadyActived;
        private Integer clockCounter;
        private String name;

        public static LocationStateDto fromModel(MatchLocationState m) {
            LocationStateDto d = new LocationStateDto();
            d.idLocation = m.getIdLocation();
            d.uuid = m.getUuid();
            d.flagAlreadyActived = m.getFlagAlreadyActived();
            d.clockCounter = m.getClockCounter();
            d.name = m.getName();
            return d;
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

    public static class RegistryEntryDto {
        private String uuid;
        private String key;
        private String stringValue;
        private Integer intValue;

        public static RegistryEntryDto fromModel(MatchRegistryEntry e) {
            RegistryEntryDto d = new RegistryEntryDto();
            d.uuid = e.getUuid();
            d.key = e.getKey();
            d.stringValue = e.getStringValue();
            d.intValue = e.getIntValue();
            return d;
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

    public static class EventOptionDto extends AbstractUuidNameDto {
        private String type;

        public static EventOptionDto fromModel(MatchEventOption m) {
            EventOptionDto d = new EventOptionDto();
            d.setUuid(m.getUuid());
            d.setName(m.getName());
            d.type = m.getType();
            return d;
        }
        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
    }

    /** Step 27.x — a player-occupied location with its card, neighbors and events. */
    public static class LocationInfoDto {
        private Long idLocation;
        private String uuid;
        private CardInfoResponse card;
        private List<LocationNeighborDto> neighbors = new ArrayList<>();
        private List<EventInfoDto> events = new ArrayList<>();

        public static LocationInfoDto fromModel(LocationInfo m) {
            LocationInfoDto d = new LocationInfoDto();
            d.idLocation = m.getIdLocation();
            d.uuid = m.getUuid();
            d.card = CardInfoResponse.fromModel(m.getCard());
            for (LocationNeighborInfo n : m.getNeighbors()) {
                d.neighbors.add(LocationNeighborDto.fromModel(n));
            }
            for (EventInfo e : m.getEvents()) {
                d.events.add(EventInfoDto.fromModel(e));
            }
            return d;
        }

        public Long getIdLocation() { return idLocation; }
        public void setIdLocation(Long idLocation) { this.idLocation = idLocation; }
        public String getUuid() { return uuid; }
        public void setUuid(String uuid) { this.uuid = uuid; }
        public CardInfoResponse getCard() { return card; }
        public void setCard(CardInfoResponse card) { this.card = card; }
        public List<LocationNeighborDto> getNeighbors() { return neighbors; }
        public void setNeighbors(List<LocationNeighborDto> neighbors) { this.neighbors = neighbors; }
        public List<EventInfoDto> getEvents() { return events; }
        public void setEvents(List<EventInfoDto> events) { this.events = events; }
    }

    /** A neighbor location reachable from a player-occupied location. */
    public static class LocationNeighborDto {
        private Long idLocation;
        private String uuid;
        private String direction;
        private Integer flagBack;
        private Integer energyCost;
        private CardInfoResponse card;

        public static LocationNeighborDto fromModel(LocationNeighborInfo m) {
            LocationNeighborDto d = new LocationNeighborDto();
            d.idLocation = m.getIdLocation();
            d.uuid = m.getUuid();
            d.direction = m.getDirection();
            d.flagBack = m.getFlagBack();
            d.energyCost = m.getEnergyCost();
            d.card = CardInfoResponse.fromModel(m.getCard());
            return d;
        }

        public Long getIdLocation() { return idLocation; }
        public void setIdLocation(Long idLocation) { this.idLocation = idLocation; }
        public String getUuid() { return uuid; }
        public void setUuid(String uuid) { this.uuid = uuid; }
        public String getDirection() { return direction; }
        public void setDirection(String direction) { this.direction = direction; }
        public Integer getFlagBack() { return flagBack; }
        public void setFlagBack(Integer flagBack) { this.flagBack = flagBack; }
        public Integer getEnergyCost() { return energyCost; }
        public void setEnergyCost(Integer energyCost) { this.energyCost = energyCost; }
        public CardInfoResponse getCard() { return card; }
        public void setCard(CardInfoResponse card) { this.card = card; }
    }

    /** An event available at a player-occupied location, with its card. */
    public static class EventInfoDto {
        private String uuid;
        private String type;
        private CardInfoResponse card;

        public static EventInfoDto fromModel(EventInfo m) {
            EventInfoDto d = new EventInfoDto();
            d.uuid = m.getUuid();
            d.type = m.getType();
            d.card = CardInfoResponse.fromModel(m.getCard());
            return d;
        }

        public String getUuid() { return uuid; }
        public void setUuid(String uuid) { this.uuid = uuid; }
        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public CardInfoResponse getCard() { return card; }
        public void setCard(CardInfoResponse card) { this.card = card; }
    }
}
