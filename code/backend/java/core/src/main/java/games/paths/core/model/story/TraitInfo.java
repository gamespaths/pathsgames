package games.paths.core.model.story;

/**
 * TraitInfo - Domain model for a character trait summary.
 * Used within StoryDetail to describe available traits for a story.
 *
 * The seven stat-delta fields live in {@link AbstractStatInfo} (added v0.19.6)
 * and represent signed deltas applied when the trait is picked.
 */
public class TraitInfo extends AbstractStatInfo {

    private final String uuid;
    private final String name;
    private final String description;
    private final int costPositive;
    private final int costNegative;
    private final Integer idClassPermitted;
    private final Integer idClassProhibited;
    private final Integer idCard;
    private final CardInfo card;
    /**
     * v0.35.2 - reported, never filtered: the API answers hidden traits too, because the
     * same list resolves the traits a character already HAS. Only the start-match picker
     * hides them, and only there.
     */
    private final boolean hideOnStartMatch;

    private TraitInfo(Builder builder) {
        super(builder);
        this.uuid = builder.uuid;
        this.name = builder.name;
        this.description = builder.description;
        this.costPositive = builder.costPositive;
        this.costNegative = builder.costNegative;
        this.idClassPermitted = builder.idClassPermitted;
        this.idClassProhibited = builder.idClassProhibited;
        this.idCard = builder.idCard;
        this.card = builder.card;
        this.hideOnStartMatch = builder.hideOnStartMatch;
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
    public boolean isHideOnStartMatch() { return hideOnStartMatch; }

    public static Builder builder() { return new Builder(); }

    public static class Builder extends AbstractStatInfoBuilder<Builder> {
        private String uuid;
        private String name;
        private String description;
        private int costPositive;
        private int costNegative;
        private Integer idClassPermitted;
        private Integer idClassProhibited;
        private Integer idCard;
        private CardInfo card;
        private boolean hideOnStartMatch;

        @Override
        protected Builder self() { return this; }

        public Builder uuid(String uuid) { this.uuid = uuid; return this; }
        public Builder name(String name) { this.name = name; return this; }
        public Builder description(String description) { this.description = description; return this; }
        public Builder costPositive(int costPositive) { this.costPositive = costPositive; return this; }
        public Builder costNegative(int costNegative) { this.costNegative = costNegative; return this; }
        public Builder idClassPermitted(Integer idClassPermitted) { this.idClassPermitted = idClassPermitted; return this; }
        public Builder idClassProhibited(Integer idClassProhibited) { this.idClassProhibited = idClassProhibited; return this; }
        public Builder idCard(Integer idCard) { this.idCard = idCard; return this; }
        public Builder card(CardInfo card) { this.card = card; return this; }
        public Builder hideOnStartMatch(boolean hideOnStartMatch) { this.hideOnStartMatch = hideOnStartMatch; return this; }

        public TraitInfo build() {
            return new TraitInfo(this);
        }
    }

    @Override
    public String toString() {
        return "TraitInfo{uuid='" + uuid + "', name='" + name + "'}";
    }
}
