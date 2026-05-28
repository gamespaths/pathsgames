package games.paths.adapters.rest.dto;

/**
 * ClassBonusInfoResponse - REST response DTO for a single class bonus row.
 */
public class ClassBonusInfoResponse {

    private String uuid;
    private String statistic;
    private int value;

    public ClassBonusInfoResponse() {}

    public ClassBonusInfoResponse(String uuid, String statistic, int value) {
        this.uuid = uuid;
        this.statistic = statistic;
        this.value = value;
    }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public String getStatistic() { return statistic; }
    public void setStatistic(String statistic) { this.statistic = statistic; }

    public int getValue() { return value; }
    public void setValue(int value) { this.value = value; }
}
