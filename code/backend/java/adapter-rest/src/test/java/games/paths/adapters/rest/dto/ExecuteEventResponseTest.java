package games.paths.adapters.rest.dto;

import games.paths.adapters.rest.dto.ExecuteEventResponse.AppliedEffectDto;
import games.paths.adapters.rest.dto.ExecuteEventResponse.CharacteristicChangeDto;
import games.paths.adapters.rest.dto.ExecuteEventResponse.EdgeStateOutcomeDto;
import games.paths.adapters.rest.dto.ExecuteEventResponse.ItemChangeDto;
import games.paths.adapters.rest.dto.ExecuteEventResponse.LocationChangeDto;
import games.paths.adapters.rest.dto.ExecuteEventResponse.PendingChoiceDto;
import games.paths.adapters.rest.dto.ExecuteEventResponse.RegistryChangeDto;
import games.paths.adapters.rest.dto.ExecuteEventResponse.StatChangeDto;
import games.paths.adapters.rest.dto.ExecuteEventResponse.TraitChangeDto;
import games.paths.core.model.story.CardInfo;
import games.paths.core.port.match.EventExecutionPort.AppliedEffect;
import games.paths.core.port.match.EventExecutionPort.CharacteristicChange;
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
 * ExecuteEventResponse (Step 29) — the wire body of the execute-event endpoint and every
 * nested change DTO it carries.
 */
@DisplayName("ExecuteEventResponse and its nested DTOs (Step 29)")
class ExecuteEventResponseTest {

    private static CardInfo card(String title) {
        return new CardInfo("c1", "event", null, null, null, null, null, null, null, null,
                title, null, null, null, null);
    }

    private static EventExecutionResult fullResult() {
        return new EventExecutionResult(
                "match-uuid", "evt-1", "ACTION", card("The gate opens"),
                List.of("evt-1", "evt-2"),
                3, 4, 7, 8, 12,
                false, true, true, true, true, true, true, true, true, true,
                List.of(new StatChange("char-1", "life", 10, 5, -5)),
                List.of(new RegistryChange("gate", "closed", "open")),
                List.of(new TraitChange("char-1", "trait-1", "ADD")),
                List.of(new ItemChange("char-1", "item-1", "REMOVE")),
                List.of(new CharacteristicChange("char-1", "brave", "ADD")),
                List.of(new LocationChange("char-1", "loc-a", "loc-b")),
                List.of(new AppliedEffect("evt-1", "eff-1", "life", -5, "ALL", 2,
                        List.of("char-1"), card("A blade in the dark"))),
                List.of(new PendingChoice("choice-1", 9, card("Left or right?"))),
                EdgeStateOutcome.none());
    }

    @Test
    @DisplayName("fromModel copies the scalars, the flags and the card")
    void fromModelCopiesScalarsAndFlags() {
        ExecuteEventResponse d = ExecuteEventResponse.fromModel(fullResult());

        assertAll(
                () -> assertEquals("match-uuid", d.getMatchUuid()),
                () -> assertEquals("evt-1", d.getEventUuid()),
                () -> assertEquals("ACTION", d.getEventType()),
                () -> assertEquals("The gate opens", d.getCard().getTitle()),
                () -> assertEquals(List.of("evt-1", "evt-2"), d.getExecutedEventUuids()),
                () -> assertEquals(3, d.getEnergySpent()),
                () -> assertEquals(4, d.getCoinSpent()),
                () -> assertEquals(7, d.getNewEnergy()),
                () -> assertEquals(8, d.getNewCoin()),
                () -> assertEquals(12, d.getCurrentClock()),
                () -> assertFalse(d.isTurnConsumed()),
                () -> assertTrue(d.isTimeEnded()),
                () -> assertTrue(d.isItemAdded()),
                () -> assertTrue(d.isItemRemoved()),
                () -> assertTrue(d.isWeatherApplied()),
                () -> assertTrue(d.isMovementApplied()),
                () -> assertTrue(d.isForcedSleep()),
                () -> assertTrue(d.isComaTriggered()),
                () -> assertTrue(d.isGameOver()),
                () -> assertTrue(d.isRefreshRecommended()));
    }

