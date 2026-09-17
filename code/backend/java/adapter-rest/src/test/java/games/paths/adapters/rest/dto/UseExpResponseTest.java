package games.paths.adapters.rest.dto;

import games.paths.core.port.match.ExperiencePort.StatChange;
import games.paths.core.port.match.ExperiencePort.UseExpResult;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Step 38 — the use-exp projection and its setters. */
class UseExpResponseTest {

    @Test
    void fromModelCopiesEverything() {
        UseExpResult m = new UseExpResult("m1", "c1", "cos", 4, 5, 10, 6, 4, Map.of("cos", 5),
                List.of(new StatChange("c1", "cos", 4, 5, 1)));
        UseExpResponse r = UseExpResponse.fromModel(m);
        assertEquals("m1", r.getMatchUuid());
        assertEquals("c1", r.getCharacterUuid());
        assertEquals("cos", r.getStat());
        assertEquals(4, r.getStatBefore());
        assertEquals(5, r.getStatAfter());
        assertEquals(10, r.getExpBefore());
        assertEquals(6, r.getExpAfter());
        assertEquals(4, r.getExpCost());
        assertEquals(5, r.getExpCosts().get("cos"));
        assertEquals(1, r.getStatChanges().size());
        assertEquals("cos", r.getStatChanges().get(0).getStatistic());
        assertEquals(1, r.getStatChanges().get(0).getDelta());
        assertEquals("c1", r.getStatChanges().get(0).getCharacterUuid());
        assertEquals(4, r.getStatChanges().get(0).getBefore());
        assertEquals(5, r.getStatChanges().get(0).getAfter());
    }

    @Test
    void nullCollectionsStayHarmless() {
        UseExpResponse r = UseExpResponse.fromModel(new UseExpResult("m", "c", "dex", 1, 2, 3, 2, 1, null, null));
        assertNull(r.getExpCosts());
        assertTrue(r.getStatChanges().isEmpty());
    }

    @Test
    void setters() {
        UseExpResponse r = new UseExpResponse();
        r.setMatchUuid("m"); r.setCharacterUuid("c"); r.setStat("int");
        r.setStatBefore(1); r.setStatAfter(2); r.setExpBefore(9); r.setExpAfter(7); r.setExpCost(2);
        r.setExpCosts(Map.of("int", 3));
        UseExpResponse.StatChangeDto d = new UseExpResponse.StatChangeDto();
        d.setCharacterUuid("c"); d.setStatistic("int"); d.setBefore(1); d.setAfter(2); d.setDelta(1);
        r.setStatChanges(List.of(d));
        assertEquals("m", r.getMatchUuid());
        assertEquals("c", r.getCharacterUuid());
        assertEquals("int", r.getStat());
        assertEquals(1, r.getStatBefore());
        assertEquals(2, r.getStatAfter());
        assertEquals(9, r.getExpBefore());
        assertEquals(7, r.getExpAfter());
        assertEquals(2, r.getExpCost());
        assertEquals(3, r.getExpCosts().get("int"));
        assertEquals("int", r.getStatChanges().get(0).getStatistic());
        UseExpRequest q = new UseExpRequest();
        q.setStat("dex");
        assertEquals("dex", q.getStat());
    }
}
