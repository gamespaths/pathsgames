package games.paths.adapters.rest.dto;

/**
 * DifficultyResponse - REST response DTO for a story difficulty level.
 * The seven stat fields live in {@link AbstractStatBlockUuidDescriptionDto}.
 */
public class DifficultyResponse extends AbstractStatBlockUuidDescriptionDto {
    private int expCost;
    private int maxWeight;
    private int minCharacter;
    private int maxCharacter;
    private int costHelpComa;
    /** Step 38 — use-exp flat cost addend and DEX/INT/COS cap (0 = none). */
    private int expCostBase;
    private int maxStatValue;
    private int numberMaxFreeAction;
    private Integer idCard;
    private CardInfoResponse card;
    /** Step 23 — trait cost budgets; null = no limit. */
    private Integer traitCostPositiveBudget;
    private Integer traitCostNegativeBudget;

    public DifficultyResponse() {}

    public DifficultyResponse(String uuid, String description, int expCost, int maxWeight,
                              int minCharacter, int maxCharacter, int costHelpComa,
                              int expCostBase, int maxStatValue, int numberMaxFreeAction) {
        super(uuid, description);
        this.expCost = expCost;
        this.maxWeight = maxWeight;
        this.minCharacter = minCharacter;
        this.maxCharacter = maxCharacter;
        this.costHelpComa = costHelpComa;
        this.expCostBase = expCostBase;
        this.maxStatValue = maxStatValue;
        this.numberMaxFreeAction = numberMaxFreeAction;
    }

    public int getExpCost() { return expCost; }
    public void setExpCost(int expCost) { this.expCost = expCost; }

    public int getMaxWeight() { return maxWeight; }
    public void setMaxWeight(int maxWeight) { this.maxWeight = maxWeight; }

    public int getMinCharacter() { return minCharacter; }
    public void setMinCharacter(int minCharacter) { this.minCharacter = minCharacter; }

    public int getMaxCharacter() { return maxCharacter; }
    public void setMaxCharacter(int maxCharacter) { this.maxCharacter = maxCharacter; }

    public int getCostHelpComa() { return costHelpComa; }
    public void setCostHelpComa(int costHelpComa) { this.costHelpComa = costHelpComa; }

    public int getExpCostBase() { return expCostBase; }
    public void setExpCostBase(int expCostBase) { this.expCostBase = expCostBase; }

    public int getMaxStatValue() { return maxStatValue; }
    public void setMaxStatValue(int maxStatValue) { this.maxStatValue = maxStatValue; }

    public int getNumberMaxFreeAction() { return numberMaxFreeAction; }
    public void setNumberMaxFreeAction(int numberMaxFreeAction) { this.numberMaxFreeAction = numberMaxFreeAction; }

    public Integer getIdCard() { return idCard; }
    public void setIdCard(Integer idCard) { this.idCard = idCard; }

    public CardInfoResponse getCard() { return card; }
    public void setCard(CardInfoResponse card) { this.card = card; }

    public Integer getTraitCostPositiveBudget() { return traitCostPositiveBudget; }
    public void setTraitCostPositiveBudget(Integer traitCostPositiveBudget) { this.traitCostPositiveBudget = traitCostPositiveBudget; }

    public Integer getTraitCostNegativeBudget() { return traitCostNegativeBudget; }
    public void setTraitCostNegativeBudget(Integer traitCostNegativeBudget) { this.traitCostNegativeBudget = traitCostNegativeBudget; }
}
