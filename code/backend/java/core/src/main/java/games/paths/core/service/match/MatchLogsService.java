package games.paths.core.service.match;

import games.paths.core.model.story.CardInfo;
import games.paths.core.port.match.EventExecutionStorePort;
import games.paths.core.port.match.LocationEntryStorePort;
import games.paths.core.port.match.MatchLogsPort;
import games.paths.core.port.match.MatchLogsStorePort;
import games.paths.core.port.match.MatchLogsStorePort.CharacterLogView;
import games.paths.core.port.match.MatchLogsStorePort.ClockLogEntry;
import games.paths.core.port.match.MatchLogsStorePort.EventLogEntry;
import games.paths.core.port.match.MatchLogsStorePort.ItemLogEntry;
import games.paths.core.port.match.MatchLogsStorePort.MatchSummary;
import games.paths.core.port.match.MatchLogsStorePort.MovementLogEntry;
import games.paths.core.port.match.MatchLogsStorePort.WeatherLogEntry;
import games.paths.core.port.match.TurnCyclePort.TurnCycleException;
import games.paths.core.port.match.UserAccessPort;
import games.paths.core.port.story.ContentQueryPort;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * MatchLogsService - assembles the consolidated match log from the five append-only
 * log tables (Step 28.7; log_item_usage joined them in v0.35.4). Returns a timeline sorted by timestamp ascending, or newest
 * first when the caller asks for {@code order=desc}.
 *
 * <p>Log types assembled:
 * <ul>
 *   <li>WEATHER — from log_weather</li>
 *   <li>MOVEMENT — from log_movements</li>
 *   <li>SLEEP — from log_events WHERE log_message='ACTION_SLEEP'</li>
 *   <li>CLOCK_ADVANCE — from log_clock_history</li>
 *   <li>RECOVERY — from log_events WHERE log_message LIKE 'recovery%'</li>
 *   <li>EVENT — from log_events WHERE log_message LIKE 'EVENT_EXECUTED%' (Step 29)</li>
 *   <li>COUNTER_ZERO — from log_events WHERE log_message LIKE 'counter%' (Step 33; until
 *       then these rows were folded into RECOVERY, which they never were)</li>
 *   <li>AUTOMATIC_EVENT — from log_events WHERE log_message LIKE 'automatic event%' (Step 33)</li>
 *   <li>ITEM_ADD / ITEM_USE / ITEM_DROP — from log_item_usage, one per action (v0.35.4)</li>
 * </ul>
 * </p>
 *
 * <p>v0.28.7 — the timeline is cursor-paginated: the full timeline is assembled and
 * sorted, then only the requested slice is returned and enriched. Enrichment needs at
 * most five extra queries per request (weather cards, location cards, template cards,
 * event cards, match characters), regardless of the page size. WEATHER entries carry the
 * weather's card; MOVEMENT entries carry the destination location's card plus the
 * character that moved; SLEEP and RECOVERY entries carry their character. v0.30.3 adds
 * the triggered event's own card to EVENT entries.</p>
 *
 * <p>See {@code documentation_v0/Step28_MovementSystem.md} §8.</p>
 */
public class MatchLogsService implements MatchLogsPort {

    private static final String TYPE_WEATHER = "WEATHER";
    private static final String TYPE_MOVEMENT = "MOVEMENT";
    private static final String TYPE_SLEEP = "SLEEP";
    private static final String TYPE_CLOCK_ADVANCE = "CLOCK_ADVANCE";
    private static final String TYPE_RECOVERY = "RECOVERY";
    /** Step 29 — an event the player triggered. */
    private static final String TYPE_EVENT = "EVENT";
    /** Step 33 — a location's counter ran out. Split out of RECOVERY, which it never was. */
    private static final String TYPE_COUNTER_ZERO = "COUNTER_ZERO";
    /** Step 33 — an event the engine fired: an arrival, a counter, a time-start. */
    private static final String TYPE_AUTOMATIC_EVENT = "AUTOMATIC_EVENT";
    /** v0.35.4 — the three item actions, read off {@code log_item_usage.action}. */
    private static final String TYPE_ITEM_ADD = "ITEM_ADD";
    private static final String TYPE_ITEM_USE = "ITEM_USE";
    private static final String TYPE_ITEM_DROP = "ITEM_DROP";
    private static final String MSG_SLEEP = "ACTION_SLEEP";
    private static final String MSG_COUNTER = "counter";
    private static final String DEFAULT_LANG = "en";
    private static final String CURSOR_PREFIX = "offset:";

