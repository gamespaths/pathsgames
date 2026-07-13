package games.paths.core.service.story;

import games.paths.core.entity.story.*;
import games.paths.core.model.story.StoryValidationReport;
import games.paths.core.port.story.StoryReadPort;
import games.paths.core.port.story.StoryValidatorPort;

import java.util.*;

/**
 * StoryValidatorService - referential-integrity and domain-rule validator for stories
 * (Step 22).
 *
 * <p>Both the import-map path and the persisted-story path normalise their input into a
 * single {@link StoryGraph} and feed it through the same rule engine, so a rule is
 * written once and applies identically to authored JSON and to stored rows.</p>
 *
 * <p>Only <em>positive</em> references are validated: a null, absent or non-positive
 * reference means "none" (matching the import service's {@code normalizeOptionalFk}),
 * so it is never reported as broken.</p>
 */
public class StoryValidatorService implements StoryValidatorPort {

    private final StoryReadPort readPort;

    public StoryValidatorService(StoryReadPort readPort) {
        this.readPort = readPort;
    }

    // ===== Entry points =====

    @Override
    public StoryValidationReport validateImportData(Map<String, Object> storyData) {
        StoryValidationReport report = new StoryValidationReport();
        if (storyData == null || storyData.isEmpty()) {
            report.add("R0_EMPTY", "story", null, null, "story data is null or empty");
            return report;
        }
        StoryGraph g = buildFromMap(storyData);
        runRules(g, report);
        return report;
    }

    @Override
    public StoryValidationReport validateStory(Long storyId) {
        StoryValidationReport report = new StoryValidationReport();
        if (storyId == null) {
            report.add("R0_EMPTY", "story", null, null, "storyId is null");
            return report;
        }
        StoryGraph g = buildFromReadPort(storyId);
        runRules(g, report);
        return report;
    }

    @Override
    public StoryValidationReport validateEntity(String entityType, Map<String, Object> data) {
        StoryValidationReport report = new StoryValidationReport();
        if (entityType == null || data == null || data.isEmpty()) {
            return report;
        }
        String id = str(data.get("id"));
        switch (entityType) {
            case "character-templates" -> validateTemplateLocal(entityType, id, data, report);
            case "items", "traits" -> validateClassRestrictionLocal(entityType, id, data, report);
            case "difficulties" -> validateDifficultyLocal(entityType, id, data, report);
            case "events" -> validateEventLocal(entityType, id, data, report);
            default -> { /* no entity-local rule */ }
        }
        return report;
    }

    /**
     * Step 29 — entity-local event rules, reachable from the lenient admin CRUD path
     * (which never sees the whole story graph).
     *
     * <p>Note there is deliberately NO closed vocabulary for {@code type}. The column is
     * free text and authored stories already use values beyond the documented four
     * (`END`, `END_GAME`), while the end-game event is identified by
     * {@code story.idEventEndGame} rather than by its type. Rejecting an unknown type
     * would break that content for no gain: the engine already treats anything outside
     * {NORMAL, ONCE} as not player-executable, which is the safe default.</p>
     */
    private void validateEventLocal(String type, String id, Map<String, Object> data,
                                    StoryValidationReport report) {
        // A registry condition whose expected value is missing can never be satisfied, so the
        // event would be permanently unavailable — almost certainly an authoring slip.
        String key = str(data.get("registryKeyCondition"));
        String value = str(data.get("registryValueCondition"));
        if (key != null && !key.isBlank() && (value == null || value.isBlank())) {
            report.add("R7_EVENT_CONDITION", type, id, "registryValueCondition",
                    "registryKeyCondition=" + key + " has no registryValueCondition,"
                            + " so the condition can never be met");
        }
    }

    /** Step 29 — the same rule over every event of a whole story. */
    private void validateEvents(StoryGraph g, StoryValidationReport report) {
        for (Map.Entry<String, Map<String, Object>> e : g.eventData.entrySet()) {
            validateEventLocal("events", e.getKey(), e.getValue(), report);
        }
    }

    // ===== Rule engine =====

    private void runRules(StoryGraph g, StoryValidationReport report) {
        validateReferences(g, report);   // R1,R3,R5,R7 + neighbor/choice/effect existence
        validateNeighbors(g, report);     // R2
        validateEventChains(g, report);   // R3 cycle
        validateChoiceOptions(g, report); // R4
        validateKeys(g, report);          // R4 conditions reference valid keys
        validateTemplates(g, report);     // R6 stat ranges
        validateClassRestrictions(g, report); // R6 permitted != prohibited
        validateEvents(g, report);        // R7 event conditions (Step 29)
    }

