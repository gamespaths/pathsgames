package games.paths.adapters.rest.dto;

/**
 * DifficultyResponse - REST response DTO for a story difficulty level.
 */
public class DifficultyResponse {

    private String uuid;
    private String description;
    private int expCost;
    private int maxWeight;
    private int minCharacter;
    private int maxCharacter;
    private int costHelpComa;
    private int costMaxCharacteristics;
    private int numberMaxFreeAction;

    public DifficultyResponse() {}

    public DifficultyResponse(String uuid, String description, int expCost, int maxWeight,
                              int minCharacter, int maxCharacter, int costHelpComa,
                              int costMaxCharacteristics, int numberMaxFreeAction) {
        this.uuid = uuid;
        this.description = description;
        this.expCost = expCost;
        this.maxWeight = maxWeight;
        this.minCharacter = minCharacter;
        this.maxCharacter = maxCharacter;
        this.costHelpComa = costHelpComa;
        this.costMaxCharacteristics = costMaxCharacteristics;
        this.numberMaxFreeAction = numberMaxFreeAction;
    }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

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
}
