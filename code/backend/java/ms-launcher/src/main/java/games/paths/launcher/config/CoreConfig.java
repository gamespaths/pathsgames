package games.paths.launcher.config;

import games.paths.core.port.EchoPort;
import games.paths.core.port.auth.GuestAdminPersistencePort;
import games.paths.core.port.auth.GuestPersistencePort;
import games.paths.core.port.auth.JwtPort;
import games.paths.core.port.auth.GuestAdminPort;
import games.paths.core.port.auth.GuestAuthPort;
import games.paths.core.port.auth.SessionPort;
import games.paths.core.port.auth.TokenPersistencePort;
import games.paths.core.port.story.StoryCrudPort;
import games.paths.core.port.story.StoryImportPort;
import games.paths.core.port.story.StoryPersistencePort;
import games.paths.core.port.story.StoryQueryPort;
import games.paths.core.port.story.StoryReadPort;
import games.paths.core.port.story.ContentQueryPort;
import games.paths.core.service.EchoService;
import games.paths.core.service.auth.GuestAdminService;
import games.paths.core.service.auth.GuestAuthService;
import games.paths.core.service.auth.SessionService;
import games.paths.core.service.story.StoryCrudService;
import games.paths.core.service.story.StoryImportService;
import games.paths.core.service.story.StoryQueryService;
import games.paths.core.service.story.ContentQueryService;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * CoreConfig - Wires domain services as Spring beans.
 * Injects profile-specific properties into pure-Java domain services.
 */
@Configuration
@EnableScheduling
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

    @Value("${game.auth.max-tokens-per-user:5}")
    private int maxTokensPerUser;

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

    @Bean
    public GuestAuthPort guestAuthPort(JwtPort jwtPort, GuestPersistencePort persistencePort) {
        return new GuestAuthService(jwtPort, persistencePort);
    }

    @Bean
    public GuestAdminPort guestAdminPort(GuestAdminPersistencePort persistencePort) {
        return new GuestAdminService(persistencePort);
    }

    @Bean
    public SessionPort sessionPort(JwtPort jwtPort, TokenPersistencePort tokenPersistencePort) {
        return new SessionService(jwtPort, tokenPersistencePort, maxTokensPerUser);
    }

    @Bean
    public StoryQueryPort storyQueryPort(StoryReadPort storyReadPort) {
        return new StoryQueryService(storyReadPort);
    }

    @Bean
    public StoryImportPort storyImportPort(StoryPersistencePort storyPersistencePort) {
        return new StoryImportService(storyPersistencePort);
    }

    @Bean
    public ContentQueryPort contentQueryPort(StoryReadPort storyReadPort) {
        return new ContentQueryService(storyReadPort);
    }

    @Bean
    public StoryCrudPort storyCrudPort(StoryReadPort storyReadPort, StoryPersistencePort storyPersistencePort) {
        return new StoryCrudService(storyReadPort, storyPersistencePort);
    }
}
