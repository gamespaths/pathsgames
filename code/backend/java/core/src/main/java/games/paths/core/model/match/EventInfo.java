package games.paths.core.model.match;

import games.paths.core.model.story.CardInfo;

/**
 * EventInfo - Domain model for an event available at a location occupied by at
 * least one player. Returned inside {@link LocationInfo#getEvents()} of the
 * enriched match-info payload.
 *
 * <p>Distinct from {@link MatchEventOption} (the lean uuid/name/type rows used
 * by the {@code events}/{@code choices} lists): this carries the resolved
 * visual {@link CardInfo} so the game board can render the event as a card.</p>
 */
public class EventInfo {

    private final String uuid;
    private final String type;
    private final boolean endGame;
    private final CardInfo card;

    public EventInfo(String uuid, String type, boolean endGame, CardInfo card) {
        this.uuid = uuid;
        this.type = type;
        this.endGame = endGame;
        this.card = card;
    }

    public String getUuid() { return uuid; }
    public String getType() { return type; }
    /** True when this event is the story's end-game event ({@code idEventEndGame}). */
    public boolean isEndGame() { return endGame; }
    public CardInfo getCard() { return card; }
}
