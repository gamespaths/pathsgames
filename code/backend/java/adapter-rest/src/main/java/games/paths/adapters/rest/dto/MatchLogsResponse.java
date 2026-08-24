package games.paths.adapters.rest.dto;

import games.paths.core.port.match.MatchLogsPort;
import games.paths.core.port.match.MatchLogsPort.LogEntry;

import java.util.ArrayList;
import java.util.List;

/**
 * Response DTO for {@code GET /api/matches/{uuidMatch}/logs} and
 * {@code GET /api/admin/matches/{uuidMatch}/logs} (Step 28.7).
 *
 * <p>v0.28.7 — cursor-paginated: {@code nextCursor} is {@code null} on the last page,
 * otherwise pass it back as {@code ?cursor=} to fetch the following page. WEATHER and
 * MOVEMENT entries carry their resolved {@code card}; character-scoped entries carry
 * {@code characterUuid} / {@code characterName}.</p>
 */
public class MatchLogsResponse {

    private String matchUuid;
    private int currentClock;
    private List<LogEntryDto> logs = new ArrayList<>();
    private String nextCursor;
    private int limit;
    private int total;
    private String order;

    public static MatchLogsResponse fromModel(MatchLogsPort.MatchLogsResult model) {
        MatchLogsResponse r = new MatchLogsResponse();
        r.matchUuid = model.matchUuid();
        r.currentClock = model.currentClock();
        r.nextCursor = model.nextCursor();
        r.limit = model.limit();
        r.total = model.total();
        r.order = model.order();
        if (model.logs() != null) {
            for (LogEntry e : model.logs()) {
                r.logs.add(LogEntryDto.fromModel(e));
            }
        }
        return r;
    }

    public String getMatchUuid() { return matchUuid; }
    public int getCurrentClock() { return currentClock; }
    public List<LogEntryDto> getLogs() { return logs; }
    public String getNextCursor() { return nextCursor; }
    public int getLimit() { return limit; }
    public int getTotal() { return total; }
    public String getOrder() { return order; }

    /** Single entry in the log timeline. */
    public static class LogEntryDto {
        private String type;
        private Integer clock;
        private String timestamp;
        private Long idWeather;
        private Long idCharacterMatch;
        private String characterUuid;
        private String characterName;
        private Long idLocationFrom;
        private Long idLocationTo;
        private Integer energyCost;
        /** v0.35.3 — what the action took besides energy; 0 when it took nothing. */
        private Integer foodCost;
        private Integer magicCost;
        private Integer coinCost;
        /** v0.35.4 — what the action gave; an ITEM_* entry splits its deltas over the two. */
        private Integer energyGain;
        private Integer foodGain;
        private Integer magicGain;
        private Integer coinGain;
        /** v0.35.4 — ITEM_* entries only: the story item, the raw action and the units. */
        private Long idItem;
        private String itemAction;
        private Integer counter;
        private String message;
        private Integer idCard;
        private CardInfoResponse card;
        private Long idEvent;

        public static LogEntryDto fromModel(LogEntry e) {
            LogEntryDto d = new LogEntryDto();
            d.type = e.type();
            d.clock = e.clock();
            d.timestamp = e.timestamp();
            d.idWeather = e.idWeather();
            d.idCharacterMatch = e.idCharacterMatch();
            d.characterUuid = e.characterUuid();
            d.characterName = e.characterName();
            d.idLocationFrom = e.idLocationFrom();
            d.idLocationTo = e.idLocationTo();
            d.energyCost = e.energyCost();
            d.foodCost = e.foodCost();
            d.magicCost = e.magicCost();
            d.coinCost = e.coinCost();
            d.energyGain = e.energyGain();
            d.foodGain = e.foodGain();
            d.magicGain = e.magicGain();
            d.coinGain = e.coinGain();
            d.idItem = e.idItem();
            d.itemAction = e.itemAction();
            d.counter = e.counter();
            d.message = e.message();
            d.idCard = e.idCard();
            d.card = e.card() == null ? null : CardInfoResponse.fromModel(e.card());
            d.idEvent = e.idEvent();
            return d;
        }

        public String getType() { return type; }
        public Integer getClock() { return clock; }
        public String getTimestamp() { return timestamp; }
        public Long getIdWeather() { return idWeather; }
        public Long getIdCharacterMatch() { return idCharacterMatch; }
        public String getCharacterUuid() { return characterUuid; }
        public String getCharacterName() { return characterName; }
        public Long getIdLocationFrom() { return idLocationFrom; }
        public Long getIdLocationTo() { return idLocationTo; }
        public Integer getEnergyCost() { return energyCost; }
        public Integer getFoodCost() { return foodCost; }
        public Integer getMagicCost() { return magicCost; }
        public Integer getCoinCost() { return coinCost; }
        public Integer getEnergyGain() { return energyGain; }
        public Integer getFoodGain() { return foodGain; }
        public Integer getMagicGain() { return magicGain; }
        public Integer getCoinGain() { return coinGain; }
        public Long getIdItem() { return idItem; }
        public String getItemAction() { return itemAction; }
        public Integer getCounter() { return counter; }
        public String getMessage() { return message; }
        public Integer getIdCard() { return idCard; }
        public CardInfoResponse getCard() { return card; }
        public Long getIdEvent() { return idEvent; }
    }
}