    @Test
    @DisplayName("fromModel maps every itemised change list")
    void fromModelMapsEveryChangeList() {
        ExecuteEventResponse d = ExecuteEventResponse.fromModel(fullResult());

        assertAll(
                () -> assertEquals("life", d.getStatChanges().get(0).getStatistic()),
                () -> assertEquals(-5, d.getStatChanges().get(0).getDelta()),
                () -> assertEquals("gate", d.getRegistryChanges().get(0).getKey()),
                () -> assertEquals("open", d.getRegistryChanges().get(0).getNewValue()),
                () -> assertEquals("trait-1", d.getTraitChanges().get(0).getTraitUuid()),
                () -> assertEquals("ADD", d.getTraitChanges().get(0).getAction()),
                () -> assertEquals("item-1", d.getItemChanges().get(0).getItemUuid()),
                () -> assertEquals("REMOVE", d.getItemChanges().get(0).getAction()),
                () -> assertEquals("brave",
                        d.getCharacteristicChanges().get(0).getCharacteristic()),
                () -> assertEquals("loc-a", d.getLocationChanges().get(0).getFromLocationUuid()),
                () -> assertEquals("loc-b", d.getLocationChanges().get(0).getToLocationUuid()),
                () -> assertEquals(1, d.getEffects().size()),
                () -> assertEquals("A blade in the dark", d.getEffects().get(0).getCard().getTitle()),
                () -> assertEquals(1, d.getPendingChoices().size()),
                () -> assertEquals("choice-1", d.getPendingChoices().get(0).getUuid()),
                () -> assertNotNull(d.getEdgeState()));
    }

    @Test
    @DisplayName("An event that changed nothing maps to empty lists, never nulls")
    void quietResultMapsToEmptyLists() {
        EventExecutionResult quiet = new EventExecutionResult(
                "m", "e", "INFO", null, List.of("e"),
                0, 0, 0, 0, 0,
                false, false, false, false, false, false, false, false, false, false,
                List.of(), List.of(), List.of(), List.of(), List.of(), List.of(),
                List.of(), List.of(), null);

        ExecuteEventResponse d = ExecuteEventResponse.fromModel(quiet);

        assertAll(
                () -> assertNull(d.getCard()),
                () -> assertTrue(d.getStatChanges().isEmpty()),
                () -> assertTrue(d.getRegistryChanges().isEmpty()),
                () -> assertTrue(d.getTraitChanges().isEmpty()),
                () -> assertTrue(d.getItemChanges().isEmpty()),
                () -> assertTrue(d.getCharacteristicChanges().isEmpty()),
                () -> assertTrue(d.getLocationChanges().isEmpty()),
                () -> assertTrue(d.getEffects().isEmpty()),
                () -> assertTrue(d.getPendingChoices().isEmpty()),
                () -> assertNull(d.getEdgeState()));
    }

    @Test
    @DisplayName("The top-level setters round-trip for Jackson")
    void topLevelSettersRoundTrip() {
        ExecuteEventResponse d = new ExecuteEventResponse();
        d.setMatchUuid("m");
        d.setEventUuid("e");
        d.setEventType("ACTION");
        d.setCard(CardInfoResponse.fromModel(card("Card")));
        d.setExecutedEventUuids(List.of("e"));
        d.setEnergySpent(1);
        d.setCoinSpent(2);
        d.setNewEnergy(3);
        d.setNewCoin(4);
        d.setCurrentClock(5);
        d.setTurnConsumed(true);
        d.setTimeEnded(true);
        d.setItemAdded(true);
        d.setItemRemoved(true);
        d.setWeatherApplied(true);
        d.setMovementApplied(true);
        d.setForcedSleep(true);
        d.setComaTriggered(true);
        d.setGameOver(true);
        d.setRefreshRecommended(true);
        d.setStatChanges(List.of());
        d.setRegistryChanges(List.of());
        d.setTraitChanges(List.of());
        d.setItemChanges(List.of());
        d.setCharacteristicChanges(List.of());
        d.setLocationChanges(List.of());
        d.setEffects(List.of());
        d.setPendingChoices(List.of());
        d.setEdgeState(new EdgeStateOutcomeDto());

        assertAll(
                () -> assertEquals("m", d.getMatchUuid()),
                () -> assertEquals("e", d.getEventUuid()),
                () -> assertEquals("ACTION", d.getEventType()),
                () -> assertEquals("Card", d.getCard().getTitle()),
                () -> assertEquals(List.of("e"), d.getExecutedEventUuids()),
                () -> assertEquals(1, d.getEnergySpent()),
                () -> assertEquals(2, d.getCoinSpent()),
                () -> assertEquals(3, d.getNewEnergy()),
                () -> assertEquals(4, d.getNewCoin()),
                () -> assertEquals(5, d.getCurrentClock()),
                () -> assertTrue(d.isTurnConsumed()),
                () -> assertTrue(d.isTimeEnded()),
                () -> assertTrue(d.isItemAdded()),
                () -> assertTrue(d.isItemRemoved()),
                () -> assertTrue(d.isWeatherApplied()),
                () -> assertTrue(d.isMovementApplied()),
                () -> assertTrue(d.isForcedSleep()),
                () -> assertTrue(d.isComaTriggered()),
                () -> assertTrue(d.isGameOver()),
                () -> assertTrue(d.isRefreshRecommended()),
                () -> assertTrue(d.getStatChanges().isEmpty()),
                () -> assertTrue(d.getRegistryChanges().isEmpty()),
                () -> assertTrue(d.getTraitChanges().isEmpty()),
                () -> assertTrue(d.getItemChanges().isEmpty()),
                () -> assertTrue(d.getCharacteristicChanges().isEmpty()),
                () -> assertTrue(d.getLocationChanges().isEmpty()),
                () -> assertTrue(d.getEffects().isEmpty()),
                () -> assertTrue(d.getPendingChoices().isEmpty()),
                () -> assertNotNull(d.getEdgeState()));
    }

