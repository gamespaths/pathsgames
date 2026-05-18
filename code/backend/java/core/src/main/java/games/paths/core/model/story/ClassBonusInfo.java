package games.paths.core.model.story;

/**
 * ClassBonusInfo - Domain model for a single class bonus row.
 * Nested under ClassInfo to expose the `list_classes_bonus` rows on the public API.
 */
public class ClassBonusInfo {

    private final String uuid;
    private final String statistic;
    private final int value;

    private ClassBonusInfo(Builder builder) {
        this.uuid = builder.uuid;
        this.statistic = builder.statistic;
        this.value = builder.value;
    }

    public String getUuid() { return uuid; }
    public String getStatistic() { return statistic; }
    public int getValue() { return value; }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private String uuid;
        private String statistic;
        private int value;

        public Builder uuid(String uuid) { this.uuid = uuid; return this; }
        public Builder statistic(String statistic) { this.statistic = statistic; return this; }
        public Builder value(int value) { this.value = value; return this; }

        public ClassBonusInfo build() {
            return new ClassBonusInfo(this);
        }
    }

    @Override
    public String toString() {
        return "ClassBonusInfo{statistic='" + statistic + "', value=" + value + "}";
    }
}
