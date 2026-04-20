package games.paths.adapters.rest.controller.story;

import games.paths.adapters.rest.dto.CardInfoResponse;
import games.paths.adapters.rest.dto.CreatorInfoResponse;
import games.paths.adapters.rest.dto.TextInfoResponse;
import games.paths.core.model.story.CardInfo;
import games.paths.core.model.story.CreatorInfo;
import games.paths.core.model.story.TextInfo;
import games.paths.core.port.story.ContentQueryPort;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * ContentController - REST adapter for story content detail APIs.
 *
 * <p>GET /api/content/{uuidStory}/cards/{uuidCard}          → card detail with resolved text and creator</p>
 * <p>GET /api/content/{uuidStory}/texts/{idText}/lang/{lang} → resolved text with language fallback</p>
 * <p>GET /api/content/{uuidStory}/creators/{uuidCreator}     → creator detail with resolved name</p>
 *
 * <p>These endpoints are public (no authentication required).
 * Language is controlled via the optional "lang" query parameter or path variable.</p>
 *
 * <p>Added in Step 16.</p>
 */
@RestController
@RequestMapping("/api/content")
public class ContentController {

    private final ContentQueryPort contentQueryPort;

    public ContentController(ContentQueryPort contentQueryPort) {
        this.contentQueryPort = contentQueryPort;
    }

    /**
     * GET /api/content/{uuidStory}/cards/{uuidCard}
     * Returns the full detail of a card within a story.
     */
    @GetMapping("/{uuidStory}/cards/{uuidCard}")
    public ResponseEntity<Object> getCard(
            @PathVariable String uuidStory,
            @PathVariable String uuidCard,
            @RequestParam(value = "lang", defaultValue = "en") String lang) {

        CardInfo card = contentQueryPort.getCardByStoryAndCardUuid(uuidStory, uuidCard, lang);
        if (card == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(errorBody("CARD_NOT_FOUND",
                    "No card found with UUID: " + uuidCard + " in story: " + uuidStory));
        }
        return ResponseEntity.ok(toCardInfoResponse(card));
    }

    /**
     * GET /api/content/{uuidStory}/texts/{idText}/lang/{lang}
     * Returns the resolved text in the requested language with English fallback.
     */
    @GetMapping("/{uuidStory}/texts/{idText}/lang/{lang}")
    public ResponseEntity<Object> getText(
            @PathVariable String uuidStory,
            @PathVariable int idText,
            @PathVariable String lang) {

        TextInfo text = contentQueryPort.getTextByStoryAndIdText(uuidStory, idText, lang);
        if (text == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(errorBody("TEXT_NOT_FOUND",
                    "No text found with id_text: " + idText + " in story: " + uuidStory));
        }
        return ResponseEntity.ok(toTextInfoResponse(text));
    }

    /**
     * GET /api/content/{uuidStory}/creators/{uuidCreator}
     * Returns the detail of a creator within a story.
     */
    @GetMapping("/{uuidStory}/creators/{uuidCreator}")
    public ResponseEntity<Object> getCreator(
            @PathVariable String uuidStory,
            @PathVariable String uuidCreator,
            @RequestParam(value = "lang", defaultValue = "en") String lang) {

        CreatorInfo creator = contentQueryPort.getCreatorByStoryAndCreatorUuid(uuidStory, uuidCreator, lang);
        if (creator == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(errorBody("CREATOR_NOT_FOUND",
                    "No creator found with UUID: " + uuidCreator + " in story: " + uuidStory));
        }
        return ResponseEntity.ok(toCreatorInfoResponse(creator));
    }

    // === Mapping helpers ===

    private Map<String, String> errorBody(String error, String message) {
        Map<String, String> body = new LinkedHashMap<>();
        body.put("error", error);
        body.put("message", message);
        return body;
    }

    private CardInfoResponse toCardInfoResponse(CardInfo ci) {
        return new CardInfoResponse(
                ci.getUuid(), ci.getImageUrl(), ci.getAlternativeImage(),
                ci.getAwesomeIcon(), ci.getStyleMain(), ci.getStyleDetail(),
                ci.getTitle(), ci.getDescription(),
                ci.getCopyrightText(), ci.getLinkCopyright(),
                ci.getCreator() != null ? toCreatorInfoResponse(ci.getCreator()) : null);
    }

    private TextInfoResponse toTextInfoResponse(TextInfo ti) {
        return new TextInfoResponse(
                ti.getIdText(), ti.getLang(), ti.getResolvedLang(),
                ti.getShortText(), ti.getLongText(),
                ti.getCopyrightText(), ti.getLinkCopyright(),
                ti.getCreator() != null ? toCreatorInfoResponse(ti.getCreator()) : null);
    }

    private CreatorInfoResponse toCreatorInfoResponse(CreatorInfo ci) {
        return new CreatorInfoResponse(
                ci.getUuid(), ci.getName(), ci.getLink(), ci.getUrl(),
                ci.getUrlImage(), ci.getUrlEmote(), ci.getUrlInstagram());
    }
}
