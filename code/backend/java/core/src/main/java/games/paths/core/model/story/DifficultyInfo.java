package games.paths.core.model.story;

/**
 * DifficultyInfo - Domain model for a story difficulty level.
 * Used within StoryDetail to describe available difficulty settings.
 *
 * The seven stat fields live in {@link AbstractStatInfo}.
 */
public class DifficultyInfo extends AbstractStatInfo {

    private final String uuid;
    private final String description;
    private final int expCost;
    private final int maxWeight;
    private final int minCharacter;
    private final int maxCharacter;
    private final int costHelpComa;
    private final int costMaxCharacteristics;
    private final int numberMaxFreeAction;
    private final Integer idCard;
    private final CardInfo card;
    /** Step 23 — trait cost budgets; null = no limit. */
    private final Integer traitCostPositiveBudget;
    private final Integer traitCostNegativeBudget;

    private DifficultyInfo(Builder builder) {
        super(builder);
        this.uuid = builder.uuid;
        this.description = builder.description;
        this.expCost = builder.expCost;
        this.maxWeight = builder.maxWeight;
        this.minCharacter = builder.minCharacter;
        this.maxCharacter = builder.maxCharacter;
        this.costHelpComa = builder.costHelpComa;
        this.costMaxCharacteristics = builder.costMaxCharacteristics;
        this.numberMaxFreeAction = builder.numberMaxFreeAction;
        this.idCard = builder.idCard;
        this.card = builder.card;
        this.traitCostPositiveBudget = builder.traitCostPositiveBudget;
        this.traitCostNegativeBudget = builder.traitCostNegativeBudget;
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
    public Integer getIdCard() { return idCard; }
    public CardInfo getCard() { return card; }
    public Integer getTraitCostPositiveBudget() { return traitCostPositiveBudget; }
    public Integer getTraitCostNegativeBudget() { return traitCostNegativeBudget; }

    public static Builder builder() { return new Builder(); }

    public static class Builder extends AbstractStatInfoBuilder<Builder> {
        private String uuid;
        private String description;
        private int expCost;
        private int maxWeight;
        private int minCharacter;
        private int maxCharacter;
        private int costHelpComa;
        private int costMaxCharacteristics;
        private int numberMaxFreeAction;
        private Integer idCard;
        private CardInfo card;
        private Integer traitCostPositiveBudget;
        private Integer traitCostNegativeBudget;

        @Override
        protected Builder self() { return this; }

        public Builder uuid(String uuid) { this.uuid = uuid; return this; }
        public Builder description(String description) { this.description = description; return this; }
        public Builder expCost(int expCost) { this.expCost = expCost; return this; }
        public Builder maxWeight(int maxWeight) { this.maxWeight = maxWeight; return this; }
        public Builder minCharacter(int minCharacter) { this.minCharacter = minCharacter; return this; }
        public Builder maxCharacter(int maxCharacter) { this.maxCharacter = maxCharacter; return this; }
        public Builder costHelpComa(int costHelpComa) { this.costHelpComa = costHelpComa; return this; }
        public Builder costMaxCharacteristics(int costMaxCharacteristics) { this.costMaxCharacteristics = costMaxCharacteristics; return this; }
        public Builder numberMaxFreeAction(int numberMaxFreeAction) { this.numberMaxFreeAction = numberMaxFreeAction; return this; }
        public Builder idCard(Integer idCard) { this.idCard = idCard; return this; }
        public Builder card(CardInfo card) { this.card = card; return this; }
        public Builder traitCostPositiveBudget(Integer v) { this.traitCostPositiveBudget = v; return this; }
        public Builder traitCostNegativeBudget(Integer v) { this.traitCostNegativeBudget = v; return this; }

        public DifficultyInfo build() {
            return new DifficultyInfo(this);
        }
    }

    @Override
    public String toString() {
        return "DifficultyInfo{uuid='" + uuid + "', expCost=" + expCost + "}";
    }
}
