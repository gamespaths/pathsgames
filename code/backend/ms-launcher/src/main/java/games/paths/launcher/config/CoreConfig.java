package games.paths.launcher.config;

import games.paths.core.port.in.EchoPort;
import games.paths.core.service.EchoService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * CoreConfig - Wires domain services as Spring beans.
 * Injects profile-specific properties into pure-Java domain services.
 */
@Configuration
public class CoreConfig {

    @Value("${game.server.status:UNKNOWN}")
    private String serverStatus;

    @Value("${game.server.env:unknown}")
    private String serverEnv;

    @Value("${game.server.version:0.0.0-SNAPSHOT}")
    private String serverVersion;

    @Value("${spring.application.name:paths-game-backend}")
    private String applicationName;

    @Value("${server.port:8080}")
    private String serverPort;

    @Bean
    public EchoPort echoPort() {
        Map<String, String> properties = new LinkedHashMap<>();
        properties.put("env", serverEnv);
        properties.put("version", serverVersion);
        properties.put("applicationName", applicationName);
        properties.put("port", serverPort);
        properties.put("javaVersion", System.getProperty("java.version"));
        return new EchoService(serverStatus, properties);
    }
}
