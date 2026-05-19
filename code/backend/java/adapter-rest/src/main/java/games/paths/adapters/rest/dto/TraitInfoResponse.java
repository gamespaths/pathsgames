package games.paths.adapters.rest.dto;

/**
 * TraitInfoResponse - REST response DTO for a character trait.
 *
 * Stat fields (life, energy, sad, dexterity, intelligence, constitution, weight)
 * live in {@link AbstractStatBlockUuidDescriptionDto} (v0.19.6 onwards). They
 * represent signed deltas applied to a character when the trait is selected.
 *
 * The {@code name} field is declared here directly so the response can keep
 * the uuid + name + description triplet of the previous shape.
 */
public class TraitInfoResponse extends AbstractStatBlockUuidDescriptionDto {
    private String name;
    private int costPositive;
    private int costNegative;
    private Integer idClassPermitted;
    private Integer idClassProhibited;
    private Integer idCard;
    private CardInfoResponse card;

    public TraitInfoResponse() {}

    public TraitInfoResponse(String uuid, String name, String description,
                             int costPositive, int costNegative,
                             Integer idClassPermitted, Integer idClassProhibited) {
        super(uuid, description);
        this.name = name;
        this.costPositive = costPositive;
        this.costNegative = costNegative;
        this.idClassPermitted = idClassPermitted;
        this.idClassProhibited = idClassProhibited;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public int getCostPositive() { return costPositive; }
    public void setCostPositive(int costPositive) { this.costPositive = costPositive; }

    public int getCostNegative() { return costNegative; }
    public void setCostNegative(int costNegative) { this.costNegative = costNegative; }

    public Integer getIdClassPermitted() { return idClassPermitted; }
    public void setIdClassPermitted(Integer idClassPermitted) { this.idClassPermitted = idClassPermitted; }

    public Integer getIdClassProhibited() { return idClassProhibited; }
    public void setIdClassProhibited(Integer idClassProhibited) { this.idClassProhibited = idClassProhibited; }

    public Integer getIdCard() { return idCard; }
    public void setIdCard(Integer idCard) { this.idCard = idCard; }

    public CardInfoResponse getCard() { return card; }
    public void setCard(CardInfoResponse card) { this.card = card; }
}
