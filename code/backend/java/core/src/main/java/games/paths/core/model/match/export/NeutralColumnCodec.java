package games.paths.core.model.match.export;

import games.paths.core.model.match.MatchTraitCodec;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/**
 * NeutralColumnCodec - v0.41.4 Step 41 H.2.3: the java snapshot rows (snake_case, SQLite 0/1 or
 * PostgreSQL BOOLEAN alike) to the neutral match export v1, and the neutral sections back to rows.
 */
public final class NeutralColumnCodec {

    public static final String LOG_EVENTS = "log_events";
    public static final String LOG_MOVEMENTS = "log_movements";
    public static final String LOG_ITEM_USAGE = "log_item_usage";
    public static final String LOG_WEATHER = "log_weather";
    public static final String LOG_CLOCK_HISTORY = "log_clock_history";
    public static final String LOG_CHOICES_EXECUTED = "log_choices_executed";
    /** Timeline tables in the tie-break order of the seq (H.2.1). */
    public static final List<String> TIMELINE_TABLES = List.of(LOG_EVENTS, LOG_MOVEMENTS, LOG_ITEM_USAGE,
            LOG_WEATHER, LOG_CLOCK_HISTORY);
    static final List<String> RESOURCES = List.of("energy", "food", "magic", "coin");
    private static final DateTimeFormatter ISO_MILLIS =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC);

    private NeutralColumnCodec() {
    }

    /** What the export needs besides the rows: the id ↔ uuid maps of the source. */
    public record Lookup(Map<Long, String> userUuidById, Map<Long, String> characterUuidByOrdinal,
                         Map<String, Long> templateIdByUuid, Map<String, Long> classIdByUuid,
                         Map<String, Long> traitIdByUuid) {
    }

    // ── export ──────────────────────────────────────────────────────────────

    public static Map<String, Object> match(Map<String, Object> m, Lookup lookup, Long partyLocationId,
                                            Long fallbackSeed) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("uuid", m.get("uuid"));
        out.put("name", str(m.get("name")));
        out.put("difficultyId", lng(m.get("id_difficulty")));
        out.put("expCost", lng(m.get("exp_cost")));
        Long seed = lng(m.get("rng_seed"));
        out.put("rngSeed", seed != null ? seed : fallbackSeed);
        out.put("singlePlayer", m.get("single_player") == null ? null : bool(m.get("single_player")));
        Map<String, Object> loadout = new LinkedHashMap<>();
        loadout.put("characterTemplateId", get(lookup.templateIdByUuid(), str(m.get("character_template_uuid"))));
        loadout.put("classId", get(lookup.classIdByUuid(), str(m.get("class_uuid"))));
        List<Long> traits = new ArrayList<>();
        for (String uuid : MatchTraitCodec.split(str(m.get("trait_uuids")))) {
            Long id = get(lookup.traitIdByUuid(), uuid);
            if (id != null) {
                traits.add(id);
            }
        }
        loadout.put("traitIds", traits);
        out.put("loadout", loadout);
        out.put("creatorUserUuid", get(lookup.userUuidById(), lng(m.get("id_user_creator"))));
        out.put("clock", nz(lng(m.get("current_clock"))));
        out.put("status", str(m.get("status")));
        out.put("currentWeatherId", positive(m.get("id_current_weather")));
        out.put("activeCharacterUuid", get(lookup.characterUuidByOrdinal(), lng(m.get("id_character_current_turn"))));
        out.put("counterConsecutivePass", lng(m.get("counter_consecutive_pass")));
        out.put("secureLocationParam", lng(m.get("secure_location_param")));
        out.put("partyLocationId", partyLocationId);
        out.put("timestampStart", ts(m.get("timestamp_start")));
        out.put("timestampEnd", ts(m.get("timestamp_end")));
        out.put("timestampGameover", ts(m.get("timestamp_gameover")));
        out.put("timestampLockExpiration", ts(m.get("timestamp_lock_expiration")));
        out.put("createdAt", ts(m.get("ts_insert")));
        return out;
    }

    public static Map<String, Object> character(Map<String, Object> c, Lookup lookup, Map<String, Object> resources,
                                                List<Map<String, Object>> traits,
                                                List<Map<String, Object>> items) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("uuid", c.get("uuid"));
        out.put("ordinal", lng(c.get("id")));
        out.put("userUuid", get(lookup.userUuidById(), lng(c.get("id_user"))));
        out.put("characterTemplateId", lng(c.get("id_character_template")));
        out.put("classId", positive(c.get("id_class")));
        for (String[] pair : STATS) {
            out.put(pair[0], lng(c.get(pair[1])));
        }
        out.put("locationId", positive(c.get("id_location")));
        out.put("isSleeping", bool(c.get("is_sleeping")));
        out.put("isComa", bool(c.get("is_coma")));
        out.put("clockInComa", lng(c.get("clock_in_coma")));
        out.put("timestampLastPass", ts(c.get("timestamp_last_pass")));
        out.put("counterConsecutivePass", lng(c.get("counter_consecutive_pass")));
        out.put("characteristics", MatchTraitCodec.split(str(c.get("characteristics"))));
        if (resources != null) {
            Map<String, Object> res = new LinkedHashMap<>();
            for (String r : List.of("food", "magic", "coin")) {
                res.put(r, lng(resources.get(r)));
            }
            out.put("resources", res);
        }
        List<Map<String, Object>> traitRows = new ArrayList<>();
        for (Map<String, Object> t : traits) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("traitId", lng(t.get("id_traits")));
            row.put("eventId", positive(t.get("id_event")));
            traitRows.add(row);
        }
        out.put("traits", traitRows);
        List<Map<String, Object>> itemRows = new ArrayList<>();
        for (Map<String, Object> i : items) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("itemId", lng(i.get("id_item")));
            row.put("amount", lng(i.get("amount")));
            row.put("state", str(i.get("state")));
            itemRows.add(row);
        }
        out.put("items", itemRows);
        return out;
    }

    /** Neutral stat name and its snake_case column. */
    static final String[][] STATS = {
            {"dexterity", "dexterity"}, {"intelligence", "intelligence"}, {"constitution", "constitution"},
            {"energy", "energy"}, {"life", "life"}, {"sad", "sad"}, {"lifeMax", "life_max"},
            {"energyMax", "energy_max"}, {"sadMax", "sad_max"}, {"weightMax", "weight_max"}, {"exp", "exp"}};

    public static Map<String, Object> registry(Map<String, Object> r, Lookup lookup) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("key", str(r.get("key")));
        out.put("stringValue", str(r.get("string_value")));
        out.put("intValue", lng(r.get("int_value")));
        out.put("multiValue", r.get("multi_value") == null ? null : bool(r.get("multi_value")));
        out.put("characterUuid", get(lookup.characterUuidByOrdinal(), lng(r.get("id_character"))));
        out.put("eventId", positive(r.get("id_event")));
        out.put("choiceId", positive(r.get("id_choice")));
        out.put("clock", lng(r.get("clock")));
        out.put("missionId", positive(r.get("id_mission")));
        out.put("missionStepId", positive(r.get("id_mission_steps")));
        return out;
    }

    /** True for a location row worth exporting (the sparse rule of AWS): any flag, a counter, the start. */
    public static boolean isNonDefaultLocation(Map<String, Object> l, Long startLocationId) {
        return bool(l.get("flag_already_actived")) || bool(l.get("flag_visited"))
                || nz(lng(l.get("clock_counter"))) != 0 || Objects.equals(lng(l.get("id_location")), startLocationId);
    }

    public static Map<String, Object> location(Map<String, Object> l) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("locationId", lng(l.get("id_location")));
        out.put("flagAlreadyActivated", bool(l.get("flag_already_actived")));
        out.put("flagVisited", bool(l.get("flag_visited")));
        out.put("clockCounter", lng(l.get("clock_counter")));
        return out;
    }

    public static Map<String, Object> turn(Map<String, Object> t, Lookup lookup) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("characterUuid", get(lookup.characterUuidByOrdinal(), lng(t.get("id_character_match"))));
        out.put("clock", nz(lng(t.get("clock"))));
        out.put("status", t.get("status") == null ? "WAITING" : str(t.get("status")));
        out.put("priority", nz(lng(t.get("priority"))));
        out.put("passCounter", lng(t.get("pass_counter")));
        out.put("timestampStart", ts(t.get("timestamp_start")));
        out.put("timestampEnd", ts(t.get("timestamp_end")));
        return out;
    }

    public static Map<String, Object> progress(Map<String, Object> p) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("clock", lng(p.get("clock")));
        out.put("eventId", positive(p.get("id_event")));
        out.put("choiceId", positive(p.get("id_choise")));
        return out;
    }

    public static Map<String, Object> choiceRow(Map<String, Object> c) {
        Map<String, Object> out = progress(c);
        out.put("message", str(c.get("log_message")));
        out.put("timestamp", ts(c.get("ts_insert")));
        return out;
    }

    public static Map<String, Object> user(Map<String, Object> u) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("uuid", u.get("uuid"));
        out.put("username", str(u.get("username")));
        out.put("nickname", str(u.get("nickname")));
        out.put("language", str(u.get("language")));
        Long state = lng(u.get("state"));
        out.put("state", state);
        out.put("guest", state != null && state == 6L);
        out.put("role", str(u.get("role")));
        out.put("emailAddress", str(u.get("email_address")));
        return out;
    }

    /** The timeline rows of the five log tables as neutral entries, sorted and numbered (seq 1…n). */
    public static List<Map<String, Object>> logs(Map<String, List<Map<String, Object>>> tables, Lookup lookup) {
        record Sortable(String ts, int table, long id, Map<String, Object> entry) {
        }
        List<Sortable> all = new ArrayList<>();
        for (int t = 0; t < TIMELINE_TABLES.size(); t++) {
            String table = TIMELINE_TABLES.get(t);
            for (Map<String, Object> row : tables.getOrDefault(table, List.of())) {
                Map<String, Object> entry = logEntry(table, row, lookup);
                if (entry != null) {
                    all.add(new Sortable(Objects.toString(entry.get("timestamp"), ""), t,
                            nz(lng(row.get("id"))), entry));
                }
            }
        }
        all.sort(Comparator.comparing(Sortable::ts, CanonicalJson::compareCodePoints)
                .thenComparingInt(Sortable::table).thenComparingLong(Sortable::id));
        List<Map<String, Object>> out = new ArrayList<>(all.size());
        long seq = 0;
        for (Sortable s : all) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("seq", ++seq);
            entry.putAll(s.entry());
            out.add(entry);
        }
        return out;
    }

    static Map<String, Object> logEntry(String table, Map<String, Object> row, Lookup lookup) {
        Map<String, Object> e = new LinkedHashMap<>();
        String character = get(lookup.characterUuidByOrdinal(), lng(row.get("id_character_match")));
        switch (table) {
            case LOG_WEATHER -> {
                e.put("type", LogTypeMapper.WEATHER);
                e.put("clock", lng(row.get("clock")));
                e.put("timestamp", ts(first(row.get("timestamp_start"), row.get("ts_insert"))));
                e.put("weatherId", positive(row.get("id_weather")));
            }
            case LOG_CLOCK_HISTORY -> {
                e.put("type", LogTypeMapper.CLOCK_ADVANCE);
                e.put("clock", lng(row.get("clock")));
                e.put("timestamp", ts(first(row.get("timestamp_start"), row.get("ts_insert"))));
            }
            case LOG_MOVEMENTS -> {
                e.put("type", LogTypeMapper.MOVEMENT);
                e.put("timestamp", ts(row.get("ts_insert")));
                e.put("characterUuid", character);
                e.put("eventId", positive(row.get("id_event")));
                e.put("choiceId", positive(row.get("id_choise")));
                e.put("locationFromId", positive(row.get("id_location_from")));
                e.put("locationToId", positive(row.get("id_location_to")));
                e.put("cost", resources(row, ""));
                e.put("message", str(row.get("log_message")));
            }
            case LOG_ITEM_USAGE -> {
                String type = LogTypeMapper.itemType(str(row.get("action")));
                if (type == null) {
                    return null;
                }
                e.put("type", type);
                e.put("timestamp", ts(row.get("timestamp")));
                e.put("characterUuid", character);
                e.put("eventId", positive(row.get("id_event")));
                e.put("itemId", positive(row.get("id_item")));
                String action = str(row.get("action"));
                e.put("itemAction", action == null ? null : action.trim().toUpperCase(Locale.ROOT));
                e.put("counter", lng(row.get("counter")));
                e.put("effects", str(row.get("effects_json")));
                e.put("cost", signed(row, true));
                e.put("gain", signed(row, false));
            }
            default -> {
                String msg = str(row.get("log_message"));
                String type = LogTypeMapper.eventType(msg);
                if (type == null) {
                    return null;
                }
                e.put("type", type);
                e.put("clock", lng(row.get("clock")));
                e.put("timestamp", ts(row.get("timestamp")));
                e.put("characterUuid", character);
                e.put("eventId", positive(row.get("id_event")));
                e.put("choiceId", positive(row.get("id_choise")));
                e.put("locationToId", positive(row.get("id_location")));
                e.put("cost", resources(row, ""));
                e.put("gain", resources(row, "_gain"));
                e.put("message", LogTypeMapper.timelineMessage(type, msg));
            }
        }
        return e;
    }

    private static Map<String, Object> resources(Map<String, Object> row, String suffix) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (String r : RESOURCES) {
            Long v = lng(row.get(r + suffix));
            if (v != null) {
                out.put(r, v);
            }
        }
        return out.isEmpty() ? null : out;
    }

    /** A signed item delta: the negative half is the cost, the positive half the gain. */
    private static Map<String, Object> signed(Map<String, Object> row, boolean cost) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (String r : RESOURCES) {
            long v = nz(lng(row.get(r)));
            out.put(r, cost ? Math.max(0, -v) : Math.max(0, v));
        }
        return out;
    }

    // ── import ──────────────────────────────────────────────────────────────

    /** Engine markers of the imported timeline: per event, executed and selected counts. */
    public static Map<Long, long[]> markerCounts(List<Map<String, Object>> logs) {
        Map<Long, long[]> out = new LinkedHashMap<>();
        for (Map<String, Object> e : logs) {
            Long event = lng(e.get("eventId"));
            String type = str(e.get("type"));
            if (event == null) {
                continue;
            }
            if (LogTypeMapper.EVENT.equals(type)) {
                out.computeIfAbsent(event, k -> new long[2])[0]++;
            } else if (LogTypeMapper.CHOICE.equals(type)) {
                out.computeIfAbsent(event, k -> new long[2])[1]++;
            }
        }
        return out;
    }

    /** H.2.4: imported EVENT/CHOICE entries beyond engine.eventMarkers (by index) and the markers still missing. */
    public record Reconciliation(Set<Integer> uncounted, List<MissingMarker> missing) {
        public boolean changed() {
            return !uncounted.isEmpty() || !missing.isEmpty();
        }
    }

    /** {@code count} marker rows of {@code eventId} to add: executed (EVENT_EXECUTED) or selected. */
    public record MissingMarker(long eventId, boolean executed, long count) {
    }

    public static Reconciliation reconcile(List<Map<String, Object>> logs, List<Object> eventMarkers) {
        Map<Long, long[]> wanted = new TreeMap<>();
        for (Object o : eventMarkers) {
            Map<String, Object> m = map(o);
            Long event = lng(m.get("eventId"));
            if (event != null) {
                wanted.put(event, new long[]{nz(lng(m.get("executed"))), nz(lng(m.get("selected")))});
            }
        }
        Map<Long, long[]> written = new TreeMap<>();
        Set<Integer> uncounted = new TreeSet<>();
        for (int i = 0; i < logs.size(); i++) {
            Map<String, Object> e = logs.get(i);
            String type = str(e.get("type"));
            Long event = lng(e.get("eventId"));
            int kind = LogTypeMapper.EVENT.equals(type) ? 0 : LogTypeMapper.CHOICE.equals(type) ? 1 : -1;
            if (event == null || kind < 0) {
                continue;
            }
            long[] have = written.computeIfAbsent(event, k -> new long[2]);
            long[] want = wanted.getOrDefault(event, new long[2]);
            if (have[kind] < want[kind]) {
                have[kind]++;
            } else {
                uncounted.add(i);
            }
        }
        List<MissingMarker> missing = new ArrayList<>();
        wanted.forEach((event, want) -> {
            long[] have = written.getOrDefault(event, new long[2]);
            if (want[0] > have[0]) {
                missing.add(new MissingMarker(event, true, want[0] - have[0]));
            }
            if (want[1] > have[1]) {
                missing.add(new MissingMarker(event, false, want[1] - have[1]));
            }
        });
        return new Reconciliation(uncounted, missing);
    }

    /** The visited set an imported java/python match will read: character locations and movements. */
    public static Set<Long> importedVisited(List<Object> characters, List<Map<String, Object>> logs) {
        Set<Long> out = new LinkedHashSet<>();
        for (Object o : characters) {
            Long loc = lng(map(o).get("locationId"));
            if (loc != null) {
                out.add(loc);
            }
        }
        for (Map<String, Object> e : logs) {
            if (LogTypeMapper.MOVEMENT.equals(str(e.get("type")))) {
                for (String k : List.of("locationFromId", "locationToId")) {
                    Long loc = lng(e.get(k));
                    if (loc != null) {
                        out.add(loc);
                    }
                }
            }
        }
        return out;
    }

    /** One native log row: table name plus its columns (no id, no uuid, no id_match). */
    public record LogRow(String table, Map<String, Object> columns) {
    }

    /** A neutral log entry as the row of its java table; ordinal resolves the characterUuid. */
    public static LogRow logRow(Map<String, Object> e, Map<String, Long> ordinalByUuid, String fallbackTs) {
        String type = str(e.get("type"));
        Long character = get(ordinalByUuid, str(e.get("characterUuid")));
        String timestamp = first(str(e.get("timestamp")), fallbackTs);
        Map<String, Object> c = new LinkedHashMap<>();
        switch (type == null ? "" : type) {
            case LogTypeMapper.WEATHER -> {
                c.put("clock", nz(lng(e.get("clock"))));
                c.put("id_weather", lng(e.get("weatherId")));
                c.put("timestamp_start", timestamp);
                c.put("ts_insert", timestamp);
                return new LogRow(LOG_WEATHER, c);
            }
            case LogTypeMapper.CLOCK_ADVANCE -> {
                c.put("clock", nz(lng(e.get("clock"))));
                c.put("timestamp_start", timestamp);
                c.put("ts_insert", timestamp);
                return new LogRow(LOG_CLOCK_HISTORY, c);
            }
            case LogTypeMapper.MOVEMENT -> {
                c.put("id_character_match", character);
                c.put("id_location_from", lng(e.get("locationFromId")));
                c.put("id_location_to", lng(e.get("locationToId")));
                c.put("id_event", lng(e.get("eventId")));
                c.put("id_choise", lng(e.get("choiceId")));
                c.put("log_message", str(e.get("message")));
                putResources(c, map(e.get("cost")), "");
                c.put("ts_insert", timestamp);
                return new LogRow(LOG_MOVEMENTS, c);
            }
            case LogTypeMapper.ITEM_ADD, LogTypeMapper.ITEM_USE, LogTypeMapper.ITEM_DROP -> {
                Long item = lng(e.get("itemId"));
                if (character == null || item == null) {
                    break;
                }
                c.put("id_character_match", character);
                c.put("id_item", item);
                c.put("action", first(str(e.get("itemAction")), type.substring("ITEM_".length())));
                c.put("counter", lng(e.get("counter")));
                c.put("id_event", lng(e.get("eventId")));
                c.put("effects_json", str(e.get("effects")));
                Map<String, Object> cost = map(e.get("cost"));
                Map<String, Object> gain = map(e.get("gain"));
                for (String r : RESOURCES) {
                    c.put(r, nz(lng(gain.get(r))) - nz(lng(cost.get(r))));
                }
                c.put("timestamp", timestamp);
                c.put("ts_insert", timestamp);
                return new LogRow(LOG_ITEM_USAGE, c);
            }
            default -> {
                // every other type is a log_events row
            }
        }
        String message = LogTypeMapper.isEventRow(type) ? LogTypeMapper.storedMessage(type, str(e.get("message")))
                : LogTypeMapper.storedMessage(null, type + (e.get("message") == null ? "" : " " + e.get("message")));
        return new LogRow(LOG_EVENTS, eventColumns(e, character, timestamp, message));
    }

    /** A log_events row with the given stored message. */
    public static Map<String, Object> eventColumns(Map<String, Object> e, Long character, String timestamp,
                                                   String message) {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("id_character_match", character);
        c.put("timestamp", timestamp);
        c.put("id_event", lng(e.get("eventId")));
        c.put("id_choise", lng(e.get("choiceId")));
        c.put("log_message", message);
        c.put("clock", lng(e.get("clock")));
        c.put("id_location", lng(e.get("locationToId")));
        putResources(c, map(e.get("cost")), "");
        putResources(c, map(e.get("gain")), "_gain");
        c.put("ts_insert", timestamp);
        return c;
    }

    private static void putResources(Map<String, Object> c, Map<String, Object> res, String suffix) {
        for (String r : RESOURCES) {
            c.put(r + suffix, lng(res.get(r)));
        }
    }

    public static Map<String, Object> matchRow(Map<String, Object> m, long idStory, long idCreator,
                                               Map<String, Long> ordinalByUuid, Map<Long, String> templateUuidById,
                                               Map<Long, String> classUuidById, Map<Long, String> traitUuidById,
                                               String now) {
        Map<String, Object> c = new LinkedHashMap<>();
        Map<String, Object> loadout = map(m.get("loadout"));
        c.put("uuid", m.get("uuid"));
        c.put("id_story", idStory);
        c.put("name", str(m.get("name")));
        c.put("id_difficulty", lng(m.get("difficultyId")));
        c.put("exp_cost", m.get("expCost") == null ? 5L : lng(m.get("expCost")));
        c.put("status", "PAUSED");
        c.put("current_clock", nz(lng(m.get("clock"))));
        c.put("id_current_weather", lng(m.get("currentWeatherId")));
        c.put("rng_seed", lng(m.get("rngSeed")));
        c.put("id_user_creator", idCreator);
        c.put("timestamp_start", str(m.get("timestampStart")));
        c.put("timestamp_lock_expiration", str(m.get("timestampLockExpiration")));
        c.put("timestamp_gameover", str(m.get("timestampGameover")));
        c.put("timestamp_end", str(m.get("timestampEnd")));
        c.put("id_character_current_turn", get(ordinalByUuid, str(m.get("activeCharacterUuid"))));
        c.put("secure_location_param", lng(m.get("secureLocationParam")));
        c.put("counter_consecutive_pass", nz(lng(m.get("counterConsecutivePass"))));
        c.put("single_player", m.get("singlePlayer") == null || bool(m.get("singlePlayer")) ? 1 : 0);
        c.put("character_template_uuid", get(templateUuidById, lng(loadout.get("characterTemplateId"))));
        c.put("class_uuid", get(classUuidById, lng(loadout.get("classId"))));
        List<String> traits = new ArrayList<>();
        for (Object id : list(loadout.get("traitIds"))) {
            String uuid = get(traitUuidById, lng(id));
            if (uuid != null) {
                traits.add(uuid);
            }
        }
        c.put("trait_uuids", MatchTraitCodec.join(traits));
        c.put("ts_insert", first(str(m.get("createdAt")), now));
        c.put("ts_update", now);
        return c;
    }

    public static Map<String, Object> characterRow(Map<String, Object> ch, long idUser, String now) {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("id", lng(ch.get("ordinal")));
        c.put("uuid", ch.get("uuid"));
        c.put("id_user", idUser);
        c.put("id_character_template", lng(ch.get("characterTemplateId")));
        c.put("id_class", lng(ch.get("classId")));
        for (String[] pair : STATS) {
            Long v = lng(ch.get(pair[0]));
            c.put(pair[1], v == null ? defaultStat(pair[1]) : v);
        }
        c.put("id_location", lng(ch.get("locationId")));
        // Java Boolean: PostgreSQL BOOLEAN takes it, SQLite stores 1/0 (decision 51).
        c.put("is_sleeping", bool(ch.get("isSleeping")));
        c.put("is_coma", bool(ch.get("isComa")));
        c.put("clock_in_coma", lng(ch.get("clockInComa")));
        c.put("timestamp_last_pass", str(ch.get("timestampLastPass")));
        c.put("counter_consecutive_pass", nz(lng(ch.get("counterConsecutivePass"))));
        List<String> characteristics = new ArrayList<>();
        list(ch.get("characteristics")).forEach(v -> characteristics.add(String.valueOf(v)));
        c.put("characteristics", characteristics.isEmpty() ? null : MatchTraitCodec.join(characteristics));
        c.put("ts_insert", now);
        c.put("ts_update", now);
        return c;
    }

    private static long defaultStat(String column) {
        return Arrays.asList("dexterity", "intelligence", "constitution", "life").contains(column) ? 1L : 0L;
    }

    public static Map<String, Object> resourcesRow(Map<String, Object> ch, String now) {
        Map<String, Object> res = map(ch.get("resources"));
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("id", lng(ch.get("ordinal")));
        c.put("id_character_match", lng(ch.get("ordinal")));
        for (String r : List.of("food", "magic", "coin")) {
            c.put(r, nz(lng(res.get(r))));
        }
        c.put("ts_insert", now);
        c.put("ts_update", now);
        return c;
    }

    public static Map<String, Object> traitRow(Map<String, Object> t, long ordinal, String now) {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("id_character_match", ordinal);
        c.put("id_traits", lng(t.get("traitId")));
        c.put("id_event", lng(t.get("eventId")));
        c.put("ts_insert", now);
        c.put("ts_update", now);
        return c;
    }

    public static Map<String, Object> itemRow(Map<String, Object> i, long ordinal, String now) {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("id_character_match", ordinal);
        c.put("id_item", lng(i.get("itemId")));
        c.put("amount", i.get("amount") == null ? 1L : lng(i.get("amount")));
        c.put("state", str(i.get("state")));
        c.put("ts_insert", now);
        c.put("ts_update", now);
        return c;
    }

    public static Map<String, Object> registryRow(Map<String, Object> r, Map<String, Long> ordinalByUuid, String now) {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("key", str(r.get("key")));
        c.put("string_value", str(r.get("stringValue")));
        c.put("int_value", lng(r.get("intValue")));
        c.put("multi_value", r.get("multiValue") == null ? null : (bool(r.get("multiValue")) ? 1 : 0));
        c.put("id_character", get(ordinalByUuid, str(r.get("characterUuid"))));
        c.put("id_event", lng(r.get("eventId")));
        c.put("id_choice", lng(r.get("choiceId")));
        c.put("clock", lng(r.get("clock")));
        c.put("id_mission", lng(r.get("missionId")));
        c.put("id_mission_steps", lng(r.get("missionStepId")));
        c.put("ts_insert", now);
        c.put("ts_update", now);
        return c;
    }

    /** One row per story location: the neutral one when present, else the zero row. */
    public static Map<String, Object> locationRow(long idLocation, Map<String, Object> neutral, String now) {
        Map<String, Object> l = neutral == null ? Map.of() : neutral;
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("id_location", idLocation);
        c.put("flag_already_actived", bool(l.get("flagAlreadyActivated")) ? 1 : 0);
        c.put("flag_visited", bool(l.get("flagVisited")) ? 1 : 0);
        c.put("clock_counter", lng(l.get("clockCounter")));
        c.put("ts_insert", now);
        c.put("ts_update", now);
        return c;
    }

    public static Map<String, Object> turnRow(Map<String, Object> t, long ordinal, String now) {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("id_character_match", ordinal);
        c.put("clock", nz(lng(t.get("clock"))));
        c.put("timestamp_start", str(t.get("timestampStart")));
        c.put("timestamp_end", str(t.get("timestampEnd")));
        c.put("pass_counter", nz(lng(t.get("passCounter"))));
        c.put("priority", nz(lng(t.get("priority"))));
        c.put("status", str(t.get("status")));
        c.put("ts_insert", now);
        c.put("ts_update", now);
        return c;
    }

    public static Map<String, Object> progressRow(Map<String, Object> p, String now) {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("clock", lng(p.get("clock")));
        c.put("id_event", lng(p.get("eventId")));
        c.put("id_choise", lng(p.get("choiceId")));
        c.put("ts_insert", now);
        c.put("ts_update", now);
        return c;
    }

    public static Map<String, Object> choiceExecutedRow(Map<String, Object> h, String now) {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("clock", lng(h.get("clock")));
        c.put("id_event", lng(h.get("eventId")));
        c.put("id_choise", lng(h.get("choiceId")));
        c.put("log_message", str(h.get("message")));
        c.put("ts_insert", first(str(h.get("timestamp")), now));
        c.put("ts_update", now);
        return c;
    }

    // ── values ──────────────────────────────────────────────────────────────

    /** A timestamp as ISO-8601 UTC with milliseconds; a text that does not parse is kept as it is. */
    public static String ts(Object value) {
        if (value == null || value.toString().isBlank()) {
            return null;
        }
        String s = value.toString().trim();
        try {
            return ISO_MILLIS.format(Instant.parse(s));
        } catch (DateTimeParseException ignored) {
            // next shape
        }
        try {
            return ISO_MILLIS.format(OffsetDateTime.parse(s).toInstant());
        } catch (DateTimeParseException ignored) {
            // next shape
        }
        try {
            return ISO_MILLIS.format(LocalDateTime.parse(s.replace(' ', 'T')).toInstant(ZoneOffset.UTC));
        } catch (DateTimeParseException ignored) {
            return s;
        }
    }

    /** Milliseconds of a neutral timestamp, or null when it is not one. */
    public static Long epochMillis(String ts) {
        String iso = ts(ts);
        try {
            return iso == null ? null : Instant.parse(iso).toEpochMilli();
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    /** Map lookup that tolerates a null key (immutable maps throw on it). */
    static <V> V get(Map<?, V> map, Object key) {
        return key == null ? null : map.get(key);
    }

    public static boolean bool(Object v) {
        if (v instanceof Boolean b) {
            return b;
        }
        if (v instanceof Number n) {
            return n.longValue() != 0;
        }
        if (v instanceof String s) {
            String t = s.trim().toLowerCase(Locale.ROOT);
            return "true".equals(t) || "t".equals(t) || "1".equals(t);
        }
        return false;
    }

    public static Long lng(Object v) {
        if (v instanceof Boolean b) {
            return b ? 1L : 0L;
        }
        if (v instanceof Number n) {
            return n.longValue();
        }
        if (v instanceof String s && !s.isBlank()) {
            try {
                return Long.parseLong(s.trim());
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    static Long positive(Object v) {
        Long n = lng(v);
        return n != null && n > 0 ? n : null;
    }

    public static long nz(Long v) {
        return v == null ? 0L : v;
    }

    public static String str(Object v) {
        return v == null ? null : v.toString();
    }

    @SafeVarargs
    static <T> T first(T... values) {
        for (T v : values) {
            if (v != null) {
                return v;
            }
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> map(Object v) {
        return v instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
    }

    public static List<Object> list(Object v) {
        return v instanceof List<?> l ? new ArrayList<>(l) : List.of();
    }
}
