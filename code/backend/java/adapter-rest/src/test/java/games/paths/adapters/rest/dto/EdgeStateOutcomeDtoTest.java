package games.paths.adapters.rest.dto;

import games.paths.adapters.rest.dto.ExecuteEventResponse.EdgeStateOutcomeDto;
import games.paths.core.model.story.CardInfo;
import games.paths.core.port.match.EventExecutionPort.AppliedEffect;
import games.paths.core.port.match.EventExecutionPort.EdgeStateOutcome;
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
 * EdgeStateOutcome (Step 30) — the domain record and its wire DTO.
 */
@DisplayName("EdgeStateOutcome and its DTO (Step 30)")
class EdgeStateOutcomeDtoTest {

    private static CardInfo card(String title) {
        return new CardInfo("c1", "event", null, null, null, null, null, null, null, null,
                title, null, null, null, null);
    }

    @Test
    @DisplayName("none() is empty and reports nothing happened")
    void noneIsQuiet() {
        EdgeStateOutcome none = EdgeStateOutcome.none();

        assertAll(
                () -> assertFalse(none.anything()),
                () -> assertTrue(none.sadnessOverflowUuids().isEmpty()),
                () -> assertTrue(none.comaUuids().isEmpty()),
                () -> assertFalse(none.allPlayersInComa()),
                () -> assertNull(none.comaEventUuid()),
                () -> assertNull(none.comaEventCard()));
    }

    @Test
    @DisplayName("anything() is true for each edge on its own")
    void anythingCoversEveryEdge() {
        assertTrue(new EdgeStateOutcome(List.of("a"), List.of(), false, null, null,
                List.of(), List.of()).anything(), "a sadness overflow alone counts");
        assertTrue(new EdgeStateOutcome(List.of(), List.of("a"), false, null, null,
                List.of(), List.of()).anything(), "a coma alone counts");
        assertTrue(new EdgeStateOutcome(List.of(), List.of(), true, null, null,
                List.of(), List.of()).anything(), "a party collapse alone counts");
    }

    @Test
    @DisplayName("fromModel copies every field, cards included")
    void fromModelCopiesEverything() {
        EdgeStateOutcome m = new EdgeStateOutcome(
                List.of("char-1"), List.of("char-2"), true,
                "evt-coma", card("Everyone is down"),
                List.of("evt-coma", "evt-after"),
                List.of(new AppliedEffect("evt-coma", "eff-1", "life", -5, "ALL", null,
                        List.of("char-1"), card("The dark closes in"))));

        EdgeStateOutcomeDto d = EdgeStateOutcomeDto.fromModel(m);

        assertAll(
                () -> assertEquals(List.of("char-1"), d.getSadnessOverflowUuids()),
                () -> assertEquals(List.of("char-2"), d.getComaUuids()),
                () -> assertTrue(d.isAllPlayersInComa()),
                () -> assertEquals("evt-coma", d.getComaEventUuid()),
                () -> assertEquals("Everyone is down", d.getComaEventCard().getTitle()),
                () -> assertEquals(List.of("evt-coma", "evt-after"), d.getComaExecutedEventUuids()),
                () -> assertEquals(1, d.getComaEffects().size()),
                () -> assertEquals("The dark closes in",
                        d.getComaEffects().get(0).getCard().getTitle()));
    }

    @Test
    @DisplayName("A null model maps to a null DTO rather than an empty one")
    void nullModelMapsToNull() {
        assertNull(EdgeStateOutcomeDto.fromModel(null));
    }

    @Test
    @DisplayName("An absent epilogue leaves the card null without failing")
    void absentEpilogueHasNoCard() {
        EdgeStateOutcomeDto d = EdgeStateOutcomeDto.fromModel(new EdgeStateOutcome(
                List.of(), List.of("char-1"), true, null, null, List.of(), List.of()));

        assertAll(
                () -> assertNull(d.getComaEventUuid()),
                () -> assertNull(d.getComaEventCard()),
                () -> assertNotNull(d.getComaEffects()),
                () -> assertTrue(d.getComaEffects().isEmpty()));
    }

    @Test
    @DisplayName("The setters round-trip, so Jackson can deserialise the payload back")
    void settersRoundTrip() {
        EdgeStateOutcomeDto d = new EdgeStateOutcomeDto();
        d.setSadnessOverflowUuids(List.of("a"));
        d.setComaUuids(List.of("b"));
        d.setAllPlayersInComa(true);
        d.setComaEventUuid("evt");
        d.setComaEventCard(CardInfoResponse.fromModel(card("Card")));
        d.setComaExecutedEventUuids(List.of("evt"));
        d.setComaEffects(List.of());

        assertAll(
                () -> assertEquals(List.of("a"), d.getSadnessOverflowUuids()),
                () -> assertEquals(List.of("b"), d.getComaUuids()),
                () -> assertTrue(d.isAllPlayersInComa()),
                () -> assertEquals("evt", d.getComaEventUuid()),
                () -> assertEquals("Card", d.getComaEventCard().getTitle()),
                () -> assertEquals(List.of("evt"), d.getComaExecutedEventUuids()),
                () -> assertTrue(d.getComaEffects().isEmpty()));
    }
}