    private void validateReferences(StoryGraph g, StoryValidationReport report) {
        for (Ref r : g.refs) {
            Set<Integer> universe = switch (r.target) {
                case LOCATION -> g.locations;
                case EVENT -> g.events;
                case ITEM -> g.items;
                case CHOICE -> g.choices;
                case CLASS -> g.classes;
                case MISSION -> g.missions;
                case WEATHER -> g.weathers;
            };
            if (r.value != null && r.value > 0 && !universe.contains(r.value)) {
                report.add(r.rule, r.entityType, r.entityId, r.field,
                        r.entityType + " " + r.field + "=" + r.value
                                + " references a non-existent " + r.target.name().toLowerCase());
            }
        }
    }

    private void validateNeighbors(StoryGraph g, StoryValidationReport report) {
        Map<String, Integer> seen = new HashMap<>();
        for (Neighbor n : g.neighbors) {
            if (n.from != null && n.to != null && n.from > 0 && n.from.equals(n.to)) {
                report.add("R2_NEIGHBOR_SELF", "location-neighbors", n.entityId, "idLocationTo",
                        "neighbor links location " + n.from + " to itself");
            }
            if (n.direction == null || n.direction.isBlank()) {
                report.add("R2_NEIGHBOR_DIR", "location-neighbors", n.entityId, "direction",
                        "neighbor from location " + n.from + " has no direction");
            } else if (n.from != null && n.from > 0) {
                String key = n.from + "/" + n.direction.trim().toUpperCase();
                Integer prev = seen.put(key, n.to);
                if (prev != null && !prev.equals(n.to)) {
                    report.add("R2_NEIGHBOR_DUP", "location-neighbors", n.entityId, "direction",
                            "location " + n.from + " has two neighbors in direction "
                                    + n.direction + " (" + prev + " and " + n.to + ")");
                }
            }
        }
    }

    /** Detects cycles in the {@code idEventNext} chain via iterative DFS with colouring. */
    private void validateEventChains(StoryGraph g, StoryValidationReport report) {
        Map<Integer, Integer> color = new HashMap<>(); // 0=visiting, 1=done
        for (Integer start : g.events) {
            if (color.containsKey(start)) {
                continue;
            }
            Deque<Integer> stack = new ArrayDeque<>();
            stack.push(start);
            while (!stack.isEmpty()) {
                Integer node = stack.peek();
                Integer c = color.get(node);
                if (c == null) {
                    color.put(node, 0);
                    Integer next = g.eventNext.get(node);
                    if (next != null && next > 0 && g.events.contains(next)) {
                        Integer nc = color.get(next);
                        if (nc != null && nc == 0) {
                            report.add("R3_EVENT_CYCLE", "events", String.valueOf(node), "idEventNext",
                                    "event chain forms a cycle at event " + node + " -> " + next);
                            color.put(node, 1);
                            stack.pop();
                        } else if (nc == null) {
                            stack.push(next);
                        } else {
                            color.put(node, 1);
                            stack.pop();
                        }
                    } else {
                        color.put(node, 1);
                        stack.pop();
                    }
                } else {
                    color.put(node, 1);
                    stack.pop();
                }
            }
        }
    }

    private void validateChoiceOptions(StoryGraph g, StoryValidationReport report) {
        for (Map.Entry<Integer, Boolean> e : g.choiceOtherwise.entrySet()) {
            Integer id = e.getKey();
            boolean otherwise = Boolean.TRUE.equals(e.getValue());
            boolean hasOption = g.choicesWithOption.contains(id);
            if (!otherwise && !hasOption) {
                report.add("R4_CHOICE_EMPTY", "choices", String.valueOf(id), null,
                        "choice " + id + " has no option (choice-effects) and no otherwise fallback");
            }
        }
    }

    private void validateKeys(StoryGraph g, StoryValidationReport report) {
        for (KeyRef kr : g.keyRefs) {
            if (kr.key != null && !kr.key.isBlank()
                    && !g.keyNames.contains(kr.key.trim().toLowerCase())) {
                report.add("R4_CONDITION_KEY", "choice-conditions", kr.entityId, "key",
                        "choice-condition references unknown registry key '" + kr.key + "'");
            }
        }
    }