    @Test
    @DisplayName("StatChangeDto maps and round-trips")
    void statChangeDto() {
        StatChangeDto from = StatChangeDto.fromModel(
                new StatChange("char-1", "energy", 9, 4, -5));
        assertAll(
                () -> assertEquals("char-1", from.getCharacterUuid()),
                () -> assertEquals("energy", from.getStatistic()),
                () -> assertEquals(9, from.getBefore()),
                () -> assertEquals(4, from.getAfter()),
                () -> assertEquals(-5, from.getDelta()));

        StatChangeDto d = new StatChangeDto();
        d.setCharacterUuid("c");
        d.setStatistic("life");
        d.setBefore(1);
        d.setAfter(2);
        d.setDelta(1);
        assertAll(
                () -> assertEquals("c", d.getCharacterUuid()),
                () -> assertEquals("life", d.getStatistic()),
                () -> assertEquals(1, d.getBefore()),
                () -> assertEquals(2, d.getAfter()),
                () -> assertEquals(1, d.getDelta()));
    }

    @Test
    @DisplayName("RegistryChangeDto maps and round-trips, a first write having no old value")
    void registryChangeDto() {
        RegistryChangeDto from = RegistryChangeDto.fromModel(
                new RegistryChange("gate", null, "open"));
        assertAll(
                () -> assertEquals("gate", from.getKey()),
                () -> assertNull(from.getOldValue()),
                () -> assertEquals("open", from.getNewValue()));

        RegistryChangeDto d = new RegistryChangeDto();
        d.setKey("k");
        d.setOldValue("a");
        d.setNewValue("b");
        assertAll(
                () -> assertEquals("k", d.getKey()),
                () -> assertEquals("a", d.getOldValue()),
                () -> assertEquals("b", d.getNewValue()));
    }

    @Test
    @DisplayName("TraitChangeDto maps and round-trips")
    void traitChangeDto() {
        TraitChangeDto from = TraitChangeDto.fromModel(
                new TraitChange("char-1", "trait-1", "REMOVE"));
        assertAll(
                () -> assertEquals("char-1", from.getCharacterUuid()),
                () -> assertEquals("trait-1", from.getTraitUuid()),
                () -> assertEquals("REMOVE", from.getAction()));

        TraitChangeDto d = new TraitChangeDto();
        d.setCharacterUuid("c");
        d.setTraitUuid("t");
        d.setAction("ADD");
        assertAll(
                () -> assertEquals("c", d.getCharacterUuid()),
                () -> assertEquals("t", d.getTraitUuid()),
                () -> assertEquals("ADD", d.getAction()));
    }

    @Test
    @DisplayName("ItemChangeDto maps and round-trips")
    void itemChangeDto() {
        ItemChangeDto from = ItemChangeDto.fromModel(
                new ItemChange("char-1", "item-1", "ADD"));
        assertAll(
                () -> assertEquals("char-1", from.getCharacterUuid()),
                () -> assertEquals("item-1", from.getItemUuid()),
                () -> assertEquals("ADD", from.getAction()));

        ItemChangeDto d = new ItemChangeDto();
        d.setCharacterUuid("c");
        d.setItemUuid("i");
        d.setAction("REMOVE");
        assertAll(
                () -> assertEquals("c", d.getCharacterUuid()),
                () -> assertEquals("i", d.getItemUuid()),
                () -> assertEquals("REMOVE", d.getAction()));
    }

