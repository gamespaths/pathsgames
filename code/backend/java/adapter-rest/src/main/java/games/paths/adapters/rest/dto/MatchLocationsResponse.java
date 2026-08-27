package games.paths.adapters.rest.dto;

import games.paths.core.port.match.MovementPort;

import java.util.ArrayList;
import java.util.List;

/**
 * Response for {@code GET /api/match/{uuidMatch}/locations} (Step 28): the visited
 * locations of a match, each with its current character count and the per-neighbor
 * {@code totalEnergyCost} resolved for the current weather.
 */
public class MatchLocationsResponse {

    private String matchUuid;
    private List<LocationView> locations = new ArrayList<>();

    public static MatchLocationsResponse fromModel(String matchUuid,
                                                   List<MovementPort.VisitedLocation> model) {
        MatchLocationsResponse r = new MatchLocationsResponse();
        r.matchUuid = matchUuid;
        if (model != null) {
            for (MovementPort.VisitedLocation l : model) {
                r.locations.add(LocationView.fromModel(l));
            }
        }
        return r;
    }

    public String getMatchUuid() { return matchUuid; }
    public List<LocationView> getLocations() { return locations; }

    /** A visited location with character count, its resolved card and move-cost neighbors. */
    public static class LocationView {
        private long idLocation;
        private String uuid;
        private Integer idCard;
        private CardInfoResponse card;
        private boolean safe;
        private int characterCount;
        private List<NeighborView> neighbors = new ArrayList<>();

        static LocationView fromModel(MovementPort.VisitedLocation l) {
            LocationView v = new LocationView();
            v.idLocation = l.idLocation();
            v.uuid = l.uuid();
            v.idCard = l.idCard();
            v.card = CardInfoResponse.fromModel(l.card());
            v.safe = l.safe();
            v.characterCount = l.characterCount();
            if (l.neighbors() != null) {
                for (MovementPort.NeighborCost n : l.neighbors()) {
                    v.neighbors.add(NeighborView.fromModel(n));
                }
            }
            return v;
        }

        public long getIdLocation() { return idLocation; }
        public String getUuid() { return uuid; }
        public Integer getIdCard() { return idCard; }
        public CardInfoResponse getCard() { return card; }
        public boolean isSafe() { return safe; }
        public int getCharacterCount() { return characterCount; }
        public List<NeighborView> getNeighbors() { return neighbors; }
    }

    /**
     * A neighbor edge with the resolved energy-cost breakdown:
     * baseEnergyCost (edge) + entryEnergyCost (target entry) + weatherEnergyCost = totalEnergyCost.
     *
     * <p>{@code direction} is the AUTHORED direction (idLocationFrom → idLocationTo), so a
     * two-way edge reports the same value from both endpoints. Clients that need the
     * TRAVERSAL direction flip it when the listing location is {@code idLocationTo}.</p>
     */
    public static class NeighborView {
        private long idLocation;
        private String uuid;
        private String direction;
        private long idLocationFrom;
        private long idLocationTo;
        private Integer idCard;
        private CardInfoResponse card;
        private int baseEnergyCost;
        private int entryEnergyCost;
        private int weatherEnergyCost;
        private int totalEnergyCost;
        /** v0.35.3 — the EDGE's resource price; one source, so there is no breakdown. */
        private int costFood;
        private int costMagic;
        private int costCoin;
        private boolean conditionMet;

        static NeighborView fromModel(MovementPort.NeighborCost n) {
            NeighborView v = new NeighborView();
            v.idLocation = n.idLocation();
            v.uuid = n.uuid();
            v.direction = n.direction();
            v.idLocationFrom = n.idLocationFrom();
            v.idLocationTo = n.idLocationTo();
            v.idCard = n.idCard();
            v.card = CardInfoResponse.fromModel(n.card());
            v.baseEnergyCost = n.baseEnergyCost();
            v.entryEnergyCost = n.entryEnergyCost();
            v.weatherEnergyCost = n.weatherEnergyCost();
            v.totalEnergyCost = n.totalEnergyCost();
            v.costFood = n.costFood();
            v.costMagic = n.costMagic();
            v.costCoin = n.costCoin();
            v.conditionMet = n.conditionMet();
            return v;
        }

        public long getIdLocation() { return idLocation; }
        public String getUuid() { return uuid; }
        public String getDirection() { return direction; }
        public long getIdLocationFrom() { return idLocationFrom; }
        public long getIdLocationTo() { return idLocationTo; }
        public Integer getIdCard() { return idCard; }
        public CardInfoResponse getCard() { return card; }
        public int getBaseEnergyCost() { return baseEnergyCost; }
        public int getEntryEnergyCost() { return entryEnergyCost; }
        public int getWeatherEnergyCost() { return weatherEnergyCost; }
        public int getTotalEnergyCost() { return totalEnergyCost; }
        public int getCostFood() { return costFood; }
        public int getCostMagic() { return costMagic; }
        public int getCostCoin() { return costCoin; }
        public boolean isConditionMet() { return conditionMet; }
    }
}
