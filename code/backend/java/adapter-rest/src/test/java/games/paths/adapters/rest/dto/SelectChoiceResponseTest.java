package games.paths.adapters.rest.dto;

import games.paths.core.model.story.CardInfo;
import games.paths.core.port.match.EventExecutionPort.AppliedEffect;
import games.paths.core.port.match.EventExecutionPort.ChoiceResolutionResult;
import games.paths.core.port.match.EventExecutionPort.EdgeStateOutcome;
import games.paths.core.port.match.EventExecutionPort.EventExecutionResult;
import games.paths.core.port.match.EventExecutionPort.ItemChange;
import games.paths.core.port.match.EventExecutionPort.LocationChange;
import games.paths.core.port.match.EventExecutionPort.PendingChoice;
import games.paths.core.port.match.EventExecutionPort.RegistryChange;
import games.paths.core.port.match.EventExecutionPort.StatChange;
import games.paths.core.port.match.EventExecutionPort.TraitChange;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * SelectChoiceResponse (Step 32) — the wire body of select-choice.
 *
 * <p>What matters here is that it really is an {@link ExecuteEventResponse} plus a few
 * fields: the board runs one code path over both, so anything the parent carries has to
 * survive the copy. A field silently left behind would show up as an effect that never
 * renders or a flag that never refreshes.</p>
 */
@DisplayName("SelectChoiceResponse (Step 32)")
class SelectChoiceResponseTest {

    private static CardInfo card(String title) {
        return new CardInfo("c1", "event", null, null, null, null, null, null, null, null,
                title, null, null, null, null);
    }

    private static EventExecutionResult execution(String status) {
        return new EventExecutionResult(
                "match-uuid", "evt-owner", "NORMAL", status, card("The gate"),
                List.of("evt-owner", "evt-linked"),
                0, 0, 17, 8, 5,
                false, true, true, false, true, true, true, false, true, true,
                List.of(new StatChange("char-1", "life", 30, 25, -5)),
                List.of(new RegistryChange("GATE", null, "OPEN")),
                List.of(new TraitChange("char-1", "trait-1", "ADD")),
                List.of(new ItemChange("char-1", "item-1", "ADD")),
                List.of(new games.paths.core.port.match.EventExecutionPort
                        .CharacteristicChange("char-1", "BRAVE", "ADD")),
                List.of(new LocationChange("char-1", "loc-a", "loc-b")),
                List.of(new AppliedEffect("evt-owner", "eff-1", "life", -5, "ONLY_ONE", null,
                        List.of("char-1"), card("A wound"))),
                List.of(new PendingChoice("ch-next", 1, "Go on", "…", card("Onward"), true, null)),
                new EdgeStateOutcome(List.of("char-1"), List.of("char-1"), true,
                        "evt-coma", card("Everyone is down"), List.of("evt-coma"), List.of()),
                List.of());
    }

    private static ChoiceResolutionResult resolution(String status) {
        return new ChoiceResolutionResult(execution(status), "ch-1", "evt-owner",
                "You push the door open.", card("Open the door"),
                "evt-linked", card("Beyond the door"), true);
    }

    @Test
    @DisplayName("the choice block carries what only a resolution knows")
    void mapsTheChoiceBlock() {
        SelectChoiceResponse d = SelectChoiceResponse.fromModel(resolution("APPLIED"));

        assertAll(
                () -> assertEquals("ch-1", d.getChoiceUuid()),
                () -> assertEquals("evt-owner", d.getEventUuid()),
                () -> assertEquals("You push the door open.", d.getNarrative()),
                () -> assertEquals("Open the door", d.getChoiceCard().getTitle()),
                () -> assertEquals("evt-linked", d.getChoiceEventUuid()),
                () -> assertEquals("Beyond the door", d.getChoiceEventCard().getTitle()),
                () -> assertTrue(d.isProgressRecorded()));
    }

