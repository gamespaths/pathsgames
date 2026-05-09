package games.paths.adapters.rest.dto;

/**
 * DifficultyResponse - REST response DTO for a story difficulty level.
 */
public class DifficultyResponse extends AbstractUuidDescriptionDto {
    private int expCost;
    private int maxWeight;
    private int minCharacter;
    private int maxCharacter;
    private int costHelpComa;
    private int costMaxCharacteristics;
    private int numberMaxFreeAction;
    private Integer idCard;
    private CardInfoResponse card;

    public DifficultyResponse() {}

    public DifficultyResponse(String uuid, String description, int expCost, int maxWeight,
                              int minCharacter, int maxCharacter, int costHelpComa,
                              int costMaxCharacteristics, int numberMaxFreeAction) {
        super(uuid, description);
        this.expCost = expCost;
        this.maxWeight = maxWeight;
        this.minCharacter = minCharacter;
        this.maxCharacter = maxCharacter;
        this.costHelpComa = costHelpComa;
        this.costMaxCharacteristics = costMaxCharacteristics;
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

    public int getCostMaxCharacteristics() { return costMaxCharacteristics; }
    public void setCostMaxCharacteristics(int costMaxCharacteristics) { this.costMaxCharacteristics = costMaxCharacteristics; }

    public int getNumberMaxFreeAction() { return numberMaxFreeAction; }
    public void setNumberMaxFreeAction(int numberMaxFreeAction) { this.numberMaxFreeAction = numberMaxFreeAction; }

    public Integer getIdCard() { return idCard; }
    public void setIdCard(Integer idCard) { this.idCard = idCard; }

    public CardInfoResponse getCard() { return card; }
    public void setCard(CardInfoResponse card) { this.card = card; }
}
