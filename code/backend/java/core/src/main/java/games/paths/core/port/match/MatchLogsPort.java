package games.paths.core.port.match;

import games.paths.core.model.story.CardInfo;

import java.util.List;

/**
 * MatchLogsPort - inbound port exposing the consolidated match log
 * (Step 28.7: GET /api/matches/{uuid}/logs and GET /api/admin/matches/{uuid}/logs).
 *
 * <p>v0.28.7 — the timeline is cursor-paginated (same envelope convention as the
 * paginated admin match list) and each WEATHER / MOVEMENT entry carries its
 * resolved {@link CardInfo}; MOVEMENT entries also name the character that moved.</p>
 */
public interface MatchLogsPort {

    /** Default page size when the caller does not pass {@code limit}. */
    int DEFAULT_LIMIT = 50;

    /** Hard cap on the page size, mirroring the admin match list. */
    int MAX_LIMIT = 200;

    /** Timeline order: oldest entry first. The default when no {@code order} is given. */
    String ORDER_ASC = "asc";

    /** Timeline order: newest entry first. */
    String ORDER_DESC = "desc";

    /**
     * Returns one page of the consolidated log for the given match. Checks ownership —
     * only the match creator can call this.
     *
     * @param lang   language used to resolve the entry cards; defaults to {@code en}
     * @param limit  page size, clamped to [1, {@value #MAX_LIMIT}]; {@code null} → {@value #DEFAULT_LIMIT}
     * @param cursor opaque token from a previous {@code nextCursor}; {@code null} → first page
     * @param order  {@value #ORDER_DESC} for newest first; anything else → {@value #ORDER_ASC}
     * @throws games.paths.core.port.match.TurnCyclePort.TurnCycleException
     *         with MATCH_NOT_FOUND when the match is unknown or not owned by userUuid.
     */
    MatchLogsResult getMatchLogs(String uuidMatch, String userUuid, String lang,
                                 Integer limit, String cursor, String order);

    /**
     * Admin variant — same payload, no ownership check.
     *
     * @throws games.paths.core.port.match.TurnCyclePort.TurnCycleException
     *         with MATCH_NOT_FOUND when the match is unknown.
     */
    MatchLogsResult getMatchLogsForAdmin(String uuidMatch, String lang,
                                         Integer limit, String cursor, String order);

    /**
     * One page of the consolidated log.
     *
     * @param logs       the entries on this page — oldest first in {@value #ORDER_ASC},
     *                   newest first in {@value #ORDER_DESC}
     * @param nextCursor token to fetch the following page, or {@code null} on the last page
     * @param limit      the effective (clamped) page size that produced this page
     * @param total      the total number of entries in the whole timeline
     * @param order      the effective order this page was cut with
     */
    record MatchLogsResult(String matchUuid, int currentClock, List<LogEntry> logs,
                           String nextCursor, int limit, int total, String order) {}

