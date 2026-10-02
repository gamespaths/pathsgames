package games.paths.core.service.match;

import games.paths.core.model.match.MatchStatuses;
import games.paths.core.model.match.export.CanonicalJson;
import games.paths.core.model.match.export.LogTypeMapper;
import games.paths.core.model.match.export.NeutralColumnCodec;
import games.paths.core.model.match.export.NeutralColumnCodec.LogRow;
import games.paths.core.model.match.export.NeutralColumnCodec.Reconciliation;
import games.paths.core.model.match.export.SchemaValidator;
import games.paths.core.model.story.StoryValidationError;
import games.paths.core.model.story.StoryValidationReport;
import games.paths.core.port.match.MatchCommandPort;
import games.paths.core.port.match.MatchExportPort;
import games.paths.core.port.match.MatchExportPort.Issue;
import games.paths.core.port.match.MatchExportPort.MatchExportException;
import games.paths.core.port.match.MatchExportStorePort;
import games.paths.core.port.match.MatchExportStorePort.ImportRows;
import games.paths.core.port.match.MatchExportStorePort.LogInsert;
import games.paths.core.port.match.MatchLogWriterPort;
import games.paths.core.port.match.SnapshotStorePort;
import games.paths.core.port.story.StoryExportPort;
import games.paths.core.port.story.StoryImportPort;
import games.paths.core.port.story.StoryValidatorPort;
import games.paths.core.service.story.StoryExportService;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;

import static games.paths.core.model.match.export.NeutralColumnCodec.list;
import static games.paths.core.model.match.export.NeutralColumnCodec.lng;
import static games.paths.core.model.match.export.NeutralColumnCodec.map;
import static games.paths.core.model.match.export.NeutralColumnCodec.str;

/**
 * MatchImportService - v0.41.4 Step 41 H.5: the dry-run check and the import of a match export v1
 * (story modes, user copy, replace, one transaction, IMPORTED row, imported snapshot, time-start).
 */
public class MatchImportService {

    public static final String BACKEND = "java";
    static final String STATUS_ABSENT = "ABSENT";
    static final String STATUS_SAME = "SAME";
    static final String STATUS_DIFFERENT = "DIFFERENT";
    static final String ACTION_IMPORT = "IMPORT";
    static final String ACTION_USE_EXISTING = "USE_EXISTING";
    static final String USER_NEW = "NEW";
    static final String USER_EXISTING = "EXISTING";
    static final String USER_RENAMED = "RENAMED";
    static final String USER_MAPPED = "MAPPED_BY_EMAIL";
    private static final Set<String> CONFLICTS = Set.of(MatchExportPort.MATCH_EXISTS,
            MatchExportPort.STORY_DIFFERS, MatchExportPort.CHARACTER_EXISTS);
    /** Story list key, label and the neutral ids that must exist in it (H.5 step 3). */
    private static final Map<String, String> STORY_LISTS = Map.ofEntries(
            Map.entry("difficulty", "difficulties"), Map.entry("location", "locations"),
            Map.entry("template", "characterTemplates"), Map.entry("class", "classes"),
            Map.entry("trait", "traits"), Map.entry("item", "items"), Map.entry("event", "events"),
            Map.entry("choice", "choices"), Map.entry("mission", "missions"),
            Map.entry("mission step", "missionSteps"), Map.entry("weather", "weatherRules"));

    private final MatchExportStorePort store;
    private final SnapshotStorePort snapshotStore;
    private final StoryExportPort storyExport;
    private final StoryImportPort storyImport;
    private final StoryValidatorPort storyValidator;
    private final String appVersion;
    private final long maxBytes;
    private final SchemaValidator schema = SchemaValidator.matchExportV1();
    private SnapshotService snapshotService;
    private TimeAdvancementService timeService;
    private MatchLogWriterPort logWriter;
    private MatchCommandPort matchCommands;

    @SuppressWarnings("java:S107")
    public MatchImportService(MatchExportStorePort store, SnapshotStorePort snapshotStore, StoryExportPort storyExport,
                              StoryImportPort storyImport, StoryValidatorPort storyValidator, String appVersion,
                              long maxBytes) {
        this.store = store;
        this.snapshotStore = snapshotStore;
        this.storyExport = storyExport;
        this.storyImport = storyImport;
        this.storyValidator = storyValidator;
        this.appVersion = appVersion;
        this.maxBytes = maxBytes;
    }

