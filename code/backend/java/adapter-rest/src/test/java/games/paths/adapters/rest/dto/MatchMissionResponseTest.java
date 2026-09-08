package games.paths.adapters.rest.dto;

import games.paths.core.model.match.MatchMission;
import games.paths.core.model.match.MatchMissionStep;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("MatchMissionResponse (Step 37)")
class MatchMissionResponseTest {

    @Test
    @DisplayName("the model crosses into the DTO field for field, steps included")
    void fromModel() {
        MatchMissionStep step = new MatchMissionStep();
        step.setUuid("s-1");
        step.setStep(2);
        step.setName("Reach the arena");
        step.setDescription("long");
        step.setIdCard(11);
        step.setDone(true);

        MatchMission m = new MatchMission();
        m.setUuid("m-1");
        m.setName("Tutorial");
        m.setDescription("desc");
        m.setStatus("ACTIVE");
        m.setStepReached(2);
        m.setStepsTotal(3);
        m.setIdCard(9);
        m.setSteps(List.of(step));

        MatchMissionResponse d = MatchMissionResponse.fromModel(m);

        assertEquals("m-1", d.getUuid());
        assertEquals("Tutorial", d.getName());
        assertEquals("desc", d.getDescription());
        assertEquals("ACTIVE", d.getStatus());
        assertEquals(2, d.getStepReached());
        assertEquals(3, d.getStepsTotal());
        assertEquals(9, d.getIdCard());
        assertNull(d.getCard());
        assertEquals(1, d.getSteps().size());

        MatchMissionResponse.StepDto s = d.getSteps().get(0);
        assertEquals("s-1", s.getUuid());
        assertEquals(2, s.getStep());
        assertEquals("Reach the arena", s.getName());
        assertEquals("long", s.getDescription());
        assertEquals(11, s.getIdCard());
        assertTrue(s.isDone());
        assertNull(s.getCard());
    }

    @Test
    @DisplayName("a null model and a null list both read as empty, never as a crash")
    void nulls() {
        assertNull(MatchMissionResponse.fromModel((MatchMission) null).getUuid());
        assertTrue(MatchMissionResponse.fromModel((List<MatchMission>) null).isEmpty());
        assertEquals(1, MatchMissionResponse.fromModel(List.of(new MatchMission())).size());
    }

    @Test
    @DisplayName("every setter round-trips, since the DTO is also what a client deserializes")
    void setters() {
        MatchMissionResponse d = new MatchMissionResponse();
        d.setUuid("u");
        d.setName("n");
        d.setDescription("d");
        d.setStatus("FAILED");
        d.setStepReached(1);
        d.setStepsTotal(2);
        d.setIdCard(3);
        d.setCard(null);
        d.setSteps(List.of());

        assertAll(
                () -> assertEquals("u", d.getUuid()),
                () -> assertEquals("n", d.getName()),
                () -> assertEquals("d", d.getDescription()),
                () -> assertEquals("FAILED", d.getStatus()),
                () -> assertEquals(1, d.getStepReached()),
                () -> assertEquals(2, d.getStepsTotal()),
                () -> assertEquals(3, d.getIdCard()),
                () -> assertNull(d.getCard()),
                () -> assertTrue(d.getSteps().isEmpty()));

        MatchMissionResponse.StepDto s = new MatchMissionResponse.StepDto();
        s.setUuid("s");
        s.setStep(4);
        s.setName("sn");
        s.setDescription("sd");
        s.setIdCard(5);
        s.setCard(null);
        s.setDone(true);

        assertAll(
                () -> assertEquals("s", s.getUuid()),
                () -> assertEquals(4, s.getStep()),
                () -> assertEquals("sn", s.getName()),
                () -> assertEquals("sd", s.getDescription()),
                () -> assertEquals(5, s.getIdCard()),
                () -> assertNull(s.getCard()),
                () -> assertTrue(s.isDone()));
    }
}
