package games.paths.core.model.match;

/**
 * LogTable - the log_* tables whose id is globally unique (UNIQUE(id)) and handed
 * out by {@link games.paths.core.port.match.LogIdPort}.
 */
public enum LogTable {
    EVENTS("log_events"),
    MOVEMENTS("log_movements"),
    ITEM_USAGE("log_item_usage"),
    WEATHER("log_weather"),
    CLOCK_HISTORY("log_clock_history"),
    CHOICES_EXECUTED("log_choices_executed");

    private final String tableName;

    LogTable(String tableName) {
        this.tableName = tableName;
    }

    public String tableName() {
        return tableName;
    }

    /** The PostgreSQL sequence BIGSERIAL created for the id column. */
    public String sequenceName() {
        return tableName + "_id_seq";
    }
}
