package games.paths.core.model.match;

import games.paths.core.model.story.CardInfo;

/**
 * LocationNeighborInfo - Domain model for a location reachable from a
 * player-occupied location. Returned inside {@link LocationInfo#getNeighbors()}
 * of the enriched match-info payload.
 *
 * <p>{@code idLocation}/{@code uuid} identify the <em>other</em> endpoint of the
 * neighbor link (the destination relative to the active location). The
 * {@link CardInfo} is resolved from the neighbor link's own card, falling back
 * to the destination location's card.</p>
 */
public class LocationNeighborInfo {

    private final Long idLocation;
    private final String uuid;
    private final String direction;
    private final Integer flagBack;
    private final Integer energyCost;
    private final CardInfo card;

    public LocationNeighborInfo(Long idLocation, String uuid, String direction,
                                Integer flagBack, Integer energyCost, CardInfo card) {
        this.idLocation = idLocation;
        this.uuid = uuid;
        this.direction = direction;
        this.flagBack = flagBack;
        this.energyCost = energyCost;
        this.card = card;
    }

    public Long getIdLocation() { return idLocation; }
    public String getUuid() { return uuid; }
    public String getDirection() { return direction; }
    public Integer getFlagBack() { return flagBack; }
    public Integer getEnergyCost() { return energyCost; }
    public CardInfo getCard() { return card; }
}
