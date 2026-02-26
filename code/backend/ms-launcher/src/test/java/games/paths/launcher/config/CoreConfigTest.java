package games.paths.launcher.config;

import games.paths.core.port.in.EchoPort;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class CoreConfigTest {

    @Autowired
    private EchoPort echoPort;

    @Test
    void echoPort_shouldBeCreatedBySpringContext() {
        assertNotNull(echoPort);
    }

    @Test
    void echoPort_shouldReturnConfiguredStatus() {
        String status = echoPort.getServerStatus();
        assertNotNull(status);
        assertFalse(status.isEmpty());
    }

    @Test
    void echoPort_shouldReturnServerProperties() {
        var props = echoPort.getServerProperties();
        assertNotNull(props);
        assertNotNull(props.get("env"));
        assertNotNull(props.get("version"));
        assertNotNull(props.get("applicationName"));
        assertNotNull(props.get("port"));
        assertNotNull(props.get("javaVersion"));
    }

    @Test
    void echoPort_shouldReturnValidTimestamp() {
        long ts = echoPort.getTimestamp();
        assertTrue(ts > 0);
    }
}