    @Test
    @DisplayName("every field of the execute-event payload survives the copy")
    void copiesTheWholeExecutionBlock() {
        SelectChoiceResponse d = SelectChoiceResponse.fromModel(resolution("APPLIED"));

        assertAll(
                () -> assertEquals("match-uuid", d.getMatchUuid()),
                () -> assertEquals("NORMAL", d.getEventType()),
                () -> assertEquals("APPLIED", d.getStatus()),
                () -> assertEquals("The gate", d.getCard().getTitle()),
                () -> assertEquals(List.of("evt-owner", "evt-linked"), d.getExecutedEventUuids()),
                () -> assertEquals(17, d.getNewEnergy()),
                () -> assertEquals(8, d.getNewCoin()),
                () -> assertEquals(5, d.getCurrentClock()),
                () -> assertFalse(d.isTurnConsumed()),
                () -> assertTrue(d.isTimeEnded()),
                () -> assertTrue(d.isItemAdded()),
                () -> assertFalse(d.isItemRemoved()),
                () -> assertTrue(d.isWeatherApplied()),
                () -> assertTrue(d.isMovementApplied()),
                () -> assertTrue(d.isForcedSleep()),
                () -> assertFalse(d.isComaTriggered()),
                () -> assertTrue(d.isGameOver()),
                () -> assertTrue(d.isRefreshRecommended()),
                () -> assertEquals("life", d.getStatChanges().get(0).getStatistic()),
                () -> assertEquals("GATE", d.getRegistryChanges().get(0).getKey()),
                () -> assertEquals("trait-1", d.getTraitChanges().get(0).getTraitUuid()),
                () -> assertEquals("item-1", d.getItemChanges().get(0).getItemUuid()),
                () -> assertEquals("BRAVE", d.getCharacteristicChanges().get(0).getCharacteristic()),
                () -> assertEquals("loc-b", d.getLocationChanges().get(0).getToLocationUuid()),
                () -> assertEquals("A wound", d.getEffects().get(0).getCard().getTitle()),
                () -> assertEquals("ch-next", d.getPendingChoices().get(0).getUuid()),
                () -> assertNotNull(d.getEdgeState()),
                () -> assertTrue(d.getEdgeState().isAllPlayersInComa()));
    }

    @Test
    @DisplayName("resolution charges nothing: the open already paid")
    void chargesNothing() {
        SelectChoiceResponse d = SelectChoiceResponse.fromModel(resolution("APPLIED"));

        assertEquals(0, d.getEnergySpent());
        assertEquals(0, d.getCoinSpent());
    }

    @Test
    @DisplayName("a linked choice-event comes back as CHOICES_PENDING with the next options")
    void nestedChoiceEvent() {
        SelectChoiceResponse d = SelectChoiceResponse.fromModel(resolution("CHOICES_PENDING"));

        assertEquals("CHOICES_PENDING", d.getStatus());
        assertEquals(1, d.getPendingChoices().size());
        assertTrue(d.getPendingChoices().get(0).isAvailable());
    }

    @Test
    @DisplayName("an option with nothing to reveal answers with nulls, not with blanks")
    void nullsSurvive() {
        ChoiceResolutionResult bare = new ChoiceResolutionResult(
                execution("APPLIED"), "ch-1", "evt-owner", null, null, null, null, false);

        SelectChoiceResponse d = SelectChoiceResponse.fromModel(bare);

        assertAll(
                () -> assertNull(d.getNarrative()),
                () -> assertNull(d.getChoiceCard()),
                () -> assertNull(d.getChoiceEventUuid()),
                () -> assertNull(d.getChoiceEventCard()),
                () -> assertFalse(d.isProgressRecorded()));
    }

    @Test
    @DisplayName("the setters round-trip, for the deserializing side of the contract")
    void settersRoundTrip() {
        SelectChoiceResponse d = new SelectChoiceResponse();
        d.setChoiceUuid("ch-9");
        d.setEventUuid("evt-9");
        d.setNarrative("n");
        d.setChoiceCard(CardInfoResponse.fromModel(card("t")));
        d.setChoiceEventUuid("evt-linked-9");
        d.setChoiceEventCard(CardInfoResponse.fromModel(card("u")));
        d.setProgressRecorded(true);

        assertAll(
                () -> assertEquals("ch-9", d.getChoiceUuid()),
                () -> assertEquals("evt-9", d.getEventUuid()),
                () -> assertEquals("n", d.getNarrative()),
                () -> assertEquals("t", d.getChoiceCard().getTitle()),
                () -> assertEquals("evt-linked-9", d.getChoiceEventUuid()),
                () -> assertEquals("u", d.getChoiceEventCard().getTitle()),
                () -> assertTrue(d.isProgressRecorded()));
    }
}
