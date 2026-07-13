package games.paths.adapters.rest.controller.match;

import games.paths.adapters.rest.dto.WeatherResponse;
import games.paths.core.model.story.CardInfo;
import games.paths.core.port.story.ContentQueryPort;
import games.paths.core.port.match.WeatherStorePort.CurrentWeatherView;
import games.paths.core.service.match.WeatherSelectionService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * WeatherController - REST adapter exposing the current weather of a match
 * (Step 27).
 *
 * <ul>
 *   <li>GET /api/matches/&#123;uuid&#125;/weather — current weather + movement-cost modifiers</li>
 * </ul>
 *
 * <p>Returns 404 when the match has no weather selected yet (e.g. still in
 * CREATED state). See {@code documentation_v0/Step27_WeatherSystem.md}.</p>
 */
@RestController
public class WeatherController {

    private final WeatherSelectionService weatherService;
    private final ContentQueryPort contentQueryPort;

    public WeatherController(WeatherSelectionService weatherService,
                            ContentQueryPort contentQueryPort) {
        this.weatherService = weatherService;
        this.contentQueryPort = contentQueryPort;
    }

    @GetMapping("/api/matches/{uuid}/weather")
    public ResponseEntity<Object> weather(@PathVariable String uuid,
                                          @RequestParam(required = false) String lang) {
        CurrentWeatherView view = weatherService.currentWeather(uuid).orElse(null);
        if (view == null) {
            return error(HttpStatus.NOT_FOUND, "WEATHER_NOT_FOUND",
                    "No weather is currently set for this match");
        }
        CardInfo card = resolveCard(view, lang);
        return ResponseEntity.ok(WeatherResponse.fromModel(view, card));
    }

    /** Resolve the weather's visual card via the content port (null when no idCard). */
    private CardInfo resolveCard(CurrentWeatherView view, String lang) {
        if (contentQueryPort == null || view.idStory() == null || view.idCard() == null) {
            return null;
        }
        String resolvedLang = (lang == null || lang.isBlank()) ? "en" : lang;
        return contentQueryPort.getCardByStoryIdAndCardId(view.idStory(), view.idCard(), resolvedLang);
    }

    private static ResponseEntity<Object> error(HttpStatus status, String code, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", code);
        body.put("message", message);
        body.put("timestamp", System.currentTimeMillis());
        return ResponseEntity.status(status).body(body);
    }
}
