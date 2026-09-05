package games.paths.core.service.match;

import games.paths.core.entity.story.KeyEntity;
import games.paths.core.model.match.MatchRegistryEntry;
import games.paths.core.model.match.MatchRegistryGroup;
import games.paths.core.port.match.RegistryStorePort;
import games.paths.core.port.match.RegistryStorePort.RegistryRow;
import games.paths.core.port.story.ContentQueryPort;
import games.paths.core.port.story.StoryReadPort;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/**
 * RegistryService - Step 36. The one place that reads, writes and compares the match registry.
 * Before it, eight readers disagreed on how a row becomes a string and three writers on how a
 * string becomes a row; {@link #render} and {@link #parse} are now exact inverses.
 */
public class RegistryService {

    /** The operators a registry condition may use. A null or blank column means {@code =}. */
    public static final String OP_EQ = "=";
    public static final String OP_NE = "!=";
    public static final String OP_GT = ">";
    public static final String OP_LT = "<";

    /** Prefix of the {@code log_events} row every write leaves behind; read by MatchLogsService. */
    public static final String MSG_REGISTRY_CHANGE = "REGISTRY_CHANGE";

    /** A key hidden from the player: anything its definition does not mark PUBLIC. */
    public static final String VISIBILITY_PUBLIC = "PUBLIC";

    private final RegistryStorePort store;
    /** Null on the bare constructor: entries then carry no category, card or visibility. */
    private final StoryReadPort storyReadPort;
    private final ContentQueryPort contentQueryPort;

    /** Values-only constructor: enough for the codec, the comparison and every write. */
    public RegistryService(RegistryStorePort store) {
        this(store, null, null);
    }

    public RegistryService(RegistryStorePort store, StoryReadPort storyReadPort,
                           ContentQueryPort contentQueryPort) {
        this.store = store;
        this.storyReadPort = storyReadPort;
        this.contentQueryPort = contentQueryPort;
    }

    // ── the two value primitives, exact inverses of each other ──────────────

    /** A row as one comparable string: the string wins, else the int, else null. */
    public static String render(String stringValue, Integer intValue) {
        if (stringValue != null) {
            return stringValue;
        }
        return intValue == null ? null : String.valueOf(intValue);
    }

    public static String render(RegistryRow row) {
        return row == null ? null : render(row.stringValue(), row.intValue());
    }

    /**
     * A value as the pair of columns: numeric lands in int_value, anything else in string_value,
     * never both. Trimmed in both branches, so what an author types is what a condition reads.
     */
    public static RegistryRow parse(String key, String value) {
        if (value == null) {
            return RegistryRow.of(key, null, null);
        }
        String trimmed = value.trim();
        try {
            return RegistryRow.of(key, null, Integer.valueOf(trimmed));
        } catch (NumberFormatException notNumeric) {
            return RegistryRow.of(key, trimmed, null);
        }
    }

    // ── comparison ─────────────────────────────────────────────────────────

    /**
     * The one registry comparison, over the SET of values a key holds. Step 36.1 generalised it;
     * on a one-element set every reading below is the equality or comparison it always was, which
     * is why no caller and no authored story had to change.
     *
     * <ul>
     *   <li>{@code =}  — ∃: at least one member equals the value</li>
     *   <li>{@code !=} — ∄: no member equals it (so an absent key satisfies it, as before)</li>
     *   <li>{@code >} {@code <} — ∀: EVERY member compares that way, and an empty set never
     *       does. Vacuous truth would open a door, and the doctrine is that a typo closes one.</li>
     * </ul>
     *
     * A null expected value, an unparseable operand or an unknown operator is NOT met.
     */
    public static boolean evaluate(String operator, String expected, Collection<String> actual) {
        if (expected == null) {
            return false;
        }
        Collection<String> values = actual == null ? List.of() : actual;
        return switch (operator(operator)) {
            case OP_EQ -> values.stream().anyMatch(v -> eq(v, expected));
            case OP_NE -> values.stream().noneMatch(v -> eq(v, expected));
            // ∀ over an empty set is vacuously true in logic and wrong here.
            case OP_GT -> !values.isEmpty() && values.stream().allMatch(v -> compare(v, expected) > 0);
            case OP_LT -> !values.isEmpty() && values.stream().allMatch(v -> compare(v, expected) < 0);
            default -> false;
        };
    }

