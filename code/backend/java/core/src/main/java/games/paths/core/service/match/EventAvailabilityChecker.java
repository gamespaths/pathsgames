package games.paths.core.service.match;

import games.paths.core.entity.story.EventEntity;
import games.paths.core.port.match.EventExecutionPort.EventAvailability;
import games.paths.core.port.match.EventExecutionPort.EventExecutionException.Code;
import games.paths.core.port.match.EventExecutionStorePort.EventCheckContext;

import java.util.Set;

/**
 * EventAvailabilityChecker - THE check procedure of Step 29.
 *
 * <p>One pure function, no ports, no I/O — and therefore exactly one answer to "can this
 * event be executed?", shared by the two places that ask:</p>
 * <ul>
 *   <li>{@code MatchQueryService}, for the {@code available} flag it puts on every event
 *       of {@code /api/match/{uuid}/info};</li>
 *   <li>{@code EventExecutionService}, to accept or reject {@code execute-event}.</li>
 * </ul>
 *
 * <p>Because it takes a pre-loaded {@link EventCheckContext} rather than a store port,
 * {@code /info} evaluates N events against a single context: no query happens inside the
 * loop, so a story with many events costs no more than a story with one.</p>
 *
 * <p>All conditions combine in AND — there is no {@code list_events_conditions} table and
 * none is planned; the conditions are columns on {@code list_events}.</p>
 *
 * <p>The order below is the contract: the first failing check names the reason, and the
 * cheapest / most explanatory reasons come first (a sleeping character is told they cannot
 * act, not that they lack energy).</p>
 *
 * <p>See {@code documentation_v0/Step29_NormalEvents.md}.</p>
 */
public final class EventAvailabilityChecker {

    /** Only these two types are player-executable; AUTOMATIC and FIRST are engine-driven. */
    public static final Set<String> EXECUTABLE_TYPES = Set.of("NORMAL", "ONCE");

    /** Executable at most once per MATCH (not per clock, not per location). */
    public static final String TYPE_ONCE = "ONCE";

    private EventAvailabilityChecker() {
    }

    /**
     * The single verdict. {@code ctx} may be null (caller owns no character), in which case
     * nothing is executable.
     */
    public static EventAvailability check(EventEntity event, EventCheckContext ctx) {
        if (event == null) {
            return EventAvailability.no(Code.EVENT_NOT_FOUND);
        }
        if (ctx == null || ctx.idCharacter() == null || ctx.sleeping() || ctx.coma()) {
            return EventAvailability.no(Code.CHARACTER_CANNOT_ACT);
        }
        if (!EXECUTABLE_TYPES.contains(type(event))) {
            return EventAvailability.no(Code.EVENT_NOT_EXECUTABLE_TYPE);
        }
        if (TYPE_ONCE.equals(type(event))
                && event.getId() != null
                && ctx.consumedEventIds().contains(event.getId())) {
            return EventAvailability.no(Code.ONCE_ALREADY_CONSUMED);
        }
        // A null id_specific_location means the event has no location constraint at all.
        if (event.getIdSpecificLocation() != null
                && !Long.valueOf(event.getIdSpecificLocation().longValue()).equals(ctx.idLocation())) {
            return EventAvailability.no(Code.WRONG_LOCATION);
        }
        if (ctx.energy() < nz(event.getCostEnery())) {
            return EventAvailability.no(Code.NOT_ENOUGH_ENERGY);
        }
        if (ctx.coin() < nz(event.getCoinCost())) {
            return EventAvailability.no(Code.NOT_ENOUGH_COINS);
        }
        if (!registryMet(event, ctx)) {
            return EventAvailability.no(Code.REGISTRY_CONDITION_NOT_MET);
        }
        // On list_events id_weather is a CONDITION; on list_events_effects it is an EFFECT.
        if (event.getIdWeather() != null
                && !Long.valueOf(event.getIdWeather().longValue()).equals(ctx.currentWeatherId())) {
            return EventAvailability.no(Code.WEATHER_CONDITION_NOT_MET);
        }
        if (event.getIdItemCondition() != null
                && !ctx.ownedItemIds().contains(event.getIdItemCondition().longValue())) {
            return EventAvailability.no(Code.ITEM_CONDITION_NOT_MET);
        }
        if (event.getIdClassCondition() != null
                && !Long.valueOf(event.getIdClassCondition().longValue()).equals(ctx.idClass())) {
            return EventAvailability.no(Code.CLASS_CONDITION_NOT_MET);
        }
        return EventAvailability.OK;
    }

    /**
     * A key with no expected value is never met — a condition that can never be satisfied
     * would otherwise read as "no condition". Mirrors {@code MovementService.conditionMet}.
     */
    private static boolean registryMet(EventEntity event, EventCheckContext ctx) {
        String key = event.getRegistryKeyCondition();
        if (key == null || key.isBlank()) {
            return true;
        }
        String expected = event.getRegistryValueCondition();
        return expected != null && expected.equals(ctx.registry().get(key));
    }

    private static String type(EventEntity event) {
        return event.getType() == null ? "" : event.getType().trim().toUpperCase();
    }

    private static int nz(Integer v) {
        return v == null ? 0 : v;
    }
}
