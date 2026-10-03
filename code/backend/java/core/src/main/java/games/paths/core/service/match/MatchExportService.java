package games.paths.core.service.match;

import games.paths.core.model.match.MatchStatuses;
import games.paths.core.model.match.export.CanonicalJson;
import games.paths.core.model.match.export.LogTypeMapper;
import games.paths.core.model.match.export.NeutralColumnCodec;
import games.paths.core.model.match.export.NeutralColumnCodec.Lookup;
import games.paths.core.port.match.MatchCommandPort;
import games.paths.core.port.match.MatchExportPort;
import games.paths.core.port.match.MatchExportStorePort;
import games.paths.core.port.match.MatchLogWriterPort;
import games.paths.core.port.match.SnapshotPort;
import games.paths.core.port.match.SnapshotStorePort;
import games.paths.core.port.match.SnapshotStorePort.MatchRef;
import games.paths.core.port.match.SnapshotStorePort.StoredSnapshot;
import games.paths.core.port.story.StoryExportPort;
import games.paths.core.service.story.StoryFingerprint;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;

import static games.paths.core.model.match.export.NeutralColumnCodec.list;
import static games.paths.core.model.match.export.NeutralColumnCodec.lng;
import static games.paths.core.model.match.export.NeutralColumnCodec.map;
import static games.paths.core.model.match.export.NeutralColumnCodec.nz;
import static games.paths.core.model.match.export.NeutralColumnCodec.str;

/**
 * MatchExportService - v0.41.4 Step 41 H.6: the export (pause, latest time-end snapshot, file, restore,
 * EXPORTED row, resume - decisions 45, 58) and the port facade of the import service.
 */
public class MatchExportService implements MatchExportPort {