    /**
     * Members ordered for display: numbers numerically first, then everything else
     * alphabetically. Computed here so both payloads and all three backends agree.
     */
    public static List<String> ordered(Collection<String> values) {
        List<String> out = new ArrayList<>(values == null ? List.of() : values);
        out.sort((a, b) -> {
            Integer na = numeric(a);
            Integer nb = numeric(b);
            if (na != null && nb != null) {
                return Integer.compare(na, nb);
            }
            if (na != null) {
                return -1;
            }
            if (nb != null) {
                return 1;
            }
            return nz(a).compareTo(nz(b));
        });
        return out;
    }

    /** True when the condition is absent altogether — a blank key means "no condition". */
    public static boolean noCondition(String key) {
        return key == null || key.isBlank();
    }

    private static String operator(String raw) {
        return raw == null || raw.isBlank() ? OP_EQ : raw.trim();
    }

    /** v0.36.2 - the form a value is COMPARED in: trimmed and case-folded, never stored. */
    private static String norm(String value) {
        return value == null ? null : value.trim().toLowerCase(Locale.ROOT);
    }

    /** Equality as every registry comparison means it: blind to case and to padding. */
    private static boolean eq(String a, String b) {
        return Objects.equals(norm(a), norm(b));
    }

    /** Membership under {@link #eq}, so a set never holds two spellings of one value. */
    private static boolean containsNorm(Collection<String> values, String value) {
        return values.stream().anyMatch(v -> eq(v, value));
    }

    /** The row a value names, whatever case the author wrote it in. Null when none does. */
    private static RegistryRow firstMatching(List<RegistryRow> rows, String value) {
        for (RegistryRow r : rows) {
            if (eq(render(r), value)) {
                return r;
            }
        }
        return null;
    }

    /** -1/0/1 comparing two numerics; 0 when either side is not a number, which never passes. */
    private static int compare(String actual, String expected) {
        Integer a = numeric(actual);
        Integer e = numeric(expected);
        if (a == null || e == null) {
            return 0;
        }
        return Integer.compare(a, e);
    }

    private static Integer numeric(String value) {
        if (value == null) {
            return null;
        }
        try {
            return Integer.valueOf(value.trim());
        } catch (NumberFormatException notNumeric) {
            return null;
        }
    }

    // ── reads ──────────────────────────────────────────────────────────────

    /**
     * Every key of the match, each with the SET of values it holds. A key with no value at all
     * maps to an empty list — never to null, so a caller never has to guard.
     */
    public Map<String, List<String>> loadAll(long idMatch) {
        Map<String, List<String>> out = new HashMap<>();
        for (RegistryRow r : store.findByMatch(idMatch)) {
            if (r.key() != null) {
                String value = render(r);
                List<String> values = out.computeIfAbsent(r.key(), k -> new ArrayList<>());
                if (value != null) {
                    values.add(value);
                }
            }
        }
        return out;
    }

    /** The values of one key. Empty when the key is absent, or present with an empty set. */
    public List<String> find(long idMatch, String key) {
        List<String> out = new ArrayList<>();
        for (RegistryRow r : store.findByMatchAndKey(idMatch, key)) {
            String value = render(r);
            if (value != null) {
                out.add(value);
            }
        }
        return out;
    }

