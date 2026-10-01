package games.paths.core.model.match.export;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * LogTypeMapper - v0.41.4 the log_events message to timeline type rule, shared by MatchLogsService and
 * the match export (so they never drift), plus the storage prefix an imported entry gets back.
 */
public final class LogTypeMapper {

    public static final String WEATHER = "WEATHER";
    public static final String MOVEMENT = "MOVEMENT";
    public static final String SLEEP = "SLEEP";
    public static final String CLOCK_ADVANCE = "CLOCK_ADVANCE";
    public static final String RECOVERY = "RECOVERY";
    public static final String EVENT = "EVENT";
    public static final String CHOICE = "CHOICE";
    public static final String COUNTER_ZERO = "COUNTER_ZERO";
    public static final String AUTOMATIC_EVENT = "AUTOMATIC_EVENT";
    public static final String RANDOM_EVENT = "RANDOM_EVENT";
    public static final String REGISTRY_CHANGE = "REGISTRY_CHANGE";
    public static final String MISSION_CHANGE = "MISSION_CHANGE";
    public static final String ITEM_ADD = "ITEM_ADD";
    public static final String ITEM_USE = "ITEM_USE";
    public static final String ITEM_DROP = "ITEM_DROP";
    public static final String EXP_USE = "EXP_USE";
    public static final String PASS = "PASS";
    public static final String EDGE_STATE = "EDGE_STATE";
    public static final String TRAIT_CHANGE = "TRAIT_CHANGE";
    public static final String MATCH_LIFECYCLE = "MATCH_LIFECYCLE";
    public static final String ADMIN_ACTION = "ADMIN_ACTION";
    public static final String OTHER = "OTHER";

    public static final String MSG_SLEEP = "ACTION_SLEEP";
    public static final String MSG_PASS = "ACTION_PASS";
    public static final String MSG_EVENT_EXECUTED = "EVENT_EXECUTED";
    public static final String MSG_CHOICE_SELECTED = "CHOICE_SELECTED";
    public static final String MSG_COUNTER = "counter";
    public static final String MSG_AUTOMATIC_EVENT = "automatic event";
    public static final String MSG_RANDOM_EVENT = "random event";
    public static final String MSG_REGISTRY_CHANGE = "REGISTRY_CHANGE";
    public static final String MSG_MISSION_CHANGE = "MISSION_CHANGE";
    public static final String MSG_EXP_USE = "EXP_USE";
    public static final String MSG_RECOVERY = "recovery";
    public static final String MSG_TRAIT_ADD = "TRAIT_ADD";
    public static final String MSG_TRAIT_REMOVE = "TRAIT_REMOVE";
    public static final String PREFIX_TRAIT = "TRAIT_";
    public static final String PREFIX_MATCH = "MATCH_";
    public static final String PREFIX_ADMIN = "ADMIN_";
    /** An imported entry that must not count as an engine marker. */
    public static final String MSG_UNCOUNTED = "IMPORTED_UNCOUNTED";

    /** Edge-state rows are matched on their first word: COMA_RECOVERED and ALL_PLAYER_COMA contain COMA. */
    public static final Set<String> EDGE_STATES = Set.of("COMA", "SADNESS_OVERFLOW", "COMA_RECOVERED",
            "ALL_PLAYER_COMA");

    /** The log_events types in classification order, with the message prefix that selects them. */
    private static final List<Map.Entry<String, String>> PREFIXED = List.of(
            Map.entry(MSG_EVENT_EXECUTED, EVENT),
            Map.entry(MSG_CHOICE_SELECTED, CHOICE),
            Map.entry(MSG_COUNTER, COUNTER_ZERO),
            Map.entry(MSG_AUTOMATIC_EVENT, AUTOMATIC_EVENT),
            Map.entry(MSG_RANDOM_EVENT, RANDOM_EVENT),
            Map.entry(MSG_REGISTRY_CHANGE, REGISTRY_CHANGE),
            Map.entry(MSG_MISSION_CHANGE, MISSION_CHANGE),
            Map.entry(MSG_EXP_USE, EXP_USE),
            Map.entry(MSG_RECOVERY, RECOVERY));