    private void validateTemplates(StoryGraph g, StoryValidationReport report) {
        for (TemplateStat t : g.templates) {
            checkPositive(report, "character-templates", t.entityId, "lifeMax", t.lifeMax);
            checkPositive(report, "character-templates", t.entityId, "energyMax", t.energyMax);
            checkNonNegative(report, "character-templates", t.entityId, "dexterityStart", t.dexterity);
            checkNonNegative(report, "character-templates", t.entityId, "intelligenceStart", t.intelligence);
            checkNonNegative(report, "character-templates", t.entityId, "constitutionStart", t.constitution);
            checkNonNegative(report, "character-templates", t.entityId, "sadMax", t.sadMax);
        }
    }

    private void validateClassRestrictions(StoryGraph g, StoryValidationReport report) {
        for (ClassRestriction c : g.restrictions) {
            if (c.permitted != null && c.prohibited != null
                    && c.permitted > 0 && c.permitted.equals(c.prohibited)) {
                report.add("R6_CLASS_CONFLICT", c.entityType, c.entityId, "idClassPermitted",
                        c.entityType + " " + c.entityId + " has the same class permitted and prohibited ("
                                + c.permitted + ")");
            }
        }
    }

    // ===== Entity-local validators (lenient CRUD) =====

    private void validateTemplateLocal(String type, String id, Map<String, Object> d, StoryValidationReport r) {
        checkPositive(r, type, id, "lifeMax", asInt(d.get("lifeMax")));
        checkPositive(r, type, id, "energyMax", asInt(d.get("energyMax")));
        checkNonNegative(r, type, id, "dexterityStart", asInt(d.get("dexterityStart")));
        checkNonNegative(r, type, id, "intelligenceStart", asInt(d.get("intelligenceStart")));
        checkNonNegative(r, type, id, "constitutionStart", asInt(d.get("constitutionStart")));
        checkNonNegative(r, type, id, "sadMax", asInt(d.get("sadMax")));
        localClassConflict(type, id, d, r);
    }

    private void validateClassRestrictionLocal(String type, String id, Map<String, Object> d, StoryValidationReport r) {
        localClassConflict(type, id, d, r);
    }

    private void localClassConflict(String type, String id, Map<String, Object> d, StoryValidationReport r) {
        Integer permitted = asInt(d.get("idClassPermitted"));
        Integer prohibited = asInt(d.get("idClassProhibited"));
        if (permitted != null && prohibited != null && permitted > 0 && permitted.equals(prohibited)) {
            r.add("R6_CLASS_CONFLICT", type, id, "idClassPermitted",
                    type + " has the same class permitted and prohibited (" + permitted + ")");
        }
    }

    private void validateDifficultyLocal(String type, String id, Map<String, Object> d, StoryValidationReport r) {
        Integer min = asInt(d.get("minCharacter"));
        Integer max = asInt(d.get("maxCharacter"));
        if (min != null && max != null && max > 0 && min > max) {
            r.add("R6_DIFFICULTY_RANGE", type, id, "minCharacter",
                    "minCharacter (" + min + ") exceeds maxCharacter (" + max + ")");
        }
        // Step 23 — trait cost budgets must not be negative (null = no limit)
        checkNonNegative(r, type, id, "traitCostPositiveBudget", asInt(d.get("traitCostPositiveBudget")));
        checkNonNegative(r, type, id, "traitCostNegativeBudget", asInt(d.get("traitCostNegativeBudget")));
    }

    private void checkPositive(StoryValidationReport r, String type, String id, String field, Integer v) {
        if (v != null && v <= 0) {
            r.add("R6_STAT_RANGE", type, id, field, field + " must be positive but is " + v);
        }
    }

    private void checkNonNegative(StoryValidationReport r, String type, String id, String field, Integer v) {
        if (v != null && v < 0) {
            r.add("R6_STAT_RANGE", type, id, field, field + " must not be negative but is " + v);
        }
    }

    // ===== Graph builders =====