    /**
     * The rows joined with their {@code list_keys} definition — category, visibility, priority
     * and card. A row whose key the story no longer declares is kept but reads as hidden: it is
     * state the engine wrote, and dropping it silently would hide a bug rather than a key.
     */
    public List<MatchRegistryEntry> listEntries(long idMatch, Long idStory, boolean includeHidden,
                                                String lang) {
        Map<String, KeyEntity> defs = keyDefinitions(idStory);

        // One entry per KEY, holding its whole set. The keys are the union of what the story
        // declares and what the match actually holds: a key whose members were all removed, or
        // one added to the story after this match began, still has an entry with an empty set,
        // and a row whose key the story no longer declares is kept but reads as hidden.
        Map<String, List<RegistryRow>> byKey = new LinkedHashMap<>();
        for (String name : defs.keySet()) {
            byKey.put(name, new ArrayList<>());
        }
        for (RegistryRow r : store.findByMatch(idMatch)) {
            if (r.key() != null) {
                byKey.computeIfAbsent(r.key(), k -> new ArrayList<>()).add(r);
            }
        }

        List<MatchRegistryEntry> out = new ArrayList<>();
        byKey.forEach((name, rows) -> {
            MatchRegistryEntry e = toEntry(name, rows);
            KeyEntity def = defs.get(name);
            if (def != null) {
                e.setCategory(def.getGroup());
                e.setPriority(def.getPriority());
                e.setVisible(VISIBILITY_PUBLIC.equalsIgnoreCase(trim(def.getVisibility())));
                e.setIdCard(def.getIdCard());
                e.setCard(card(idStory, def.getIdCard(), lang));
                e.setMultiValue(isMulti(def));
            }
            if (e.isVisible() || includeHidden) {
                out.add(e);
            }
        });
        out.sort(Comparator
                .comparing((MatchRegistryEntry e) -> nz(e.getCategory()))
                .thenComparingInt(e -> e.getPriority() == null ? 0 : e.getPriority())
                .thenComparing(e -> nz(e.getKey())));
        return out;
    }

    /** The same entries, bucketed by category and keeping the sort above inside each bucket. */
    public List<MatchRegistryGroup> listGroups(long idMatch, Long idStory, boolean includeHidden,
                                               String lang) {
        Map<String, List<MatchRegistryEntry>> byCategory = new LinkedHashMap<>();
        for (MatchRegistryEntry e : listEntries(idMatch, idStory, includeHidden, lang)) {
            byCategory.computeIfAbsent(e.getCategory(), k -> new ArrayList<>()).add(e);
        }
        List<MatchRegistryGroup> out = new ArrayList<>();
        byCategory.forEach((category, entries) -> out.add(new MatchRegistryGroup(category, entries)));
        return out;
    }

    private Map<String, KeyEntity> keyDefinitions(Long idStory) {
        Map<String, KeyEntity> defs = new HashMap<>();
        if (storyReadPort == null || idStory == null) {
            return defs;
        }
        List<KeyEntity> keys = storyReadPort.findKeysByStoryId(idStory);
        if (keys != null) {
            for (KeyEntity k : keys) {
                if (k.getName() != null) {
                    defs.put(k.getName(), k);
                }
            }
        }
        return defs;
    }

    private games.paths.core.model.story.CardInfo card(Long idStory, Integer idCard, String lang) {
        if (contentQueryPort == null || idStory == null || idCard == null) {
            return null;
        }
        return contentQueryPort.getCardByStoryIdAndCardId(idStory, idCard, lang);
    }

    /**
     * One entry per key. {@code uuid} and {@code idCharacter} come from the LAST row written —
     * on a multi key that means "who last wrote anything here", which is what the payload says.
     */
    private static MatchRegistryEntry toEntry(String key, List<RegistryRow> rows) {
        MatchRegistryEntry e = new MatchRegistryEntry();
        e.setKey(key);
        List<String> values = new ArrayList<>();
        for (RegistryRow r : rows) {
            String value = render(r);
            if (value != null) {
                values.add(value);
            }
            e.setUuid(r.uuid());
            e.setIdCharacter(r.idCharacter());
            if (r.isMulti()) {
                e.setMultiValue(true);
            }
        }
        e.setValues(ordered(values));
        return e;
    }