    /**
     * Single log entry. All fields except {@code type} and {@code timestamp} are nullable;
     * present fields depend on the type:
     * <ul>
     *   <li>WEATHER       — clock, idWeather, idCard, card</li>
     *   <li>MOVEMENT      — idCharacterMatch, characterUuid, characterName, idLocationFrom,
     *                       idLocationTo, energyCost, idCard, card (of the destination location)</li>
     *   <li>SLEEP         — clock, idCharacterMatch, characterUuid, characterName</li>
     *   <li>CLOCK_ADVANCE — clock</li>
     *   <li>RECOVERY      — idCharacterMatch, characterUuid, characterName, message</li>
     *   <li>EVENT         — idEvent, idCharacterMatch, characterUuid, characterName,
     *                       message, idCard, card (v0.30.3 — of the triggered event itself)</li>
     *   <li>ITEM_ADD / ITEM_USE / ITEM_DROP — idItem, itemAction, counter, idEvent (the
     *                       effect that moved it), idCharacterMatch, idCard, card (v0.35.4)</li>
     * </ul>
     */
    record LogEntry(
            String type,
            Integer clock,
            String timestamp,
            Long idWeather,
            Long idCharacterMatch,
            String characterUuid,
            String characterName,
            Long idLocationFrom,
            Long idLocationTo,
            Integer energyCost,
            String message,
            Integer idCard,
            CardInfo card,
            Long idEvent,
            /**
             * v0.35.3 — the resources the action actually took. Zero (never null) on the
             * rows that cost nothing, so a client can sum a column without null checks.
             */
            Integer foodCost,
            Integer magicCost,
            Integer coinCost,
            /**
             * v0.35.4 — the resources the action GAVE, same convention. An item usage
             * splits its signed deltas across the two families: what it drained is a cost,
             * what it restored is a gain, so one renderer covers every entry type.
             */
            Integer energyGain,
            Integer foodGain,
            Integer magicGain,
            Integer coinGain,
            /** v0.35.4 — ITEM_* entries: the story item, the raw action and the units. */
            Long idItem,
            String itemAction,
            Integer counter
    ) {

        public static Builder builder(String type, String timestamp) {
            return new Builder(type, timestamp);
        }

        /**
         * The record is 24 positional fields and every entry type fills a handful of them:
         * the builder is what keeps a new type from being a row of a dozen nulls.
         */
        public static final class Builder {
            private final String type;
            private final String timestamp;
            private Integer clock;
            private Long idWeather;
            private Long idCharacterMatch;
            private String characterUuid;
            private String characterName;
            private Long idLocationFrom;
            private Long idLocationTo;
            private String message;
            private Integer idCard;
            private CardInfo card;
            private Long idEvent;
            private Long idItem;
            private String itemAction;
            private Integer counter;
            private int energyCost;
            private int foodCost;
            private int magicCost;
            private int coinCost;
            private int energyGain;
            private int foodGain;
            private int magicGain;
            private int coinGain;

            private Builder(String type, String timestamp) {
                this.type = type;
                this.timestamp = timestamp;
            }

            public Builder clock(Integer v) { this.clock = v; return this; }
            public Builder idWeather(Long v) { this.idWeather = v; return this; }
            public Builder character(Long id) { this.idCharacterMatch = id; return this; }
            public Builder characterUuid(String v) { this.characterUuid = v; return this; }
            public Builder characterName(String v) { this.characterName = v; return this; }
            public Builder locationFrom(Long v) { this.idLocationFrom = v; return this; }
            public Builder locationTo(Long v) { this.idLocationTo = v; return this; }
            public Builder message(String v) { this.message = v; return this; }
            public Builder card(Integer idCard, CardInfo card) {
                this.idCard = idCard;
                this.card = card;
                return this;
            }
            public Builder idEvent(Long v) { this.idEvent = v; return this; }
            public Builder item(Long idItem, String action, Integer counter) {
                this.idItem = idItem;
                this.itemAction = action;
                this.counter = counter;
                return this;
            }

            /** Nulls read as 0: a log row that recorded nothing spent nothing. */
            public Builder cost(Integer energy, Integer food, Integer magic, Integer coin) {
                this.energyCost = nz(energy);
                this.foodCost = nz(food);
                this.magicCost = nz(magic);
                this.coinCost = nz(coin);
                return this;
            }

            public Builder gain(Integer energy, Integer food, Integer magic, Integer coin) {
                this.energyGain = nz(energy);
                this.foodGain = nz(food);
                this.magicGain = nz(magic);
                this.coinGain = nz(coin);
                return this;
            }

            /**
             * A signed delta lands on both families at once: the negative half is a cost,
             * the positive half is a gain. What an item usage produces, in other words.
             */
            public Builder delta(Integer energy, Integer food, Integer magic, Integer coin) {
                cost(neg(energy), neg(food), neg(magic), neg(coin));
                return gain(pos(energy), pos(food), pos(magic), pos(coin));
            }

            public LogEntry build() {
                return new LogEntry(type, clock, timestamp, idWeather, idCharacterMatch,
                        characterUuid, characterName, idLocationFrom, idLocationTo,
                        energyCost, message, idCard, card, idEvent,
                        foodCost, magicCost, coinCost,
                        energyGain, foodGain, magicGain, coinGain,
                        idItem, itemAction, counter);
            }

            private static int nz(Integer v) { return v == null ? 0 : v; }
            private static int pos(Integer v) { return Math.max(0, nz(v)); }
            private static int neg(Integer v) { return Math.max(0, -nz(v)); }
        }

        /** Copies this entry with the enrichment the service resolves per page. */
        public LogEntry enrichedWith(String characterUuid, String characterName,
                                     Integer idCard, CardInfo card) {
            return new LogEntry(type, clock, timestamp, idWeather, idCharacterMatch,
                    characterUuid, characterName, idLocationFrom, idLocationTo,
                    energyCost, message, idCard, card, idEvent,
                    foodCost, magicCost, coinCost,
                    energyGain, foodGain, magicGain, coinGain,
                    idItem, itemAction, counter);
        }
    }
}
