package games.paths.core.port.match;

import games.paths.core.model.story.CardInfo;

import java.util.List;

/**
 * LocationEntryPort - inbound port for the Step 33 location engine: the events a
 * story fires <em>by itself</em>, without a player asking for anything.
 *
 * <p>Two things trigger them, and neither is a player action:</p>
 * <ul>
 *   <li>a character <b>arriving</b> somewhere — whether by walking there
 *       ({@code movements/start}) or by being pulled there by an effect;</li>
 *   <li>a location's clock <b>running out</b>, or a time unit <b>beginning</b>
 *       where a character stands — both resolved during the time-start pass.</li>
 * </ul>
 *
 * <p>The event is named by the location, not by a query over the events table:
 * {@code list_locations} has carried {@code id_event_if_first_time},
 * {@code id_event_not_first_time}, {@code id_event_if_character_enter_empty_location},
 * {@code id_event_if_character_start_time} and {@code id_event_if_counter_zero}
 * since V0.10.3. A referenced event keeps {@code type = 'AUTOMATIC'}, which the
 * {@code EXECUTABLE_TYPES = {NORMAL, ONCE}} allowlist already refuses to players.</p>
 *
 * <p>Implemented by {@code EventExecutionService}: the trigger resolution has to
 * live next to the chain runner, because an automatic event may itself move a
 * character and that move is another arrival.</p>
 */
public interface LocationEntryPort {

    /** First arrival of the party at this location. */
    String TRIGGER_FIRST_ENTRY = "FIRST_ENTRY";
    /** Any later arrival — the world has already been discovered here. */
    String TRIGGER_SUBSEQUENT_ENTRY = "SUBSEQUENT_ENTRY";
    /** The arriving character found nobody else here. Orthogonal to the two above. */
    String TRIGGER_MOVE_INTO_EMPTY_LOCATION = "MOVE_INTO_EMPTY_LOCATION";
    /** The location's counter reached zero. One-shot for the whole match. */
    String TRIGGER_COUNTER_ZERO = "COUNTER_ZERO";
    /** A time unit began with a character standing here. */
    String TRIGGER_CHARACTER_START_TIME = "CHARACTER_START_TIME";

    /**
     * Resolve and run every trigger a successful arrival fires, then mark the
     * location visited. Never throws for authoring mistakes: a null column is no
     * trigger, a dangling event id is skipped, and an event owning choices is
     * refused and logged (an automatic event has nobody to ask).
     */
    List<AutomaticEventFired> onArrival(ArrivalContext arrival);

    /**
     * Run the events a time-start collected — counter-zero fuses and
     * {@code id_event_if_character_start_time} — in the order the recovery pass
     * produced them ({@code priority_automatic_event}, then location id).
     */
    List<AutomaticEventFired> runPendingAutomaticEvents(long idMatch, int currentClock,
                                                        List<PendingAutomaticEvent> pending,
                                                        String lang);

    /**
     * Describe an already-run list of automatic events <b>to one recipient</b>, applying the
     * fog-of-war rule of Step 33 §8.
     *
     * <p>This is deliberately a separate step from running them. The engine produces the list
     * once and unfiltered; the telling is per person, because every player has their own
     * visited set. Single-player is simply the one-recipient case — filtering while the list
     * is assembled would bake it in and force a rewrite when Steps 49-54 broadcast the same
     * payload over the WebSocket.</p>
     *
     * <p>{@code idRecipientCharacter} null yields the most cautious reading, {@code
     * ANONYMOUS} everywhere.</p>
     */
    List<TimeAdvancementPort.CounterZeroItem> describeForRecipient(
            long idMatch, Long idRecipientCharacter, int clock,
            List<AutomaticEventFired> fired, String lang);

    /**
     * Everything the entry resolution needs about an arrival. {@code idCharacter} is
     * the character that arrived; it is always known here, unlike on the counter-zero
     * path where the trigger belongs to the location and not to anybody.
     */
    record ArrivalContext(long idMatch,
                          long idStory,
                          long idCharacter,
                          long idLocation,
                          int currentClock,
                          String lang) {
    }

    /**
     * One automatic event the time-start pass found waiting. {@code idActorCharacter}
     * is the nominal actor — the lowest-id character standing in that location — and
     * is {@code null} when nobody is there, in which case the effects that need a
     * recipient are skipped while registry, weather and the {@code id_event_next}
     * chain still run.
     */
    record PendingAutomaticEvent(String trigger,
                                 long idLocation,
                                 long idEvent,
                                 Long idActorCharacter,
                                 int priority) {
    }

    /**
     * What one automatic event did, slim enough to ride on a movement or sleep
     * response. {@code card} is the narrative the book shows on its right page.
     */
    record AutomaticEventFired(String trigger,
                               long idLocation,
                               String eventUuid,
                               CardInfo card,
                               List<EventExecutionPort.AppliedEffect> effects,
                               List<EventExecutionPort.StatChange> statChanges,
                               List<EventExecutionPort.LocationChange> locationChanges,
                               boolean gameOver) {
    }
}
