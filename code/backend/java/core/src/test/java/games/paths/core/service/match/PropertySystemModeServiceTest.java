package games.paths.core.service.match;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class PropertySystemModeServiceTest {

    @Test
    void maintenanceTrueWhenStatusEqualsMaintenanceCaseInsensitive() {
        assertTrue(new PropertySystemModeService("MAINTENANCE").isMaintenance());
        assertTrue(new PropertySystemModeService("maintenance").isMaintenance());
        assertTrue(new PropertySystemModeService("MainTenance").isMaintenance());
    }

    @Test
    void maintenanceFalseForOtherStatus() {
        assertFalse(new PropertySystemModeService("OK").isMaintenance());
        assertFalse(new PropertySystemModeService("").isMaintenance());
        assertFalse(new PropertySystemModeService(null).isMaintenance());
    }
}
