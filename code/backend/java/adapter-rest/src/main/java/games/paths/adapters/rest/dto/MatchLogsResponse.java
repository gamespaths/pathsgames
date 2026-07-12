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

    public static MatchLogsResponse fromModel(MatchLogsPort.MatchLogsResult model) {
        MatchLogsResponse r = new MatchLogsResponse();
        r.matchUuid = model.matchUuid();
        r.currentClock = model.currentClock();
        r.nextCursor = model.nextCursor();
        r.limit = model.limit();
        r.total = model.total();
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
        private String message;
        private Integer idCard;
        private CardInfoResponse card;

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
            d.message = e.message();
            d.idCard = e.idCard();
            d.card = e.card() == null ? null : CardInfoResponse.fromModel(e.card());
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
        public String getMessage() { return message; }
        public Integer getIdCard() { return idCard; }
        public CardInfoResponse getCard() { return card; }
    }
}
