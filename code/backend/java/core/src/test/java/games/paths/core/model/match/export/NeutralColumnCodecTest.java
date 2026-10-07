package games.paths.core.model.match.export;

import games.paths.core.model.match.export.NeutralColumnCodec.Lookup;
import games.paths.core.model.match.export.NeutralColumnCodec.LogRow;
import games.paths.core.model.match.export.NeutralColumnCodec.Reconciliation;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/** v0.41.4 — java rows ↔ neutral sections, both value shapes of decision 51 (SQLite 0/1, PostgreSQL BOOLEAN). */
@DisplayName("NeutralColumnCodec (v0.41.4)")
class NeutralColumnCodecTest {

    private static final String C1 = "c4c4c4c4-0000-4000-8000-000000000001";
    private static final Lookup LOOKUP = new Lookup(Map.of(42L, "u-42"), Map.of(1L, C1),
            Map.of("tpl-1", 1L), Map.of("cl-1", 1L), Map.of("tr-1", 1L, "tr-2", 2L));

    private static Map<String, Object> characterRow(Object sleeping, Object coma) {
        Map<String, Object> c = new HashMap<>();
        c.put("id", 1);
        c.put("uuid", C1);
        c.put("id_user", 42L);
        c.put("id_character_template", 1);
        c.put("id_class", 0);
        c.put("dexterity", 3);
        c.put("life", 9);
        c.put("energy", 18);
        c.put("sad", 1);
        c.put("life_max", 10);
        c.put("id_location", 2);
        c.put("is_sleeping", sleeping);
        c.put("is_coma", coma);
        c.put("timestamp_last_pass", "2026-10-01 09:00:00");
        c.put("characteristics", "brave, bold");
        return c;
    }

    @Test
    void sqliteAndPostgresShapesGiveTheSameCharacter() {
        Map<String, Object> sqlite = NeutralColumnCodec.character(characterRow(1, 0), LOOKUP,
                Map.of("food", 1, "magic", 0, "coin", 2), List.of(Map.of("id_traits", 1, "id_event", 13)),
                List.of(Map.of("id_item", 5, "amount", 1, "state", "OK")));
        Map<String, Object> postgres = NeutralColumnCodec.character(characterRow(true, false), LOOKUP,
                Map.of("food", 1L, "magic", 0L, "coin", 2L), List.of(Map.of("id_traits", 1L, "id_event", 13L)),
                List.of(Map.of("id_item", 5L, "amount", 1L, "state", "OK")));
        assertEquals(CanonicalJson.write(sqlite), CanonicalJson.write(postgres));
        assertEquals(true, sqlite.get("isSleeping"));
        assertEquals(false, sqlite.get("isComa"));
        assertNull(sqlite.get("classId"));
        assertEquals("u-42", sqlite.get("userUuid"));
        assertEquals("2026-10-01T09:00:00.000Z", sqlite.get("timestampLastPass"));
        assertEquals(List.of("brave", "bold"), sqlite.get("characteristics"));

        Map<String, Object> row = NeutralColumnCodec.characterRow(sqlite, 7L, "now");
        assertEquals(Boolean.TRUE, row.get("is_sleeping"));
        assertEquals(Boolean.FALSE, row.get("is_coma"));
        assertEquals(1L, row.get("id"));
        assertEquals(7L, row.get("id_user"));
        assertEquals("brave,bold", row.get("characteristics"));
        assertEquals(0L, row.get("weight_max"));
        assertEquals(1L, row.get("intelligence"));
        assertNull(NeutralColumnCodec.characterRow(Map.of("ordinal", 1), 1L, "now").get("characteristics"));
    }

