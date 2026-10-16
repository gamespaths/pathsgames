package games.paths.adapters.rest.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import games.paths.core.model.match.EventInfo;
import games.paths.core.model.match.LocationNeighborInfo;
import games.paths.core.model.match.RegistryLock;
import games.paths.core.port.match.EventExecutionPort.PendingChoice;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** V1 step 1 - the {@code registryLock} field on events, neighbors and pending choices. */
@DisplayName("RegistryLock DTO mapping (V1 step 1)")
class RegistryLockResponseTest {

    private static final RegistryLock LOCK =
            new RegistryLock("FORBIDDEN", false, "gate", "Gate key", "!=", "open");

    @Test
    @DisplayName("maps every field, null in gives null out")
    void fromModel() {
        RegistryLockResponse d = RegistryLockResponse.fromModel(LOCK);
        assertAll(
                () -> assertEquals("FORBIDDEN", d.getMode()),
                () -> assertFalse(d.isHidden()),
                () -> assertEquals("gate", d.getKey()),
                () -> assertEquals("Gate key", d.getKeyTitle()),
                () -> assertEquals("!=", d.getOperator()),
                () -> assertEquals("open", d.getValue()));
        assertNull(RegistryLockResponse.fromModel(null));
    }

    @Test
    @DisplayName("setters round-trip")
    void setters() {
        RegistryLockResponse d = new RegistryLockResponse();
        d.setMode("MISSING");
        d.setHidden(true);
        d.setKey("k");
        d.setKeyTitle("t");
        d.setOperator(">");
        d.setValue("3");
        assertAll(
                () -> assertEquals("MISSING", d.getMode()),
                () -> assertTrue(d.isHidden()),
                () -> assertEquals("k", d.getKey()),
                () -> assertEquals("t", d.getKeyTitle()),
                () -> assertEquals(">", d.getOperator()),
                () -> assertEquals("3", d.getValue()));
    }

    @Test
    @DisplayName("event, neighbor and pending choice DTOs carry the lock; JSON keeps hidden nulls")
    void carriedByTheDtos() throws Exception {
        EventInfo e = new EventInfo("e", "NORMAL", false, null, false,
                "REGISTRY_CONDITION_NOT_MET", 0);
        e.setRegistryLock(LOCK.asHidden());
        LocationNeighborInfo n = new LocationNeighborInfo(1L, "n", "N", 0, 0, null, 0, 1L, 2L,
                null, null, null, false, "MOVEMENT_CONDITION_NOT_MET");
        n.setRegistryLock(LOCK);
        PendingChoice c = new PendingChoice("c", 1, "x", "y", null, false,
                "CONDITION_KEYS_NOT_MET", LOCK);

        MatchInfoResponse.EventInfoDto ed = MatchInfoResponse.EventInfoDto.fromModel(e);
        MatchInfoResponse.LocationNeighborDto nd = MatchInfoResponse.LocationNeighborDto.fromModel(n);
        ExecuteEventResponse.PendingChoiceDto cd = ExecuteEventResponse.PendingChoiceDto.fromModel(c);

        assertTrue(ed.getRegistryLock().isHidden());
        assertEquals("gate", nd.getRegistryLock().getKey());
        assertEquals("Open".toLowerCase(), cd.getRegistryLock().getValue());

        JsonNode json = new ObjectMapper().valueToTree(ed);
        assertTrue(json.get("registryLock").has("key"));
        assertTrue(json.get("registryLock").get("key").isNull());

        ed.setRegistryLock(null);
        nd.setRegistryLock(null);
        cd.setRegistryLock(null);
        assertNull(ed.getRegistryLock());
        assertNull(nd.getRegistryLock());
        assertNull(cd.getRegistryLock());
        assertTrue(new ObjectMapper().valueToTree(nd).get("registryLock").isNull());
    }
}