    private final MatchLogsStorePort store;
    private final UserAccessPort userAccessPort;
    private final ContentQueryPort contentQueryPort;

    public MatchLogsService(MatchLogsStorePort store, UserAccessPort userAccessPort,
                            ContentQueryPort contentQueryPort) {
        this.store = store;
        this.userAccessPort = userAccessPort;
        this.contentQueryPort = contentQueryPort;
    }

    @Override
    public MatchLogsResult getMatchLogs(String uuidMatch, String userUuid, String lang,
                                        Integer limit, String cursor, String order) {
        MatchSummary match = requireMatch(uuidMatch);
        long userId = userAccessPort.findByUuid(userUuid)
                .map(UserAccessPort.UserView::id)
                .orElseThrow(MatchLogsService::notFound);
        if (match.idUserCreator() != userId) {
            throw notFound();
        }
        return buildResult(match, lang, limit, cursor, order);
    }

    @Override
    public MatchLogsResult getMatchLogsForAdmin(String uuidMatch, String lang,
                                                Integer limit, String cursor, String order) {
        return buildResult(requireMatch(uuidMatch), lang, limit, cursor, order);
    }

    // ── internal ─────────────────────────────────────────────────────────────

    /** Only {@code desc} flips the timeline; anything else (null, junk) keeps {@code asc}. */
    private static String normalizeOrder(String order) {
        return order != null && ORDER_DESC.equalsIgnoreCase(order.trim()) ? ORDER_DESC : ORDER_ASC;
    }

    private MatchLogsResult buildResult(MatchSummary match, String lang,
                                        Integer limit, String cursor, String order) {
        List<LogEntry> all = assembleTimeline(match);
        String effectiveOrder = normalizeOrder(order);
        // Reversed before the page is cut, so the cursor keeps walking away from the first
        // entry: with `desc` the following pages move towards the older entries.
        if (ORDER_DESC.equals(effectiveOrder)) {
            Collections.reverse(all);
        }

        int effectiveLimit = clampLimit(limit);
        int offset = decodeCursor(cursor);
        if (offset > all.size()) {
            offset = all.size();
        }
        int end = Math.min(offset + effectiveLimit, all.size());
        List<LogEntry> page = enrich(all.subList(offset, end), match, resolveLang(lang));
        String nextCursor = end < all.size() ? encodeCursor(end) : null;

        return new MatchLogsResult(match.uuid(), match.currentClock(), page,
                nextCursor, effectiveLimit, all.size(), effectiveOrder);
    }

    /**
     * v0.35.4 — {@code log_item_usage.action} to timeline type. REMOVE is an effect taking
     * the item away and DROP is the player putting it down: the bag ends up the same, so
     * they share one type. An unknown action is dropped, like an unknown log message.
     */
    private static String itemType(String action) {
        if (action == null) {
            // Pre-v0.35.4 rows predate the column: back then the table only logged usages.
            return TYPE_ITEM_USE;
        }
        return switch (action.trim().toUpperCase()) {
            case EventExecutionStorePort.ITEM_ACTION_ADD -> TYPE_ITEM_ADD;
            case EventExecutionStorePort.ITEM_ACTION_USE -> TYPE_ITEM_USE;
            case EventExecutionStorePort.ITEM_ACTION_DROP,
                 EventExecutionStorePort.ITEM_ACTION_REMOVE -> TYPE_ITEM_DROP;
            default -> null;
        };
    }

