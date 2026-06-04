package games.paths.launcher.config;

import org.apache.catalina.connector.Connector;
import org.apache.coyote.http11.Http11NioProtocol;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.context.annotation.Configuration;

/**
 * AdminServerConfig - adds a second embedded-Tomcat connector dedicated to the admin API.
 *
 * <p>The primary connector keeps listening on {@code server.port} (8042 dev / 8080 prod)
 * and serves the public/player API. This customizer adds an additional connector on
 * {@code game.admin.port} (default 8044) so that {@code /api/admin/**} can be served on a
 * separate, IP-restrictable network boundary. The {@code AdminPortFilter} enforces which
 * paths each connector is allowed to answer.</p>
 */
@Configuration
public class AdminServerConfig implements WebServerFactoryCustomizer<TomcatServletWebServerFactory> {

    private final int adminPort;

    public AdminServerConfig(@Value("${game.admin.port:8044}") int adminPort) {
        this.adminPort = adminPort;
    }

    @Override
    public void customize(TomcatServletWebServerFactory factory) {
        Connector adminConnector = new Connector(Http11NioProtocol.class.getName());
        adminConnector.setPort(adminPort);
        factory.addAdditionalTomcatConnectors(adminConnector);
    }
}
