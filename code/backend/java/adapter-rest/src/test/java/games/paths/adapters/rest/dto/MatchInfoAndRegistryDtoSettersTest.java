package games.paths.adapters.rest.dto;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The mutable half of the match DTOs: Jackson writes through the setters on the way in,
 * so every one of them has to hand the value back unchanged.
 */
@DisplayName("Match DTO setters")
class MatchInfoAndRegistryDtoSettersTest {

    @Test
    @DisplayName("MatchUpdateRequest round-trips both optional fields")
    void matchUpdateRequest() {
        MatchUpdateRequest r = new MatchUpdateRequest();
        r.setStatus("ENDED");
        r.setName("Saturday run");

        assertAll(
                () -> assertEquals("ENDED", r.getStatus()),
                () -> assertEquals("Saturday run", r.getName()));
    }

    @Test
    @DisplayName("LocationStateDto round-trips every field")
    void locationStateDto() {
        MatchInfoResponse.LocationStateDto d = new MatchInfoResponse.LocationStateDto();
        d.setIdLocation(7L);
        d.setUuid("loc-7");
        d.setFlagAlreadyActived(1);
        d.setFlagVisited(1);
        d.setClockCounter(3);

        assertAll(
                () -> assertEquals(7L, d.getIdLocation()),
                () -> assertEquals("loc-7", d.getUuid()),
                () -> assertEquals(1, d.getFlagAlreadyActived()),
                () -> assertEquals(1, d.getFlagVisited()),
                () -> assertEquals(3, d.getClockCounter()));
    }

    @Test
    @DisplayName("MatchInfoResponse.RegistryEntryDto round-trips every field")
    void registryEntryDto() {
        MatchInfoResponse.RegistryEntryDto d = new MatchInfoResponse.RegistryEntryDto();
        CardInfoResponse card = new CardInfoResponse();
        d.setUuid("reg-1");
        d.setKey("WINTER");
        d.setValues(List.of("YES"));
        d.setMultiValue(true);
        d.setIdCharacter(4L);
        d.setCategory("weather");
        d.setVisible(true);
        d.setPriority(2);
        d.setIdCard(9);
        d.setCard(card);

        assertAll(
                () -> assertEquals("reg-1", d.getUuid()),
                () -> assertEquals("WINTER", d.getKey()),
                () -> assertEquals(List.of("YES"), d.getValues()),
                () -> assertTrue(d.isMultiValue()),
                () -> assertEquals(4L, d.getIdCharacter()),
                () -> assertEquals("weather", d.getCategory()),
                () -> assertTrue(d.isVisible()),
                () -> assertEquals(2, d.getPriority()),
                () -> assertEquals(9, d.getIdCard()),
                () -> assertEquals(card, d.getCard()));
    }

    @Test
    @DisplayName("LocationNeighborDto round-trips every field, edge prices included")
    void locationNeighborDto() {
        MatchInfoResponse.LocationNeighborDto d = new MatchInfoResponse.LocationNeighborDto();
        CardInfoResponse card = new CardInfoResponse();
        CardInfoResponse back = new CardInfoResponse();
        CardInfoResponse from = new CardInfoResponse();
        CardInfoResponse to = new CardInfoResponse();
        d.setIdLocation(2L);
        d.setUuid("edge-1");
        d.setDirection("N");
        d.setFlagBack(0);
        d.setEnergyCost(3);
        d.setCostFood(1);
        d.setCostMagic(2);
        d.setCostCoin(4);
        d.setCard(card);
        d.setSecureParam(1);
        d.setIdLocationFrom(1L);
        d.setIdLocationTo(2L);
        d.setCardBack(back);
        d.setCardLocationFrom(from);
        d.setCardLocationTo(to);
        d.setAvailable(true);
        d.setReason("OK");

        assertAll(
                () -> assertEquals(2L, d.getIdLocation()),
                () -> assertEquals("edge-1", d.getUuid()),
                () -> assertEquals("N", d.getDirection()),
                () -> assertEquals(0, d.getFlagBack()),
                () -> assertEquals(3, d.getEnergyCost()),
                () -> assertEquals(1, d.getCostFood()),
                () -> assertEquals(2, d.getCostMagic()),
                () -> assertEquals(4, d.getCostCoin()),
                () -> assertEquals(card, d.getCard()),
                () -> assertEquals(1, d.getSecureParam()),
                () -> assertEquals(1L, d.getIdLocationFrom()),
                () -> assertEquals(2L, d.getIdLocationTo()),
                () -> assertEquals(back, d.getCardBack()),
                () -> assertEquals(from, d.getCardLocationFrom()),
                () -> assertEquals(to, d.getCardLocationTo()),
                () -> assertTrue(d.isAvailable()),
                () -> assertEquals("OK", d.getReason()));
    }