    @Test
    void matchRoundTrip() {
        Map<String, Object> m = new HashMap<>();
        m.put("uuid", "m-1");
        m.put("id_difficulty", 1);
        m.put("rng_seed", null);
        m.put("single_player", 0);
        m.put("character_template_uuid", "tpl-1");
        m.put("class_uuid", "cl-1");
        m.put("trait_uuids", "tr-1,missing,tr-2");
        m.put("id_user_creator", 42);
        m.put("current_clock", 3);
        m.put("status", "RUNNING");
        m.put("id_current_weather", 1);
        m.put("id_character_current_turn", 1);
        m.put("ts_insert", "2026-10-01T08:59:00.123456789Z");
        m.put("timestamp_end", "not a date");
        Map<String, Object> neutral = NeutralColumnCodec.match(m, LOOKUP, 2L, 9L);
        assertEquals(9L, neutral.get("rngSeed"));
        assertEquals(false, neutral.get("singlePlayer"));
        assertEquals(List.of(1L, 2L), NeutralColumnCodec.map(neutral.get("loadout")).get("traitIds"));
        assertEquals(C1, neutral.get("activeCharacterUuid"));
        assertEquals("2026-10-01T08:59:00.123Z", neutral.get("createdAt"));
        assertEquals("not a date", neutral.get("timestampEnd"));
        assertNull(NeutralColumnCodec.match(new HashMap<>(Map.of("uuid", "m")), LOOKUP, null, 9L).get("singlePlayer"));

        Map<String, Object> row = NeutralColumnCodec.matchRow(neutral, 5L, 7L, Map.of(C1, 1L),
                Map.of(1L, "tpl-T"), Map.of(1L, "cl-T"), Map.of(1L, "tr-T", 2L, "tr-T2"), "now");
        assertEquals("PAUSED", row.get("status"));
        assertEquals(0, row.get("single_player"));
        assertEquals("tr-T,tr-T2", row.get("trait_uuids"));
        assertEquals("tpl-T", row.get("character_template_uuid"));
        assertEquals(1L, row.get("id_character_current_turn"));
        assertEquals(5L, row.get("exp_cost"));
        Map<String, Object> defaults = NeutralColumnCodec.matchRow(Map.of("uuid", "x"), 1L, 1L, Map.of(), Map.of(),
                Map.of(), Map.of(), "now");
        assertEquals(1, defaults.get("single_player"));
        assertEquals("now", defaults.get("ts_insert"));
    }

    @Test
    void stateSectionsRoundTrip() {
        Map<String, Object> reg = new HashMap<>(Map.of("key", "quest", "string_value", "done", "id_character", 1,
                "id_event", 14, "multi_value", 1, "clock", 2, "id_mission_steps", 3));
        Map<String, Object> r = NeutralColumnCodec.registry(reg, LOOKUP);
        assertEquals(C1, r.get("characterUuid"));
        assertEquals(true, r.get("multiValue"));
        Map<String, Object> back = NeutralColumnCodec.registryRow(r, Map.of(C1, 1L), "now");
        assertEquals(1, back.get("multi_value"));
        assertEquals(3L, back.get("id_mission_steps"));
        assertNull(NeutralColumnCodec.registryRow(Map.of("key", "k"), Map.of(), "now").get("multi_value"));
        assertNull(NeutralColumnCodec.registry(Map.of("key", "k"), LOOKUP).get("multiValue"));

        Map<String, Object> loc = Map.of("id_location", 2, "flag_already_actived", true, "flag_visited", "1",
                "clock_counter", 3);
        assertTrue(NeutralColumnCodec.isNonDefaultLocation(loc, 1L));
        assertTrue(NeutralColumnCodec.isNonDefaultLocation(Map.of("id_location", 1), 1L));
        assertFalse(NeutralColumnCodec.isNonDefaultLocation(Map.of("id_location", 3, "flag_visited", "no"), 1L));
        Map<String, Object> l = NeutralColumnCodec.location(loc);
        assertEquals(true, l.get("flagVisited"));
        Map<String, Object> lr = NeutralColumnCodec.locationRow(2L, l, "now");
        assertEquals(1, lr.get("flag_already_actived"));
        assertEquals(0, NeutralColumnCodec.locationRow(9L, null, "now").get("flag_visited"));

        Map<String, Object> t = NeutralColumnCodec.turn(Map.of("id_character_match", 1, "clock", 3, "priority", 2), LOOKUP);
        assertEquals("WAITING", t.get("status"));
        assertEquals(1L, NeutralColumnCodec.turnRow(t, 1L, "now").get("id_character_match"));
        Map<String, Object> p = NeutralColumnCodec.progress(Map.of("clock", 2, "id_event", 14, "id_choise", 7));
        assertEquals(7L, NeutralColumnCodec.progressRow(p, "now").get("id_choise"));
        Map<String, Object> h = NeutralColumnCodec.choiceRow(Map.of("clock", 2, "id_event", 14, "id_choise", 7,
                "log_message", "CHOICE_SELECTED 7", "ts_insert", "2026-10-01T09:00:00Z"));
        assertEquals("2026-10-01T09:00:00Z", NeutralColumnCodec.choiceExecutedRow(h, "now").get("ts_insert") instanceof String s
                ? s.replace(".000", "") : null);
        assertEquals("now", NeutralColumnCodec.choiceExecutedRow(Map.of(), "now").get("ts_insert"));

        Map<String, Object> ch = Map.of("ordinal", 2, "resources", Map.of("coin", 4));
        assertEquals(4L, NeutralColumnCodec.resourcesRow(ch, "now").get("coin"));
        assertEquals(1L, NeutralColumnCodec.itemRow(Map.of("itemId", 5), 2L, "now").get("amount"));
        assertEquals(13L, NeutralColumnCodec.traitRow(Map.of("traitId", 1, "eventId", 13), 2L, "now").get("id_event"));
    }

