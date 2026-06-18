package games.paths.adapters.rest.controller.story;

import games.paths.adapters.rest.dto.CardInfoResponse;
import games.paths.adapters.rest.dto.CharacterTemplateResponse;
import games.paths.adapters.rest.dto.ClassBonusInfoResponse;
import games.paths.adapters.rest.dto.ClassInfoResponse;
import games.paths.adapters.rest.dto.DifficultyResponse;
import games.paths.adapters.rest.dto.StoryDetailResponse;
import games.paths.adapters.rest.dto.StorySummaryResponse;
import games.paths.adapters.rest.dto.TraitInfoResponse;
import games.paths.core.model.story.CardInfo;
import games.paths.core.model.story.CharacterTemplateInfo;
import games.paths.core.model.story.ClassBonusInfo;
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

    /**
     * GET /api/stories/{uuidStory}/classes/{uuidClass}/traits
     * Step 23 — lists the story traits selectable with the given class
     * (id_class_permitted / id_class_prohibited filter).
     */
    @GetMapping("/{uuidStory}/classes/{uuidClass}/traits")
    public ResponseEntity<Object> listTraitsForClass(
            @PathVariable String uuidStory,
            @PathVariable String uuidClass,
            @RequestParam(value = "lang", defaultValue = "en") String lang) {

        StoryQueryPort.TraitsForClassResult result =
                storyQueryPort.listTraitsForClass(uuidStory, uuidClass, lang);
        if (result.status() == StoryQueryPort.TraitsForClassResult.Status.STORY_NOT_FOUND) {
            Map<String, String> error = new LinkedHashMap<>();
            error.put("error", "STORY_NOT_FOUND");
            error.put("message", "No story found with UUID: " + uuidStory);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
        }
        if (result.status() == StoryQueryPort.TraitsForClassResult.Status.CLASS_NOT_FOUND) {
            Map<String, String> error = new LinkedHashMap<>();
            error.put("error", "CLASS_NOT_FOUND");
            error.put("message", "No class found with UUID: " + uuidClass);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
        }
        List<TraitInfoResponse> response = result.traits().stream()
                .map(this::toTraitInfoResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(response);
    }

    private StorySummaryResponse toSummaryResponse(StorySummary s) {
        CardInfoResponse cardResp = s.card() != null ? toCardInfoResponse(s.card()) : null;
        return new StorySummaryResponse(
                s.uuid(), s.title(), s.description(), s.author(),
                s.category(), s.group(), s.visibility(),
                s.priority(), s.peghi(), s.difficultyCount(),
                cardResp);
    }

    private StoryDetailResponse toDetailResponse(StoryDetail d) {
        StoryDetailResponse resp = new StoryDetailResponse();
        resp.setUuid(d.uuid());
        resp.setTitle(d.title());
        resp.setDescription(d.description());
        resp.setAuthor(d.author());
        resp.setCategory(d.category());
        resp.setGroup(d.group());
        resp.setVisibility(d.visibility());
        resp.setPriority(d.priority());
        resp.setPeghi(d.peghi());
        resp.setVersionMin(d.versionMin());
        resp.setVersionMax(d.versionMax());
        resp.setClockSingularDescription(d.clockSingularDescription());
        resp.setClockPluralDescription(d.clockPluralDescription());
        resp.setIdTextClockSingular(d.idTextClockSingular());
        resp.setIdTextClockPlural(d.idTextClockPlural());
        resp.setCopyrightText(d.copyrightText());
        resp.setLinkCopyright(d.linkCopyright());
        resp.setLocationCount(d.locationCount());
        resp.setEventCount(d.eventCount());
        resp.setItemCount(d.itemCount());
        resp.setClassCount(d.classCount());
        resp.setCharacterTemplateCount(d.characterTemplateCount());
        resp.setTraitCount(d.traitCount());
        resp.setDifficulties(d.difficulties().stream()
                .map(this::toDifficultyResponse)
                .collect(Collectors.toList()));
        resp.setCharacterTemplates(d.characterTemplates().stream()
                .map(this::toCharacterTemplateResponse)
                .collect(Collectors.toList()));
        resp.setClasses(d.classes().stream()
                .map(this::toClassInfoResponse)
                .collect(Collectors.toList()));
        resp.setTraits(d.traits().stream()
                .map(this::toTraitInfoResponse)
                .collect(Collectors.toList()));
        resp.setCard(d.card() != null ? toCardInfoResponse(d.card()) : null);
        return resp;
    }

    private DifficultyResponse toDifficultyResponse(DifficultyInfo di) {
        DifficultyResponse r = new DifficultyResponse(
                di.getUuid(), di.getDescription(), di.getExpCost(), di.getMaxWeight(),
                di.getMinCharacter(), di.getMaxCharacter(), di.getCostHelpComa(),
                di.getCostMaxCharacteristics(), di.getNumberMaxFreeAction());
        r.setLife(di.getLife());
        r.setEnergy(di.getEnergy());
        r.setSad(di.getSad());
        r.setDexterity(di.getDexterity());
        r.setIntelligence(di.getIntelligence());
        r.setConstitution(di.getConstitution());
        r.setWeight(di.getWeight());
        r.setIdCard(di.getIdCard());
        r.setCard(di.getCard() != null ? toCardInfoResponse(di.getCard()) : null);
        r.setTraitCostPositiveBudget(di.getTraitCostPositiveBudget());
        r.setTraitCostNegativeBudget(di.getTraitCostNegativeBudget());
        return r;
    }

    private CharacterTemplateResponse toCharacterTemplateResponse(CharacterTemplateInfo ct) {
        CharacterTemplateResponse r = new CharacterTemplateResponse(
                ct.uuid(), ct.name(), ct.description(),
                ct.lifeMax(), ct.energyMax(), ct.sadMax(),
                ct.dexterityStart(), ct.intelligenceStart(), ct.constitutionStart());
        r.setIdCard(ct.idCard());
        r.setCard(ct.card() != null ? toCardInfoResponse(ct.card()) : null);
        r.setIdClassPermitted(ct.idClassPermitted());
        r.setIdClassProhibited(ct.idClassProhibited());
        return r;
    }

    private ClassInfoResponse toClassInfoResponse(ClassInfo ci) {
        ClassInfoResponse r = new ClassInfoResponse(
                ci.uuid(), ci.name(), ci.description(),
                ci.weightMax(), ci.dexterityBase(), ci.intelligenceBase(),
                ci.constitutionBase());
        r.setId(ci.id());
        r.setIdCard(ci.idCard());
        r.setCard(ci.card() != null ? toCardInfoResponse(ci.card()) : null);
        r.setBonuses(ci.bonuses() != null
                ? ci.bonuses().stream().map(this::toClassBonusInfoResponse).collect(Collectors.toList())
                : new java.util.ArrayList<>());
        return r;
    }

    private ClassBonusInfoResponse toClassBonusInfoResponse(ClassBonusInfo cb) {
        return new ClassBonusInfoResponse(cb.uuid(), cb.statistic(), cb.value());
    }

    private TraitInfoResponse toTraitInfoResponse(TraitInfo ti) {
        TraitInfoResponse r = new TraitInfoResponse(
                ti.getUuid(), ti.getName(), ti.getDescription(),
                ti.getCostPositive(), ti.getCostNegative(),
                ti.getIdClassPermitted(), ti.getIdClassProhibited());
        r.setIdCard(ti.getIdCard());
        r.setCard(ti.getCard() != null ? toCardInfoResponse(ti.getCard()) : null);
        r.setLife(ti.getLife());
        r.setEnergy(ti.getEnergy());
        r.setSad(ti.getSad());
        r.setDexterity(ti.getDexterity());
        r.setIntelligence(ti.getIntelligence());
        r.setConstitution(ti.getConstitution());
        r.setWeight(ti.getWeight());
        return r;
    }

    private CardInfoResponse toCardInfoResponse(CardInfo ci) {
        return new CardInfoResponse(
                ci.uuid(), ci.cardType(), ci.urlImage(), ci.alternativeImage(),
                ci.awesomeIcon(), ci.styleMain(), ci.styleDetail(),
                ci.styleImageLittle(), ci.styleImageMedium(), ci.styleImageLarge(),
                ci.title(), ci.description(),
                ci.copyrightText(), ci.linkCopyright(), null);
    }
}
