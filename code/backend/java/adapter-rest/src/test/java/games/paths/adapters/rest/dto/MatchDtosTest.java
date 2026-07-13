package games.paths.adapters.rest.dto;

import games.paths.core.model.match.EventInfo;
import games.paths.core.model.match.LocationInfo;
import games.paths.core.model.match.LocationNeighborInfo;
import games.paths.core.model.match.MatchDetail;
import games.paths.core.model.match.MatchEventOption;
import games.paths.core.model.match.MatchLocationState;
import games.paths.core.model.match.MatchRegistryEntry;
import games.paths.core.model.match.MatchSummary;
import games.paths.core.model.story.CardInfo;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class MatchDtosTest {

    @Test
    void matchCreateRequestRoundtrip() {
        MatchCreateRequest r = new MatchCreateRequest();
        r.setStoryUuid("s");
        r.setDifficultyUuid("d");
        r.setName("n");
        r.setCharacterTemplateUuid("ct");
        r.setClassUuid("cl");
        r.setTraitUuids(List.of("t1", "t2"));
        r.setSinglePlayer(1);
        r.setTurnstileToken("tok");
        r.setRngSeed(42L);
        assertEquals("s", r.getStoryUuid());
        assertEquals("d", r.getDifficultyUuid());
        assertEquals("n", r.getName());
        assertEquals("ct", r.getCharacterTemplateUuid());
        assertEquals("cl", r.getClassUuid());
        assertEquals(List.of("t1", "t2"), r.getTraitUuids());
        assertEquals(1, r.getSinglePlayer());
        assertEquals("tok", r.getTurnstileToken());
        assertEquals(42L, r.getRngSeed());
    }

    @Test
    void matchSummaryResponseFromNullReturnsNull() {
        assertNull(MatchSummaryResponse.fromModel(null));
    }

    @Test
    void matchSummaryResponseFromModelMapsFields() {
        MatchSummary m = new MatchSummary();
        m.setUuid("u");
        m.setStoryUuid("s");
        m.setDifficultyUuid("d");
        m.setName("n");
        m.setStatus("CREATED");
        m.setCurrentClock(1);
        m.setExpCost(5);
        m.setUserCreatorUuid("uc");
        m.setTsInsert("ts");
        m.setSinglePlayer(1);
        m.setCharacterTemplateUuid("ct");
        m.setClassUuid("cl");
        m.setTraitUuids(List.of("t1", "t2"));

        MatchSummaryResponse r = MatchSummaryResponse.fromModel(m);
        assertEquals("u", r.getUuid());
        assertEquals("s", r.getStoryUuid());
        assertEquals("d", r.getDifficultyUuid());
        assertEquals("n", r.getName());
        assertEquals("CREATED", r.getStatus());
        assertEquals(1, r.getCurrentClock());
        assertEquals(5, r.getExpCost());
        assertEquals("uc", r.getUserCreatorUuid());
        assertEquals("ts", r.getTsInsert());
        assertEquals(1, r.getSinglePlayer());
        assertEquals("ct", r.getCharacterTemplateUuid());
        assertEquals("cl", r.getClassUuid());
        assertEquals(List.of("t1", "t2"), r.getTraitUuids());

        // setters
        r.setUuid("u2");
        r.setStoryUuid("s2");
        r.setDifficultyUuid("d2");
        r.setName("n2");
        r.setStatus("RUNNING");
        r.setCurrentClock(2);
        r.setExpCost(7);
        r.setUserCreatorUuid("uc2");
        r.setTsInsert("ts2");
        r.setSinglePlayer(0);
        r.setCharacterTemplateUuid("ct2");
        r.setClassUuid("cl2");
        r.setTraitUuids(List.of("t3"));
        assertEquals("u2", r.getUuid());
        assertEquals("RUNNING", r.getStatus());
        assertEquals("ts2", r.getTsInsert());
        assertEquals(0, r.getSinglePlayer());
        assertEquals("ct2", r.getCharacterTemplateUuid());
        assertEquals("cl2", r.getClassUuid());
        assertEquals(List.of("t3"), r.getTraitUuids());
    }

    @Test
    void matchInfoResponseFromNullReturnsNull() {
        assertNull(MatchInfoResponse.fromModel(null));
    }

    @Test
    void matchInfoResponseMapsAllSubObjects() {
        MatchDetail d = new MatchDetail();
        d.setMatch(new MatchSummary());
        d.setCurrentLocationId(1L);
        d.setCurrentLocationUuid("u");
        MatchLocationState s = new MatchLocationState();
        s.setIdLocation(2L);
        s.setUuid("ls");
        s.setFlagAlreadyActived(1);
        s.setClockCounter(3);
        d.setLocations(List.of(s));
        MatchRegistryEntry e = new MatchRegistryEntry();
        e.setUuid("r");
        e.setKey("k");
        e.setStringValue("v");
        e.setIntValue(7);
        d.setRegistry(List.of(e));
        d.setEvents(List.of(new MatchEventOption("ev", "n", "EVENT")));
        d.setChoices(List.of(new MatchEventOption("ch", "n", "CHOICE")));

        MatchInfoResponse r = MatchInfoResponse.fromModel(d);
        assertNotNull(r.getMatch());
        assertEquals(1L, r.getCurrentLocationId());
        assertEquals("u", r.getCurrentLocationUuid());

        MatchInfoResponse.LocationStateDto ls = r.getLocations().get(0);
        assertEquals(2L, ls.getIdLocation());
        assertEquals("ls", ls.getUuid());
        assertEquals(1, ls.getFlagAlreadyActived());
        assertEquals(3, ls.getClockCounter());

        MatchInfoResponse.RegistryEntryDto re = r.getRegistry().get(0);
        assertEquals("r", re.getUuid());
        assertEquals("k", re.getKey());
        assertEquals("v", re.getStringValue());
        assertEquals(7, re.getIntValue());

        MatchInfoResponse.EventOptionDto ev = r.getEvents().get(0);
        assertEquals("ev", ev.getUuid());
        assertEquals("n", ev.getName());
        assertEquals("EVENT", ev.getType());
    }

    @Test
    void matchInfoResponseMapsLocationsActiveWithCards() {
        CardInfo locCard = new CardInfo("c-loc", "location", "img", null, "fa-x",
                null, null, null, null, null, "Tavern", "warm", null, null, null);
        CardInfo nbCard = new CardInfo("c-nb", "location", null, null, "fa-y",
                null, null, null, null, null, "Cave", "dark", null, null, null);
        CardInfo evCard = new CardInfo("c-ev", "event", null, null, "fa-z",
                null, null, null, null, null, "Stranger", "appears", null, null, null);
        CardInfo nbBackCard = new CardInfo("c-nb-back", "location", null, null, "fa-yb",
                null, null, null, null, null, "Cave Return", "back", null, null, null);

        // v0.28.6 — the LOCATION card of idLocationFrom (visited: the player stands
        // there); idLocationTo is still under fog of war, hence null.
        LocationNeighborInfo nb = new LocationNeighborInfo(2L, "loc-2", "N", 0, 3, nbCard, 1, 1L, 2L, nbBackCard,
                locCard, null);
        // v0.29.0 — the event carries the check-procedure verdict; here it is blocked.
        EventInfo ev = new EventInfo("evt-1", "NORMAL", true, evCard, false, "NOT_ENOUGH_ENERGY");
        LocationInfo li = new LocationInfo(1L, "loc-1", 7, locCard, List.of(nb), List.of(ev), 1);

        MatchDetail d = new MatchDetail();
        d.setMatch(new MatchSummary());
        d.setLocationsActive(List.of(li));

        MatchInfoResponse r = MatchInfoResponse.fromModel(d);
        assertEquals(1, r.getLocationsActive().size());
        MatchInfoResponse.LocationInfoDto dto = r.getLocationsActive().get(0);
        assertEquals(1L, dto.getIdLocation());
        assertEquals("loc-1", dto.getUuid());
        assertEquals(7, dto.getIdCard());
        assertEquals("Tavern", dto.getCard().getTitle());

        assertEquals(1, dto.getNeighbors().size());
        MatchInfoResponse.LocationNeighborDto nbDto = dto.getNeighbors().get(0);
        assertEquals(2L, nbDto.getIdLocation());
        assertEquals("N", nbDto.getDirection());
        assertEquals(3, nbDto.getEnergyCost());
        assertEquals("Cave", nbDto.getCard().getTitle());
        assertEquals(1, nbDto.getSecureParam());
        assertEquals(1L, nbDto.getIdLocationFrom());
        assertEquals(2L, nbDto.getIdLocationTo());
        assertEquals("Cave Return", nbDto.getCardBack().getTitle());
        assertEquals("Tavern", nbDto.getCardLocationFrom().getTitle());
        assertNull(nbDto.getCardLocationTo());

        assertEquals(1, dto.getEvents().size());
        MatchInfoResponse.EventInfoDto evDto = dto.getEvents().get(0);
        assertEquals("evt-1", evDto.getUuid());
        assertEquals("NORMAL", evDto.getType());
        assertTrue(evDto.isEndGame());
        assertEquals("Stranger", evDto.getCard().getTitle());
        assertFalse(evDto.isAvailable());
        assertEquals("NOT_ENOUGH_ENERGY", evDto.getReason());
    }

    @Test
    void infoResponseSetters() {
        MatchInfoResponse r = new MatchInfoResponse();
        r.setMatch(new MatchSummaryResponse());
        r.setCurrentLocationId(9L);
        r.setCurrentLocationUuid("u");
        r.setLocations(List.of());
        r.setRegistry(List.of());
        r.setEvents(List.of());
        r.setChoices(List.of());
        assertNotNull(r.getMatch());
        assertEquals(9L, r.getCurrentLocationId());
        assertEquals("u", r.getCurrentLocationUuid());
        assertNotNull(r.getLocations());
        assertNotNull(r.getRegistry());
        assertNotNull(r.getEvents());
        assertNotNull(r.getChoices());
    }

    @Test
    void infoSubDtoSetters() {
        MatchInfoResponse.LocationStateDto ls = new MatchInfoResponse.LocationStateDto();
        ls.setIdLocation(1L);
        ls.setUuid("u");
        ls.setFlagAlreadyActived(1);
        ls.setClockCounter(2);
        assertEquals(1L, ls.getIdLocation());
        assertEquals("u", ls.getUuid());
        assertEquals(1, ls.getFlagAlreadyActived());
        assertEquals(2, ls.getClockCounter());

        MatchInfoResponse.RegistryEntryDto re = new MatchInfoResponse.RegistryEntryDto();
        re.setUuid("u");
        re.setKey("k");
        re.setStringValue("v");
        re.setIntValue(7);
        assertEquals("u", re.getUuid());
        assertEquals("k", re.getKey());
        assertEquals("v", re.getStringValue());
        assertEquals(7, re.getIntValue());

        MatchInfoResponse.EventOptionDto ev = new MatchInfoResponse.EventOptionDto();
        ev.setUuid("u");
        ev.setName("n");
        ev.setType("E");
        assertEquals("u", ev.getUuid());
        assertEquals("n", ev.getName());
        assertEquals("E", ev.getType());
    }

    @Test
    void locationInfoDtoSetters() {
        CardInfoResponse card = new CardInfoResponse();
        card.setUuid("card-uuid");

        MatchInfoResponse.LocationInfoDto loc = new MatchInfoResponse.LocationInfoDto();
        loc.setIdLocation(1L);
        loc.setUuid("loc-1");
        loc.setIdCard(10);
        loc.setCard(card);
        loc.setNeighbors(List.of(new MatchInfoResponse.LocationNeighborDto()));
        loc.setEvents(List.of(new MatchInfoResponse.EventInfoDto()));
        loc.setSecureParam(1);

        assertEquals(1L, loc.getIdLocation());
        assertEquals("loc-1", loc.getUuid());
        assertEquals(10, loc.getIdCard());
        assertEquals("card-uuid", loc.getCard().getUuid());
        assertEquals(1, loc.getNeighbors().size());
        assertEquals(1, loc.getEvents().size());
        assertEquals(1, loc.getSecureParam());

        MatchInfoResponse r = new MatchInfoResponse();
        r.setLocationsActive(List.of(loc));
        assertEquals("loc-1", r.getLocationsActive().get(0).getUuid());
    }

    @Test
    void locationNeighborDtoSetters() {
        CardInfoResponse card = new CardInfoResponse();
        card.setUuid("card-uuid");
        CardInfoResponse back = new CardInfoResponse();
        back.setUuid("card-back");
        CardInfoResponse from = new CardInfoResponse();
        from.setUuid("card-from");
        CardInfoResponse to = new CardInfoResponse();
        to.setUuid("card-to");

        MatchInfoResponse.LocationNeighborDto n = new MatchInfoResponse.LocationNeighborDto();
        n.setIdLocation(2L);
        n.setUuid("loc-2");
        n.setDirection("NORTH");
        n.setFlagBack(1);
        n.setEnergyCost(4);
        n.setCard(card);
        n.setSecureParam(0);
        n.setIdLocationFrom(1L);
        n.setIdLocationTo(2L);
        n.setCardBack(back);
        n.setCardLocationFrom(from);
        n.setCardLocationTo(to);

        assertEquals(2L, n.getIdLocation());
        assertEquals("loc-2", n.getUuid());
        assertEquals("NORTH", n.getDirection());
        assertEquals(1, n.getFlagBack());
        assertEquals(4, n.getEnergyCost());
        assertEquals("card-uuid", n.getCard().getUuid());
        assertEquals(0, n.getSecureParam());
        assertEquals(1L, n.getIdLocationFrom());
        assertEquals(2L, n.getIdLocationTo());
        assertEquals("card-back", n.getCardBack().getUuid());
        assertEquals("card-from", n.getCardLocationFrom().getUuid());
        assertEquals("card-to", n.getCardLocationTo().getUuid());
    }

    @Test
    void eventInfoDtoSetters() {
        CardInfoResponse card = new CardInfoResponse();
        card.setUuid("card-uuid");

        MatchInfoResponse.EventInfoDto e = new MatchInfoResponse.EventInfoDto();
        e.setUuid("ev-1");
        e.setType("NORMAL");
        e.setEndGame(true);
        e.setCard(card);

        assertEquals("ev-1", e.getUuid());
        assertEquals("NORMAL", e.getType());
        assertTrue(e.isEndGame());
        assertEquals("card-uuid", e.getCard().getUuid());
    }
}
