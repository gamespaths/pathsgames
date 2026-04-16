package games.paths.core.model.story;

/**
 * TraitInfo - Domain model for a character trait summary.
 * Used within StoryDetail to describe available traits for a story.
 */
public class TraitInfo {

    private final String uuid;
    private final String name;
    private final String description;
    private final int costPositive;
    private final int costNegative;
    private final Integer idClassPermitted;
    private final Integer idClassProhibited;

    private TraitInfo(Builder builder) {
        this.uuid = builder.uuid;
        this.name = builder.name;
        this.description = builder.description;
        this.costPositive = builder.costPositive;
        this.costNegative = builder.costNegative;
        this.idClassPermitted = builder.idClassPermitted;
        this.idClassProhibited = builder.idClassProhibited;
    }

    public String getUuid() { return uuid; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public int getCostPositive() { return costPositive; }
    public int getCostNegative() { return costNegative; }
    public Integer getIdClassPermitted() { return idClassPermitted; }
    public Integer getIdClassProhibited() { return idClassProhibited; }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private String uuid;
        private String name;
        private String description;
        private int costPositive;
        private int costNegative;
        private Integer idClassPermitted;
        private Integer idClassProhibited;

        public Builder uuid(String uuid) { this.uuid = uuid; return this; }
        public Builder name(String name) { this.name = name; return this; }
        public Builder description(String description) { this.description = description; return this; }
        public Builder costPositive(int costPositive) { this.costPositive = costPositive; return this; }
        public Builder costNegative(int costNegative) { this.costNegative = costNegative; return this; }
        public Builder idClassPermitted(Integer idClassPermitted) { this.idClassPermitted = idClassPermitted; return this; }
        public Builder idClassProhibited(Integer idClassProhibited) { this.idClassProhibited = idClassProhibited; return this; }

        public TraitInfo build() {
            return new TraitInfo(this);
        }
    }

    @Override
    public String toString() {
        return "TraitInfo{uuid='" + uuid + "', name='" + name + "'}";
    }
}