    private StoryGraph buildFromMap(Map<String, Object> data) {
        StoryGraph g = new StoryGraph();

        collectIds(g.locations, list(data, "locations"), "id");
        collectIds(g.events, list(data, "events"), "id");
        collectIds(g.items, list(data, "items"), "id");
        collectIds(g.choices, list(data, "choices"), "id");
        collectIds(g.classes, list(data, "classes"), "id");
        collectIds(g.missions, list(data, "missions"), "id");
        collectIds(g.weathers, list(data, "weatherRules"), "id");
        for (Map<String, Object> k : list(data, "keys")) {
            String name = str(k.get("name"));
            if (name != null) {
                g.keyNames.add(name.trim().toLowerCase());
            }
        }

        // Story-level FKs
        ref(g, "story", null, "idLocationStart", Target.LOCATION, asInt(data.get("idLocationStart")));
        ref(g, "story", null, "idLocationAllPlayerComa", Target.LOCATION, asInt(data.get("idLocationAllPlayerComa")));
        ref(g, "story", null, "idEventAllPlayerComa", Target.EVENT, asInt(data.get("idEventAllPlayerComa")));
        ref(g, "story", null, "idEventEndGame", Target.EVENT, asInt(data.get("idEventEndGame")));

        for (Map<String, Object> e : list(data, "events")) {
            String id = str(e.get("id"));
            ref(g, "events", id, "idSpecificLocation", Target.LOCATION, asInt(e.get("idSpecificLocation")));
            ref(g, "events", id, "idEventNext", Target.EVENT, asInt(e.get("idEventNext")));
            // Step 29 conditions (idItemToAdd is deprecated and no longer referenced).
            ref(g, "events", id, "idWeather", Target.WEATHER, asInt(e.get("idWeather")));
            ref(g, "events", id, "idClassCondition", Target.CLASS, asInt(e.get("idClassCondition")));
            ref(g, "events", id, "idItemCondition", Target.ITEM, asInt(e.get("idItemCondition")));
            g.eventData.put(id, e);
            Integer myId = asInt(e.get("id"));
            Integer next = asInt(e.get("idEventNext"));
            if (myId != null && next != null) {
                g.eventNext.put(myId, next);
            }
        }
        for (Map<String, Object> c : list(data, "choices")) {
            String id = str(c.get("id"));
            ref(g, "choices", id, "idEvent", Target.EVENT, asInt(c.get("idEvent")));
            ref(g, "choices", id, "idLocation", Target.LOCATION, asInt(c.get("idLocation")));
            ref(g, "choices", id, "idEventTorun", Target.EVENT, asInt(c.get("idEventTorun")));
            Integer myId = asInt(c.get("id"));
            if (myId != null) {
                g.choiceOtherwise.put(myId, truthy(c.get("otherwiseFlag")));
            }
        }
        for (Map<String, Object> ce : list(data, "choiceEffects")) {
            Integer cid = asInt(ce.get("idChoices"));
            if (cid != null) {
                g.choicesWithOption.add(cid);
            }
            ref(g, "choice-effects", str(ce.get("id")), "idChoices", Target.CHOICE, cid);
        }
        for (Map<String, Object> cc : list(data, "choiceConditions")) {
            ref(g, "choice-conditions", str(cc.get("id")), "idChoices", Target.CHOICE, asInt(cc.get("idChoices")));
            g.keyRefs.add(new KeyRef(str(cc.get("id")), str(cc.get("type")), str(cc.get("key"))));
        }
        for (Map<String, Object> ee : list(data, "eventEffects")) {
            String id = str(ee.get("id"));
            ref(g, "event-effects", id, "idEvent", Target.EVENT, asInt(ee.get("idEvent")));
            ref(g, "event-effects", id, "idItemTarget", Target.ITEM, asInt(ee.get("idItemTarget")));
            ref(g, "event-effects", id, "targetClass", Target.CLASS, asInt(ee.get("targetClass")));
            // Step 29 — here idWeather is the EFFECT that sets the match weather.
            ref(g, "event-effects", id, "idWeather", Target.WEATHER, asInt(ee.get("idWeather")));
        }
        for (Map<String, Object> ie : list(data, "itemEffects")) {
            ref(g, "item-effects", str(ie.get("id")), "idItem", Target.ITEM, asInt(ie.get("idItem")));
        }
        for (Map<String, Object> cb : list(data, "classBonuses")) {
            ref(g, "class-bonuses", str(cb.get("id")), "idClass", Target.CLASS, asInt(cb.get("idClass")));
        }
        for (Map<String, Object> ms : list(data, "missionSteps")) {
            ref(g, "mission-steps", str(ms.get("id")), "idMission", Target.MISSION, asInt(ms.get("idMission")));
        }
        for (Map<String, Object> wr : list(data, "weatherRules")) {
            ref(g, "weather-rules", str(wr.get("id")), "idEvent", Target.EVENT, asInt(wr.get("idEvent")));
        }
        for (Map<String, Object> gr : list(data, "globalRandomEvents")) {
            ref(g, "global-random-events", str(gr.get("id")), "idEvent", Target.EVENT, asInt(gr.get("idEvent")));
        }
        for (Map<String, Object> n : list(data, "locationNeighbors")) {
            Integer from = asInt(n.get("idLocationFrom"));
            Integer to = asInt(n.get("idLocationTo"));
            String nid = str(n.get("id"));
            ref(g, "location-neighbors", nid, "idLocationFrom", Target.LOCATION, from);
            ref(g, "location-neighbors", nid, "idLocationTo", Target.LOCATION, to);
            g.neighbors.add(new Neighbor(nid, from, to, str(n.get("direction"))));
        }
        for (Map<String, Object> it : list(data, "items")) {
            restriction(g, "items", str(it.get("id")), asInt(it.get("idClassPermitted")), asInt(it.get("idClassProhibited")));
        }
        for (Map<String, Object> tr : list(data, "traits")) {
            restriction(g, "traits", str(tr.get("id")), asInt(tr.get("idClassPermitted")), asInt(tr.get("idClassProhibited")));
        }
        for (Map<String, Object> ct : list(data, "characterTemplates")) {
            String id = str(ct.get("id") != null ? ct.get("id") : ct.get("idTipo"));
            restriction(g, "character-templates", id, asInt(ct.get("idClassPermitted")), asInt(ct.get("idClassProhibited")));
            g.templates.add(new TemplateStat(id, asInt(ct.get("lifeMax")), asInt(ct.get("energyMax")),
                    asInt(ct.get("dexterityStart")), asInt(ct.get("intelligenceStart")),
                    asInt(ct.get("constitutionStart")), asInt(ct.get("sadMax"))));
        }
        return g;
    }