    /** The storage prefix an imported entry of a log_events type gets back. */
    private static final Map<String, String> STORAGE_PREFIX = Map.ofEntries(
            Map.entry(SLEEP, MSG_SLEEP), Map.entry(PASS, MSG_PASS),
            Map.entry(EVENT, MSG_EVENT_EXECUTED), Map.entry(CHOICE, MSG_CHOICE_SELECTED),
            Map.entry(COUNTER_ZERO, MSG_COUNTER), Map.entry(AUTOMATIC_EVENT, MSG_AUTOMATIC_EVENT),
            Map.entry(RANDOM_EVENT, MSG_RANDOM_EVENT), Map.entry(REGISTRY_CHANGE, MSG_REGISTRY_CHANGE),
            Map.entry(MISSION_CHANGE, MSG_MISSION_CHANGE), Map.entry(EXP_USE, MSG_EXP_USE),
            Map.entry(RECOVERY, MSG_RECOVERY), Map.entry(TRAIT_CHANGE, PREFIX_TRAIT),
            Map.entry(MATCH_LIFECYCLE, PREFIX_MATCH), Map.entry(ADMIN_ACTION, PREFIX_ADMIN),
            Map.entry(EDGE_STATE, ""));

    private LogTypeMapper() {
    }

    /** The timeline type of a log_events message: OTHER when no rule matches, null for a null message. */
    public static String eventType(String msg) {
        if (msg == null) {
            return null;
        }
        if (MSG_SLEEP.equals(msg)) {
            return SLEEP;
        }
        for (Map.Entry<String, String> rule : PREFIXED) {
            if (msg.startsWith(rule.getKey())) {
                return rule.getValue();
            }
        }
        String firstWord = msg.split(" ", 2)[0];
        if (MSG_PASS.equals(msg)) {
            return PASS;
        }
        if (EDGE_STATES.contains(firstWord)) {
            return EDGE_STATE;
        }
        if (msg.startsWith(MSG_TRAIT_ADD + " ") || msg.startsWith(MSG_TRAIT_REMOVE + " ")) {
            return TRAIT_CHANGE;
        }
        if (msg.startsWith(PREFIX_MATCH)) {
            return MATCH_LIFECYCLE;
        }
        if (msg.startsWith(PREFIX_ADMIN)) {
            return ADMIN_ACTION;
        }
        return OTHER;
    }

    /** What the timeline shows as the message of a log_events row of that type. */
    public static String timelineMessage(String type, String msg) {
        if (msg == null || type == null) {
            return null;
        }
        return switch (type) {
            case SLEEP, PASS -> null;
            case EDGE_STATE -> msg.split(" ", 2)[0];
            case TRAIT_CHANGE -> msg.substring(PREFIX_TRAIT.length());
            case MATCH_LIFECYCLE -> msg.substring(PREFIX_MATCH.length());
            case ADMIN_ACTION -> msg.substring(PREFIX_ADMIN.length());
            default -> msg;
        };
    }

    /** True for the types stored as log_events rows (the others have a table of their own). */
    public static boolean isEventRow(String type) {
        return type != null && (STORAGE_PREFIX.containsKey(type) || OTHER.equals(type));
    }

    /** The log_message an imported entry is stored with: the type prefix plus the message (H.2.3 rule). */
    public static String storedMessage(String type, String message) {
        String prefix = type == null ? null : STORAGE_PREFIX.get(type);
        if (prefix == null) {
            if (message == null) {
                return MSG_UNCOUNTED;
            }
            boolean marker = message.startsWith(MSG_EVENT_EXECUTED) || message.startsWith(MSG_CHOICE_SELECTED);
            return marker ? MSG_UNCOUNTED + " " + message : message;
        }
        if (message == null || message.isBlank()) {
            return prefix.isEmpty() ? MSG_UNCOUNTED : prefix;
        }
        if (prefix.isEmpty() || message.startsWith(prefix)) {
            return message;
        }
        return prefix.endsWith("_") ? prefix + message : prefix + " " + message;
    }

    /** log_item_usage.action to timeline type: REMOVE and DROP share one; unknown actions answer null. */
    public static String itemType(String action) {
        if (action == null) {
            return ITEM_USE;
        }
        return switch (action.trim().toUpperCase(Locale.ROOT)) {
            case "ADD" -> ITEM_ADD;
            case "USE" -> ITEM_USE;
            case "DROP", "REMOVE" -> ITEM_DROP;
            default -> null;
        };
    }
}
