package games.paths.launcher.config;

import org.apache.catalina.connector.Connector;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link AdminServerConfig} — verifies the second Tomcat connector is added
 * on the configured admin port.
 */
class AdminServerConfigTest {

    @Test
    @DisplayName("customize adds an additional connector on the admin port")
    void customize_addsAdminConnector() {
        AdminServerConfig config = new AdminServerConfig(8044);
        TomcatServletWebServerFactory factory = new TomcatServletWebServerFactory();

        config.customize(factory);

        List<Connector> connectors = List.copyOf(factory.getAdditionalTomcatConnectors());
        assertEquals(1, connectors.size());
        assertEquals(8044, connectors.get(0).getPort());
    }

    @Test
    @DisplayName("customize honours a custom admin port")
    void customize_honoursCustomPort() {
        AdminServerConfig config = new AdminServerConfig(9099);
        TomcatServletWebServerFactory factory = new TomcatServletWebServerFactory();

        config.customize(factory);

        assertEquals(9099, factory.getAdditionalTomcatConnectors().iterator().next().getPort());
    }
}