    @Test
    void usersNeverCarrySecrets() {
        Map<String, Object> u = NeutralColumnCodec.user(Map.of("uuid", "u", "username", "g", "state", 6,
                "role", "PLAYER", "email_address", "a@b.c"));
        assertEquals(true, u.get("guest"));
        assertEquals("a@b.c", u.get("emailAddress"));
        assertFalse(u.containsKey("password_hash"));
        assertEquals(false, NeutralColumnCodec.user(Map.of("uuid", "u")).get("guest"));
    }

    @Test
    void logsAreSortedNumberedAndMappedBack() {
        Map<String, List<Map<String, Object>>> tables = new LinkedHashMap<>();
        tables.put("log_events", List.of(
                row("id", 3, "log_message", "EVENT_EXECUTED 13", "id_event", 13, "id_character_match", 1,
                        "timestamp", "2026-10-01T09:06:00Z", "energy", 1, "coin_gain", 2, "clock", 1),
                row("id", 4, "log_message", "ADMIN_PAUSE", "timestamp", "2026-10-01T09:07:00Z"),
                row("id", 5, "log_message", null),
                row("id", 6, "log_message", "COMA c", "timestamp", "2026-10-01T09:08:00Z")));
        tables.put("log_movements", List.of(row("id", 1, "id_character_match", 1, "id_location_from", 1,
                "id_location_to", 2, "energy", 2, "ts_insert", "2026-10-01T09:05:00Z")));
        tables.put("log_item_usage", List.of(
                row("id", 1, "id_character_match", 1, "id_item", 5, "action", "add", "food", 1, "energy", -1,
                        "timestamp", "2026-10-01T09:21:00Z", "effects_json", "[]"),
                row("id", 2, "action", "TRADE")));
        tables.put("log_weather", List.of(row("id", 1, "clock", 1, "id_weather", 1, "timestamp_start",
                "2026-10-01T09:00:00Z")));
        tables.put("log_clock_history", List.of(row("id", 1, "clock", 2, "ts_insert", "2026-10-01T09:25:00Z")));
        List<Map<String, Object>> logs = NeutralColumnCodec.logs(tables, LOOKUP);
        assertEquals(List.of("WEATHER", "MOVEMENT", "EVENT", "ADMIN_ACTION", "EDGE_STATE", "ITEM_ADD", "CLOCK_ADVANCE"),
                logs.stream().map(e -> e.get("type")).toList());
        assertEquals(1L, logs.get(0).get("seq"));
        assertEquals("PAUSE", logs.get(3).get("message"));
        assertEquals("COMA", logs.get(4).get("message"));
        Map<String, Object> item = logs.get(5);
        assertEquals("ADD", item.get("itemAction"));
        assertEquals(1L, NeutralColumnCodec.map(item.get("cost")).get("energy"));
        assertEquals(1L, NeutralColumnCodec.map(item.get("gain")).get("food"));

        Map<String, Long> ordinals = Map.of(C1, 1L);
        LogRow weather = NeutralColumnCodec.logRow(logs.get(0), ordinals, "fb");
        assertEquals("log_weather", weather.table());
        LogRow move = NeutralColumnCodec.logRow(logs.get(1), ordinals, "fb");
        assertEquals("log_movements", move.table());
        assertEquals(2L, move.columns().get("energy"));
        LogRow event = NeutralColumnCodec.logRow(logs.get(2), ordinals, "fb");
        assertEquals("EVENT_EXECUTED 13", event.columns().get("log_message"));
        assertEquals(2L, event.columns().get("coin_gain"));
        assertEquals("ADMIN_PAUSE", NeutralColumnCodec.logRow(logs.get(3), ordinals, "fb").columns().get("log_message"));
        LogRow itemRow = NeutralColumnCodec.logRow(item, ordinals, "fb");
        assertEquals(-1L, itemRow.columns().get("energy"));
        assertEquals(1L, itemRow.columns().get("food"));
        assertEquals("log_clock_history", NeutralColumnCodec.logRow(logs.get(6), ordinals, "fb").table());
        Map<String, Object> orphanItem = new HashMap<>(Map.of("type", "ITEM_USE", "message", "m"));
        LogRow orphan = NeutralColumnCodec.logRow(orphanItem, ordinals, "fb");
        assertEquals("log_events", orphan.table());
        assertEquals("ITEM_USE m", orphan.columns().get("log_message"));
        assertEquals("fb", orphan.columns().get("timestamp"));
        assertEquals("ITEM_USE", NeutralColumnCodec.logRow(Map.of("type", "ITEM_USE"), ordinals, "fb")
                .columns().get("log_message"));
        assertEquals("USE", NeutralColumnCodec.logRow(Map.of("type", "ITEM_USE", "itemId", 5, "characterUuid", C1),
                ordinals, "fb").columns().get("action"));
    }