    /** The story's own declaration, which decides how a write behaves for a key with no row yet. */
    private static boolean isMulti(KeyEntity def) {
        return def != null && def.getMultiValue() != null && def.getMultiValue() != 0;
    }

    private static String nz(String v) {
        return v == null ? "" : v;
    }

    private static String trim(String v) {
        return v == null ? null : v.trim();
    }

    // ── writes ─────────────────────────────────────────────────────────────

    /**
     * Write one key. A blank key is authored noise and is skipped, not an error.
     *
     * <p>Whether the value REPLACES the key or JOINS it is decided by the rows already there —
     * their {@code multi_value} mirror — and only by the story's declaration when the key has no
     * row yet. That is what lets an author flip the flag without disturbing a match already in
     * progress: a running match keeps the behaviour it was born with.</p>
     */
    @SuppressWarnings("java:S107")
    public List<String> upsert(long idMatch, Long idStory, String key, String value,
                               Long idCharacter, Long idEvent, Long idChoice, Integer clock) {
        if (noCondition(key)) {
            return List.of();
        }
        List<RegistryRow> rows = store.findByMatchAndKey(idMatch, key);
        // The rows decide; the story is consulted only for a key this match has never written.
        boolean multi = rows.isEmpty() ? declaredMulti(idStory, key) : rows.get(0).isMulti();
        RegistryRow parsed = parse(key, value);

        String rendered = render(parsed.stringValue(), parsed.intValue());

        if (!multi) {
            String previous = rows.isEmpty() ? null : render(rows.get(0));
            store.upsert(idMatch, key, parsed.stringValue(), parsed.intValue(),
                    idCharacter, idEvent, idChoice, clock);
            log(idMatch, idCharacter, idEvent, idChoice, clock,
                    key + " " + previous + " -> " + value);
            return rendered == null ? List.of() : List.of(rendered);
        }
        // A set: adding a member it already holds changes nothing, so it says nothing either.
        List<String> current = values(rows);
        if (rendered == null || containsNorm(current, rendered)) {
            return ordered(current);
        }
        store.insertValue(idMatch, key, parsed.stringValue(), parsed.intValue(),
                idCharacter, idEvent, idChoice, clock);
        log(idMatch, idCharacter, idEvent, idChoice, clock, key + " +" + rendered);
        List<String> after = new ArrayList<>(current);
        after.add(rendered);
        return ordered(after);
    }

    /**
     * Take one value away. On a single key this is the compare-and-clear it has always been; on
     * a multi key it removes that one member and leaves the rest. Removing the last member
     * leaves the key with an empty set — the row goes, the key does not.
     */
    @SuppressWarnings("java:S107")
    public List<String> remove(long idMatch, String key, String value, Long idCharacter,
                               Long idEvent, Long idChoice, Integer clock) {
        if (noCondition(key)) {
            return List.of();
        }
        List<RegistryRow> rows = store.findByMatchAndKey(idMatch, key);
        List<String> current = values(rows);
        if (rows.isEmpty()) {
            return current;
        }
        RegistryRow parsed = parse(key, value);
        String rendered = render(parsed.stringValue(), parsed.intValue());

        if (!rows.get(0).isMulti()) {
            if (rendered == null || !eq(rendered, render(rows.get(0)))) {
                return current;   // a value the story has since moved on from: leave it alone
            }
            store.upsert(idMatch, key, null, null, idCharacter, idEvent, idChoice, clock);
            log(idMatch, idCharacter, idEvent, idChoice, clock, key + " " + rendered + " -> null");
            return List.of();
        }
        // The member is named case-blind but deleted as stored, or the delete matches nothing.
        RegistryRow stored = rendered == null ? null : firstMatching(rows, rendered);
        if (stored == null) {
            return ordered(current);
        }
        String storedValue = render(stored);
        store.deleteValue(idMatch, key, stored.stringValue(), stored.intValue());
        log(idMatch, idCharacter, idEvent, idChoice, clock, key + " -" + storedValue);
        List<String> after = new ArrayList<>(current);
        after.remove(storedValue);
        return ordered(after);
    }

