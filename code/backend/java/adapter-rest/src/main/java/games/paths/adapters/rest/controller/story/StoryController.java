package games.paths.adapters.rest.controller.story;

import games.paths.adapters.rest.dto.CardInfoResponse;
import games.paths.adapters.rest.dto.CharacterTemplateResponse;
import games.paths.adapters.rest.dto.ClassInfoResponse;
import games.paths.adapters.rest.dto.DifficultyResponse;
import games.paths.adapters.rest.dto.StoryDetailResponse;
import games.paths.adapters.rest.dto.StorySummaryResponse;
import games.paths.adapters.rest.dto.TraitInfoResponse;
import games.paths.core.model.story.CardInfo;
import games.paths.core.model.story.CharacterTemplateInfo;
import games.paths.core.model.story.ClassInfo;
import games.paths.core.model.story.DifficultyInfo;
import games.paths.core.model.story.StoryDetail;
import games.paths.core.model.story.StorySummary;
import games.paths.core.model.story.TraitInfo;
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
 * <p>GET /api/stories                     → list all publicly visible stories</p>
 * <p>GET /api/stories/categories           → list distinct categories</p>
 * <p>GET /api/stories/category/{category}  → list stories by category</p>
 * <p>GET /api/stories/groups               → list distinct groups</p>
 * <p>GET /api/stories/group/{group}        → list stories by group</p>
 * <p>GET /api/stories/{uuid}               → get full details of a single story</p>
 *
 * <p>These endpoints are public (no authentication required).
 * Language is controlled via the optional "lang" query parameter (default: "en").</p>
 *
 * <p>Enhanced in Step 15 with category/group listing and filtering endpoints,
 * plus enriched story detail with character templates, classes, traits, and card info.</p>
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

    // === Step 15: Category endpoints (mapped BEFORE /{uuid}) ===

    /**
     * GET /api/stories/categories
     * Lists distinct categories of publicly visible stories.
     */
    @GetMapping("/categories")
    public ResponseEntity<List<String>> listCategories() {
        List<String> categories = storyQueryPort.listCategories();
        return ResponseEntity.ok(categories);
    }

    /**
     * GET /api/stories/category/{category}
     * Lists all publicly visible stories filtered by category.
     */
    @GetMapping("/category/{category}")
    public ResponseEntity<List<StorySummaryResponse>> listStoriesByCategory(
            @PathVariable String category,
            @RequestParam(value = "lang", defaultValue = "en") String lang) {

        List<StorySummary> stories = storyQueryPort.listStoriesByCategory(category, lang);
        List<StorySummaryResponse> response = stories.stream()
                .map(this::toSummaryResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/stories/groups
     * Lists distinct groups of publicly visible stories.
     */
    @GetMapping("/groups")
    public ResponseEntity<List<String>> listGroups() {
        List<String> groups = storyQueryPort.listGroups();
        return ResponseEntity.ok(groups);
    }

    /**
     * GET /api/stories/group/{group}
     * Lists all publicly visible stories filtered by group.
     */
    @GetMapping("/group/{group}")
    public ResponseEntity<List<StorySummaryResponse>> listStoriesByGroup(
            @PathVariable String group,
            @RequestParam(value = "lang", defaultValue = "en") String lang) {

        List<StorySummary> stories = storyQueryPort.listStoriesByGroup(group, lang);
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
        resp.setClassCount(d.getClassCount());
        resp.setCharacterTemplateCount(d.getCharacterTemplateCount());
        resp.setTraitCount(d.getTraitCount());
        resp.setDifficulties(d.getDifficulties().stream()
                .map(this::toDifficultyResponse)
                .collect(Collectors.toList()));
        resp.setCharacterTemplates(d.getCharacterTemplates().stream()
                .map(this::toCharacterTemplateResponse)
                .collect(Collectors.toList()));
        resp.setClasses(d.getClasses().stream()
                .map(this::toClassInfoResponse)
                .collect(Collectors.toList()));
        resp.setTraits(d.getTraits().stream()
                .map(this::toTraitInfoResponse)
                .collect(Collectors.toList()));
        resp.setCard(d.getCard() != null ? toCardInfoResponse(d.getCard()) : null);
        return resp;
    }

    private DifficultyResponse toDifficultyResponse(DifficultyInfo di) {
        return new DifficultyResponse(
                di.getUuid(), di.getDescription(), di.getExpCost(), di.getMaxWeight(),
                di.getMinCharacter(), di.getMaxCharacter(), di.getCostHelpComa(),
                di.getCostMaxCharacteristics(), di.getNumberMaxFreeAction());
    }

    private CharacterTemplateResponse toCharacterTemplateResponse(CharacterTemplateInfo ct) {
        return new CharacterTemplateResponse(
                ct.getUuid(), ct.getName(), ct.getDescription(),
                ct.getLifeMax(), ct.getEnergyMax(), ct.getSadMax(),
                ct.getDexterityStart(), ct.getIntelligenceStart(), ct.getConstitutionStart());
    }

    private ClassInfoResponse toClassInfoResponse(ClassInfo ci) {
        return new ClassInfoResponse(
                ci.getUuid(), ci.getName(), ci.getDescription(),
                ci.getWeightMax(), ci.getDexterityBase(), ci.getIntelligenceBase(),
                ci.getConstitutionBase());
    }

    private TraitInfoResponse toTraitInfoResponse(TraitInfo ti) {
        return new TraitInfoResponse(
                ti.getUuid(), ti.getName(), ti.getDescription(),
                ti.getCostPositive(), ti.getCostNegative(),
                ti.getIdClassPermitted(), ti.getIdClassProhibited());
    }

    private CardInfoResponse toCardInfoResponse(CardInfo ci) {
        return new CardInfoResponse(
                ci.getUuid(), ci.getImageUrl(), ci.getAlternativeImage(),
                ci.getAwesomeIcon(), ci.getStyleMain(), ci.getStyleDetail(),
                ci.getTitle());
    }
}
