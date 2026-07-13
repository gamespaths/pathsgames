package games.paths.core.model.match;

import games.paths.core.model.story.CardInfo;

/**
 * EventInfo - Domain model for an event at a location occupied by at least one
 * player. Returned inside {@link LocationInfo#getEvents()} of the enriched
 * match-info payload.
 *
 * <p>Distinct from {@link MatchEventOption} (the lean uuid/name/type rows used
 * by the {@code events}/{@code choices} lists): this carries the resolved
 * visual {@link CardInfo} so the game board can render the event as a card.</p>
 *
 * <p>Step 29 added {@link #isAvailable()} and {@link #getReason()}: the verdict of
 * {@code EventAvailabilityChecker}, the very same one {@code execute-event} enforces.
 * A board that shows an action as available can therefore never be told "no" by the
 * endpoint, and a blocked action already knows why. There is deliberately no 4-arg
 * constructor: an event must always state whether it can be triggered.</p>
 */
public class EventInfo {

    private final String uuid;
    private final String type;
    private final boolean endGame;
    private final CardInfo card;
    private final boolean available;
    private final String reason;
    private final int energy;

    public EventInfo(String uuid, String type, boolean endGame, CardInfo card,
                     boolean available, String reason, int energy) {
        this.uuid = uuid;
        this.type = type;
        this.endGame = endGame;
        this.card = card;
        this.available = available;
        this.reason = reason;
        this.energy = energy;
    }

    public String getUuid() { return uuid; }
    public String getType() { return type; }
    /** True when this event is the story's end-game event ({@code idEventEndGame}). */
    public boolean isEndGame() { return endGame; }
    public CardInfo getCard() { return card; }
    /** Whether the player can trigger this event right now. */
    public boolean isAvailable() { return available; }
    /** Why not, as an {@code EventExecutionException.Code} name; null when available. */
    public String getReason() { return reason; }
    /** The energy the event costs to trigger ({@code costEnery}); 0 when it is free. */
    public int getEnergy() { return energy; }
}