    private static Map<String, Object> row(Object... kv) {
        Map<String, Object> m = new HashMap<>();
        for (int i = 0; i < kv.length; i += 2) {
            m.put((String) kv[i], kv[i + 1]);
        }
        return m;
    }

    @Test
    void reconciliationAddsMissingAndNeutralisesExtraMarkers() {
        List<Map<String, Object>> logs = new ArrayList<>();
        logs.add(Map.of("type", "EVENT", "eventId", 13));
        logs.add(Map.of("type", "EVENT", "eventId", 13));
        logs.add(Map.of("type", "CHOICE", "eventId", 13));
        logs.add(Map.of("type", "EVENT"));
        logs.add(Map.of("type", "MOVEMENT", "locationFromId", 1, "locationToId", 3));
        Reconciliation r = NeutralColumnCodec.reconcile(logs, List.of(
                Map.of("eventId", 13, "executed", 1, "selected", 0), Map.of("eventId", 20, "executed", 1, "selected", 1),
                Map.of("noEvent", 1)));
        assertTrue(r.changed());
        assertEquals(Set.of(1, 2), r.uncounted());
        assertEquals(2, r.missing().size());
        assertTrue(r.missing().get(0).executed());
        assertFalse(r.missing().get(1).executed());
        assertFalse(NeutralColumnCodec.reconcile(List.of(), List.of()).changed());
        assertEquals(Set.of(2L, 1L, 3L), NeutralColumnCodec.importedVisited(
                List.of(Map.of("locationId", 2), Map.of()), logs));
    }

    @Test
    void valueHelpers() {
        assertNull(NeutralColumnCodec.ts(null));
        assertNull(NeutralColumnCodec.ts(" "));
        assertEquals("2026-10-01T10:00:00.000Z", NeutralColumnCodec.ts("2026-10-01T12:00:00+02:00"));
        assertEquals(java.time.Instant.parse("2026-09-24T10:00:00Z").toEpochMilli(), NeutralColumnCodec.epochMillis("2026-09-24T10:00:00Z"));
        assertNull(NeutralColumnCodec.epochMillis("junk"));
        assertNull(NeutralColumnCodec.epochMillis(null));
        assertEquals(1L, NeutralColumnCodec.lng(true));
        assertEquals(0L, NeutralColumnCodec.lng(false));
        assertNull(NeutralColumnCodec.lng("x"));
        assertNull(NeutralColumnCodec.lng(List.of()));
        assertTrue(NeutralColumnCodec.bool("t"));
        assertFalse(NeutralColumnCodec.bool(null));
        assertEquals(List.of(), NeutralColumnCodec.list("x"));
        assertEquals(Map.of(), NeutralColumnCodec.map("x"));
        assertNull(NeutralColumnCodec.first((Object) null));
    }
}