    /** The collaborators that already know each other through setters at wiring time. */
    public void setEngine(SnapshotService snapshotService, TimeAdvancementService timeService,
                          MatchLogWriterPort logWriter, MatchCommandPort matchCommands) {
        this.snapshotService = snapshotService;
        this.timeService = timeService;
        this.logWriter = logWriter;
        this.matchCommands = matchCommands;
    }

    /** One planned user: the neutral row, its status on this server, its username and uuid there. */
    record UserPlan(Map<String, Object> user, String status, String targetUsername, String targetUuid) {

        boolean created() {
            return USER_NEW.equals(status) || USER_RENAMED.equals(status);
        }
    }

    /** Everything the check found; the import writes from it. */
    static final class Analysis {
        Map<String, Object> doc;
        final List<Issue> errors = new ArrayList<>();
        final List<Issue> warnings = new ArrayList<>();
        boolean matchExists;
        String storyStatus;
        String storyAction;
        int matchesDeleted;
        Map<String, Object> bundledStory;
        final List<UserPlan> users = new ArrayList<>();
        final List<Map<String, Object>> activeMatches = new ArrayList<>();
        Reconciliation reconciliation;

        boolean valid() {
            return errors.isEmpty();
        }
    }

    // ── check ───────────────────────────────────────────────────────────────

    public Map<String, Object> check(Map<String, Object> request) {
        return checkBody(analyze(request));
    }

    Analysis analyze(Map<String, Object> request) {
        Analysis a = new Analysis();
        Map<String, Object> req = request == null ? Map.of() : request;
        Object export = req.get("export");
        if (!(export instanceof Map<?, ?>)) {
            a.errors.add(new Issue(MatchExportPort.SCHEMA_INVALID, "export must be a match export object"));
            return a;
        }
        a.doc = map(export);
        if (CanonicalJson.size(a.doc) > maxBytes) {
            throw new MatchExportException(MatchExportException.Code.IMPORT_TOO_LARGE,
                    "The export is larger than " + maxBytes + " bytes");
        }
        if (!readable(a)) {
            return a;
        }
        String mode = storyMode(req);
        if (mode == null) {
            a.errors.add(new Issue(MatchExportPort.SCHEMA_INVALID, "storyMode must be AUTO, KEEP or REPLACE"));
            return a;
        }
        Map<String, Object> source = map(a.doc.get("source"));
        if (!Objects.equals(appVersion, source.get("appVersion"))) {
            a.warnings.add(new Issue(MatchExportPort.APP_VERSION_DIFFERS,
                    "Exported by " + source.get("appVersion") + ", this server runs " + appVersion));
        }
        if (!BACKEND.equals(source.get("backend"))) {
            a.warnings.add(new Issue(MatchExportPort.CROSS_FAMILY, "Exported by the " + source.get("backend")
                    + " backend: the time-start after the import may roll other weather or random events"));
        }
        Optional<Long> storyId = story(a, mode);
        users(a, storyId);
        matchAndCharacters(a, Boolean.TRUE.equals(req.get("replace")));
        engine(a);
        return a;
    }

    /** Format, schema, checksum and references; false when the document cannot be read further. */
    private boolean readable(Analysis a) {
        Map<String, Object> doc = a.doc;
        if (!MatchExportPort.FORMAT.equals(doc.get("format"))
                || !Objects.equals(1L, lng(doc.get("formatVersion"))) || !(doc.get("formatVersion") instanceof Number)) {
            a.errors.add(new Issue(MatchExportPort.FORMAT_UNKNOWN, "Unknown format " + doc.get("format")
                    + " version " + doc.get("formatVersion")));
            return false;
        }
        for (String problem : schema.validate(doc)) {
            a.errors.add(new Issue(MatchExportPort.SCHEMA_INVALID, problem));
        }
        if (!a.errors.isEmpty()) {
            return false;
        }
        Map<String, Object> body = new LinkedHashMap<>(doc);
        body.remove("checksum");
        if (!CanonicalJson.sha256(body).equals(doc.get("checksum"))) {
            a.errors.add(new Issue(MatchExportPort.CHECKSUM_MISMATCH, "The file does not match its checksum"));
            return false;
        }
        references(a);
        return a.errors.isEmpty();
    }

