package games.paths.core.model.match;

import games.paths.core.model.story.CardInfo;

import java.util.ArrayList;
import java.util.List;

/**
 * LocationInfo - Domain model for a location occupied by at least one player,
 * enriched with its visual {@link CardInfo}, its reachable neighbors and the
 * events available there. Returned in {@link MatchDetail#getLocationsActive()}.
 *
 * <p>Step 27.x — feeds the game board left page (current location) plus the
 * neighbor/event cards. Only locations carrying one or more players are
 * included; neighbors and events are filtered to that location.</p>
 */
public class LocationInfo {

    private final Long idLocation;
    private final String uuid;
    private final CardInfo card;
    private final List<LocationNeighborInfo> neighbors;
    private final List<EventInfo> events;

    public LocationInfo(Long idLocation, String uuid, CardInfo card,
                        List<LocationNeighborInfo> neighbors, List<EventInfo> events) {
        this.idLocation = idLocation;
        this.uuid = uuid;
        this.card = card;
        this.neighbors = neighbors != null ? neighbors : new ArrayList<>();
        this.events = events != null ? events : new ArrayList<>();
    }

    public Long getIdLocation() { return idLocation; }
    public String getUuid() { return uuid; }
    public CardInfo getCard() { return card; }
    public List<LocationNeighborInfo> getNeighbors() { return neighbors; }
    public List<EventInfo> getEvents() { return events; }
}
