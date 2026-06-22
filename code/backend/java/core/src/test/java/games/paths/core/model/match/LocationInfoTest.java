package games.paths.core.model.match;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class LocationInfoTest {

    @Test
    void constructorAndGetters() {
        LocationNeighborInfo neighbor = new LocationNeighborInfo(2L, "n-uuid", "NORTH", 0, 1, null, 5);
        LocationInfo loc = new LocationInfo(1L, "loc-uuid", 10, null, List.of(neighbor), List.of(), 7);

        assertEquals(1L, loc.getIdLocation());
        assertEquals("loc-uuid", loc.getUuid());
        assertEquals(10, loc.getIdCard());
        assertNull(loc.getCard());
        assertEquals(1, loc.getNeighbors().size());
        assertEquals(0, loc.getEvents().size());
        assertEquals(7, loc.getSecureParam());
    }

    @Test
    void nullNeighborsAndEventsDefaultToEmptyList() {
        LocationInfo loc = new LocationInfo(1L, "u", 1, null, null, null, null);
        assertNotNull(loc.getNeighbors());
        assertNotNull(loc.getEvents());
        assertTrue(loc.getNeighbors().isEmpty());
        assertTrue(loc.getEvents().isEmpty());
    }

    @Test
    void locationNeighborInfoGetters() {
        LocationNeighborInfo n = new LocationNeighborInfo(3L, "n-uuid", "SOUTH", 1, 2, null, 4);
        assertEquals(3L, n.getIdLocation());
        assertEquals("n-uuid", n.getUuid());
        assertEquals("SOUTH", n.getDirection());
        assertEquals(1, n.getFlagBack());
        assertEquals(2, n.getEnergyCost());
        assertNull(n.getCard());
        assertEquals(4, n.getSecureParam());
    }
}