    /** The whole timeline, sorted by timestamp ascending, with no enrichment yet. */
    private List<LogEntry> assembleTimeline(MatchSummary match) {
        List<LogEntry> entries = new ArrayList<>();

        for (WeatherLogEntry w : store.findWeatherLog(match.id())) {
            entries.add(LogEntry.builder(TYPE_WEATHER, w.timestamp())
                    .clock(w.clock()).idWeather(w.idWeather()).build());
        }

        for (MovementLogEntry m : store.findMovementLog(match.id())) {
            entries.add(LogEntry.builder(TYPE_MOVEMENT, m.timestamp())
                    .character(m.idCharacterMatch())
                    .locationFrom(m.idLocationFrom()).locationTo(m.idLocationTo())
                    .cost(m.energyCost(), m.foodCost(), m.magicCost(), m.coinCost())
                    .build());
        }

        for (ClockLogEntry c : store.findClockLog(match.id())) {
            entries.add(LogEntry.builder(TYPE_CLOCK_ADVANCE, c.timestamp())
                    .clock(c.clock()).build());
        }

        // v0.35.4 — the item log. Unlike log_events this table needs no message parsing:
        // the action column says what happened, and an unknown one is dropped the same way.
        for (ItemLogEntry i : store.findItemLog(match.id())) {
            String type = itemType(i.action());
            if (type == null) {
                continue;
            }
            entries.add(LogEntry.builder(type, i.timestamp())
                    .character(i.idCharacterMatch())
                    .idEvent(i.idEvent())
                    .item(i.idItem(), i.action(), i.counter())
                    .delta(i.energy(), i.food(), i.magic(), i.coin())
                    .build());
        }

        // log_events is a shared table and the type is derived from the message prefix, so an
        // unrecognised message is dropped rather than shown as garbage. A new writer therefore
        // needs a branch here or its rows never reach the timeline.
        for (EventLogEntry e : store.findEventLog(match.id())) {
            String msg = e.logMessage();
            if (msg == null) {
                continue;
            }
            if (MSG_SLEEP.equals(msg)) {
                entries.add(LogEntry.builder(TYPE_SLEEP, e.timestamp())
                        .clock(e.clock()).character(e.idCharacterMatch()).build());
            } else if (msg.startsWith(EventExecutionStorePort.MSG_EVENT_EXECUTED)) {
                // v0.35.3 — the price the actor paid rides on the EVENT row: energy in the
                // slot movement already uses, the three resources in the new ones.
                // v0.35.4 — and what the event gave back, on the gain half of the same row.
                entries.add(LogEntry.builder(TYPE_EVENT, e.timestamp())
                        .clock(e.clock()).character(e.idCharacterMatch())
                        .message(msg).idEvent(e.idEvent())
                        .cost(e.energyCost(), e.foodCost(), e.magicCost(), e.coinCost())
                        .gain(e.energyGain(), e.foodGain(), e.magicGain(), e.coinGain())
                        .build());
            } else if (msg.startsWith(MSG_COUNTER)) {
                // Step 33 split this out of RECOVERY: a counter running out and a character
                // healing are unrelated events, and the frontend has to tell them apart.
                // The location rides in idLocationTo so it enriches like a MOVEMENT does.
                entries.add(LogEntry.builder(TYPE_COUNTER_ZERO, e.timestamp())
                        .clock(e.clock()).character(e.idCharacterMatch())
                        .locationTo(e.idLocation()).message(msg).idEvent(e.idEvent()).build());
            } else if (msg.startsWith(LocationEntryStorePort.MSG_AUTOMATIC_EVENT)) {
                entries.add(LogEntry.builder(TYPE_AUTOMATIC_EVENT, e.timestamp())
                        .clock(e.clock()).character(e.idCharacterMatch())
                        .locationTo(e.idLocation()).message(msg).idEvent(e.idEvent()).build());
            } else if (msg.startsWith("recovery")) {
                entries.add(LogEntry.builder(TYPE_RECOVERY, e.timestamp())
                        .clock(e.clock()).character(e.idCharacterMatch()).message(msg).build());
            }
        }

        // ISO timestamps are lexicographically comparable; nulls sort first.
        entries.sort((a, b) -> nz(a.timestamp()).compareTo(nz(b.timestamp())));
        return entries;
    }

