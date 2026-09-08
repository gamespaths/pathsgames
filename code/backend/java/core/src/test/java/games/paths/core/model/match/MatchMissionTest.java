package games.paths.core.model.match;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("MatchMission / MatchMissionStep (Step 37)")
class MatchMissionTest {

    @Test
    @DisplayName("a mission carries what the story authored and what only this match knows")
    void mission() {
        MatchMission m = new MatchMission();
        m.setUuid("m-1");
        m.setName("Complete the Tutorial");
        m.setDescription("desc");
        m.setIdCard(9);
        m.setCard(null);
        m.setStatus("ACTIVE");
        m.setStepReached(2);
        m.setStepsTotal(3);
        m.setSteps(List.of(new MatchMissionStep()));

        assertAll(
                () -> assertEquals("m-1", m.getUuid()),
                () -> assertEquals("Complete the Tutorial", m.getName()),
                () -> assertEquals("desc", m.getDescription()),
                () -> assertEquals(9, m.getIdCard()),
                () -> assertNull(m.getCard()),
                () -> assertEquals("ACTIVE", m.getStatus()),
                () -> assertEquals(2, m.getStepReached()),
                () -> assertEquals(3, m.getStepsTotal()),
                () -> assertEquals(1, m.getSteps().size()));
    }

    @Test
    @DisplayName("a fresh mission has no steps rather than a null list a caller must guard")
    void freshMissionHasAnEmptyList() {
        assertTrue(new MatchMission().getSteps().isEmpty());
    }

    @Test
    @DisplayName("a step carries its place and the only state it has, whether it is closed")
    void step() {
        MatchMissionStep s = new MatchMissionStep();
        s.setUuid("s-1");
        s.setStep(1);
        s.setName("Visit the Movement Room");
        s.setDescription("go there");
        s.setIdCard(4);
        s.setCard(null);
        s.setDone(true);

        assertAll(
                () -> assertEquals("s-1", s.getUuid()),
                () -> assertEquals(1, s.getStep()),
                () -> assertEquals("Visit the Movement Room", s.getName()),
                () -> assertEquals("go there", s.getDescription()),
                () -> assertEquals(4, s.getIdCard()),
                () -> assertNull(s.getCard()),
                () -> assertTrue(s.isDone()));
    }
}
