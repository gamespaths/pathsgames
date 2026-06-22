package games.paths.core.model.match;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class MatchModelsTest {

    @Test
    void matchCreateCommandStoresAllFields() {
        MatchCreateCommand c = new MatchCreateCommand(
                "u", "s", "d", "n", "ct", "cl", List.of("t1", "t2"), 0);
        assertEquals("u", c.getUserUuid());
        assertEquals("s", c.getStoryUuid());
        assertEquals("d", c.getDifficultyUuid());
        assertEquals("n", c.getName());
        assertEquals("ct", c.getCharacterTemplateUuid());
        assertEquals("cl", c.getClassUuid());
        assertEquals(List.of("t1", "t2"), c.getTraitUuids());
        assertEquals(0, c.getSinglePlayer());
    }

    @Test
    void matchSummaryRoundtrip() {
        MatchSummary s = new MatchSummary();
        s.setUuid("u");
        s.setStoryUuid("st");
        s.setDifficultyUuid("d");
        s.setName("n");
        s.setStatus("CREATED");
        s.setCurrentClock(0);
        s.setExpCost(5);
        s.setUserCreatorUuid("uc");
        s.setTsInsert("ts");
        s.setSinglePlayer(1);
        s.setCharacterTemplateUuid("ct");
        s.setClassUuid("cl");
        s.setTraitUuids(List.of("t1", "t2"));
        assertEquals("u", s.getUuid());
        assertEquals("st", s.getStoryUuid());
        assertEquals("d", s.getDifficultyUuid());
        assertEquals("n", s.getName());
        assertEquals("CREATED", s.getStatus());
        assertEquals(0, s.getCurrentClock());
        assertEquals(5, s.getExpCost());
        assertEquals("uc", s.getUserCreatorUuid());
        assertEquals("ts", s.getTsInsert());
        assertEquals(1, s.getSinglePlayer());
        assertEquals("ct", s.getCharacterTemplateUuid());
        assertEquals("cl", s.getClassUuid());
        assertEquals(List.of("t1", "t2"), s.getTraitUuids());

        // null trait list is normalised to an empty list
        s.setTraitUuids(null);
        assertNotNull(s.getTraitUuids());
        assertTrue(s.getTraitUuids().isEmpty());
    }

    @Test
    void matchLocationStateRoundtrip() {
        MatchLocationState m = new MatchLocationState();
        m.setIdLocation(1L);
        m.setUuid("u");
        m.setFlagAlreadyActived(1);
        m.setClockCounter(2);
        m.setName("n");
        assertEquals(1L, m.getIdLocation());
        assertEquals("u", m.getUuid());
        assertEquals(1, m.getFlagAlreadyActived());
        assertEquals(2, m.getClockCounter());
        assertEquals("n", m.getName());
    }

    @Test
    void matchRegistryEntryRoundtrip() {
        MatchRegistryEntry r = new MatchRegistryEntry();
        r.setUuid("u");
        r.setKey("k");
        r.setStringValue("s");
        r.setIntValue(1);
        assertEquals("u", r.getUuid());
        assertEquals("k", r.getKey());
        assertEquals("s", r.getStringValue());
        assertEquals(1, r.getIntValue());
    }

    @Test
    void matchEventOptionRoundtrip() {
        MatchEventOption a = new MatchEventOption();
        a.setUuid("u");
        a.setName("n");
        a.setType("EVENT");
        assertEquals("u", a.getUuid());
        assertEquals("n", a.getName());
        assertEquals("EVENT", a.getType());

        MatchEventOption b = new MatchEventOption("u2", "n2", "CHOICE");
        assertEquals("u2", b.getUuid());
        assertEquals("n2", b.getName());
        assertEquals("CHOICE", b.getType());
    }

    @Test
    void matchDetailLists() {
        MatchDetail d = new MatchDetail();
        d.setMatch(new MatchSummary());
        d.setCurrentLocationId(10L);
        d.setCurrentLocationUuid("loc");
        d.setCurrentLocationName("Loc");
        d.setLocations(List.of(new MatchLocationState()));
        d.setRegistry(List.of(new MatchRegistryEntry()));
        d.setEvents(List.of(new MatchEventOption()));
        d.setChoices(List.of(new MatchEventOption()));
        assertNotNull(d.getMatch());
        assertEquals(10L, d.getCurrentLocationId());
        assertEquals("loc", d.getCurrentLocationUuid());
        assertEquals("Loc", d.getCurrentLocationName());
        assertEquals(1, d.getLocations().size());
        assertEquals(1, d.getRegistry().size());
        assertEquals(1, d.getEvents().size());
        assertEquals(1, d.getChoices().size());
    }

    @Test
    void matchDetailNullCollectionsBecomeEmpty() {
        MatchDetail d = new MatchDetail();
        d.setLocations(null);
        d.setRegistry(null);
        d.setEvents(null);
        d.setChoices(null);
        assertNotNull(d.getLocations());
        assertNotNull(d.getRegistry());
        assertNotNull(d.getEvents());
        assertNotNull(d.getChoices());
    }

    @Test
    void joinMatchCommand_allArgsConstructor() {
        JoinMatchCommand cmd = new JoinMatchCommand("mu", "uu", "ct", "cl", List.of("t1"));
        assertEquals("mu", cmd.getMatchUuid());
        assertEquals("uu", cmd.getUserUuid());
        assertEquals("ct", cmd.getCharacterTemplateUuid());
        assertEquals("cl", cmd.getClassUuid());
        assertEquals(List.of("t1"), cmd.getTraitUuids());
    }

    @Test
    void joinMatchCommand_setters() {
        JoinMatchCommand cmd = new JoinMatchCommand();
        cmd.setMatchUuid("m");
        cmd.setUserUuid("u");
        cmd.setCharacterTemplateUuid("c");
        cmd.setClassUuid("cl");
        cmd.setTraitUuids(List.of("t1", "t2"));

        assertEquals("m", cmd.getMatchUuid());
        assertEquals("u", cmd.getUserUuid());
        assertEquals("c", cmd.getCharacterTemplateUuid());
        assertEquals("cl", cmd.getClassUuid());
        assertEquals(2, cmd.getTraitUuids().size());
    }

    @Test
    void joinMatchCommand_nullTraits_defaultsToEmpty() {
        JoinMatchCommand cmd = new JoinMatchCommand("m", "u", null, null, null);
        assertNotNull(cmd.getTraitUuids());
        assertTrue(cmd.getTraitUuids().isEmpty());
    }

    @Test
    void joinMatchCommand_setTraitsNull_defaultsToEmpty() {
        JoinMatchCommand cmd = new JoinMatchCommand();
        cmd.setTraitUuids(null);
        assertNotNull(cmd.getTraitUuids());
        assertTrue(cmd.getTraitUuids().isEmpty());
    }

    @Test
    void itemInstanceInfo_gettersAndSetters() {
        ItemInstanceInfo info = new ItemInstanceInfo();
        info.setUuid("iu");
        info.setItemUuid("it");
        info.setName("Sword");
        info.setWeight(2);
        info.setAmount(1);
        info.setState("ACTIVE");

        assertEquals("iu", info.getUuid());
        assertEquals("it", info.getItemUuid());
        assertEquals("Sword", info.getName());
        assertEquals(2, info.getWeight());
        assertEquals(1, info.getAmount());
        assertEquals("ACTIVE", info.getState());
    }
}