    private StoryGraph buildFromReadPort(Long storyId) {
        StoryGraph g = new StoryGraph();
        List<LocationEntity> locations = readPort.findLocationsByStoryId(storyId);
        List<EventEntity> events = readPort.findEventsByStoryId(storyId);
        List<ItemEntity> items = readPort.findItemsByStoryId(storyId);
        List<ChoiceEntity> choices = readPort.findChoicesByStoryId(storyId);
        List<ClassEntity> classes = readPort.findClassesByStoryId(storyId);
        List<MissionEntity> missions = readPort.findMissionsByStoryId(storyId);

        for (LocationEntity l : locations) {
            addId(g.locations, l.getId());
        }
        for (EventEntity e : events) {
            addId(g.events, e.getId());
        }
        for (ItemEntity i : items) {
            addId(g.items, i.getId());
        }
        for (ChoiceEntity c : choices) {
            addId(g.choices, c.getId());
        }
        for (ClassEntity c : classes) {
            addId(g.classes, c.getId());
        }
        for (MissionEntity m : missions) {
            addId(g.missions, m.getId());
        }
        for (KeyEntity k : readPort.findKeysByStoryId(storyId)) {
            if (k.getName() != null) {
                g.keyNames.add(k.getName().trim().toLowerCase());
            }
        }

        for (EventEntity e : events) {
            String id = str(e.getId());
            ref(g, "events", id, "idSpecificLocation", Target.LOCATION, e.getIdSpecificLocation());
            ref(g, "events", id, "idEventNext", Target.EVENT, e.getIdEventNext());
            // Step 29 conditions (idItemToAdd is deprecated and no longer referenced).
            ref(g, "events", id, "idWeather", Target.WEATHER, e.getIdWeather());
            ref(g, "events", id, "idClassCondition", Target.CLASS, e.getIdClassCondition());
            ref(g, "events", id, "idItemCondition", Target.ITEM, e.getIdItemCondition());
            Map<String, Object> row = new HashMap<>();
            row.put("registryKeyCondition", e.getRegistryKeyCondition());
            row.put("registryValueCondition", e.getRegistryValueCondition());
            g.eventData.put(id, row);
            if (e.getId() != null && e.getIdEventNext() != null) {
                g.eventNext.put(e.getId().intValue(), e.getIdEventNext());
            }
        }
        for (ChoiceEntity c : choices) {
            String id = str(c.getId());
            ref(g, "choices", id, "idEvent", Target.EVENT, c.getIdEvent());
            ref(g, "choices", id, "idLocation", Target.LOCATION, c.getIdLocation());
            ref(g, "choices", id, "idEventTorun", Target.EVENT, c.getIdEventTorun());
            if (c.getId() != null) {
                g.choiceOtherwise.put(c.getId().intValue(), truthy(c.getOtherwiseFlag()));
            }
        }
        for (ChoiceEffectEntity ce : readPort.findChoiceEffectsByStoryId(storyId)) {
            if (ce.getIdChoices() != null) {
                g.choicesWithOption.add(ce.getIdChoices());
            }
            ref(g, "choice-effects", str(ce.getId()), "idChoices", Target.CHOICE, ce.getIdChoices());
        }
        for (ChoiceConditionEntity cc : readPort.findChoiceConditionsByStoryId(storyId)) {
            ref(g, "choice-conditions", str(cc.getId()), "idChoices", Target.CHOICE, cc.getIdChoices());
            g.keyRefs.add(new KeyRef(str(cc.getId()), cc.getType(), cc.getKey()));
        }
        for (EventEffectEntity ee : readPort.findEventEffectsByStoryId(storyId)) {
            String id = str(ee.getId());
            ref(g, "event-effects", id, "idEvent", Target.EVENT, ee.getIdEvent());
            ref(g, "event-effects", id, "idItemTarget", Target.ITEM, ee.getIdItemTarget());
            ref(g, "event-effects", id, "targetClass", Target.CLASS, ee.getTargetClass());
            // Step 29 — here idWeather is the EFFECT that sets the match weather.
            ref(g, "event-effects", id, "idWeather", Target.WEATHER, ee.getIdWeather());
        }
        for (ItemEffectEntity ie : readPort.findItemEffectsByStoryId(storyId)) {
            ref(g, "item-effects", str(ie.getId()), "idItem", Target.ITEM, ie.getIdItem());
        }
        for (ClassBonusEntity cb : readPort.findClassBonusesByStoryId(storyId)) {
            ref(g, "class-bonuses", str(cb.getId()), "idClass", Target.CLASS, cb.getIdClass());
        }
        for (MissionStepEntity ms : readPort.findMissionStepsByStoryId(storyId)) {
            ref(g, "mission-steps", str(ms.getId()), "idMission", Target.MISSION, ms.getIdMission());
        }
        for (WeatherRuleEntity wr : readPort.findWeatherRulesByStoryId(storyId)) {
            addId(g.weathers, wr.getId());
            ref(g, "weather-rules", str(wr.getId()), "idEvent", Target.EVENT, wr.getIdEvent());
        }
        for (GlobalRandomEventEntity gr : readPort.findGlobalRandomEventsByStoryId(storyId)) {
            ref(g, "global-random-events", str(gr.getId()), "idEvent", Target.EVENT, gr.getIdEvent());
        }
        for (LocationNeighborEntity n : readPort.findLocationNeighborsByStoryId(storyId)) {
            String nid = str(n.getId());
            ref(g, "location-neighbors", nid, "idLocationFrom", Target.LOCATION, n.getIdLocationFrom());
            ref(g, "location-neighbors", nid, "idLocationTo", Target.LOCATION, n.getIdLocationTo());
            g.neighbors.add(new Neighbor(nid, n.getIdLocationFrom(), n.getIdLocationTo(), n.getDirection()));
        }
        for (ItemEntity it : items) {
            restriction(g, "items", str(it.getId()), it.getIdClassPermitted(), it.getIdClassProhibited());
        }
        for (TraitEntity tr : readPort.findTraitsByStoryId(storyId)) {
            restriction(g, "traits", str(tr.getId()), tr.getIdClassPermitted(), tr.getIdClassProhibited());
        }
        for (CharacterTemplateEntity ct : readPort.findCharacterTemplatesByStoryId(storyId)) {
            String id = str(ct.getIdTipo());
            restriction(g, "character-templates", id, ct.getIdClassPermitted(), ct.getIdClassProhibited());
            g.templates.add(new TemplateStat(id, ct.getLifeMax(), ct.getEnergyMax(),
                    ct.getDexterityStart(), ct.getIntelligenceStart(), ct.getConstitutionStart(), ct.getSadMax()));
        }
        return g;
    }

