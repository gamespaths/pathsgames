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

    /**
     * Step 33 — the {@code list_locations} columns that name an engine-fired event. Kept in
     * one place because both graph builders and the R9 rules walk exactly this set.
     */
    private static final List<String> LOCATION_TRIGGER_FIELDS = List.of(
            "idEventIfFirstTime",
            "idEventNotFirstTime",
            "idEventIfCharacterEnterEmptyLocation",
            "idEventIfCharacterStartTime",
            "idEventIfCounterZero");

    /**
     * The two types a player can execute. Mirrors
     * {@code EventAvailabilityChecker.EXECUTABLE_TYPES}, duplicated rather than imported
     * because the validator lives in the story package and must not depend on the match
     * engine. Kept in sync by {@code StoryValidatorServiceTest}.
     */
    private static final Set<String> EXECUTABLE_EVENT_TYPES = Set.of("NORMAL", "ONCE");

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
            case "choices" -> validateChoiceLocal(entityType, id, data, report);
            default -> { /* no entity-local rule */ }
        }
        return report;
    }

    /**
     * Step 31 — entity-local choice rule, reachable from the lenient admin CRUD path.
     *
     * <p>Only an actively-typed {@code idLocation} is rejected here: the binding is
     * deprecated, so writing one is always a mistake. A missing {@code idEvent} is
     * deliberately tolerated — a draft choice may exist before its event while
     * authoring (the Robot CRUD suite creates {@code {priority: 1}} and expects 201);
     * the whole-graph rule below closes the gap at import and validate-story.</p>
     */
    private void validateChoiceLocal(String type, String id, Map<String, Object> data,
                                     StoryValidationReport report) {
        Integer idLocation = asInt(data.get("idLocation"));
        if (idLocation != null && idLocation > 0) {
            report.add("R8_CHOICE_EVENT", type, id, "idLocation",
                    "idLocation=" + idLocation + " is deprecated — a choice binds to an"
                            + " event (idEvent), never to a location (step 31)");
        }
    }

    /** Step 31 — story-wide: every choice belongs to an event, and only to an event. */
    private void validateChoices(StoryGraph g, StoryValidationReport report) {
        for (Map.Entry<String, Map<String, Object>> e : g.choiceData.entrySet()) {
            String id = e.getKey();
            Integer idEvent = asInt(e.getValue().get("idEvent"));
            if (idEvent == null || idEvent <= 0) {
                report.add("R8_CHOICE_EVENT", "choices", id, "idEvent",
                        "choice " + id + " has no idEvent — every choice must belong"
                                + " to an event (step 31)");
            }
            validateChoiceLocal("choices", id, e.getValue(), report);
        }
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

    /**
     * Step 33 — the two rules that keep an automatic location event runnable.
     *
     * <p>Both are about events a {@code list_locations.id_event_*} column names. The engine
     * fires those without a player: nobody pays for them, nobody is asked anything, and the
     * response they would answer does not exist.</p>
     *
     * <ul>
     *   <li><b>R9_AUTOMATIC_EVENT_CHOICES</b> — such an event may not own choices. There is
     *       no response to carry the options and no {@code select-choice} call could ever
     *       close the cycle, so the match would carry a decision nobody can answer for ever.
     *       The engine refuses it at runtime too; this catches it while it is still text.</li>
     *   <li><b>R9_AUTOMATIC_EVENT_TYPE</b> — such an event may not be {@code NORMAL} or
     *       {@code ONCE}. Those are exactly the two types a player can execute, so the event
     *       would be offered as an action <em>and</em> fire by itself. {@code AUTOMATIC} is
     *       the type to use.</li>
     * </ul>
     */
    private void validateLocationTriggers(StoryGraph g, StoryValidationReport report) {
        if (g.locationTriggerEvents.isEmpty()) {
            return;
        }
        Set<Integer> eventsOwningChoices = new HashSet<>();
        for (Map<String, Object> c : g.choiceData.values()) {
            Integer idEvent = asInt(c.get("idEvent"));
            if (idEvent != null) {
                eventsOwningChoices.add(idEvent);
            }
        }
        for (Map.Entry<Integer, String> t : g.locationTriggerEvents.entrySet()) {
            int idEvent = t.getKey();
            String field = t.getValue();
            if (eventsOwningChoices.contains(idEvent)) {
                report.add("R9_AUTOMATIC_EVENT_CHOICES", "locations", null, field,
                        "event " + idEvent + " is fired automatically by " + field
                                + " but owns choices — an automatic event has no one to ask"
                                + " and no response to ask in (step 33)");
            }
            Map<String, Object> event = g.eventData.get(String.valueOf(idEvent));
            String type = event == null ? null : str(event.get("type"));
            if (type != null && EXECUTABLE_EVENT_TYPES.contains(type.trim().toUpperCase())) {
                report.add("R9_AUTOMATIC_EVENT_TYPE", "locations", null, field,
                        "event " + idEvent + " is fired automatically by " + field
                                + " but its type is " + type + ", which is player-executable"
                                + " — use AUTOMATIC (step 33)");
            }
        }
    }

    /** Records one location trigger column: the R1 reference and the R9 candidate set. */
    private void recordLocationTrigger(StoryGraph g, String idLocation, String field,
                                       Integer idEvent) {
        ref(g, "locations", idLocation, field, Target.EVENT, idEvent);
        if (idEvent != null && idEvent > 0) {
            g.locationTriggerEvents.put(idEvent, field);
        }
    }

    // ===== Rule engine =====

    private void runRules(StoryGraph g, StoryValidationReport report) {
        validateReferences(g, report);   // R1,R3,R5,R7 + neighbor/choice/effect existence
        validateNeighbors(g, report);     // R2
        validateEventChains(g, report);   // R3 cycle
        validateChoiceOptions(g, report); // R4
        validateKeys(g, report);          // R4 KEYS conditions reference valid keys
        validateTemplates(g, report);     // R6 stat ranges
        validateClassRestrictions(g, report); // R6 permitted != prohibited
        validateEvents(g, report);        // R7 event conditions (Step 29)
        validateChoices(g, report);       // R8 choice-event binding (Step 31)
        validateLocationTriggers(g, report); // R9 automatic location events (Step 33)
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
                case TRAIT -> g.traits;
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
            // Only KEYS conditions read the registry. On every other type the `key` column
            // means something else entirely (a stat name for statistics, unused for ITEM),
            // so matching it against the registry would false-fail legal stories (step 31).
            if (kr.type == null || !"KEYS".equalsIgnoreCase(kr.type.trim())) {
                continue;
            }
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
        collectIds(g.traits, list(data, "traits"), "id");
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

        // Step 33 — the five location-side trigger columns. They have existed since V0.10.3
        // and were never referenced here, so a location could point at an event that does not
        // exist and nothing would say so.
        for (Map<String, Object> l : list(data, "locations")) {
            String id = str(l.get("id"));
            for (String field : LOCATION_TRIGGER_FIELDS) {
                Integer idEvent = asInt(l.get(field));
                ref(g, "locations", id, field, Target.EVENT, idEvent);
                if (idEvent != null && idEvent > 0) {
                    g.locationTriggerEvents.put(idEvent, field);
                }
            }
        }

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
            g.choiceData.put(id, c);
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
            String id = str(ce.get("id"));
            ref(g, "choice-effects", id, "idChoices", Target.CHOICE, cid);
            // v0.32.0 — the effect targets a resolved choice can reach (Step 32). All four
            // are EFFECTS, so idWeather here SETS the weather, mirroring the event effects.
            ref(g, "choice-effects", id, "idEvent", Target.EVENT, asInt(ce.get("idEvent")));
            ref(g, "choice-effects", id, "idLocation", Target.LOCATION, asInt(ce.get("idLocation")));
            ref(g, "choice-effects", id, "idWeather", Target.WEATHER, asInt(ce.get("idWeather")));
            ref(g, "choice-effects", id, "idItemTarget", Target.ITEM, asInt(ce.get("idItemTarget")));
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
            // v0.29.3 — forced movement: the location the effect moves its recipients to.
            ref(g, "event-effects", id, "idLocation", Target.LOCATION, asInt(ee.get("idLocation")));
        }
        for (Map<String, Object> ie : list(data, "itemEffects")) {
            String id = str(ie.get("id"));
            ref(g, "item-effects", id, "idItem", Target.ITEM, asInt(ie.get("idItem")));
            // v0.34.0 — CSV of trait ids, same format as the event effects.
            refCsv(g, "item-effects", id, "traitsToAdd", str(ie.get("traitsToAdd")));
            refCsv(g, "item-effects", id, "traitsToRemove", str(ie.get("traitsToRemove")));
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

        // Step 33 — the five location-side trigger columns (see buildFromMap).
        for (LocationEntity l : locations) {
            String id = str(l.getId());
            recordLocationTrigger(g, id, "idEventIfFirstTime", l.getIdEventIfFirstTime());
            recordLocationTrigger(g, id, "idEventNotFirstTime", l.getIdEventNotFirstTime());
            recordLocationTrigger(g, id, "idEventIfCharacterEnterEmptyLocation",
                    l.getIdEventIfCharacterEnterEmptyLocation());
            recordLocationTrigger(g, id, "idEventIfCharacterStartTime",
                    l.getIdEventIfCharacterStartTime());
            recordLocationTrigger(g, id, "idEventIfCounterZero", l.getIdEventIfCounterZero());
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
            row.put("type", e.getType());
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
            Map<String, Object> row = new HashMap<>();
            row.put("idEvent", c.getIdEvent());
            row.put("idLocation", c.getIdLocation());
            g.choiceData.put(id, row);
            if (c.getId() != null) {
                g.choiceOtherwise.put(c.getId().intValue(), truthy(c.getOtherwiseFlag()));
            }
        }
        for (ChoiceEffectEntity ce : readPort.findChoiceEffectsByStoryId(storyId)) {
            if (ce.getIdChoices() != null) {
                g.choicesWithOption.add(ce.getIdChoices());
            }
            String id = str(ce.getId());
            ref(g, "choice-effects", id, "idChoices", Target.CHOICE, ce.getIdChoices());
            // v0.32.0 — the effect targets a resolved choice can reach (Step 32). All four
            // are EFFECTS, so idWeather here SETS the weather, mirroring the event effects.
            ref(g, "choice-effects", id, "idEvent", Target.EVENT, ce.getIdEvent());
            ref(g, "choice-effects", id, "idLocation", Target.LOCATION, ce.getIdLocation());
            ref(g, "choice-effects", id, "idWeather", Target.WEATHER, ce.getIdWeather());
            ref(g, "choice-effects", id, "idItemTarget", Target.ITEM, ce.getIdItemTarget());
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
            // v0.29.3 — forced movement: the location the effect moves its recipients to.
            ref(g, "event-effects", id, "idLocation", Target.LOCATION, ee.getIdLocation());
        }
        for (ItemEffectEntity ie : readPort.findItemEffectsByStoryId(storyId)) {
            String id = str(ie.getId());
            ref(g, "item-effects", id, "idItem", Target.ITEM, ie.getIdItem());
            // v0.34.0 — CSV of trait ids, same format as the event effects.
            refCsv(g, "item-effects", id, "traitsToAdd", ie.getTraitsToAdd());
            refCsv(g, "item-effects", id, "traitsToRemove", ie.getTraitsToRemove());
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
            // v0.34.0 — also the trait universe the effect CSVs are checked against.
            addId(g.traits, tr.getId());
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

    /**
     * Records one reference per id of a comma-separated list. Non-numeric parts are
     * skipped in silence, exactly as the execution engine's {@code csvIds} skips them:
     * the validator must not report what the engine will never try to apply.
     */
    private void refCsv(StoryGraph g, String entityType, String entityId, String field, String csv) {
        if (csv == null || csv.isBlank()) {
            return;
        }
        for (String part : csv.split(",")) {
            String trimmed = part.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            try {
                ref(g, entityType, entityId, field, Target.TRAIT, Integer.valueOf(trimmed));
            } catch (NumberFormatException ignored) {
                // authored noise, not a broken reference
            }
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
            case TRAIT -> "R_TRAIT_REF";
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

    private enum Target { LOCATION, EVENT, ITEM, CHOICE, CLASS, MISSION, WEATHER, TRAIT }

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
        /** v0.34.0 — the story's traits, referenced as a CSV of ids by the effect tables. */
        final Set<Integer> traits = new HashSet<>();
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
        /** Step 31 — choice id to its authored idEvent/idLocation, for the R8 binding rule. */
        final Map<String, Map<String, Object>> choiceData = new HashMap<>();
        /**
         * Step 33 — every event id a {@code list_locations.id_event_*} column names, mapped to
         * the column that names it (for the message). An event reachable from two columns is
         * reported against the last one; the rule is about the event, not the column.
         */
        final Map<Integer, String> locationTriggerEvents = new HashMap<>();
    }
}
