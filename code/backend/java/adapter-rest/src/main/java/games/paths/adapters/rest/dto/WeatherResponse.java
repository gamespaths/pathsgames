package games.paths.adapters.rest.dto;

import games.paths.core.model.story.CardInfo;
import games.paths.core.port.match.WeatherStorePort.CurrentWeatherView;

/**
 * WeatherResponse - body of {@code GET /api/matches/{uuid}/weather} (Step 27).
 * Carries the current weather plus its movement-cost modifiers (safe / not-safe
 * location), the energy delta applied at time-start, and its visual card
 * ({@code idCard} + the resolved {@link CardInfo}).
 */
public class WeatherResponse {

    private Long idWeather;
    private String uuid;
    private Integer idTextName;
    private Integer idCard;
    private CardInfo card;
    private Integer deltaEnergy;
    private Integer costMoveSafeLocation;
    private Integer costMoveNotSafeLocation;
    private Integer currentClock;

    public static WeatherResponse fromModel(CurrentWeatherView v, CardInfo card) {
        WeatherResponse r = new WeatherResponse();
        r.idWeather = v.idWeather();
        r.uuid = v.uuid();
        r.idTextName = v.idTextName();
        r.idCard = v.idCard();
        r.card = card;
        r.deltaEnergy = v.deltaEnergy();
        r.costMoveSafeLocation = v.costMoveSafeLocation();
        r.costMoveNotSafeLocation = v.costMoveNotSafeLocation();
        r.currentClock = v.currentClock();
        return r;
    }

    public Long getIdWeather() { return idWeather; }
    public void setIdWeather(Long idWeather) { this.idWeather = idWeather; }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public Integer getIdTextName() { return idTextName; }
    public void setIdTextName(Integer idTextName) { this.idTextName = idTextName; }

    public Integer getIdCard() { return idCard; }
    public void setIdCard(Integer idCard) { this.idCard = idCard; }

    public CardInfo getCard() { return card; }
    public void setCard(CardInfo card) { this.card = card; }

    public Integer getDeltaEnergy() { return deltaEnergy; }
    public void setDeltaEnergy(Integer deltaEnergy) { this.deltaEnergy = deltaEnergy; }

    public Integer getCostMoveSafeLocation() { return costMoveSafeLocation; }
    public void setCostMoveSafeLocation(Integer costMoveSafeLocation) {
        this.costMoveSafeLocation = costMoveSafeLocation;
    }

    public Integer getCostMoveNotSafeLocation() { return costMoveNotSafeLocation; }
    public void setCostMoveNotSafeLocation(Integer costMoveNotSafeLocation) {
        this.costMoveNotSafeLocation = costMoveNotSafeLocation;
    }

    public Integer getCurrentClock() { return currentClock; }
    public void setCurrentClock(Integer currentClock) { this.currentClock = currentClock; }
}
