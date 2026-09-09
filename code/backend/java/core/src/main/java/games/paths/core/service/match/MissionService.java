package games.paths.core.service.match;

import games.paths.core.entity.story.BaseMissionEntity;
import games.paths.core.entity.story.MissionEntity;
import games.paths.core.entity.story.MissionStepEntity;
import games.paths.core.entity.story.TextEntity;
import games.paths.core.model.match.MatchMission;
import games.paths.core.model.match.MatchMissionStep;
import games.paths.core.model.story.CardInfo;
import games.paths.core.port.story.ContentQueryPort;
import games.paths.core.port.match.MissionEventPort;
import games.paths.core.port.match.RegistryStorePort;
import games.paths.core.port.match.RegistryStorePort.MissionStateRow;
import games.paths.core.port.match.RegistryStorePort.RegistryRow;
import games.paths.core.port.story.StoryReadPort;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * MissionService - Step 37. A mission is a projection of the registry: no operator of its own,
 * no state table of its own, and not one line of comparison code of its own.
 *
 * <p>Every condition is read through {@link RegistryService#evaluate} with {@code "="}, which on
 * a single-valued key means equality and on a set key means CONTAINED IN. {@code conditionValues}
 * is an AND over that: every listed value must hold. A blank {@code conditionKey} makes the row
 * invalid — it never activates, progresses or completes — which is the exact opposite of the
 * registry's own "blank key = no condition" rule, and deliberately so.</p>
 *
 * <p>State lives on {@code gaming_state_registry}: one row per mission, its {@code id_mission}
 * set, which is what keeps it out of every player-facing registry read. Statuses never move
 * backwards, even when the condition that produced them stops being true.</p>
 */
public class MissionService {

    public static final String STATUS_AVAILABLE = "AVAILABLE";
    public static final String STATUS_ACTIVE = "ACTIVE";
    public static final String STATUS_COMPLETED = "COMPLETED";
    public static final String STATUS_FAILED = "FAILED";

    /** The reserved key prefix of a bookkeeping row. Never declared in {@code list_keys}. */
    private static final String KEY_PREFIX = "mission:";

    /**
     * v0.37.2 - the audit row of a mission that moved. The state row alone said WHERE a match
     * stands and never HOW it got there: the timeline carried the registry write that opened a
     * mission but not the opening, so reading a log meant knowing by heart which key belonged
     * to which mission. One writer, {@link #transition}, so a move can be neither missed nor
     * doubled - the same rule {@code REGISTRY_CHANGE} follows.
     */
    public static final String MSG_MISSION_CHANGE = "MISSION_CHANGE";

    private final RegistryStorePort store;
    private final StoryReadPort storyReadPort;
    private final ContentQueryPort contentQueryPort;

    /** Set after construction: the engine and the event runner know each other in a circle. */
    private MissionEventPort eventPort;

    /** Re-entrancy depth of the cascade, since a completion event may close another mission. */
    private final ThreadLocal<Integer> depth = ThreadLocal.withInitial(() -> 0);

    /** Completion events waiting for a safe moment, as {@code {idMatch, idEvent}} pairs. */
    private final ThreadLocal<List<long[]>> pending = ThreadLocal.withInitial(ArrayList::new);

    /** How many event executions are in flight above us; zero means it is safe to fire now. */
    private final ThreadLocal<Integer> deferrals = ThreadLocal.withInitial(() -> 0);

    public MissionService(RegistryStorePort store) {
        this(store, null, null);
    }

    public MissionService(RegistryStorePort store, StoryReadPort storyReadPort,
                          ContentQueryPort contentQueryPort) {
        this.store = store;
        this.storyReadPort = storyReadPort;
        this.contentQueryPort = contentQueryPort;
    }

    public void setEventPort(MissionEventPort eventPort) {
        this.eventPort = eventPort;
    }

    /**
     * Hold completion events back until the caller is done. An event execution buffers the
     * characters it touches and writes them at the end, so firing a mission event in the middle
     * of one would let a fresh execution read state the outer one has not written yet.
     */
    public void beginDeferral() {
        deferrals.set(deferrals.get() + 1);
    }

    /** Release one hold, and when the last one goes, fire everything that queued up meanwhile. */
    public void endDeferral() {
        int left = Math.max(0, deferrals.get() - 1);
        deferrals.set(left);
        if (left == 0) {
            drain();
            releaseIfIdle();
        }
    }

    /** Drop the thread's copies once the cascade is over, so a pooled thread carries nothing. */
    private void releaseIfIdle() {
        if (depth.get() == 0 && deferrals.get() == 0 && pending.get().isEmpty()) {
            depth.remove();
            deferrals.remove();
            pending.remove();
        }
    }

    // ── condition reading ──────────────────────────────────────────────────

    /**
     * The values a condition demands. {@code conditionValues} is a PIPE-separated list, trimmed
     * around each pipe with empty segments dropped, and when it holds anything at all it WINS
     * over {@code conditionValue} — having authored both is not an error.
     */
    public static List<String> parseValues(String conditionValue, String conditionValues) {
        List<String> out = new ArrayList<>();
        if (conditionValues != null) {
            for (String part : conditionValues.split("\\|")) {
                String trimmed = part.trim();
                if (!trimmed.isEmpty()) {
                    out.add(trimmed);
                }
            }
        }
        if (!out.isEmpty()) {
            return out;
        }
        if (conditionValue != null && !conditionValue.trim().isEmpty()) {
            out.add(conditionValue.trim());
        }
        return out;
    }

    /**
     * Whether one authored row's condition holds. A blank key, or a key with nothing to compare
     * against, is never satisfied — an unfinished mission must not open itself.
     */
    public static boolean satisfied(BaseMissionEntity row, Map<String, List<String>> registry) {
        if (row == null) {
            return false;
        }
        String key = row.getConditionKey();
        if (key == null || key.isBlank()) {
            return false;
        }
        List<String> expected = parseValues(row.getConditionValue(), row.getConditionValues());
        if (expected.isEmpty()) {
            return false;
        }
        List<String> actual = registry.getOrDefault(key, List.of());
        return expected.stream()
                .allMatch(v -> RegistryService.evaluate(RegistryService.OP_EQ, v, actual));
    }

    // ── the engine ─────────────────────────────────────────────────────────

    /**
     * Re-evaluate every mission of the match. Called after each registry write; idempotent, so
     * the cascade a completion event sets off simply re-enters and finds nothing left to do.
     */
    public void onRegistryChange(long idMatch, Integer clock) {
        onRegistryChange(idMatch, store.findStoryIdByMatch(idMatch), clock);
    }

    /** The same pass when the story id is already in hand, which is how the tests drive it. */
    public void onRegistryChange(long idMatch, Long idStory, Integer clock) {
        if (idStory == null || storyReadPort == null) {
            return;
        }
        if (depth.get() >= EventExecutionService.MAX_ENTRY_DEPTH) {
            return;
        }
        List<MissionEntity> missions = missions(idStory);
        if (missions.isEmpty()) {
            return;
        }
        Map<Long, List<MissionStepEntity>> stepsByMission = stepsByMission(idStory);
        Map<String, List<String>> registry = registryValues(idMatch);
        Map<Long, MissionStateRow> states = states(idMatch);

        for (MissionEntity mission : missions) {
            advance(idMatch, mission, stepsByMission.getOrDefault(id(mission), List.of()),
                    registry, states.get(id(mission)), clock);
        }
        if (deferrals.get() == 0) {
            drain();
        }
        releaseIfIdle();
    }

    /** Everything still open when the story ends has failed; what never opened is ignored. */
    public void onStoryEnd(long idMatch) {
        Map<Long, String> uuids = missionUuids(store.findStoryIdByMatch(idMatch));
        for (MissionStateRow state : store.findMissionStates(idMatch)) {
            if (STATUS_AVAILABLE.equals(state.status()) || STATUS_ACTIVE.equals(state.status())) {
                store.upsertMissionState(idMatch, KEY_PREFIX + state.idMission(), STATUS_FAILED,
                        state.idMission(), state.idMissionSteps(), null);
                // v0.37.2 - named by uuid like every other MISSION_CHANGE, so one reader parses
                // the whole timeline; the story is read once, at the end, for that alone.
                store.logChange(idMatch, null, null, null, null,
                        MSG_MISSION_CHANGE + " "
                                + uuids.getOrDefault(state.idMission(), String.valueOf(state.idMission()))
                                + " " + state.status() + " -> " + STATUS_FAILED);
            }
        }
    }

    /** Mission id to uuid for one story. Empty when the story cannot be read. */
    private Map<Long, String> missionUuids(Long idStory) {
        if (idStory == null || storyReadPort == null) {
            return Map.of();
        }
        Map<Long, String> out = new HashMap<>();
        for (MissionEntity mission : missions(idStory)) {
            out.put(id(mission), uuidOf(mission));
        }
        return out;
    }

    /**
     * One mission's transition. Steps may be satisfied out of order, so the walk closes every
     * step already met from the one reached onward and stops at the first that is not.
     */
    private void advance(long idMatch, MissionEntity mission, List<MissionStepEntity> steps,
                         Map<String, List<String>> registry, MissionStateRow state,
                         Integer clock) {
        boolean fresh = state == null;
        if (fresh && !satisfied(mission, registry)) {
            return;
        }
        String status = fresh ? STATUS_AVAILABLE : state.status();
        if (STATUS_COMPLETED.equals(status) || STATUS_FAILED.equals(status)) {
            return;
        }
        Long reached = fresh ? null : state.idMissionSteps();

        int next = indexAfter(steps, reached);
        boolean moved = fresh;
        List<Integer> closed = new ArrayList<>();
        // v0.37.2 — the steps this very pass closed, in order: each one gets a log row of its
        // own, so the timeline can narrate it with the STEP's card rather than the mission's.
        List<MissionStepEntity> closedSteps = new ArrayList<>();
        while (next < steps.size() && satisfied(steps.get(next), registry)) {
            MissionStepEntity step = steps.get(next);
            reached = step.getId();
            closed.add(step.getIdEventCompleted());
            closedSteps.add(step);
            next++;
            moved = true;
        }
        if (!moved) {
            return;
        }
        // No steps at all: the mission's own condition is its completion condition.
        if (next >= steps.size()) {
            status = STATUS_COMPLETED;
        } else if (reached != null) {
            status = STATUS_ACTIVE;
        }
        transition(idMatch, mission, fresh ? null : state.status(), status, reached,
                closedSteps, fresh, clock);
        closed.forEach(idEvent -> queue(idMatch, idEvent));
        if (STATUS_COMPLETED.equals(status)) {
            queue(idMatch, mission.getIdEventCompleted());
        }
    }

    /**
     * Write the state and say so on the log. The two belong together: a status the timeline
     * does not mention is one nobody can explain after the fact.
     *
     * <p>v0.37.2 — one pass can be several things happening at once, and each of them is its
     * own row, because each is narrated by a different card: the MISSION's when it opens and
     * again when it is over, the STEP's for every step the pass closed. A row naming a step is
     * what tells the timeline which of the two to resolve.</p>
     */
    @SuppressWarnings("java:S107")
    private void transition(long idMatch, MissionEntity mission, String previous, String status,
                            Long reached, List<MissionStepEntity> closedSteps, boolean fresh,
                            Integer clock) {
        store.upsertMissionState(idMatch, KEY_PREFIX + uuidOf(mission), status, id(mission),
                reached, clock);
        for (Integer step : rowsOf(closedSteps, status, fresh)) {
            log(idMatch, mission, previous, status, step, clock);
        }
    }

    /**
     * The rows one pass writes, as the step each names — {@code null} for the mission itself.
     * A mission that opens says so, every step it closed says so, and a mission that is over
     * says THAT too, after its last step.
     */
    private static List<Integer> rowsOf(List<MissionStepEntity> closedSteps, String status,
                                        boolean fresh) {
        List<Integer> rows = new ArrayList<>();
        if (fresh) {
            rows.add(null);
        }
        closedSteps.forEach(step -> rows.add(step.getStep()));
        if (STATUS_COMPLETED.equals(status) && !closedSteps.isEmpty()) {
            rows.add(null);
        }
        if (rows.isEmpty()) {
            // Neither opened nor closed anything, yet the state moved: say it once, plainly.
            rows.add(null);
        }
        return rows;
    }

    private void log(long idMatch, MissionEntity mission, String previous, String status,
                     Integer step, Integer clock) {
        StringBuilder detail = new StringBuilder(MSG_MISSION_CHANGE)
                .append(' ').append(uuidOf(mission))
                .append(' ').append(previous == null ? "none" : previous)
                .append(" -> ").append(status);
        if (step != null) {
            // The step number the author wrote, not the row id: the log is read by a person.
            detail.append(" step ").append(step);
        }
        store.logChange(idMatch, null, null, null, clock, detail.toString());
    }

    private void queue(long idMatch, Integer idEvent) {
        if (idEvent != null && idEvent > 0) {
            pending.get().add(new long[]{idMatch, idEvent});
        }
    }

    /** Where the walk resumes: just past the step already reached, or the very first one. */
    private static int indexAfter(List<MissionStepEntity> steps, Long reached) {
        return indexOf(steps, reached) + 1;
    }

    /** Position of the step already reached, or -1 when the match has closed none of them. */
    private static int indexOf(List<MissionStepEntity> steps, Long reached) {
        if (reached == null) {
            return -1;
        }
        for (int i = 0; i < steps.size(); i++) {
            if (reached.equals(steps.get(i).getId())) {
                return i;
            }
        }
        return -1;
    }

    /** Completion events run after the state is written, so a re-entry sees the closed mission. */
    private void drain() {
        List<long[]> events = pending.get();
        if (eventPort == null || events.isEmpty()) {
            events.clear();
            return;
        }
        List<long[]> batch = new ArrayList<>(events);
        events.clear();
        int current = depth.get();
        depth.set(current + 1);
        try {
            for (long[] e : batch) {
                eventPort.runMissionEvent(e[0], e[1], current + 1);
            }
        } finally {
            depth.set(current);
        }
    }

    // ── reads for the API ──────────────────────────────────────────────────

    /** Every mission this match has reached, newest status first is NOT a thing: authored order. */
    public List<MatchMission> list(long idMatch, Long idStory, String status, String lang) {
        if (idStory == null || storyReadPort == null) {
            return List.of();
        }
        Map<Long, MissionStateRow> states = states(idMatch);
        if (states.isEmpty()) {
            return List.of();
        }
        Map<Long, List<MissionStepEntity>> stepsByMission = stepsByMission(idStory);
        String wanted = status == null || status.isBlank()
                ? null : status.trim().toUpperCase(Locale.ROOT);

        List<MatchMission> out = new ArrayList<>();
        for (MissionEntity mission : missions(idStory)) {
            MissionStateRow state = states.get(id(mission));
            if (state == null || (wanted != null && !wanted.equals(state.status()))) {
                continue;
            }
            out.add(toModel(mission, stepsByMission.getOrDefault(id(mission), List.of()),
                    state, idStory, lang));
        }
        return out;
    }

    /** One mission with all its steps. Null when the story has no such mission, or the match has
     *  not reached it — the caller turns both into the same 404. */
    public MatchMission detail(long idMatch, Long idStory, String missionUuid, String lang) {
        if (idStory == null || storyReadPort == null || missionUuid == null || missionUuid.isBlank()) {
            return null;
        }
        Optional<MissionEntity> found = storyReadPort.findMissionByStoryIdAndUuid(idStory, missionUuid);
        if (found.isEmpty()) {
            return null;
        }
        MissionEntity mission = found.get();
        MissionStateRow state = states(idMatch).get(id(mission));
        if (state == null) {
            return null;
        }
        return toModel(mission, stepsByMission(idStory).getOrDefault(id(mission), List.of()),
                state, idStory, lang);
    }

    private MatchMission toModel(MissionEntity mission, List<MissionStepEntity> steps,
                                 MissionStateRow state, Long idStory, String lang) {
        MatchMission m = new MatchMission();
        m.setUuid(mission.getUuid());
        m.setName(text(idStory, mission.getIdTextName(), lang, false));
        m.setDescription(text(idStory, mission.getIdTextDescription(), lang, true));
        m.setIdCard(mission.getIdCard());
        m.setCard(card(idStory, mission.getIdCard(), lang));
        m.setStatus(state.status());
        m.setStepsTotal(steps.size());

        // Everything up to the step reached is closed; a completed mission closes all of them.
        int reached = indexOf(steps, state.idMissionSteps());
        if (STATUS_COMPLETED.equals(state.status())) {
            reached = steps.size() - 1;
        }
        List<MatchMissionStep> out = new ArrayList<>();
        for (int i = 0; i < steps.size(); i++) {
            MissionStepEntity step = steps.get(i);
            MatchMissionStep s = new MatchMissionStep();
            s.setUuid(step.getUuid());
            s.setStep(step.getStep());
            s.setName(text(idStory, step.getIdTextName(), lang, false));
            s.setDescription(text(idStory, step.getIdTextDescription(), lang, true));
            s.setIdCard(step.getIdCard());
            s.setCard(card(idStory, step.getIdCard(), lang));
            s.setDone(i <= reached);
            out.add(s);
        }
        if (reached >= 0 && reached < steps.size()) {
            m.setStepReached(steps.get(reached).getStep());
        }
        m.setSteps(out);
        return m;
    }

    // ── plumbing ───────────────────────────────────────────────────────────

    private List<MissionEntity> missions(Long idStory) {
        List<MissionEntity> missions = storyReadPort.findMissionsByStoryId(idStory);
        if (missions == null) {
            return List.of();
        }
        List<MissionEntity> out = new ArrayList<>(missions);
        out.sort(Comparator.comparing(MissionService::id, Comparator.nullsLast(Long::compareTo)));
        return out;
    }

    private Map<Long, List<MissionStepEntity>> stepsByMission(Long idStory) {
        List<MissionStepEntity> steps = storyReadPort.findMissionStepsByStoryId(idStory);
        Map<Long, List<MissionStepEntity>> out = new LinkedHashMap<>();
        if (steps == null) {
            return out;
        }
        for (MissionStepEntity s : steps) {
            if (s.getIdMission() != null) {
                out.computeIfAbsent(s.getIdMission().longValue(), k -> new ArrayList<>()).add(s);
            }
        }
        out.values().forEach(list -> list.sort(
                Comparator.comparing(MissionStepEntity::getStep, Comparator.nullsLast(Integer::compareTo))));
        return out;
    }

    private Map<Long, MissionStateRow> states(long idMatch) {
        Map<Long, MissionStateRow> out = new HashMap<>();
        for (MissionStateRow r : store.findMissionStates(idMatch)) {
            if (r.idMission() != null) {
                out.put(r.idMission(), r);
            }
        }
        return out;
    }

    /** The registry as the engine compares it: key to its whole set, mission rows excluded. */
    private Map<String, List<String>> registryValues(long idMatch) {
        Map<String, List<String>> out = new LinkedHashMap<>();
        for (RegistryRow r : store.findByMatch(idMatch)) {
            String value = RegistryService.render(r);
            List<String> values = out.computeIfAbsent(r.key(), k -> new ArrayList<>());
            if (value != null) {
                values.add(value);
            }
        }
        return out;
    }

    private String text(Long idStory, Integer idText, String lang, boolean longText) {
        if (idText == null || storyReadPort == null) {
            return null;
        }
        String effective = lang == null || lang.isBlank() ? "en" : lang;
        Optional<TextEntity> found = storyReadPort.findTextByStoryIdTextAndLang(idStory, idText, effective);
        if (found.isEmpty() && !"en".equals(effective)) {
            found = storyReadPort.findTextByStoryIdTextAndLang(idStory, idText, "en");
        }
        return found.map(t -> longText ? t.getLongText() : t.getShortText()).orElse(null);
    }

    private CardInfo card(Long idStory, Integer idCard, String lang) {
        if (contentQueryPort == null || idStory == null || idCard == null) {
            return null;
        }
        return contentQueryPort.getCardByStoryIdAndCardId(idStory, idCard, lang);
    }

    private static Long id(BaseMissionEntity e) {
        return e.getId();
    }

    private static String uuidOf(MissionEntity mission) {
        return mission.getUuid() == null ? String.valueOf(id(mission)) : mission.getUuid();
    }
}