    @Test
    @DisplayName("EventInfoDto round-trips every field, the four prices included")
    void eventInfoDto() {
        MatchInfoResponse.EventInfoDto d = new MatchInfoResponse.EventInfoDto();
        CardInfoResponse card = new CardInfoResponse();
        d.setUuid("evt-1");
        d.setType("NORMAL");
        d.setEndGame(true);
        d.setCard(card);
        d.setAvailable(true);
        d.setReason("OK");
        d.setEnergy(1);
        d.setCoin(2);
        d.setFood(3);
        d.setMagic(4);

        assertAll(
                () -> assertEquals("evt-1", d.getUuid()),
                () -> assertEquals("NORMAL", d.getType()),
                () -> assertTrue(d.isEndGame()),
                () -> assertEquals(card, d.getCard()),
                () -> assertTrue(d.isAvailable()),
                () -> assertEquals("OK", d.getReason()),
                () -> assertEquals(1, d.getEnergy()),
                () -> assertEquals(2, d.getCoin()),
                () -> assertEquals(3, d.getFood()),
                () -> assertEquals(4, d.getMagic()));
    }

    @Test
    @DisplayName("MatchRegistryResponse round-trips its groups and their entries")
    void matchRegistryResponse() {
        MatchRegistryResponse.EntryDto entry = new MatchRegistryResponse.EntryDto();
        CardInfoResponse card = new CardInfoResponse();
        entry.setUuid("reg-1");
        entry.setKey("WINTER");
        entry.setValues(List.of("YES", "NO"));
        entry.setMultiValue(true);
        entry.setIdCharacter(4L);
        entry.setCategory("weather");
        entry.setVisible(true);
        entry.setPriority(2);
        entry.setIdCard(9);
        entry.setCard(card);

        MatchRegistryResponse.GroupDto group = new MatchRegistryResponse.GroupDto();
        group.setCategory("weather");
        group.setEntries(List.of(entry));

        MatchRegistryResponse response = new MatchRegistryResponse();
        response.setGroups(List.of(group));

        assertAll(
                () -> assertEquals(List.of(group), response.getGroups()),
                () -> assertEquals("weather", group.getCategory()),
                () -> assertEquals(List.of(entry), group.getEntries()),
                () -> assertEquals("reg-1", entry.getUuid()),
                () -> assertEquals("WINTER", entry.getKey()),
                () -> assertEquals(List.of("YES", "NO"), entry.getValues()),
                () -> assertTrue(entry.isMultiValue()),
                () -> assertEquals(4L, entry.getIdCharacter()),
                () -> assertEquals("weather", entry.getCategory()),
                () -> assertTrue(entry.isVisible()),
                () -> assertEquals(2, entry.getPriority()),
                () -> assertEquals(9, entry.getIdCard()),
                () -> assertEquals(card, entry.getCard()));
    }

    @Test
    @DisplayName("A null model yields an empty registry payload, never a null list")
    void fromModelNull() {
        assertTrue(MatchRegistryResponse.fromModel(null).getGroups().isEmpty());
    }
}
