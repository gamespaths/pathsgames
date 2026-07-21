package games.paths.core.service.match;

import games.paths.core.model.story.CardInfo;
import games.paths.core.port.match.EventExecutionStorePort;
import games.paths.core.port.match.MatchLogsPort;
import games.paths.core.port.match.MatchLogsStorePort;
import games.paths.core.port.match.MatchLogsStorePort.CharacterLogView;
import games.paths.core.port.match.MatchLogsStorePort.ClockLogEntry;
import games.paths.core.port.match.MatchLogsStorePort.EventLogEntry;
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
 * MatchLogsService - assembles the consolidated match log from the four append-only
 * log tables (Step 28.7). Returns a timeline sorted by timestamp ascending, or newest
 * first when the caller asks for {@code order=desc}.
 *
 * <p>Log types assembled:
 * <ul>
 *   <li>WEATHER — from log_weather</li>
 *   <li>MOVEMENT — from log_movements</li>
 *   <li>SLEEP — from log_events WHERE log_message='ACTION_SLEEP'</li>
 *   <li>CLOCK_ADVANCE — from log_clock_history</li>
 *   <li>RECOVERY — from log_events WHERE log_message LIKE 'recovery%' or 'counter%'</li>
 * </ul>
 * </p>
 *
 * <p>v0.28.7 — the timeline is cursor-paginated: the full timeline is assembled and
 * sorted, then only the requested slice is returned and enriched. Enrichment needs at
 * most four extra queries per request (weather cards, location cards, template cards,
 * match characters), regardless of the page size. WEATHER entries carry the weather's
 * card; MOVEMENT entries carry the destination location's card plus the character that
 * moved; SLEEP and RECOVERY entries carry their character.</p>
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
    private static final String MSG_SLEEP = "ACTION_SLEEP";
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

    /** The whole timeline, sorted by timestamp ascending, with no enrichment yet. */
    private List<LogEntry> assembleTimeline(MatchSummary match) {
        List<LogEntry> entries = new ArrayList<>();

        for (WeatherLogEntry w : store.findWeatherLog(match.id())) {
            entries.add(new LogEntry(TYPE_WEATHER, w.clock(), w.timestamp(), w.idWeather(),
                    null, null, null, null, null, null, null, null, null));
        }

        for (MovementLogEntry m : store.findMovementLog(match.id())) {
            entries.add(new LogEntry(TYPE_MOVEMENT, null, m.timestamp(), null,
                    m.idCharacterMatch(), null, null, m.idLocationFrom(), m.idLocationTo(),
                    m.energyCost(), null, null, null));
        }

        for (ClockLogEntry c : store.findClockLog(match.id())) {
            entries.add(new LogEntry(TYPE_CLOCK_ADVANCE, c.clock(), c.timestamp(), null,
                    null, null, null, null, null, null, null, null, null));
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
                entries.add(new LogEntry(TYPE_SLEEP, e.clock(), e.timestamp(), null,
                        e.idCharacterMatch(), null, null, null, null, null, null, null, null));
            } else if (msg.startsWith(EventExecutionStorePort.MSG_EVENT_EXECUTED)) {
                entries.add(new LogEntry(TYPE_EVENT, e.clock(), e.timestamp(), null,
                        e.idCharacterMatch(), null, null, null, null, null, msg, null, null));
            } else if (msg.startsWith("recovery") || msg.startsWith("counter")) {
                entries.add(new LogEntry(TYPE_RECOVERY, e.clock(), e.timestamp(), null,
                        e.idCharacterMatch(), null, null, null, null, null, msg, null, null));
            }
        }

        // ISO timestamps are lexicographically comparable; nulls sort first.
        entries.sort((a, b) -> nz(a.timestamp()).compareTo(nz(b.timestamp())));
        return entries;
    }

    /**
     * Fills in the card of every WEATHER (the weather's own card) and MOVEMENT entry
     * (the destination location's card), and the uuid/name of the character behind
     * every character-scoped entry. Lookups are loaded once for the whole page.
     */
    private List<LogEntry> enrich(List<LogEntry> page, MatchSummary match, String lang) {
        if (page.isEmpty()) {
            return List.of();
        }
        Map<Long, Integer> weatherCards = store.findWeatherIdCards(match.idStory());
        Map<Long, Integer> locationCards = store.findLocationIdCards(match.idStory());
        Map<Long, Integer> templateCards = store.findCharacterTemplateIdCards(match.idStory());
        Map<Long, CharacterLogView> characters = store.findCharactersByMatch(match.id());

        List<LogEntry> out = new ArrayList<>(page.size());
        for (LogEntry e : page) {
            Integer idCard = null;
            if (TYPE_WEATHER.equals(e.type()) && e.idWeather() != null) {
                idCard = weatherCards.get(e.idWeather());
            } else if (TYPE_MOVEMENT.equals(e.type()) && e.idLocationTo() != null) {
                idCard = locationCards.get(e.idLocationTo());
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

            out.add(new LogEntry(e.type(), e.clock(), e.timestamp(), e.idWeather(),
                    e.idCharacterMatch(), characterUuid, characterName,
                    e.idLocationFrom(), e.idLocationTo(), e.energyCost(), e.message(),
                    idCard, card));
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

    private static String nz(String s) {
        return s == null ? "" : s;
    }
}
