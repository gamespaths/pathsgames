package games.paths.launcher.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import games.paths.core.port.EchoPort;
import games.paths.core.port.story.StoryCrudPort;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class CoreConfigTest {

    @Autowired
    private EchoPort echoPort;

    @Autowired
    private StoryCrudPort storyCrudPort;

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

    @Test
    void storyCrudPort_shouldBeCreatedBySpringContext() {
        assertNotNull(storyCrudPort);
    }
}
