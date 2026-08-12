package games.paths.core.port.match;

import java.util.List;
import java.util.Optional;

/**
 * LocationEntryStorePort - outbound port for the Step 33 location engine.
 *
 * <p>Deliberately narrow: the trigger resolution needs the location's five
 * {@code id_event_*} columns, the {@code flag_visited} latch, who else is standing
 * where, and one audit row. Everything else it does — running the event, applying
 * the effects — goes through the existing {@code EventExecutionStorePort}.</p>
 */
public interface LocationEntryStorePort {

    /** Message prefix of the audit row an automatic event writes. */
    String MSG_AUTOMATIC_EVENT = "automatic event";

    /** The trigger columns of one story location; empty when the location is unknown. */
    Optional<LocationTriggerView> findLocationTriggers(long idStory, long idLocation);

    /**
     * {@code gaming_state_locations.flag_visited} for this (match, location).
     * Returns 0 when no row exists — a location nobody has been to.
     */
    int findFlagVisited(long idMatch, long idLocation);

    /** Latch the location as visited by the party. Idempotent. */
    void markStateLocationVisited(long idMatch, long idLocation);

    /**
     * How many characters stand in {@code idLocation} other than
     * {@code exceptIdCharacter}. Zero is what makes an arrival
     * {@code FIRST_IN_LOCATION}.
     */
    int countOtherCharactersAtLocation(long idMatch, long idLocation, long exceptIdCharacter);

    /**
     * The lowest-id character standing in {@code idLocation}, or empty when nobody is
     * there. This is the nominal actor of a counter-zero event: the fuse belongs to
     * the location, but the effects still need somebody to resolve
     * {@code target = ONLY_ONE} against, and {@code target = ALL} then means everyone
     * in that location — never the whole match.
     */
    Optional<Long> findNominalActorAtLocation(long idMatch, long idLocation);

    /** Append the {@code log_events} audit row for an automatic event. */
    void logAutomaticEvent(long idMatch, Long idCharacter, long idLocation, Long idEvent,
                           Integer clock, String message);

    /**
     * The locations the party has ever been to — current positions plus every endpoint in
     * {@code log_movements}. The same set Step 28 §6.3 derives for fog of war, and what
     * decides whether a counter-zero notice may name the place it happened in.
     */
    List<Long> findVisitedLocationIds(long idMatch);

    /** Where a character stands, for the {@code FULL} visibility case. Empty when unknown. */
    Optional<Long> findCharacterLocation(long idMatch, long idCharacter);

    /**
     * The five location-side trigger columns plus the ordering one. All nullable:
     * a null column is simply not a trigger.
     */
    record LocationTriggerView(long idLocation,
                               Integer idCard,
                               Integer idEventIfFirstTime,
                               Integer idEventNotFirstTime,
                               Integer idEventIfCharacterEnterFirstTime,
                               Integer idEventIfCharacterStartTime,
                               Integer idEventIfCounterZero,
                               Integer priorityAutomaticEvent) {
    }
}
