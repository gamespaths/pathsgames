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
    private final boolean available;
    private final String reason;
    private final Integer costFood;
    private final Integer costMagic;
    private final Integer costCoin;

    /** Backwards-compatible: a neighbor with no verdict reads as available. */
    public LocationNeighborInfo(Long idLocation, String uuid, String direction,
                                Integer flagBack, Integer energyCost, CardInfo card,
                                Integer secureParam, Long idLocationFrom, Long idLocationTo,
                                CardInfo cardBack, CardInfo cardLocationFrom,
                                CardInfo cardLocationTo) {
        this(idLocation, uuid, direction, flagBack, energyCost, card, secureParam,
                idLocationFrom, idLocationTo, cardBack, cardLocationFrom, cardLocationTo,
                true, null);
    }

    @SuppressWarnings("java:S107")
    public LocationNeighborInfo(Long idLocation, String uuid, String direction,
                                Integer flagBack, Integer energyCost, CardInfo card,
                                Integer secureParam, Long idLocationFrom, Long idLocationTo,
                                CardInfo cardBack, CardInfo cardLocationFrom,
                                CardInfo cardLocationTo,
                                boolean available, String reason) {
        this(idLocation, uuid, direction, flagBack, energyCost, card, secureParam,
                idLocationFrom, idLocationTo, cardBack, cardLocationFrom, cardLocationTo,
                available, reason, 0, 0, 0);
    }

    /** v0.35.3 — same edge, with the resource price it now carries. */
    @SuppressWarnings("java:S107")
    public LocationNeighborInfo(Long idLocation, String uuid, String direction,
                                Integer flagBack, Integer energyCost, CardInfo card,
                                Integer secureParam, Long idLocationFrom, Long idLocationTo,
                                CardInfo cardBack, CardInfo cardLocationFrom,
                                CardInfo cardLocationTo,
                                boolean available, String reason,
                                Integer costFood, Integer costMagic, Integer costCoin) {
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
        this.available = available;
        this.reason = reason;
        this.costFood = costFood;
        this.costMagic = costMagic;
        this.costCoin = costCoin;
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

    /**
     * Whether the reference character can take this path right now, and — when it cannot —
     * the {@code MovementPort.MovementException.Code} the move endpoint would answer with
     * (COMA, SLEEPING, INSUFFICIENT_ENERGY, …). Same verdict, same code, one source:
     * {@code MovementAvailabilityChecker}. Null reason when the move is allowed.
     */
    public boolean isAvailable() { return available; }
    public String getReason() { return reason; }

    /**
     * v0.35.3 — what the EDGE costs in resources. Energy sums three sources and is
     * reported pre-summed in {@link #getEnergyCost()}; these have one source, so what the
     * client reads here is exactly what the move will take.
     */
    public Integer getCostFood() { return costFood; }
    public Integer getCostMagic() { return costMagic; }
    public Integer getCostCoin() { return costCoin; }
}
