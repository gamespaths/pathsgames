package games.paths.adapters.rest.dto;

import games.paths.core.port.match.TimeAdvancementPort;

import java.util.ArrayList;
import java.util.List;

/**
 * TimeStartWeatherResponse - the weather in force after a time-start an action forced (Step 40).
 * Same fields as {@link WeatherResponse}, plus {@code changed} (differs from the weather before).
 */
public class TimeStartWeatherResponse {

    private Long idWeather;
    private String uuid;
    private CardInfoResponse card;
    private Integer deltaEnergy;
    private Integer costMoveSafeLocation;
    private Integer costMoveNotSafeLocation;
    private boolean changed;

    /** Null in, null out: no forced time-end, or no eligible weather. */
    public static TimeStartWeatherResponse fromModel(TimeAdvancementPort.TimeStartWeather w) {
        if (w == null) {
            return null;
        }
        TimeStartWeatherResponse r = new TimeStartWeatherResponse();
        r.idWeather = w.idWeather();
        r.uuid = w.uuid();
        r.card = CardInfoResponse.fromModel(w.card());
        r.deltaEnergy = w.deltaEnergy();
        r.costMoveSafeLocation = w.costMoveSafeLocation();
        r.costMoveNotSafeLocation = w.costMoveNotSafeLocation();
        r.changed = w.changed();
        return r;
    }

    /** The counterZero[] of a forced time-end, in the sleep answer's item shape; never null. */
    public static List<SleepActionResponse.CounterZeroItem> counterZeroOf(
            TimeAdvancementPort.TimeEndNews news) {
        return news == null ? new ArrayList<>()
                : SleepActionResponse.CounterZeroItem.fromModels(news.counterZero());
    }

    public Long getIdWeather() { return idWeather; }
    public String getUuid() { return uuid; }
    public CardInfoResponse getCard() { return card; }
    public Integer getDeltaEnergy() { return deltaEnergy; }
    public Integer getCostMoveSafeLocation() { return costMoveSafeLocation; }
    public Integer getCostMoveNotSafeLocation() { return costMoveNotSafeLocation; }
    public boolean isChanged() { return changed; }
}