    private static void references(Analysis a) {
        Set<String> users = new HashSet<>();
        list(a.doc.get("users")).forEach(u -> users.add(str(map(u).get("uuid"))));
        Set<String> characters = new HashSet<>();
        Set<Long> ordinals = new HashSet<>();
        for (Object o : list(a.doc.get("characters"))) {
            Map<String, Object> c = map(o);
            if (!characters.add(str(c.get("uuid")))) {
                a.errors.add(ref("character " + c.get("uuid") + " is listed twice"));
            }
            if (!ordinals.add(lng(c.get("ordinal")))) {
                a.errors.add(ref("ordinal " + c.get("ordinal") + " is used twice"));
            }
            if (!users.contains(str(c.get("userUuid")))) {
                a.errors.add(ref("user " + c.get("userUuid") + " of character " + c.get("uuid") + " is not in users"));
            }
        }
        Map<String, Object> match = map(a.doc.get("match"));
        if (!users.contains(str(match.get("creatorUserUuid")))) {
            a.errors.add(ref("creator " + match.get("creatorUserUuid") + " is not in users"));
        }
        checkCharacter(a, characters, match.get("activeCharacterUuid"), "match.activeCharacterUuid");
        Map<String, Object> state = map(a.doc.get("state"));
        list(state.get("registry")).forEach(r -> checkCharacter(a, characters, map(r).get("characterUuid"), "registry"));
        Set<String> turns = new HashSet<>();
        for (Object t : list(state.get("turns"))) {
            Object who = map(t).get("characterUuid");
            checkCharacter(a, characters, who, "turns");
            if (!turns.add(str(who))) {
                a.errors.add(ref("character " + who + " has two turns"));
            }
        }
        list(a.doc.get("logs")).forEach(l -> checkCharacter(a, characters, map(l).get("characterUuid"), "logs"));
    }

    private static void checkCharacter(Analysis a, Set<String> characters, Object uuid, String where) {
        if (uuid != null && !characters.contains(str(uuid))) {
            a.errors.add(ref(where + " names an unknown character " + uuid));
        }
    }

    private static Issue ref(String message) {
        return new Issue(MatchExportPort.REFERENCE_INVALID, message);
    }

    private static String storyMode(Map<String, Object> request) {
        Object raw = request.get("storyMode");
        String mode = raw == null ? MatchExportPort.MODE_AUTO : raw.toString().trim().toUpperCase();
        return List.of(MatchExportPort.MODE_AUTO, MatchExportPort.MODE_KEEP, MatchExportPort.MODE_REPLACE)
                .contains(mode) ? mode : null;
    }

    private Optional<Long> story(Analysis a, String mode) {
        Map<String, Object> story = map(a.doc.get("story"));
        String uuid = str(story.get("uuid"));
        a.bundledStory = map(story.get("data"));
        Optional<Long> id = store.storyIdByUuid(uuid);
        Map<String, Object> used;
        if (id.isEmpty()) {
            a.storyStatus = STATUS_ABSENT;
            a.storyAction = ACTION_IMPORT;
            validateBundled(a);
            used = a.bundledStory;
        } else {
            Map<String, Object> target = storyExport.exportStory(uuid);
            boolean same = target != null && games.paths.core.service.story.StoryFingerprint.of(target)
                    .equals(str(story.get("fingerprint")));
            a.storyStatus = same ? STATUS_SAME : STATUS_DIFFERENT;
            if (same) {
                a.storyAction = ACTION_USE_EXISTING;
                used = target;
            } else if (MatchExportPort.MODE_KEEP.equals(mode)) {
                a.storyAction = MatchExportPort.MODE_KEEP;
                used = target;
            } else if (MatchExportPort.MODE_REPLACE.equals(mode)) {
                a.storyAction = MatchExportPort.MODE_REPLACE;
                a.matchesDeleted = store.countMatchesOfStory(id.get());
                a.warnings.add(new Issue(MatchExportPort.STORY_MATCHES_DELETED, a.matchesDeleted
                        + " match(es) of story " + uuid + " are deleted by the story re-import"));
                validateBundled(a);
                used = a.bundledStory;
            } else {
                a.storyAction = MatchExportPort.MODE_AUTO;
                a.errors.add(new Issue(MatchExportPort.STORY_DIFFERS, "Story " + uuid
                        + " exists on this server with other content: choose storyMode KEEP or REPLACE"));
                used = null;
            }
        }
        if (used != null) {
            storyEntities(a, used);
        }
        return id;
    }

