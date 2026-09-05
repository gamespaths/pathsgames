package games.paths.core.port.match;

import java.util.List;
import java.util.Optional;

/**
 * WeatherStorePort - outbound port used by {@code WeatherSelectionService}
 * (Step 27) to read the data needed for weather selection and to persist the
 * selected weather, the per-character energy delta and the log_weather history.
 *
 * <p>Like {@link RecoveryStorePort} it is read-then-write: the service runs the
 * pure weighted-roll selection and asks the adapter to persist the outcome, so
 * the domain logic stays framework-free and unit-testable.</p>
 */
public interface WeatherStorePort {

    /** Story id, current clock and per-match RNG seed for a match. */
    Optional<WeatherMatchContext> loadContext(long idMatch);

    /** Active weather rules (active = 1) for the story. */
    List<WeatherRuleView> findActiveWeatherRules(long idStory);

    /** Per-character energy + cap inputs for the delta application. */
    List<WeatherCharacter> findCharacters(long idMatch);

    /** Persist a clamped character energy (0 ≤ energy ≤ energy_max). */
    void updateCharacterEnergy(long idMatch, long idCharacter, int energy);

    /** Set gaming_match.id_current_weather (null clears it). */
    void setCurrentWeather(long idMatch, Long idWeather);

    /** Append a log_weather history row for the selected weather at a clock. */
    void insertLogWeather(long idMatch, int clock, Long idWeather);

    /** Audit a weather-linked event as pending (execution wired in Step 29/30). */
    void logWeatherEvent(long idMatch, Integer idEvent, String message);

    /** Current weather snapshot for the GET /matches/{uuid}/weather endpoint. */
    Optional<CurrentWeatherView> findCurrentWeather(long idMatch);

    /** Current weather snapshot resolved by match uuid (REST endpoint). */
    Optional<CurrentWeatherView> findCurrentWeatherByMatchUuid(String matchUuid);

    /** The per-match RNG seed (admin view); empty when the match is unknown. */
    Optional<Long> findRngSeed(String matchUuid);

    /** The log_weather history of a match (admin view), oldest clock first. */
    List<WeatherLogView> findWeatherLog(String matchUuid);

    /** All weather rules of the match's story (admin view), each flagged current. */
    List<WeatherRuleSummary> findWeatherRulesForMatch(String matchUuid);

    record WeatherRuleSummary(long id,
                              String uuid,
                              Integer idTextName,
                              String name,
                              Integer probability,
                              Integer deltaEnergy,
                              Integer costMoveSafeLocation,
                              Integer costMoveNotSafeLocation,
                              boolean active,
                              boolean current,
                              /** v0.36.2 - the authored registry condition, and whether it is met. */
                              String conditionKey,
                              String conditionValue,
                              String conditionOperator,
                              boolean registryMet) {
    }

    record WeatherLogView(long id,
                          String uuid,
                          int clock,
                          Long idWeather,
                          String weatherUuid,
                          Integer idTextName,
                          String timestampStart) {
    }

    record WeatherMatchContext(long idStory, int currentClock, Long rngSeed) {
    }

    record WeatherRuleView(long id,
                           String uuid,
                           int probability,
                           int priority,
                           Integer timeFrom,
                           Integer timeTo,
                           String conditionKey,
                           String conditionKeyValue,
                           /** Step 36 - how conditionKeyValue is compared; null means =. */
                           String conditionOperator,
                           Integer deltaEnergy,
                           Integer idEvent,
                           Integer costMoveSafeLocation,
                           Integer costMoveNotSafeLocation,
                           Integer idTextName) {
    }

    record WeatherCharacter(long id, int energy, int energyMax) {
    }

    record CurrentWeatherView(long idWeather,
                              String uuid,
                              Long idStory,
                              Integer idCard,
                              Integer idTextName,
                              Integer deltaEnergy,
                              Integer costMoveSafeLocation,
                              Integer costMoveNotSafeLocation,
                              int currentClock) {
    }
}
