package games.paths.core.service.match;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import games.paths.core.model.match.MatchStatuses;
import games.paths.core.port.match.MatchLogWriterPort;
import games.paths.core.port.match.SnapshotPort;
import games.paths.core.port.match.SnapshotStorePort;
import games.paths.core.port.match.SnapshotStorePort.MatchRef;
import games.paths.core.port.match.SnapshotStorePort.NewSnapshot;
import games.paths.core.port.match.SnapshotStorePort.StoredSnapshot;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

/**
 * SnapshotService - v0.41.1 Step 41 B: a LIGHT snapshot at every time-end (canonical JSON, SHA-256),
 * the last N kept; admin list, check and restore (log cut, time-start, PAUSED - decisions 3, 4, 18).
 */
public class SnapshotService implements SnapshotPort, SnapshotPort.TimeEndWriter {

    public static final int PAYLOAD_VERSION = 1;
    static final String K_VERSION = "v";
    static final String K_MATCH_UUID = "matchUuid";
    static final String K_ID_STORY = "idStory";
    static final String K_CLOCK = "clock";
    static final String K_STATE = "state";
    static final String K_LOG_MARKS = "logMarks";
    static final String MATCH_TABLE = "gaming_match";
    static final String CHARACTER_TABLE = "gaming_character_instance";