    @Test
    @DisplayName("CharacteristicChangeDto maps and round-trips")
    void characteristicChangeDto() {
        CharacteristicChangeDto from = CharacteristicChangeDto.fromModel(
                new CharacteristicChange("char-1", "brave", "ADD"));
        assertAll(
                () -> assertEquals("char-1", from.getCharacterUuid()),
                () -> assertEquals("brave", from.getCharacteristic()),
                () -> assertEquals("ADD", from.getAction()));

        CharacteristicChangeDto d = new CharacteristicChangeDto();
        d.setCharacterUuid("c");
        d.setCharacteristic("wise");
        d.setAction("REMOVE");
        assertAll(
                () -> assertEquals("c", d.getCharacterUuid()),
                () -> assertEquals("wise", d.getCharacteristic()),
                () -> assertEquals("REMOVE", d.getAction()));
    }

    @Test
    @DisplayName("LocationChangeDto keeps a null origin for an unplaced character")
    void locationChangeDto() {
        LocationChangeDto from = LocationChangeDto.fromModel(
                new LocationChange("char-1", null, "loc-b"));
        assertAll(
                () -> assertEquals("char-1", from.getCharacterUuid()),
                () -> assertNull(from.getFromLocationUuid()),
                () -> assertEquals("loc-b", from.getToLocationUuid()));

        LocationChangeDto d = new LocationChangeDto();
        d.setCharacterUuid("c");
        d.setFromLocationUuid("a");
        d.setToLocationUuid("b");
        assertAll(
                () -> assertEquals("c", d.getCharacterUuid()),
                () -> assertEquals("a", d.getFromLocationUuid()),
                () -> assertEquals("b", d.getToLocationUuid()));
    }

    @Test
    @DisplayName("AppliedEffectDto maps every field and copies the recipients")
    void appliedEffectDto() {
        AppliedEffectDto from = AppliedEffectDto.fromModel(new AppliedEffect(
                "evt-1", "eff-1", "life", -5, "CLASS", 3,
                List.of("char-1", "char-2"), card("A blade in the dark")));

        assertAll(
                () -> assertEquals("evt-1", from.getEventUuid()),
                () -> assertEquals("eff-1", from.getEffectUuid()),
                () -> assertEquals("life", from.getStatistic()),
                () -> assertEquals(-5, from.getValue()),
                () -> assertEquals("CLASS", from.getTarget()),
                () -> assertEquals(3, from.getTargetClass()),
                () -> assertEquals(List.of("char-1", "char-2"), from.getCharacterUuids()),
                () -> assertEquals("A blade in the dark", from.getCard().getTitle()));
    }

    @Test
    @DisplayName("AppliedEffectDto tolerates a class target matching nobody, and round-trips")
    void appliedEffectDtoEmptyRecipients() {
        AppliedEffectDto from = AppliedEffectDto.fromModel(new AppliedEffect(
                "evt-1", "eff-2", null, null, "CLASS", null, List.of(), null));
        assertAll(
                () -> assertNull(from.getStatistic()),
                () -> assertNull(from.getValue()),
                () -> assertNull(from.getTargetClass()),
                () -> assertTrue(from.getCharacterUuids().isEmpty()),
                () -> assertNull(from.getCard()));

        AppliedEffectDto d = new AppliedEffectDto();
        d.setEventUuid("e");
        d.setEffectUuid("f");
        d.setStatistic("coin");
        d.setValue(2);
        d.setTarget("SELF");
        d.setTargetClass(1);
        d.setCharacterUuids(List.of("c"));
        d.setCard(CardInfoResponse.fromModel(card("Card")));
        assertAll(
                () -> assertEquals("e", d.getEventUuid()),
                () -> assertEquals("f", d.getEffectUuid()),
                () -> assertEquals("coin", d.getStatistic()),
                () -> assertEquals(2, d.getValue()),
                () -> assertEquals("SELF", d.getTarget()),
                () -> assertEquals(1, d.getTargetClass()),
                () -> assertEquals(List.of("c"), d.getCharacterUuids()),
                () -> assertEquals("Card", d.getCard().getTitle()));
    }

    @Test
    @DisplayName("PendingChoiceDto maps and round-trips")
    void pendingChoiceDto() {
        PendingChoiceDto from = PendingChoiceDto.fromModel(
                new PendingChoice("choice-1", 9, card("Left or right?")));
        assertAll(
                () -> assertEquals("choice-1", from.getUuid()),
                () -> assertEquals(9, from.getPriority()),
                () -> assertEquals("Left or right?", from.getCard().getTitle()));

        PendingChoiceDto d = new PendingChoiceDto();
        d.setUuid("c");
        d.setPriority(1);
        d.setCard(null);
        assertAll(
                () -> assertEquals("c", d.getUuid()),
                () -> assertEquals(1, d.getPriority()),
                () -> assertNull(d.getCard()));
    }
}