    // ===== Small helpers =====

    private void ref(StoryGraph g, String type, String id, String field, Target target, Integer value) {
        if (value != null && value > 0) {
            g.refs.add(new Ref(refRule(target), type, id, field, target, value));
        }
    }

    private void restriction(StoryGraph g, String type, String id, Integer permitted, Integer prohibited) {
        g.restrictions.add(new ClassRestriction(type, id, permitted, prohibited));
        if (permitted != null && permitted > 0) {
            g.refs.add(new Ref("R6_CLASS_REF", type, id, "idClassPermitted", Target.CLASS, permitted));
        }
        if (prohibited != null && prohibited > 0) {
            g.refs.add(new Ref("R6_CLASS_REF", type, id, "idClassProhibited", Target.CLASS, prohibited));
        }
    }

    private String refRule(Target t) {
        return switch (t) {
            case LOCATION -> "R_LOCATION_REF";
            case EVENT -> "R_EVENT_REF";
            case ITEM -> "R_ITEM_REF";
            case CHOICE -> "R_CHOICE_REF";
            case CLASS -> "R_CLASS_REF";
            case MISSION -> "R_MISSION_REF";
            case WEATHER -> "R_WEATHER_REF";
        };
    }

    private void collectIds(Set<Integer> set, List<Map<String, Object>> items, String key) {
        for (Map<String, Object> it : items) {
            addId(set, asInt(it.get(key)));
        }
    }

