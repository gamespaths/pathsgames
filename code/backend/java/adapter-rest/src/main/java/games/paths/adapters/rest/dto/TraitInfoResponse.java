package games.paths.adapters.rest.dto;

/**
 * TraitInfoResponse - REST response DTO for a character trait.
 *
 * Stat fields (life, energy, sad, dexterity, intelligence, constitution, weight)
 * were added in v0.19.6 and represent signed deltas applied to a character
 * when the trait is selected.
 */
public class TraitInfoResponse extends AbstractUuidNameDescriptionDto {
    private int costPositive;
    private int costNegative;
    private Integer idClassPermitted;
    private Integer idClassProhibited;
    private Integer idCard;
    private CardInfoResponse card;
    private int life;
    private int energy;
    private int sad;
    private int dexterity;
    private int intelligence;
    private int constitution;
    private int weight;

    public TraitInfoResponse() {}

    public TraitInfoResponse(String uuid, String name, String description,
                             int costPositive, int costNegative,
                             Integer idClassPermitted, Integer idClassProhibited) {
        super(uuid, name, description);
        this.costPositive = costPositive;
        this.costNegative = costNegative;
        this.idClassPermitted = idClassPermitted;
        this.idClassProhibited = idClassProhibited;
    }

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

    public int getLife() { return life; }
    public void setLife(int life) { this.life = life; }

    public int getEnergy() { return energy; }
    public void setEnergy(int energy) { this.energy = energy; }

    public int getSad() { return sad; }
    public void setSad(int sad) { this.sad = sad; }

    public int getDexterity() { return dexterity; }
    public void setDexterity(int dexterity) { this.dexterity = dexterity; }

    public int getIntelligence() { return intelligence; }
    public void setIntelligence(int intelligence) { this.intelligence = intelligence; }

    public int getConstitution() { return constitution; }
    public void setConstitution(int constitution) { this.constitution = constitution; }

    public int getWeight() { return weight; }
    public void setWeight(int weight) { this.weight = weight; }
}