    private static final DateTimeFormatter ISO_MILLIS =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC);

    private final SnapshotStorePort snapshots;
    private final SnapshotPort snapshotPort;
    private final MatchExportStorePort store;
    private final StoryExportPort storyExport;
    private final MatchImportService importer;
    private final String appVersion;
    private final String server;
    private final long maxBytes;
    private MatchLogWriterPort logWriter;
    private MatchCommandPort matchCommands;

    @SuppressWarnings("java:S107")
    public MatchExportService(SnapshotStorePort snapshots, SnapshotPort snapshotPort, MatchExportStorePort store,
                              StoryExportPort storyExport, MatchImportService importer, String appVersion,
                              String server, long maxBytes) {
        this.snapshots = snapshots;
        this.snapshotPort = snapshotPort;
        this.store = store;
        this.storyExport = storyExport;
        this.importer = importer;
        this.appVersion = appVersion;
        this.server = server;
        this.maxBytes = maxBytes;
    }

    public void setLogWriter(MatchLogWriterPort logWriter) {
        this.logWriter = logWriter;
    }

    public void setMatchCommands(MatchCommandPort matchCommands) {
        this.matchCommands = matchCommands;
    }

    @Override
    public Map<String, Object> check(Map<String, Object> request) {
        return importer.check(request);
    }

    @Override
    public Map<String, Object> importMatch(Map<String, Object> request) {
        return importer.importMatch(request);
    }

    // ── export ──────────────────────────────────────────────────────────────

    @Override
    public ExportResult exportMatch(String uuidMatch) {
        MatchRef match = snapshots.findMatchByUuid(uuidMatch).orElseThrow(() -> new MatchExportException(
                MatchExportException.Code.MATCH_NOT_FOUND, "Match not found: " + uuidMatch));
        List<StoredSnapshot> list = snapshots.list(match.id());
        if (MatchStatuses.CREATED.equals(match.status()) || list.isEmpty()) {
            throw new MatchExportException(MatchExportException.Code.NO_SNAPSHOT,
                    "The match has no time-end snapshot to export");
        }
        StoredSnapshot latest = list.get(0);
        String original = match.status();
        boolean running = MatchStatuses.RUNNING.equals(original);
        boolean terminal = MatchStatuses.isTerminal(original);
        if (running) {
            snapshots.setStatus(match.id(), MatchStatuses.PAUSED);
        }
        Map<String, Object> document;
        String canonical;
        try {
            SnapshotPort.SnapshotCheck check = snapshotPort.check(uuidMatch, latest.uuid());
            if (!check.valid()) {
                throw new MatchExportException(MatchExportException.Code.SNAPSHOT_INTEGRITY_FAILED,
                        "The snapshot failed its integrity check", check.errors().stream()
                        .map(e -> new Issue(e.code(), e.message())).toList());
            }
            StoredSnapshot full = snapshots.find(match.id(), latest.uuid()).orElseThrow(() -> new MatchExportException(
                    MatchExportException.Code.NO_SNAPSHOT, "The snapshot disappeared during the export"));
            document = build(match, full);
            canonical = CanonicalJson.write(document);
            if (canonical.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > maxBytes) {
                throw new MatchExportException(MatchExportException.Code.EXPORT_TOO_LARGE,
                        "The export is larger than " + maxBytes + " bytes");
            }
        } catch (RuntimeException e) {
            if (running) {
                snapshots.setStatus(match.id(), original);
            }
            throw e;
        }
        if (!terminal) {
            snapshotPort.restore(uuidMatch, latest.uuid());
            if (logWriter != null) {
                int now = snapshots.findMatchById(match.id()).map(MatchRef::currentClock).orElse(latest.clock());
                logWriter.write(match.id(), null, null, now, MatchLogWriterPort.exported(latest.clock()));
            }
            if (running && matchCommands != null) {
                matchCommands.updateMatch(uuidMatch, MatchStatuses.RUNNING, null, MatchLogWriterPort.ADMIN_RESUME);
            }
        }
        String fileName = "match-" + uuidMatch.substring(0, Math.min(8, uuidMatch.length())) + "-clock-"
                + latest.clock() + ".json";
        return new ExportResult(document, canonical, fileName);
    }

    /** The neutral document of one snapshot: payload state, logs up to its marks, users, story, engine. */
    Map<String, Object> build(MatchRef match, StoredSnapshot snapshot) {
        Map<String, Object> payload = SnapshotService.parse(snapshot.payload());
        Map<String, List<Map<String, Object>>> state = SnapshotService.applyOwner(SnapshotService.state(payload),
                match.idUserCreator(), match.idUserCreator() == null ? Map.of() : snapshots.characterUsers(match.id()));
        Map<String, Long> marks = SnapshotService.logMarks(payload);
        Map<String, Object> matchRow = state.getOrDefault(SnapshotService.MATCH_TABLE, List.of()).stream()
                .findFirst().orElse(Map.of());
        List<Map<String, Object>> characters = new ArrayList<>(state.getOrDefault(SnapshotService.CHARACTER_TABLE, List.of()));
        characters.sort(Comparator.comparingLong(c -> nz(lng(c.get("id")))));
        String storyUuid = store.storyUuidById(match.idStory()).orElse(null);
        Map<String, Object> story = storyUuid == null ? null : storyExport.exportStory(storyUuid);
        Map<String, Object> storyData = story == null ? Map.of() : story;

        Set<Long> userIds = new LinkedHashSet<>();
        userIds.add(lng(matchRow.get("id_user_creator")));
        characters.forEach(c -> userIds.add(lng(c.get("id_user"))));
        userIds.remove(null);
        Map<Long, Map<String, Object>> users = store.usersByIds(userIds);
        Map<Long, String> userUuid = new LinkedHashMap<>();
        users.forEach((id, row) -> userUuid.put(id, str(row.get("uuid"))));
        Map<Long, String> characterUuid = new LinkedHashMap<>();
        characters.forEach(c -> characterUuid.put(lng(c.get("id")), str(c.get("uuid"))));
        Lookup lookup = new Lookup(userUuid, characterUuid, idByUuid(storyData, "characterTemplates"),
                idByUuid(storyData, "classes"), idByUuid(storyData, "traits"));

        Long party = characters.isEmpty() ? null : lng(characters.get(0).get("id_location"));
        Map<String, Object> doc = new LinkedHashMap<>();
        doc.put("format", FORMAT);
        doc.put("formatVersion", FORMAT_VERSION);
        doc.put("source", source(snapshot));
        doc.put("story", storySection(storyUuid, storyData));
        List<Map<String, Object>> userRows = new ArrayList<>();
        userIds.forEach(id -> {
            if (users.containsKey(id)) {
                userRows.add(NeutralColumnCodec.user(users.get(id)));
            }
        });
        doc.put("users", userRows);
        doc.put("match", NeutralColumnCodec.match(matchRow, lookup, party, match.idStory()));
        doc.put("characters", characterSection(state, characters, lookup));
        Map<String, List<Map<String, Object>>> logs = new LinkedHashMap<>();
        for (String table : NeutralColumnCodec.TIMELINE_TABLES) {
            logs.put(table, store.logRows(match.id(), table, marks.getOrDefault(table, 0L)));
        }
        List<Map<String, Object>> choices = store.logRows(match.id(), NeutralColumnCodec.LOG_CHOICES_EXECUTED,
                marks.getOrDefault(NeutralColumnCodec.LOG_CHOICES_EXECUTED, 0L));
        doc.put("state", stateSection(state, lookup, choices, lng(storyData.get("idLocationStart"))));
        doc.put("engine", engine(characters, logs));
        doc.put("logs", NeutralColumnCodec.logs(logs, lookup));
        doc.put("checksum", CanonicalJson.sha256(doc));
        return doc;
    }

    private Map<String, Object> source(StoredSnapshot snapshot) {
        Map<String, Object> source = new LinkedHashMap<>();
        source.put("backend", MatchImportService.BACKEND);
        source.put("dialect", store.dialect());
        source.put("appVersion", appVersion);
        source.put("server", server);
        source.put("exportedAt", ISO_MILLIS.format(Instant.now()));
        source.put("snapshotUuid", snapshot.uuid());
        source.put("snapshotClock", snapshot.clock());
        return source;
    }

    static Map<String, Object> storySection(String storyUuid, Map<String, Object> data) {
        Map<String, Object> story = new LinkedHashMap<>();
        story.put("uuid", storyUuid);
        story.put("title", title(data));
        story.put("fingerprint", StoryFingerprint.of(data));
        story.put("data", data);
        return story;
    }

    /** The English (else the first) short text of the story's idTextTitle. */
    static String title(Map<String, Object> data) {
        Long id = lng(data.get("idTextTitle"));
        String fallback = null;
        for (Object o : list(data.get("texts"))) {
            Map<String, Object> t = map(o);
            if (id != null && id.equals(lng(t.get("idText")))) {
                String text = str(t.get("shortText") != null ? t.get("shortText") : t.get("longText"));
                if ("en".equals(t.get("lang"))) {
                    return text;
                }
                fallback = fallback == null ? text : fallback;
            }
        }
        return fallback;
    }

    private static List<Map<String, Object>> characterSection(Map<String, List<Map<String, Object>>> state,
                                                              List<Map<String, Object>> characters, Lookup lookup) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> c : characters) {
            Long ordinal = lng(c.get("id"));
            Map<String, Object> resources = rowsOf(state, "gaming_backpack_resources", ordinal).stream()
                    .findFirst().orElse(null);
            out.add(NeutralColumnCodec.character(c, lookup, resources,
                    rowsOf(state, "gaming_character_traits", ordinal), rowsOf(state, "gaming_inventory_items", ordinal)));
        }
        return out;
    }

    /** The child rows of one character, by their per-match id (source order). */
    private static List<Map<String, Object>> rowsOf(Map<String, List<Map<String, Object>>> state, String table,
                                                    Long ordinal) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> row : state.getOrDefault(table, List.of())) {
            if (Objects.equals(lng(row.get("id_character_match")), ordinal)) {
                out.add(row);
            }
        }
        out.sort(Comparator.comparingLong(r -> nz(lng(r.get("id")))));
        return out;
    }

    private static Map<String, Object> stateSection(Map<String, List<Map<String, Object>>> state, Lookup lookup,
                                                    List<Map<String, Object>> choices, Long startLocation) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("registry", sorted(state.get("gaming_state_registry")).stream()
                .map(r -> NeutralColumnCodec.registry(r, lookup)).toList());
        List<Map<String, Object>> locations = new ArrayList<>(state.getOrDefault("gaming_state_locations", List.of()));
        locations.sort(Comparator.comparingLong(l -> nz(lng(l.get("id_location")))));
        out.put("locations", locations.stream().filter(l -> NeutralColumnCodec.isNonDefaultLocation(l, startLocation))
                .map(NeutralColumnCodec::location).toList());
        List<Map<String, Object>> turns = new ArrayList<>(state.getOrDefault("gaming_turn_queue", List.of()));
        turns.sort(Comparator.comparingLong(t -> nz(lng(t.get("id_character_match")))));
        out.put("turns", turns.stream().map(t -> NeutralColumnCodec.turn(t, lookup)).toList());
        out.put("storyProgress", sorted(state.get("gaming_story_progress")).stream()
                .map(NeutralColumnCodec::progress).toList());
        out.put("choiceHistory", choices.stream().map(NeutralColumnCodec::choiceRow).toList());
        return out;
    }

    private static List<Map<String, Object>> sorted(List<Map<String, Object>> rows) {
        List<Map<String, Object>> out = new ArrayList<>(rows == null ? List.of() : rows);
        out.sort(Comparator.comparingLong(r -> nz(lng(r.get("id")))));
        return out;
    }

    /** H.2.4 export: markers counted like countLogMarkers, visited like findVisitedLocationIds. */
    static Map<String, Object> engine(List<Map<String, Object>> characters, Map<String, List<Map<String, Object>>> logs) {
        Map<Long, long[]> markers = new TreeMap<>();
        for (Map<String, Object> row : logs.getOrDefault(NeutralColumnCodec.LOG_EVENTS, List.of())) {
            String msg = str(row.get("log_message"));
            Long event = lng(row.get("id_event"));
            if (msg == null || event == null) {
                continue;
            }
            if (msg.startsWith(LogTypeMapper.MSG_EVENT_EXECUTED)) {
                markers.computeIfAbsent(event, k -> new long[2])[0]++;
            } else if (msg.startsWith(LogTypeMapper.MSG_CHOICE_SELECTED)) {
                markers.computeIfAbsent(event, k -> new long[2])[1]++;
            }
        }
        List<Map<String, Object>> eventMarkers = new ArrayList<>();
        markers.forEach((event, counts) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("eventId", event);
            m.put("executed", counts[0]);
            m.put("selected", counts[1]);
            eventMarkers.add(m);
        });
        Set<Long> visited = new LinkedHashSet<>();
        characters.forEach(c -> addPositive(visited, c.get("id_location")));
        for (Map<String, Object> row : logs.getOrDefault(NeutralColumnCodec.LOG_MOVEMENTS, List.of())) {
            addPositive(visited, row.get("id_location_from"));
            addPositive(visited, row.get("id_location_to"));
        }
        Map<String, Object> engine = new LinkedHashMap<>();
        engine.put("eventMarkers", eventMarkers);
        engine.put("visitedLocationIds", new ArrayList<>(visited));
        return engine;
    }

    private static void addPositive(Set<Long> set, Object value) {
        Long id = lng(value);
        if (id != null && id > 0) {
            set.add(id);
        }
    }

    /** Story uuid → story-local id of one story list. */
    static Map<String, Long> idByUuid(Map<String, Object> story, String key) {
        Map<String, Long> out = new LinkedHashMap<>();
        for (Object o : list(story.get(key))) {
            Map<String, Object> row = map(o);
            if (row.get("uuid") != null && lng(row.get("id")) != null) {
                out.put(str(row.get("uuid")), lng(row.get("id")));
            }
        }
        return out;
    }
}
