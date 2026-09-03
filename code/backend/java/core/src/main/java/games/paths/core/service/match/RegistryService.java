package games.paths.core.service.match;

import games.paths.core.entity.story.KeyEntity;
import games.paths.core.model.match.MatchRegistryEntry;
import games.paths.core.model.match.MatchRegistryGroup;
import games.paths.core.port.match.RegistryStorePort;
import games.paths.core.port.match.RegistryStorePort.RegistryRow;
import games.paths.core.port.story.ContentQueryPort;
import games.paths.core.port.story.StoryReadPort;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

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
     * The one registry comparison. {@code =} and {@code !=} are textual, {@code >} and {@code <}
     * need both sides numeric. A null expected value, an unparseable operand or an unknown
     * operator is NOT met: a typo must lock a door, never open one. An absent key satisfies
     * only {@code !=} — "never set" really is different.
     */
    public static boolean evaluate(String operator, String expected, String actual) {
        if (expected == null) {
            return false;
        }
        return switch (operator(operator)) {
            case OP_EQ -> expected.equals(actual);
            case OP_NE -> !expected.equals(actual);
            case OP_GT -> compare(actual, expected) > 0;
            case OP_LT -> compare(actual, expected) < 0;
            default -> false;
        };
    }

    /** True when the condition is absent altogether — a blank key means "no condition". */
    public static boolean noCondition(String key) {
        return key == null || key.isBlank();
    }

    private static String operator(String raw) {
        return raw == null || raw.isBlank() ? OP_EQ : raw.trim();
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

    /** Every key of the match as one map. A row with no value at all maps the key to null. */
    public Map<String, String> loadAll(long idMatch) {
        Map<String, String> out = new HashMap<>();
        for (RegistryRow r : store.findByMatch(idMatch)) {
            if (r.key() != null) {
                out.put(r.key(), render(r));
            }
        }
        return out;
    }

    /** One key. Empty means the key is absent; a present key with no value renders as null. */
    public Optional<String> find(long idMatch, String key) {
        return store.findByMatchAndKey(idMatch, key).map(RegistryService::render);
    }

    /** The raw rows, with no story metadata. Used where only the values matter. */
    public List<MatchRegistryEntry> listEntries(long idMatch) {
        List<MatchRegistryEntry> out = new ArrayList<>();
        for (RegistryRow r : store.findByMatch(idMatch)) {
            out.add(toEntry(r));
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
        List<MatchRegistryEntry> out = new ArrayList<>();
        for (RegistryRow r : store.findByMatch(idMatch)) {
            MatchRegistryEntry e = toEntry(r);
            KeyEntity def = r.key() == null ? null : defs.get(r.key());
            if (def != null) {
                e.setCategory(def.getGroup());
                e.setPriority(def.getPriority());
                e.setVisible(VISIBILITY_PUBLIC.equalsIgnoreCase(trim(def.getVisibility())));
                e.setIdCard(def.getIdCard());
                e.setCard(card(idStory, def.getIdCard(), lang));
            }
            if (e.isVisible() || includeHidden) {
                out.add(e);
            }
        }
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

    private static MatchRegistryEntry toEntry(RegistryRow r) {
        MatchRegistryEntry e = new MatchRegistryEntry();
        e.setUuid(r.uuid());
        e.setKey(r.key());
        e.setStringValue(r.stringValue());
        e.setIntValue(r.intValue());
        e.setIdCharacter(r.idCharacter());
        return e;
    }

    private static String nz(String v) {
        return v == null ? "" : v;
    }

    private static String trim(String v) {
        return v == null ? null : v.trim();
    }

    // ── writes ─────────────────────────────────────────────────────────────

    /** Set one key. A blank key is authored noise and is skipped, not an error. */
    public void upsert(long idMatch, String key, String value, Long idCharacter,
                       Long idEvent, Long idChoice, Integer clock) {
        if (noCondition(key)) {
            return;
        }
        String previous = find(idMatch, key).orElse(null);
        RegistryRow parsed = parse(key, value);
        store.upsert(idMatch, key, parsed.stringValue(), parsed.intValue(),
                idCharacter, idEvent, idChoice, clock);
        // One writer, one audit row: a registry change can neither be missed nor doubled.
        store.logChange(idMatch, idCharacter, idEvent, idChoice, clock,
                MSG_REGISTRY_CHANGE + " " + key + " " + previous + " -> " + value);
    }

    /** Match creation: one row per story key, holding the default from {@code list_keys.value}. */
    public void seed(long idMatch, List<KeyEntity> keys) {
        List<RegistryRow> rows = new ArrayList<>();
        if (keys != null) {
            for (KeyEntity k : keys) {
                rows.add(parse(k.getName(), k.getValue()));
            }
        }
        store.insertAll(idMatch, rows);
    }

    public void deleteByMatch(List<Long> matchIds) {
        store.deleteByMatchIdIn(matchIds);
    }
}