    private void addId(Set<Integer> set, Object idObj) {
        Integer id = asInt(idObj);
        if (id != null) {
            set.add(id);
        }
    }

    private void addId(Set<Integer> set, Long id) {
        if (id != null) {
            set.add(id.intValue());
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> list(Map<String, Object> data, String key) {
        Object v = data.get(key);
        if (v instanceof List<?>) {
            return (List<Map<String, Object>>) v;
        }
        return List.of();
    }

    private Integer asInt(Object v) {
        if (v instanceof Number n) {
            return n.intValue();
        }
        if (v instanceof String s) {
            try {
                return Integer.parseInt(s.trim());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private String str(Object v) {
        return v != null ? v.toString() : null;
    }

    private boolean truthy(Object v) {
        Integer i = asInt(v);
        if (i != null) {
            return i != 0;
        }
        return Boolean.TRUE.equals(v) || "true".equalsIgnoreCase(String.valueOf(v));
    }

    // ===== Internal normalised model =====

    private enum Target { LOCATION, EVENT, ITEM, CHOICE, CLASS, MISSION, WEATHER }

    private record Ref(String rule, String entityType, String entityId, String field, Target target, Integer value) {}

    private record Neighbor(String entityId, Integer from, Integer to, String direction) {}

    private record KeyRef(String entityId, String type, String key) {}

    private record ClassRestriction(String entityType, String entityId, Integer permitted, Integer prohibited) {}

    private record TemplateStat(String entityId, Integer lifeMax, Integer energyMax,
                                Integer dexterity, Integer intelligence, Integer constitution, Integer sadMax) {}

    private static final class StoryGraph {
        final Set<Integer> locations = new HashSet<>();
        final Set<Integer> events = new HashSet<>();
        final Set<Integer> items = new HashSet<>();
        final Set<Integer> choices = new HashSet<>();
        final Set<Integer> classes = new HashSet<>();
        final Set<Integer> missions = new HashSet<>();
        final Set<Integer> weathers = new HashSet<>();
        final Set<String> keyNames = new HashSet<>();
        final List<Ref> refs = new ArrayList<>();
        final List<Neighbor> neighbors = new ArrayList<>();
        final List<KeyRef> keyRefs = new ArrayList<>();
        final List<ClassRestriction> restrictions = new ArrayList<>();
        final List<TemplateStat> templates = new ArrayList<>();
        final Map<Integer, Integer> eventNext = new HashMap<>();
        final Map<Integer, Boolean> choiceOtherwise = new HashMap<>();
        final Set<Integer> choicesWithOption = new HashSet<>();
        /** Step 29 — event id to its authored fields, so the entity-local rules can run story-wide. */
        final Map<String, Map<String, Object>> eventData = new HashMap<>();
    }
}
