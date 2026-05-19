package games.paths.core.model.story;

/**
 * TraitInfo - Domain model for a character trait summary.
 * Used within StoryDetail to describe available traits for a story.
 *
 * Stat fields (life, energy, sad, dexterity, intelligence, constitution, weight)
 * are signed deltas applied when the trait is picked. Added in v0.19.6.
 */
public class TraitInfo {

    private final String uuid;
    private final String name;
    private final String description;
    private final int costPositive;
    private final int costNegative;
    private final Integer idClassPermitted;
    private final Integer idClassProhibited;
    private final Integer idCard;
    private final CardInfo card;
    private final int life;
    private final int energy;
    private final int sad;
    private final int dexterity;
    private final int intelligence;
    private final int constitution;
    private final int weight;

    private TraitInfo(Builder builder) {
        this.uuid = builder.uuid;
        this.name = builder.name;
        this.description = builder.description;
        this.costPositive = builder.costPositive;
        this.costNegative = builder.costNegative;
        this.idClassPermitted = builder.idClassPermitted;
        this.idClassProhibited = builder.idClassProhibited;
        this.idCard = builder.idCard;
        this.card = builder.card;
        this.life = builder.life;
        this.energy = builder.energy;
        this.sad = builder.sad;
        this.dexterity = builder.dexterity;
        this.intelligence = builder.intelligence;
        this.constitution = builder.constitution;
        this.weight = builder.weight;
    }

    public String getUuid() { return uuid; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public int getCostPositive() { return costPositive; }
    public int getCostNegative() { return costNegative; }
    public Integer getIdClassPermitted() { return idClassPermitted; }
    public Integer getIdClassProhibited() { return idClassProhibited; }
    public Integer getIdCard() { return idCard; }
    public CardInfo getCard() { return card; }
    public int getLife() { return life; }
    public int getEnergy() { return energy; }
    public int getSad() { return sad; }
    public int getDexterity() { return dexterity; }
    public int getIntelligence() { return intelligence; }
    public int getConstitution() { return constitution; }
    public int getWeight() { return weight; }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private String uuid;
        private String name;
        private String description;
        private int costPositive;
        private int costNegative;
        private Integer idClassPermitted;
        private Integer idClassProhibited;
        private Integer idCard;
        private CardInfo card;
        private int life;
        private int energy;
        private int sad;
        private int dexterity;
        private int intelligence;
        private int constitution;
        private int weight;

        public Builder uuid(String uuid) { this.uuid = uuid; return this; }
        public Builder name(String name) { this.name = name; return this; }
        public Builder description(String description) { this.description = description; return this; }
        public Builder costPositive(int costPositive) { this.costPositive = costPositive; return this; }
        public Builder costNegative(int costNegative) { this.costNegative = costNegative; return this; }
        public Builder idClassPermitted(Integer idClassPermitted) { this.idClassPermitted = idClassPermitted; return this; }
        public Builder idClassProhibited(Integer idClassProhibited) { this.idClassProhibited = idClassProhibited; return this; }
        public Builder idCard(Integer idCard) { this.idCard = idCard; return this; }
        public Builder card(CardInfo card) { this.card = card; return this; }
        public Builder life(int life) { this.life = life; return this; }
        public Builder energy(int energy) { this.energy = energy; return this; }
        public Builder sad(int sad) { this.sad = sad; return this; }
        public Builder dexterity(int dexterity) { this.dexterity = dexterity; return this; }
        public Builder intelligence(int intelligence) { this.intelligence = intelligence; return this; }
        public Builder constitution(int constitution) { this.constitution = constitution; return this; }
        public Builder weight(int weight) { this.weight = weight; return this; }

        public TraitInfo build() {
            return new TraitInfo(this);
        }
    }

    @Override
    public String toString() {
        return "TraitInfo{uuid='" + uuid + "', name='" + name + "'}";
    }
}