    private void validateBundled(Analysis a) {
        if (storyValidator == null) {
            return;
        }
        StoryValidationReport report = storyValidator.validateImportData(storyForImport(a.bundledStory));
        if (!report.isValid()) {
            String rules = report.getErrors().stream().map(StoryValidationError::rule).distinct()
                    .collect(Collectors.joining(", "));
            a.errors.add(new Issue(MatchExportPort.STORY_INVALID, "The bundled story is refused: " + rules));
        }
    }

    /** A deep copy of the bundled story without the source server's story id (the target assigns one). */
    @SuppressWarnings("unchecked")
    static Map<String, Object> storyForImport(Map<String, Object> data) {
        Map<String, Object> copy = (Map<String, Object>) StoryExportService.stripNulls(
                CanonicalJson.parse(CanonicalJson.write(data)));
        copy.remove("id");
        return copy;
    }

    /** Every story-local id of match, characters, state and engine must exist in the story used. */
    private static void storyEntities(Analysis a, Map<String, Object> story) {
        Map<String, Set<Long>> index = new LinkedHashMap<>();
        STORY_LISTS.forEach((label, key) -> {
            Set<Long> ids = new HashSet<>();
            list(story.get(key)).forEach(o -> {
                Map<String, Object> row = map(o);
                Long id = lng(row.get("id"));
                ids.add(id != null ? id : lng(row.get("idTipo")));
            });
            index.put(label, ids);
        });
        Set<String> missing = new TreeSet<>();
        Map<String, Object> match = map(a.doc.get("match"));
        Map<String, Object> loadout = map(match.get("loadout"));
        need(index, missing, "difficulty", match.get("difficultyId"));
        need(index, missing, "template", loadout.get("characterTemplateId"));
        need(index, missing, "class", loadout.get("classId"));
        list(loadout.get("traitIds")).forEach(t -> need(index, missing, "trait", t));
        need(index, missing, "weather", match.get("currentWeatherId"));
        need(index, missing, "location", match.get("partyLocationId"));
        for (Object o : list(a.doc.get("characters"))) {
            Map<String, Object> c = map(o);
            need(index, missing, "template", c.get("characterTemplateId"));
            need(index, missing, "class", c.get("classId"));
            need(index, missing, "location", c.get("locationId"));
            list(c.get("traits")).forEach(t -> {
                need(index, missing, "trait", map(t).get("traitId"));
                need(index, missing, "event", map(t).get("eventId"));
            });
            list(c.get("items")).forEach(i -> need(index, missing, "item", map(i).get("itemId")));
        }
        Map<String, Object> state = map(a.doc.get("state"));
        for (Object o : list(state.get("registry"))) {
            Map<String, Object> r = map(o);
            need(index, missing, "event", r.get("eventId"));
            need(index, missing, "choice", r.get("choiceId"));
            need(index, missing, "mission", r.get("missionId"));
            need(index, missing, "mission step", r.get("missionStepId"));
        }
        list(state.get("locations")).forEach(l -> need(index, missing, "location", map(l).get("locationId")));
        for (String section : List.of("storyProgress", "choiceHistory")) {
            for (Object o : list(state.get(section))) {
                need(index, missing, "event", map(o).get("eventId"));
                need(index, missing, "choice", map(o).get("choiceId"));
            }
        }
        Map<String, Object> engine = map(a.doc.get("engine"));
        list(engine.get("eventMarkers")).forEach(m -> need(index, missing, "event", map(m).get("eventId")));
        list(engine.get("visitedLocationIds")).forEach(l -> need(index, missing, "location", l));
        missing.forEach(m -> a.errors.add(new Issue(MatchExportPort.STORY_ENTITY_MISSING, m + " is not in the story")));
    }

