package games.paths.adapters.rest.controller.story;

import games.paths.adapters.rest.dto.DifficultyResponse;
import games.paths.adapters.rest.dto.StoryDetailResponse;
import games.paths.adapters.rest.dto.StorySummaryResponse;
import games.paths.core.model.story.DifficultyInfo;
import games.paths.core.model.story.StoryDetail;
import games.paths.core.model.story.StorySummary;
import games.paths.core.port.story.StoryQueryPort;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * StoryController - REST adapter for public story querying.
 *
 * <p>GET /api/stories      → list all publicly visible stories</p>
 * <p>GET /api/stories/{uuid} → get full details of a single story</p>
 *
 * <p>These endpoints are public (no authentication required).
 * Language is controlled via the optional "lang" query parameter (default: "en").</p>
 */
@RestController
@RequestMapping("/api/stories")
public class StoryController {

    private final StoryQueryPort storyQueryPort;

    public StoryController(StoryQueryPort storyQueryPort) {
        this.storyQueryPort = storyQueryPort;
    }

    /**
     * GET /api/stories
     * Lists all publicly visible stories, ordered by priority descending.
     */
    @GetMapping
    public ResponseEntity<List<StorySummaryResponse>> listStories(
            @RequestParam(value = "lang", defaultValue = "en") String lang) {

        List<StorySummary> stories = storyQueryPort.listPublicStories(lang);
        List<StorySummaryResponse> response = stories.stream()
                .map(this::toSummaryResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/stories/{uuid}
     * Returns the full detail of a single story by UUID.
     */
    @GetMapping("/{uuid}")
    public ResponseEntity<Object> getStory(
            @PathVariable String uuid,
            @RequestParam(value = "lang", defaultValue = "en") String lang) {

        StoryDetail detail = storyQueryPort.getStoryByUuid(uuid, lang);
        if (detail == null) {
            Map<String, String> error = new LinkedHashMap<>();
            error.put("error", "STORY_NOT_FOUND");
            error.put("message", "No story found with UUID: " + uuid);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
        }
        return ResponseEntity.ok(toDetailResponse(detail));
    }

    private StorySummaryResponse toSummaryResponse(StorySummary s) {
        return new StorySummaryResponse(
                s.getUuid(), s.getTitle(), s.getDescription(), s.getAuthor(),
                s.getCategory(), s.getGroup(), s.getVisibility(),
                s.getPriority(), s.getPeghi(), s.getDifficultyCount());
    }

    private StoryDetailResponse toDetailResponse(StoryDetail d) {
        StoryDetailResponse resp = new StoryDetailResponse();
        resp.setUuid(d.getUuid());
        resp.setTitle(d.getTitle());
        resp.setDescription(d.getDescription());
        resp.setAuthor(d.getAuthor());
        resp.setCategory(d.getCategory());
        resp.setGroup(d.getGroup());
        resp.setVisibility(d.getVisibility());
        resp.setPriority(d.getPriority());
        resp.setPeghi(d.getPeghi());
        resp.setVersionMin(d.getVersionMin());
        resp.setVersionMax(d.getVersionMax());
        resp.setClockSingularDescription(d.getClockSingularDescription());
        resp.setClockPluralDescription(d.getClockPluralDescription());
        resp.setCopyrightText(d.getCopyrightText());
        resp.setLinkCopyright(d.getLinkCopyright());
        resp.setLocationCount(d.getLocationCount());
        resp.setEventCount(d.getEventCount());
        resp.setItemCount(d.getItemCount());
        resp.setDifficulties(d.getDifficulties().stream()
                .map(this::toDifficultyResponse)
                .collect(Collectors.toList()));
        return resp;
    }

    private DifficultyResponse toDifficultyResponse(DifficultyInfo di) {
        return new DifficultyResponse(
                di.getUuid(), di.getDescription(), di.getExpCost(), di.getMaxWeight(),
                di.getMinCharacter(), di.getMaxCharacter(), di.getCostHelpComa(),
                di.getCostMaxCharacteristics(), di.getNumberMaxFreeAction());
    }
}