    private static final System.Logger LOG = System.getLogger(SnapshotService.class.getName());
    private static final ObjectMapper JSON = JsonMapper.builder()
            .enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS).build();
    private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() { };

    /** A story id a state row points at: (state table, column) read in (story table, column). */
    record StoryRef(String table, String column, String storyTable, String storyColumn, String label) {
    }

    static final List<StoryRef> STORY_REFS = List.of(
            new StoryRef(MATCH_TABLE, "id_current_weather", "list_weather_rules", "id", "weather"),
            new StoryRef(CHARACTER_TABLE, "id_location", "list_locations", "id", "location"),
            new StoryRef(CHARACTER_TABLE, "id_class", "list_classes", "id", "class"),
            new StoryRef(CHARACTER_TABLE, "id_character_template", "list_character_templates", "id_tipo", "template"),
            new StoryRef("gaming_inventory_items", "id_item", "list_items", "id", "item"),
            new StoryRef("gaming_character_traits", "id_traits", "list_traits", "id", "trait"),
            new StoryRef("gaming_character_traits", "id_event", "list_events", "id", "event"),
            new StoryRef("gaming_state_registry", "id_event", "list_events", "id", "event"),
            new StoryRef("gaming_state_registry", "id_choice", "list_choices", "id", "choice"),
            new StoryRef("gaming_state_registry", "id_mission", "list_missions", "id", "mission"),
            new StoryRef("gaming_state_locations", "id_location", "list_locations", "id", "location"),
            new StoryRef("gaming_active_choices", "id_event", "list_events", "id", "event"),
            new StoryRef("gaming_active_choices", "id_choise", "list_choices", "id", "choice"),
            new StoryRef("gaming_story_progress", "id_event", "list_events", "id", "event"),
            new StoryRef("gaming_story_progress", "id_choise", "list_choices", "id", "choice"));

    private final SnapshotStorePort store;
    private final int keepPerMatch;
    private TimeAdvancementService timeService;
    private MatchLogWriterPort logWriter;

    public SnapshotService(SnapshotStorePort store, int keepPerMatch) {
        this.store = store;
        this.keepPerMatch = keepPerMatch;
    }

    /** The engine that runs the time-start after a restore; set once at wiring time (a cycle). */
    public void setTimeService(TimeAdvancementService timeService) {
        this.timeService = timeService;
    }

    public void setLogWriter(MatchLogWriterPort logWriter) {
        this.logWriter = logWriter;
    }

    // ── time-end ────────────────────────────────────────────────────────────

    /** Best effort: a snapshot that cannot be written is a WARN line, never a failed time-end. */
    @Override
    public void writeAtTimeEnd(long idMatch) {
        if (keepPerMatch <= 0) {
            return;
        }
        try {
            store.findMatchById(idMatch).ifPresent(this::write);
        } catch (RuntimeException e) {
            LOG.log(System.Logger.Level.WARNING, "SNAPSHOT match {0} not written: {1}", idMatch, e.getMessage());
        }
    }

    private void write(MatchRef match) {
        write(match, "Time-end of clock " + match.currentClock());
        store.prune(match.id(), keepPerMatch);
    }

    /** v0.41.4 - a LIGHT snapshot now (the "Imported at clock N" rollback point); answers its uuid. */
    public String writeNow(long idMatch, String description) {
        MatchRef match = store.findMatchById(idMatch).orElseThrow(() -> new SnapshotException(
                SnapshotException.Code.MATCH_NOT_FOUND, "Match not found: " + idMatch));
        write(match, description);
        if (keepPerMatch > 0) {
            store.prune(match.id(), keepPerMatch);
        }
        List<StoredSnapshot> rows = store.list(match.id());
        return rows.isEmpty() ? null : rows.get(0).uuid();
    }

    private void write(MatchRef match, String description) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put(K_VERSION, PAYLOAD_VERSION);
        payload.put(K_MATCH_UUID, match.uuid());
        payload.put(K_ID_STORY, match.idStory());
        payload.put(K_CLOCK, match.currentClock());
        payload.put(K_STATE, store.readState(match.id()));
        payload.put(K_LOG_MARKS, store.logMarks(match.id()));
        String json = canonical(payload);
        store.insert(new NewSnapshot(match.id(), match.idStory(), match.currentClock(), TYPE_LIGHT,
                json, sha256(json), description));
    }

    // ── admin ───────────────────────────────────────────────────────────────

    @Override
    public List<SnapshotSummary> list(String uuidMatch) {
        MatchRef match = requireMatch(uuidMatch);
        return store.list(match.id()).stream()
                .map(s -> new SnapshotSummary(s.uuid(), s.clock(), s.type(), s.timestamp(),
                        s.description(), s.sizeBytes()))
                .toList();
    }

    @Override
    public SnapshotCheck check(String uuidMatch, String uuidSnapshot) {
        MatchRef match = requireMatch(uuidMatch);
        List<CheckError> errors = verify(match, requireSnapshot(match, uuidSnapshot));
        return new SnapshotCheck(errors.isEmpty(), errors);
    }

    @Override
    public RestoreResult restore(String uuidMatch, String uuidSnapshot) {
        MatchRef match = requireMatch(uuidMatch);
        StoredSnapshot snapshot = requireSnapshot(match, uuidSnapshot);
        List<CheckError> errors = verify(match, snapshot);
        if (!errors.isEmpty()) {
            throw new SnapshotException(SnapshotException.Code.SNAPSHOT_INTEGRITY_FAILED,
                    "The snapshot failed its integrity check", errors);
        }
        Map<String, Object> payload = parse(snapshot.payload());
        long removed = store.restore(match.id(), snapshot.id(), withCurrentOwner(match, state(payload)),
                logMarks(payload));
        int clock = snapshot.clock();
        if (logWriter != null) {
            logWriter.write(match.id(), null, null, clock, MatchLogWriterPort.snapshotRestored(clock));
        }
        // Decision 18: the time-start at once (clock N+1, weather and random event again), then PAUSED.
        if (timeService != null) {
            timeService.startTimeAfterRestore(match.uuid());
        }
        store.setStatus(match.id(), MatchStatuses.PAUSED);
        return new RestoreResult(STATUS_RESTORED, snapshot.uuid(), clock, MatchStatuses.PAUSED, removed);
    }

    // ── check ───────────────────────────────────────────────────────────────

    List<CheckError> verify(MatchRef match, StoredSnapshot snapshot) {
        List<CheckError> errors = new ArrayList<>();
        Map<String, Object> payload = parse(snapshot.payload());
        if (payload == null) {
            errors.add(new CheckError(CHECKSUM_MISMATCH, "The payload is not readable JSON"));
            return errors;
        }
        if (!sha256(canonical(payload)).equals(snapshot.checksum())) {
            errors.add(new CheckError(CHECKSUM_MISMATCH, "The payload does not match its checksum"));
        }
        Long version = asLong(payload.get(K_VERSION));
        if (version == null || version != PAYLOAD_VERSION) {
            errors.add(new CheckError(VERSION_UNKNOWN, "Unknown payload version: " + payload.get(K_VERSION)));
            return errors;
        }
        Long idStory = asLong(payload.get(K_ID_STORY));
        if (!match.uuid().equals(payload.get(K_MATCH_UUID)) || idStory == null || idStory != match.idStory()) {
            errors.add(new CheckError(MATCH_MISMATCH, "The snapshot belongs to another match or story"));
        }
        Map<String, List<Map<String, Object>>> state = withCurrentOwner(match, state(payload));
        errors.addAll(missingStoryEntities(match.idStory(), state));
        errors.addAll(missingUsers(state));
        return errors;
    }

    /**
     * v0.41.6 decision 1: the creator and every character's user become the current owners (after the
     * checksum); a character the match no longer has goes to the current creator.
     */
    Map<String, List<Map<String, Object>>> withCurrentOwner(MatchRef match,
                                                            Map<String, List<Map<String, Object>>> state) {
        return applyOwner(state, match.idUserCreator(),
                match.idUserCreator() == null ? Map.of() : store.characterUsers(match.id()));
    }

    /** Rewrites the owner columns of a parsed state in place; a null creator leaves it untouched. */
    static Map<String, List<Map<String, Object>>> applyOwner(Map<String, List<Map<String, Object>>> state,
                                                             Long idUserCreator, Map<Long, Long> characterUsers) {
        if (idUserCreator == null) {
            return state;
        }
        state.getOrDefault(MATCH_TABLE, List.of()).forEach(r -> r.put("id_user_creator", idUserCreator));
        for (Map<String, Object> row : state.getOrDefault(CHARACTER_TABLE, List.of())) {
            Long current = characterUsers.get(asLong(row.get("id")));
            row.put("id_user", current == null ? idUserCreator : current);
        }
        return state;
    }

    private record Target(String storyTable, String storyColumn, String label) {
    }

    private List<CheckError> missingStoryEntities(long idStory, Map<String, List<Map<String, Object>>> state) {
        Map<Target, Set<Long>> wanted = new LinkedHashMap<>();
        for (StoryRef ref : STORY_REFS) {
            for (Map<String, Object> row : state.getOrDefault(ref.table(), List.of())) {
                Long id = asLong(row.get(ref.column()));
                if (id != null && id > 0) {
                    wanted.computeIfAbsent(new Target(ref.storyTable(), ref.storyColumn(), ref.label()),
                            k -> new TreeSet<>()).add(id);
                }
            }
        }
        List<CheckError> errors = new ArrayList<>();
        wanted.forEach((target, ids) -> {
            Set<Long> found = store.existingStoryIds(target.storyTable(), target.storyColumn(), idStory, ids);
            for (Long id : ids) {
                if (!found.contains(id)) {
                    errors.add(new CheckError(STORY_ENTITY_MISSING,
                            target.label() + " " + id + " is no longer in the story"));
                }
            }
        });
        return errors;
    }

    private List<CheckError> missingUsers(Map<String, List<Map<String, Object>>> state) {
        Set<Long> ids = new TreeSet<>();
        state.getOrDefault(MATCH_TABLE, List.of()).forEach(r -> addId(ids, r.get("id_user_creator")));
        state.getOrDefault(CHARACTER_TABLE, List.of()).forEach(r -> addId(ids, r.get("id_user")));
        if (ids.isEmpty()) {
            return List.of();
        }
        Set<Long> found = store.existingUserIds(ids);
        List<CheckError> errors = new ArrayList<>();
        for (Long id : ids) {
            if (!found.contains(id)) {
                errors.add(new CheckError(USER_MISSING, "user " + id + " no longer exists"));
            }
        }
        return errors;
    }

    private static void addId(Set<Long> ids, Object value) {
        Long id = asLong(value);
        if (id != null && id > 0) {
            ids.add(id);
        }
    }

    // ── payload ─────────────────────────────────────────────────────────────

    /** The state tables of a payload; anything not shaped as table → list of rows is skipped. */
    @SuppressWarnings("unchecked")
    static Map<String, List<Map<String, Object>>> state(Map<String, Object> payload) {
        Map<String, List<Map<String, Object>>> out = new LinkedHashMap<>();
        if (payload != null && payload.get(K_STATE) instanceof Map<?, ?> tables) {
            tables.forEach((name, rows) -> {
                if (rows instanceof List<?> list) {
                    List<Map<String, Object>> clean = new ArrayList<>();
                    list.forEach(r -> {
                        if (r instanceof Map<?, ?> m) {
                            clean.add((Map<String, Object>) m);
                        }
                    });
                    out.put(String.valueOf(name), clean);
                }
            });
        }
        return out;
    }

    static Map<String, Long> logMarks(Map<String, Object> payload) {
        Map<String, Long> out = new LinkedHashMap<>();
        if (payload != null && payload.get(K_LOG_MARKS) instanceof Map<?, ?> marks) {
            marks.forEach((table, mark) -> {
                Long value = asLong(mark);
                if (value != null) {
                    out.put(String.valueOf(table), value);
                }
            });
        }
        return out;
    }

    static String canonical(Map<String, Object> payload) {
        try {
            return JSON.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Snapshot payload is not serialisable", e);
        }
    }

    /** Null when the text is not a JSON object. */
    static Map<String, Object> parse(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return JSON.readValue(json, MAP);
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    static String sha256(String text) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(text.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }

    static Long asLong(Object value) {
        if (value instanceof Number n) {
            return n.longValue();
        }
        if (value instanceof String s && !s.isBlank()) {
            try {
                return Long.parseLong(s.trim());
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    private MatchRef requireMatch(String uuidMatch) {
        return store.findMatchByUuid(uuidMatch).orElseThrow(() -> new SnapshotException(
                SnapshotException.Code.MATCH_NOT_FOUND, "Match not found: " + uuidMatch));
    }

    private StoredSnapshot requireSnapshot(MatchRef match, String uuidSnapshot) {
        return store.find(match.id(), uuidSnapshot).orElseThrow(() -> new SnapshotException(
                SnapshotException.Code.SNAPSHOT_NOT_FOUND, "Snapshot not found: " + uuidSnapshot));
    }
}