    private static void need(Map<String, Set<Long>> index, Set<String> missing, String label, Object value) {
        Long id = lng(value);
        if (id != null && !index.get(label).contains(id)) {
            missing.add(label + " " + id);
        }
    }

    /** Decision 54 (revised): uuid on the target, else the same e-mail, else a new user (renamed on a clash). */
    private void users(Analysis a, Optional<Long> storyId) {
        List<String> existing = new ArrayList<>();
        Set<String> planned = new HashSet<>();
        for (Object o : list(a.doc.get("users"))) {
            Map<String, Object> u = map(o);
            String uuid = str(u.get("uuid"));
            String username = str(u.get("username"));
            if (store.userByUuid(uuid).isPresent()) {
                a.users.add(new UserPlan(u, USER_EXISTING, username, uuid));
                existing.add(uuid);
                continue;
            }
            Optional<Map<String, Object>> byEmail = store.userByEmail(str(u.get("emailAddress")));
            if (byEmail.isPresent()) {
                String target = str(byEmail.get().get("uuid"));
                a.users.add(new UserPlan(u, USER_MAPPED, str(byEmail.get().get("username")), target));
                existing.add(target);
                a.warnings.add(new Issue(MatchExportPort.USER_MAPPED_BY_EMAIL, "User " + username
                        + " is mapped by e-mail onto the existing user " + byEmail.get().get("username")));
                continue;
            }
            if (store.usernameTaken(username) || planned.contains(username)) {
                String target = username + "_" + uuid.substring(0, Math.min(6, uuid.length()));
                a.users.add(new UserPlan(u, USER_RENAMED, target, uuid));
                planned.add(target);
                a.warnings.add(new Issue(MatchExportPort.USERNAME_RENAMED,
                        "User " + username + " is created as " + target));
            } else {
                a.users.add(new UserPlan(u, USER_NEW, username, uuid));
                planned.add(username);
            }
            if ("ADMIN".equalsIgnoreCase(str(u.get("role")))) {
                a.warnings.add(new Issue(MatchExportPort.ROLE_DOWNGRADED, "User " + username + " is created as PLAYER"));
            }
        }
        boolean storyReplaced = MatchExportPort.MODE_REPLACE.equals(a.storyAction);
        if (storyId.isPresent() && !existing.isEmpty() && !storyReplaced) {
            String uuidMatch = str(map(a.doc.get("match")).get("uuid"));
            a.activeMatches.addAll(store.activeMatchesOf(existing, storyId.get(), uuidMatch));
            if (!a.activeMatches.isEmpty()) {
                String names = a.activeMatches.stream().map(m -> m.get("uuid") + " (" + m.get("status") + ")")
                        .collect(Collectors.joining(", "));
                a.warnings.add(new Issue(MatchExportPort.USER_HAS_ACTIVE_MATCH,
                        "These matches of the same story are set to PAUSED by the import: " + names));
            }
        }
    }

    private void matchAndCharacters(Analysis a, boolean replace) {
        String uuidMatch = str(map(a.doc.get("match")).get("uuid"));
        a.matchExists = store.matchExists(uuidMatch);
        if (a.matchExists && !replace) {
            a.errors.add(new Issue(MatchExportPort.MATCH_EXISTS, "Match " + uuidMatch
                    + " already exists on this server: use replace=true"));
        }
        for (Object o : list(a.doc.get("characters"))) {
            String uuid = str(map(o).get("uuid"));
            Optional<String> owner = store.matchOfCharacter(uuid);
            if (owner.isPresent() && !owner.get().equals(uuidMatch)) {
                a.errors.add(new Issue(MatchExportPort.CHARACTER_EXISTS,
                        "Character " + uuid + " belongs to match " + owner.get()));
            }
        }
    }

