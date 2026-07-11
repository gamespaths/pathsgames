package games.paths.adapters.rest.dto;

import games.paths.core.model.match.CharacterInstanceInfo;
import games.paths.core.model.match.MatchDetail;
import games.paths.core.model.match.MatchSummary;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class CharacterDtosTest {

    private CharacterInstanceInfo info() {
        CharacterInstanceInfo i = new CharacterInstanceInfo();
        i.setUuid("char-uuid");
        i.setMatchUuid("match-uuid");
        i.setUserUuid("user-uuid");
        i.setCharacterTemplateUuid("tpl");
        i.setClassUuid("cls");
        i.setDexterity(19);
        i.setIntelligence(18);
        i.setConstitution(17);
        i.setEnergy(127);
        i.setLife(137);
        i.setSad(0);
        i.setIdLocation(90001L);
        i.setLocationUuid("loc");
        i.setIsSleeping(false);
        i.setIsComa(false);
        i.setTraitUuids(List.of("t1", "t2"));
        i.setFood(1);
        i.setMagic(2);
        i.setCoin(3);
        return i;
    }

    @Test
    void instanceResponse_fromModel_null() {
        assertNull(CharacterInstanceResponse.fromModel(null));
    }

    @Test
    void instanceResponse_fromModel_mapsAll() {
        CharacterInstanceResponse r = CharacterInstanceResponse.fromModel(info());
        assertEquals("char-uuid", r.getUuid());
        assertEquals("match-uuid", r.getMatchUuid());
        assertEquals("user-uuid", r.getUserUuid());
        assertEquals("tpl", r.getCharacterTemplateUuid());
        assertEquals("cls", r.getClassUuid());
        assertEquals(19, r.getDexterity());
        assertEquals(18, r.getIntelligence());
        assertEquals(17, r.getConstitution());
        assertEquals(127, r.getEnergy());
        assertEquals(137, r.getLife());
        assertEquals(0, r.getSad());
        assertEquals(90001L, r.getIdLocation());
        assertEquals("loc", r.getLocationUuid());
        assertFalse(r.getIsSleeping());
        assertFalse(r.getIsComa());
        assertEquals(List.of("t1", "t2"), r.getTraitUuids());
        assertEquals(1, r.getFood());
        assertEquals(2, r.getMagic());
        assertEquals(3, r.getCoin());
    }

    @Test
    void instanceResponse_setters() {
        CharacterInstanceResponse r = new CharacterInstanceResponse();
        r.setUuid("u");
        r.setMatchUuid("m");
        r.setUserUuid("usr");
        r.setCharacterTemplateUuid("t");
        r.setClassUuid("c");
        r.setDexterity(1);
        r.setIntelligence(2);
        r.setConstitution(3);
        r.setEnergy(4);
        r.setLife(5);
        r.setSad(6);
        r.setIdLocation(7L);
        r.setLocationUuid("l");
        r.setIsSleeping(true);
        r.setIsComa(true);
        r.setTraitUuids(List.of("x"));
        r.setFood(8);
        r.setMagic(9);
        r.setCoin(10);
        assertEquals("u", r.getUuid());
        assertEquals("m", r.getMatchUuid());
        assertEquals("usr", r.getUserUuid());
        assertTrue(r.getIsSleeping());
        assertEquals(10, r.getCoin());
    }

    @Test
    void summaryResponse_fromModel_null() {
        assertNull(CharacterSummaryResponse.fromModel(null));
    }

    @Test
    void summaryResponse_fromModel_mapsSubset() {
        CharacterSummaryResponse r = CharacterSummaryResponse.fromModel(info());
        assertEquals("char-uuid", r.getUuid());
        assertEquals("user-uuid", r.getUserUuid());
        assertEquals("tpl", r.getCharacterTemplateUuid());
        assertEquals(19, r.getDexterity());
        assertEquals(137, r.getLife());
        assertEquals(90001L, r.getIdLocation());
        assertFalse(r.getIsSleeping());
        assertFalse(r.getIsComa());
        assertEquals("cls", r.getClassUuid());
        assertEquals(List.of("t1", "t2"), r.getTraitUuids());
    }

    @Test
    void summaryResponse_setters() {
        CharacterSummaryResponse r = new CharacterSummaryResponse();
        r.setUuid("u");
        r.setUserUuid("usr");
        r.setCharacterTemplateUuid("t");
        r.setDexterity(1);
        r.setIntelligence(2);
        r.setConstitution(3);
        r.setEnergy(4);
        r.setLife(5);
        r.setSad(6);
        r.setIdLocation(7L);
        r.setIsSleeping(true);
        r.setIsComa(true);
        r.setClassUuid("cls");
        r.setTraitUuids(List.of("t1"));
        assertEquals("u", r.getUuid());
        assertEquals(2, r.getIntelligence());
        assertEquals("cls", r.getClassUuid());
        assertEquals(List.of("t1"), r.getTraitUuids());
    }

    @Test
    void matchInfoResponse_includesPlayers() {
        MatchDetail d = new MatchDetail();
        MatchSummary s = new MatchSummary();
        s.setUuid("match-uuid");
        d.setMatch(s);
        d.setPlayers(List.of(info()));

        MatchInfoResponse r = MatchInfoResponse.fromModel(d);
        assertEquals(1, r.getPlayers().size());
        assertEquals("char-uuid", r.getPlayers().get(0).getUuid());

        r.setPlayers(List.of());
        assertTrue(r.getPlayers().isEmpty());
    }
}