    /** The rendered members of a key's rows, skipping a row that holds no value at all. */
    private static List<String> values(List<RegistryRow> rows) {
        List<String> out = new ArrayList<>();
        for (RegistryRow r : rows) {
            String v = render(r);
            if (v != null) {
                out.add(v);
            }
        }
        return out;
    }

    /** One writer, one audit row: a registry change can neither be missed nor doubled. */
    private void log(long idMatch, Long idCharacter, Long idEvent, Long idChoice, Integer clock,
                     String detail) {
        store.logChange(idMatch, idCharacter, idEvent, idChoice, clock,
                MSG_REGISTRY_CHANGE + " " + detail);
    }

    /** What the story says about a key the match has never written. */
    private boolean declaredMulti(Long idStory, String key) {
        if (storyReadPort == null || idStory == null) {
            return false;
        }
        return isMulti(keyDefinitions(idStory).get(key));
    }

    /**
     * Match creation: one row per story key, holding the default from {@code list_keys.value}.
     * A MULTI key with no default seeds no row at all — its set starts empty, and an empty set
     * is the absence of rows, not a row holding nothing. Each row carries the mirror that will
     * decide how this match writes the key from now on.
     */
    public void seed(long idMatch, List<KeyEntity> keys) {
        List<RegistryRow> rows = new ArrayList<>();
        if (keys != null) {
            for (KeyEntity k : keys) {
                boolean multi = isMulti(k);
                RegistryRow parsed = parse(k.getName(), k.getValue());
                if (multi && render(parsed.stringValue(), parsed.intValue()) == null) {
                    continue;
                }
                rows.add(RegistryRow.of(k.getName(), parsed.stringValue(), parsed.intValue(),
                        multi));
            }
        }
        store.insertAll(idMatch, rows);
    }

    // ── admin edit (v0.36.2) ────────────────────────────────────────────────

    /** The values of one key, by match uuid. Empty when the match or the key is unknown. */
    public List<String> findByMatchUuid(String matchUuid, String key) {
        long[] ids = store.findMatchAndStoryIdByUuid(matchUuid).orElse(null);
        return ids == null ? List.of() : find(ids[0], key);
    }

    /**
     * The admin console writing a key by match uuid. Nobody in the fiction did this, so the
     * character, event and choice columns stay null — but the audit row is the ordinary one,
     * because a correction the log does not mention is a correction nobody can trace.
     * Null when no match answers to the uuid.
     */
    public List<String> upsertByMatchUuid(String matchUuid, String key, String value) {
        long[] ids = store.findMatchAndStoryIdByUuid(matchUuid).orElse(null);
        if (ids == null) {
            return null;
        }
        return upsert(ids[0], ids[1], key, value, null, null, null, null);
    }

    /**
     * The admin console taking a value away. A null value empties a single key outright
     * rather than comparing first: the console is correcting the row, not playing the story.
     */
    public List<String> removeByMatchUuid(String matchUuid, String key, String value) {
        long[] ids = store.findMatchAndStoryIdByUuid(matchUuid).orElse(null);
        if (ids == null) {
            return null;
        }
        if (value == null) {
            return clear(ids[0], key);
        }
        return remove(ids[0], key, value, null, null, null, null);
    }

    /** Empty a key whatever it holds: every member of a set, or the value of a single key. */
    private List<String> clear(long idMatch, String key) {
        if (noCondition(key)) {
            return List.of();
        }
        List<RegistryRow> rows = store.findByMatchAndKey(idMatch, key);
        for (String member : values(rows)) {
            remove(idMatch, key, member, null, null, null, null);
        }
        return List.of();
    }

    public void deleteByMatch(List<Long> matchIds) {
        store.deleteByMatchIdIn(matchIds);
    }
}