    /**
     * Fills in the card of every WEATHER (the weather's own card), MOVEMENT (the
     * destination location's card) and EVENT entry (the triggered event's own card,
     * v0.30.3), and the uuid/name of the character behind every character-scoped entry.
     * Lookups are loaded once for the whole page.
     */
    private List<LogEntry> enrich(List<LogEntry> page, MatchSummary match, String lang) {
        if (page.isEmpty()) {
            return List.of();
        }
        Map<Long, Integer> weatherCards = store.findWeatherIdCards(match.idStory());
        Map<Long, Integer> locationCards = store.findLocationIdCards(match.idStory());
        Map<Long, Integer> templateCards = store.findCharacterTemplateIdCards(match.idStory());
        Map<Long, Integer> eventCards = store.findEventIdCards(match.idStory());
        Map<Long, Integer> itemCards = store.findItemIdCards(match.idStory());
        Map<Long, CharacterLogView> characters = store.findCharactersByMatch(match.id());

        List<LogEntry> out = new ArrayList<>(page.size());
        for (LogEntry e : page) {
            Integer idCard = null;
            if (TYPE_WEATHER.equals(e.type()) && e.idWeather() != null) {
                idCard = weatherCards.get(e.idWeather());
            } else if (TYPE_MOVEMENT.equals(e.type()) && e.idLocationTo() != null) {
                idCard = locationCards.get(e.idLocationTo());
            } else if (TYPE_EVENT.equals(e.type()) && e.idEvent() != null) {
                idCard = eventCards.get(e.idEvent());
            } else if (TYPE_AUTOMATIC_EVENT.equals(e.type()) && e.idEvent() != null) {
                // Step 33 — the event's own card, like a player-triggered one.
                idCard = eventCards.get(e.idEvent());
            } else if (TYPE_COUNTER_ZERO.equals(e.type()) && e.idLocationTo() != null) {
                // Step 33 — a counter belongs to a place, so the place's card names it.
                idCard = locationCards.get(e.idLocationTo());
            } else if (e.idItem() != null) {
                // v0.35.4 — an item entry is narrated by the item's own card, whichever of
                // the three actions it is.
                idCard = itemCards.get(e.idItem());
            }
            CardInfo card = resolveCard(match.idStory(), idCard, lang);

            String characterUuid = null;
            String characterName = null;
            CharacterLogView c = e.idCharacterMatch() == null
                    ? null : characters.get(e.idCharacterMatch());
            if (c != null) {
                characterUuid = c.uuid();
                CardInfo templateCard = resolveCard(match.idStory(),
                        c.idCharacterTemplate() == null ? null : templateCards.get(c.idCharacterTemplate()),
                        lang);
                characterName = templateCard == null ? null : templateCard.title();
            }

            out.add(e.enrichedWith(characterUuid, characterName, idCard, card));
        }
        return out;
    }

    /** Localized card for the given story-scoped card id; null-safe on port and id. */
    private CardInfo resolveCard(long idStory, Integer idCard, String lang) {
        if (contentQueryPort == null || idCard == null) {
            return null;
        }
        return contentQueryPort.getCardByStoryIdAndCardId(idStory, idCard, lang);
    }

    private MatchSummary requireMatch(String uuidMatch) {
        return store.findMatchByUuid(uuidMatch).orElseThrow(MatchLogsService::notFound);
    }

    private static TurnCycleException notFound() {
        return new TurnCycleException(TurnCycleException.Code.MATCH_NOT_FOUND,
                "Match not found or not accessible");
    }

    // ── pagination helpers ───────────────────────────────────────────────────

    /** Clamps the requested page size into [1, MAX_LIMIT]; null falls back to the default. */
    static int clampLimit(Integer limit) {
        if (limit == null) {
            return DEFAULT_LIMIT;
        }
        return Math.max(1, Math.min(limit, MAX_LIMIT));
    }

    /** Encodes the offset of the next page into an opaque url-safe token. */
    static String encodeCursor(int offset) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(
                (CURSOR_PREFIX + offset).getBytes(StandardCharsets.UTF_8));
    }

    /** Decodes an opaque cursor into an offset. Unreadable cursors restart from 0. */
    static int decodeCursor(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return 0;
        }
        try {
            String raw = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
            if (!raw.startsWith(CURSOR_PREFIX)) {
                return 0;
            }
            int offset = Integer.parseInt(raw.substring(CURSOR_PREFIX.length()));
            return Math.max(0, offset);
        } catch (IllegalArgumentException ex) {
            return 0;
        }
    }

    private static String resolveLang(String lang) {
        return (lang == null || lang.isBlank()) ? DEFAULT_LANG : lang;
    }

    /** A null cost column (a row written before v0.35.3) reads as "nothing was spent". */
    private static int nz0(Integer v) {
        return v == null ? 0 : v;
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }
}