    private static void engine(Analysis a) {
        Map<String, Object> engine = map(a.doc.get("engine"));
        a.reconciliation = NeutralColumnCodec.reconcile(logs(a), list(engine.get("eventMarkers")));
        if (a.reconciliation.changed()) {
            a.warnings.add(new Issue(MatchExportPort.MARKERS_RECONCILED,
                    "The timeline markers were aligned with engine.eventMarkers"));
        }
        Set<Long> visited = NeutralColumnCodec.importedVisited(list(a.doc.get("characters")), logs(a));
        Set<Long> wanted = new HashSet<>();
        list(engine.get("visitedLocationIds")).forEach(l -> wanted.add(lng(l)));
        if (!visited.equals(wanted)) {
            a.warnings.add(new Issue(MatchExportPort.VISITED_LOCATIONS_DIFFER,
                    "Visited locations of the timeline " + new TreeSet<>(visited) + " differ from the file "
                            + new TreeSet<>(wanted)));
        }
    }

    private static List<Map<String, Object>> logs(Analysis a) {
        List<Map<String, Object>> out = new ArrayList<>();
        list(a.doc.get("logs")).forEach(o -> out.add(map(o)));
        return out;
    }

    private Map<String, Object> checkBody(Analysis a) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("valid", a.valid());
        body.put("errors", issues(a.errors));
        body.put("warnings", issues(a.warnings));
        Map<String, Object> source = a.doc == null ? Map.of() : map(a.doc.get("source"));
        Map<String, Object> src = new LinkedHashMap<>();
        for (String k : List.of("backend", "dialect", "appVersion", "server", "snapshotClock")) {
            src.put(k, source.get(k));
        }
        body.put("source", src);
        body.put("matchExists", a.matchExists);
        Map<String, Object> story = new LinkedHashMap<>();
        story.put("uuid", a.doc == null ? null : map(a.doc.get("story")).get("uuid"));
        story.put("status", a.storyStatus);
        story.put("action", a.storyAction);
        story.put("matchesDeleted", a.matchesDeleted);
        body.put("story", story);
        List<Map<String, Object>> users = new ArrayList<>();
        for (UserPlan p : a.users) {
            Map<String, Object> u = new LinkedHashMap<>();
            u.put("uuid", p.user().get("uuid"));
            u.put("username", p.user().get("username"));
            u.put("targetUsername", p.targetUsername());
            u.put("targetUuid", p.targetUuid());
            u.put("status", p.status());
            users.add(u);
        }
        body.put("users", users);
        return body;
    }

    static List<Map<String, Object>> issues(List<Issue> list) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Issue i : list) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("code", i.code());
            row.put("message", i.message());
            out.add(row);
        }
        return out;
    }

    // ── import ──────────────────────────────────────────────────────────────

    public Map<String, Object> importMatch(Map<String, Object> request) {
        Analysis a = analyze(request);
        if (!a.valid()) {
            throw refusal(a.errors);
        }
        Map<String, Object> doc = a.doc;
        Map<String, Object> match = map(doc.get("match"));
        String uuidMatch = str(match.get("uuid"));
        String storyUuid = str(map(doc.get("story")).get("uuid"));
        if (ACTION_IMPORT.equals(a.storyAction) || MatchExportPort.MODE_REPLACE.equals(a.storyAction)) {
            storyImport.importStory(storyForImport(a.bundledStory));
        }
        long idStory = store.storyIdByUuid(storyUuid).orElseThrow(() -> new IllegalStateException(
                "Story " + storyUuid + " is not on this server after its import"));
        Map<String, Object> target = storyExport.exportStory(storyUuid);
        ImportRows rows = rows(a, idStory, target == null ? Map.of() : target,
                Boolean.TRUE.equals(request.get("replace")) && a.matchExists ? uuidMatch : null);
        long idMatch = store.insertImported(rows);
        pauseOthers(a);
        int clock = (int) NeutralColumnCodec.nz(lng(match.get("clock")));
        String server = str(map(doc.get("source")).get("server"));
        if (logWriter != null) {
            logWriter.write(idMatch, null, null, clock, MatchLogWriterPort.imported(server, clock));
        }
        String uuidSnapshot = snapshotService == null ? null
                : snapshotService.writeNow(idMatch, "Imported at clock " + clock);
        try {
            if (timeService != null) {
                timeService.startTimeAfterRestore(uuidMatch);
            }
        } catch (RuntimeException e) {
            snapshotStore.setStatus(idMatch, MatchStatuses.PAUSED);
            throw new MatchExportException(MatchExportException.Code.IMPORT_TIME_START_FAILED,
                    "The match was imported (PAUSED) but its time-start failed: " + e.getMessage());
        }
        String status = Boolean.TRUE.equals(request.get("startPaused")) ? MatchStatuses.PAUSED : MatchStatuses.RUNNING;
        snapshotStore.setStatus(idMatch, status);
        int now = snapshotStore.findMatchById(idMatch).map(SnapshotStorePort.MatchRef::currentClock).orElse(clock);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", "IMPORTED");
        body.put("uuidMatch", uuidMatch);
        body.put("snapshotClock", clock);
        body.put("clock", now);
        body.put("matchStatus", status);
        body.put("uuidSnapshot", uuidSnapshot);
        body.put("storyAction", a.storyAction);
        body.put("usersCreated", a.users.stream().filter(UserPlan::created).count());
        body.put("logsImported", rows.logs().size());
        body.put("warnings", issues(a.warnings));
        return body;
    }

    /** 409 with the conflict code when only conflicts are left, 422 IMPORT_INVALID otherwise. */
    static MatchExportException refusal(List<Issue> errors) {
        boolean onlyConflicts = errors.stream().allMatch(e -> CONFLICTS.contains(e.code()));
        if (onlyConflicts) {
            MatchExportException.Code code = MatchExportException.Code.valueOf(errors.get(0).code());
            return new MatchExportException(code, errors.get(0).message(), errors);
        }
        return new MatchExportException(MatchExportException.Code.IMPORT_INVALID,
                "The match export cannot be imported", errors);
    }

    private void pauseOthers(Analysis a) {
        if (matchCommands == null) {
            return;
        }
        for (Map<String, Object> m : a.activeMatches) {
            matchCommands.updateMatch(str(m.get("uuid")), MatchStatuses.PAUSED, null, MatchLogWriterPort.ADMIN_PAUSE);
        }
    }

    ImportRows rows(Analysis a, long idStory, Map<String, Object> story, String replaceUuid) {
        Map<String, Object> doc = a.doc;
        String now = Instant.now().toString();
        String fallbackTs = str(map(doc.get("source")).get("exportedAt"));
        Map<String, Object> match = map(doc.get("match"));
        List<Map<String, Object>> newUsers = new ArrayList<>();
        Map<String, String> userUuid = new LinkedHashMap<>();
        for (UserPlan p : a.users) {
            String uuid = str(p.user().get("uuid"));
            userUuid.put(uuid, p.targetUuid());
            if (p.created()) {
                Map<String, Object> u = new LinkedHashMap<>();
                u.put("uuid", uuid);
                u.put("username", p.targetUsername());
                u.put("nickname", p.user().get("nickname"));
                u.put("language", p.user().get("language"));
                u.put("state", lng(p.user().get("state")));
                u.put("email_address", p.user().get("emailAddress"));
                newUsers.add(u);
            }
        }
        Map<String, Long> ordinalByUuid = new LinkedHashMap<>();
        list(doc.get("characters")).forEach(o -> ordinalByUuid.put(str(map(o).get("uuid")), lng(map(o).get("ordinal"))));
        Map<String, Object> matchRow = NeutralColumnCodec.matchRow(match, idStory, 0L, Map.of(),
                uuidById(story, "characterTemplates"), uuidById(story, "classes"), uuidById(story, "traits"), now);
        matchRow.put("id_user_creator", userUuid.getOrDefault(str(match.get("creatorUserUuid")),
                str(match.get("creatorUserUuid"))));
        matchRow.put("id_character_current_turn", null);
        List<Map<String, Object>> characters = new ArrayList<>();
        Map<String, List<Map<String, Object>>> child = new LinkedHashMap<>();
        for (String table : List.of("gaming_backpack_resources", "gaming_character_traits", "gaming_inventory_items",
                "gaming_state_registry", "gaming_state_locations", "gaming_turn_queue", "gaming_story_progress")) {
            child.put(table, new ArrayList<>());
        }
        for (Object o : list(doc.get("characters"))) {
            Map<String, Object> c = map(o);
            long ordinal = NeutralColumnCodec.nz(lng(c.get("ordinal")));
            Map<String, Object> row = NeutralColumnCodec.characterRow(c, 0L, now);
            row.put("id_user", userUuid.getOrDefault(str(c.get("userUuid")), str(c.get("userUuid"))));
            characters.add(row);
            child.get("gaming_backpack_resources").add(NeutralColumnCodec.resourcesRow(c, now));
            list(c.get("traits")).forEach(t -> child.get("gaming_character_traits")
                    .add(NeutralColumnCodec.traitRow(map(t), ordinal, now)));
            list(c.get("items")).forEach(i -> child.get("gaming_inventory_items")
                    .add(NeutralColumnCodec.itemRow(map(i), ordinal, now)));
        }
        Map<String, Object> state = map(doc.get("state"));
        list(state.get("registry")).forEach(r -> child.get("gaming_state_registry")
                .add(NeutralColumnCodec.registryRow(map(r), ordinalByUuid, now)));
        Map<Long, Map<String, Object>> locations = new LinkedHashMap<>();
        list(state.get("locations")).forEach(l -> locations.put(lng(map(l).get("locationId")), map(l)));
        for (Long id : store.storyLocationIds(idStory)) {
            child.get("gaming_state_locations").add(NeutralColumnCodec.locationRow(id, locations.get(id), now));
        }
        list(state.get("turns")).forEach(t -> child.get("gaming_turn_queue").add(NeutralColumnCodec.turnRow(map(t),
                ordinalByUuid.get(str(map(t).get("characterUuid"))), now)));
        list(state.get("storyProgress")).forEach(p -> child.get("gaming_story_progress")
                .add(NeutralColumnCodec.progressRow(map(p), now)));
        List<LogInsert> logs = logInserts(a, ordinalByUuid, fallbackTs == null ? now : fallbackTs);
        list(state.get("choiceHistory")).forEach(h -> logs.add(new LogInsert(NeutralColumnCodec.LOG_CHOICES_EXECUTED,
                NeutralColumnCodec.choiceExecutedRow(map(h), now))));
        Long active = ordinalByUuid.get(str(match.get("activeCharacterUuid")));
        return new ImportRows(replaceUuid, newUsers, matchRow, characters, child, logs, active);
    }

    /** The timeline rows in seq order, then the markers the reconciliation adds (H.2.4). */
    private static List<LogInsert> logInserts(Analysis a, Map<String, Long> ordinalByUuid, String fallbackTs) {
        List<Map<String, Object>> entries = logs(a);
        List<LogInsert> out = new ArrayList<>();
        String lastTs = fallbackTs;
        for (int i = 0; i < entries.size(); i++) {
            Map<String, Object> e = entries.get(i);
            LogRow row = NeutralColumnCodec.logRow(e, ordinalByUuid, fallbackTs);
            Map<String, Object> columns = row.columns();
            if (a.reconciliation.uncounted().contains(i)) {
                columns.put("log_message", LogTypeMapper.MSG_UNCOUNTED + " " + columns.get("log_message"));
            }
            if (e.get("timestamp") != null) {
                lastTs = str(e.get("timestamp"));
            }
            out.add(new LogInsert(row.table(), columns));
        }
        long clock = NeutralColumnCodec.nz(lng(map(a.doc.get("match")).get("clock")));
        for (NeutralColumnCodec.MissingMarker m : a.reconciliation.missing()) {
            String prefix = m.executed() ? LogTypeMapper.MSG_EVENT_EXECUTED : LogTypeMapper.MSG_CHOICE_SELECTED;
            for (long n = 0; n < m.count(); n++) {
                Map<String, Object> e = new LinkedHashMap<>();
                e.put("eventId", m.eventId());
                e.put("clock", clock);
                out.add(new LogInsert(NeutralColumnCodec.LOG_EVENTS, NeutralColumnCodec.eventColumns(e, null, lastTs,
                        prefix + " " + m.eventId() + " imported")));
            }
        }
        return out;
    }

    /** Story-local id → uuid of one story list (the target's own uuids). */
    static Map<Long, String> uuidById(Map<String, Object> story, String key) {
        Map<Long, String> out = new LinkedHashMap<>();
        for (Object o : list(story.get(key))) {
            Map<String, Object> row = map(o);
            Long id = lng(row.get("id"));
            if (id != null && row.get("uuid") != null) {
                out.put(id, str(row.get("uuid")));
            }
        }
        return out;
    }
}
