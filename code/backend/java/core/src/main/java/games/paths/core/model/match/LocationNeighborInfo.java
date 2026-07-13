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
 *
 * <p>{@code idLocationFrom}/{@code idLocationTo} expose the raw edge orientation
 * so a client can detect when the player stands on the {@code to} side and show
 * {@link #getCardBack()} (the optional "return" card) instead of {@link #getCard()}.
 * {@code cardBack} falls back to the forward card when the link defines no
 * dedicated {@code idCardBack}.</p>
 *
 * <p>{@code cardLocationFrom}/{@code cardLocationTo} carry the card of the
 * LOCATION sitting at each endpoint of the edge — distinct from {@code card}
 * (the authored LINK/movement card) and {@code cardBack} (the return LINK card).
 * Each is gated on its OWN fog-of-war flag: null until that location has been
 * visited. The active location is always visited (a character stands on it), so
 * the endpoint matching it is always resolved; the move destination is
 * {@code cardLocationFrom} when the player stands on {@code idLocationTo} and
 * {@code cardLocationTo} otherwise.</p>
 */
public class LocationNeighborInfo {

    private final Long idLocation;
    private final String uuid;
    private final String direction;
    private final Integer flagBack;
    private final Integer energyCost;
    private final CardInfo card;
    private final Integer secureParam;
    private final Long idLocationFrom;
    private final Long idLocationTo;
    private final CardInfo cardBack;
    private final CardInfo cardLocationFrom;
    private final CardInfo cardLocationTo;

    public LocationNeighborInfo(Long idLocation, String uuid, String direction,
                                Integer flagBack, Integer energyCost, CardInfo card,
                                Integer secureParam, Long idLocationFrom, Long idLocationTo,
                                CardInfo cardBack, CardInfo cardLocationFrom,
                                CardInfo cardLocationTo) {
        this.idLocation = idLocation;
        this.uuid = uuid;
        this.direction = direction;
        this.flagBack = flagBack;
        this.energyCost = energyCost;
        this.card = card;
        this.secureParam = secureParam;
        this.idLocationFrom = idLocationFrom;
        this.idLocationTo = idLocationTo;
        this.cardBack = cardBack;
        this.cardLocationFrom = cardLocationFrom;
        this.cardLocationTo = cardLocationTo;
    }

    public Long getIdLocation() { return idLocation; }
    public String getUuid() { return uuid; }
    public String getDirection() { return direction; }
    public Integer getFlagBack() { return flagBack; }
    public Integer getEnergyCost() { return energyCost; }
    public CardInfo getCard() { return card; }
    public Integer getSecureParam() { return secureParam; }
    public Long getIdLocationFrom() { return idLocationFrom; }
    public Long getIdLocationTo() { return idLocationTo; }
    public CardInfo getCardBack() { return cardBack; }
    public CardInfo getCardLocationFrom() { return cardLocationFrom; }
    public CardInfo getCardLocationTo() { return cardLocationTo; }
}
