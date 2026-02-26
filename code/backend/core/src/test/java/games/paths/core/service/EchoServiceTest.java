package games.paths.core.service;

import games.paths.core.service.EchoService;
import games.paths.core.port.in.EchoPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class EchoServiceTest {

    private EchoPort echoPort;

    @BeforeEach
    void setUp() {
        Map<String, String> properties = Map.of(
            "env", "test",
            "version", "1.0.0-TEST",
            "applicationName", "paths-game-test"
        );
        echoPort = new EchoService("OK", properties);
    }

    @Test
    void getServerStatus_shouldReturnConfiguredStatus() {
        assertEquals("OK", echoPort.getServerStatus());
    }

    @Test
    void getServerStatus_shouldReturnCustomStatus() {
        EchoPort custom = new EchoService("MAINTENANCE", Map.of());
        assertEquals("MAINTENANCE", custom.getServerStatus());
    }

    @Test
    void getTimestamp_shouldReturnCurrentTimeApproximately() {
        long before = System.currentTimeMillis();
        long timestamp = echoPort.getTimestamp();
        long after = System.currentTimeMillis();
        assertTrue(timestamp >= before && timestamp <= after);
    }

    @Test
    void getServerProperties_shouldReturnAllConfiguredProperties() {
        Map<String, String> props = echoPort.getServerProperties();
        assertEquals("test", props.get("env"));
        assertEquals("1.0.0-TEST", props.get("version"));
        assertEquals("paths-game-test", props.get("applicationName"));
    }

    @Test
    void getServerProperties_shouldReturnUnmodifiableMap() {
        Map<String, String> props = echoPort.getServerProperties();
        assertThrows(UnsupportedOperationException.class, () -> props.put("new", "value"));
    }

    @Test
    void getServerProperties_shouldHandleEmptyProperties() {
        EchoPort minimal = new EchoService("OK", Map.of());
        assertTrue(minimal.getServerProperties().isEmpty());
    }
}
