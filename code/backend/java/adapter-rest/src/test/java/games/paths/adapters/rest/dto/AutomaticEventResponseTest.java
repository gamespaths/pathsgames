package games.paths.adapters.rest.dto;

import games.paths.core.model.story.CardInfo;
import games.paths.core.port.match.EventExecutionPort.AppliedEffect;
import games.paths.core.port.match.EventExecutionPort.LocationChange;
import games.paths.core.port.match.EventExecutionPort.StatChange;
import games.paths.core.port.match.LocationEntryPort.AutomaticEventFired;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Step 33 - the automatic-event payload that rides on movement, event and choice responses.
 */
class AutomaticEventResponseTest {

    private static CardInfo card(String title) {
        return new CardInfo("card-uuid", "EVENT", null, null, "fas fa-bolt",
                null, null, null, null, null, title, "a description", null, null, null);
    }

    private static AutomaticEventFired fired(List<AppliedEffect> effects,
                                             List<StatChange> statChanges,
                                             List<LocationChange> locationChanges) {
        return new AutomaticEventFired("FIRST_ENTRY", 42L, "event-uuid", card("The Cave"),
                effects, statChanges, locationChanges, true);
    }

    @Test
    void fromModelMapsEveryFieldAndNestedList() {
        AutomaticEventFired m = fired(
                List.of(new AppliedEffect("event-uuid", "effect-uuid", "LIFE", -3, "ONLY_ONE",
                        null, List.of("char-uuid"), card("Ouch"))),
                List.of(new StatChange("char-uuid", "LIFE", 10, 7, -3)),
                List.of(new LocationChange("char-uuid", "loc-from", "loc-to")));

        AutomaticEventResponse r = AutomaticEventResponse.fromModel(m);

        assertEquals("FIRST_ENTRY", r.getTrigger());
        assertEquals(42L, r.getIdLocation());
        assertEquals("event-uuid", r.getEventUuid());
        assertEquals("The Cave", r.getCard().getTitle());
        assertTrue(r.isGameOver());
        assertEquals(1, r.getEffects().size());
        assertEquals("effect-uuid", r.getEffects().get(0).getEffectUuid());
        assertEquals(1, r.getStatChanges().size());
        assertEquals(-3, r.getStatChanges().get(0).getDelta());
        assertEquals(1, r.getLocationChanges().size());
        assertEquals("loc-to", r.getLocationChanges().get(0).getToLocationUuid());
    }

    @Test
    void fromModelTreatsNullListsAsEmptyOnes() {
        AutomaticEventResponse r = AutomaticEventResponse.fromModel(fired(null, null, null));

        assertTrue(r.getEffects().isEmpty());
        assertTrue(r.getStatChanges().isEmpty());
        assertTrue(r.getLocationChanges().isEmpty());
    }

    @Test
    void fromModelsMapsTheWholeList() {
        List<AutomaticEventResponse> out = AutomaticEventResponse.fromModels(
                List.of(fired(List.of(), List.of(), List.of()),
                        fired(List.of(), List.of(), List.of())));

        assertEquals(2, out.size());
        assertEquals("FIRST_ENTRY", out.get(0).getTrigger());
    }

    @Test
    void fromModelsIsEmptyRatherThanNullForANullList() {
        assertTrue(AutomaticEventResponse.fromModels(null).isEmpty());
    }
}
