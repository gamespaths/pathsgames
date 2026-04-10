package games.paths.core.model.story;

/**
 * DifficultyInfo - Domain model for a story difficulty level.
 * Used within StoryDetail to describe available difficulty settings.
 */
public class DifficultyInfo {

    private final String uuid;
    private final String description;
    private final int expCost;
    private final int maxWeight;
    private final int minCharacter;
    private final int maxCharacter;
    private final int costHelpComa;
    private final int costMaxCharacteristics;
    private final int numberMaxFreeAction;

    private DifficultyInfo(Builder builder) {
        this.uuid = builder.uuid;
        this.description = builder.description;
        this.expCost = builder.expCost;
        this.maxWeight = builder.maxWeight;
        this.minCharacter = builder.minCharacter;
        this.maxCharacter = builder.maxCharacter;
        this.costHelpComa = builder.costHelpComa;
        this.costMaxCharacteristics = builder.costMaxCharacteristics;
        this.numberMaxFreeAction = builder.numberMaxFreeAction;
    }

    public String getUuid() { return uuid; }
    public String getDescription() { return description; }
    public int getExpCost() { return expCost; }
    public int getMaxWeight() { return maxWeight; }
    public int getMinCharacter() { return minCharacter; }
    public int getMaxCharacter() { return maxCharacter; }
    public int getCostHelpComa() { return costHelpComa; }
    public int getCostMaxCharacteristics() { return costMaxCharacteristics; }
    public int getNumberMaxFreeAction() { return numberMaxFreeAction; }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private String uuid;
        private String description;
        private int expCost;
        private int maxWeight;
        private int minCharacter;
        private int maxCharacter;
        private int costHelpComa;
        private int costMaxCharacteristics;
        private int numberMaxFreeAction;

        public Builder uuid(String uuid) { this.uuid = uuid; return this; }
        public Builder description(String description) { this.description = description; return this; }
        public Builder expCost(int expCost) { this.expCost = expCost; return this; }
        public Builder maxWeight(int maxWeight) { this.maxWeight = maxWeight; return this; }
        public Builder minCharacter(int minCharacter) { this.minCharacter = minCharacter; return this; }
        public Builder maxCharacter(int maxCharacter) { this.maxCharacter = maxCharacter; return this; }
        public Builder costHelpComa(int costHelpComa) { this.costHelpComa = costHelpComa; return this; }
        public Builder costMaxCharacteristics(int costMaxCharacteristics) { this.costMaxCharacteristics = costMaxCharacteristics; return this; }
        public Builder numberMaxFreeAction(int numberMaxFreeAction) { this.numberMaxFreeAction = numberMaxFreeAction; return this; }

        public DifficultyInfo build() {
            return new DifficultyInfo(this);
        }
    }

    @Override
    public String toString() {
        return "DifficultyInfo{uuid='" + uuid + "', expCost=" + expCost + "}";
    }
}
