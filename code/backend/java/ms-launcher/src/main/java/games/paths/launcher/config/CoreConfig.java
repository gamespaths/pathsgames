package games.paths.launcher.config;

import games.paths.core.port.EchoPort;
import games.paths.core.port.auth.GuestAdminPersistencePort;
import games.paths.core.port.auth.GuestPersistencePort;
import games.paths.core.port.auth.JwtPort;
import games.paths.core.port.auth.GuestAdminPort;
import games.paths.core.port.auth.GuestAuthPort;
import games.paths.core.port.auth.SessionPort;
import games.paths.core.port.auth.TokenPersistencePort;
import games.paths.core.port.dev.TestDataCleanupPort;
import games.paths.core.port.story.StoryCrudPort;
import games.paths.core.port.story.StoryImportPort;
import games.paths.core.port.story.StoryPersistencePort;
import games.paths.core.port.story.StoryQueryPort;
import games.paths.core.port.story.StoryReadPort;
import games.paths.core.port.story.StoryValidatorPort;
import games.paths.core.port.story.ContentQueryPort;
import games.paths.core.port.match.CharacterCommandPort;
import games.paths.core.port.match.CharacterPersistencePort;
import games.paths.core.port.match.CharacterQueryPort;
import games.paths.core.port.match.CharacterReadPort;
import games.paths.core.port.match.MatchCommandPort;
import games.paths.core.port.match.MatchPersistencePort;
import games.paths.core.port.match.MatchQueryPort;
import games.paths.core.port.match.MatchReadPort;
import games.paths.core.port.match.SystemModePort;
import games.paths.core.port.match.UserAccessPort;
import games.paths.core.port.turnstile.TurnstileVerificationPort;
import games.paths.launcher.adapter.turnstile.TurnstileVerificationAdapter;
import games.paths.core.service.EchoService;
import games.paths.core.service.auth.GuestAdminService;
import games.paths.core.service.auth.GuestAuthService;
import games.paths.core.service.auth.SessionService;
import games.paths.core.service.dev.TestDataCleanupService;
import games.paths.core.service.story.StoryCrudService;
import games.paths.core.service.story.StoryImportService;
import games.paths.core.service.story.StoryQueryService;
import games.paths.core.service.story.StoryValidatorService;
import games.paths.core.service.story.ContentQueryService;
import games.paths.core.service.match.CharacterCommandService;
import games.paths.core.service.match.CharacterQueryService;
import games.paths.core.service.match.MatchCommandService;
import games.paths.core.service.match.MatchQueryService;
import games.paths.core.service.match.PropertySystemModeService;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.web.client.RestTemplate;

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

    @Value("${game.turnstile.secret-key:}")
    private String turnstileSecretKey;

    @Value("${game.turnstile.bypass-token:}")
    private String turnstileBypassToken;

    @Value("${game.env:dev}")
    private String gameEnv;

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
    public StoryValidatorPort storyValidatorPort(StoryReadPort storyReadPort) {
        return new StoryValidatorService(storyReadPort);
    }

    @Bean
    public StoryImportPort storyImportPort(StoryPersistencePort storyPersistencePort,
            StoryValidatorPort storyValidatorPort) {
        return new StoryImportService(storyPersistencePort, storyValidatorPort);
    }

    @Bean
    public ContentQueryPort contentQueryPort(StoryReadPort storyReadPort) {
        return new ContentQueryService(storyReadPort);
    }

    @Bean
    public StoryCrudPort storyCrudPort(StoryReadPort storyReadPort, StoryPersistencePort storyPersistencePort,
            StoryValidatorPort storyValidatorPort) {
        return new StoryCrudService(storyReadPort, storyPersistencePort, storyValidatorPort);
    }

    // ───── Step 19: Single-player match creation ─────

    @Bean
    public SystemModePort systemModePort() {
        return new PropertySystemModeService(serverStatus);
    }

    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }

    @Bean
    public TurnstileVerificationPort turnstileVerificationPort(RestTemplate restTemplate) {
        return new TurnstileVerificationAdapter(
                turnstileSecretKey, turnstileBypassToken, gameEnv, restTemplate);
    }

    @Bean
    public MatchCommandPort matchCommandPort(StoryReadPort storyReadPort,
                                             MatchPersistencePort matchPersistencePort,
                                             UserAccessPort userAccessPort,
                                             SystemModePort systemModePort,
                                             TurnstileVerificationPort turnstileVerificationPort) {
        return new MatchCommandService(storyReadPort, matchPersistencePort,
                userAccessPort, systemModePort, turnstileVerificationPort);
    }

    @Bean
    public MatchQueryPort matchQueryPort(MatchReadPort matchReadPort,
                                         StoryReadPort storyReadPort,
                                         UserAccessPort userAccessPort,
                                         CharacterReadPort characterReadPort) {
        return new MatchQueryService(matchReadPort, storyReadPort, userAccessPort, characterReadPort);
    }

    // ───── Step 24: Turn cycle engine (single-player) ─────

    @Bean
    public games.paths.core.port.match.TurnCyclePort turnCyclePort(
            games.paths.core.port.match.TurnCycleStorePort turnCycleStorePort,
            UserAccessPort userAccessPort) {
        return new games.paths.core.service.match.TurnCycleService(turnCycleStorePort, userAccessPort);
    }

    // ───── Step 25: Time advancement & clock cycle (single-player) ─────

    @Bean
    public games.paths.core.port.event.DomainEventPublisher domainEventPublisher() {
        return new games.paths.core.service.event.InProcessDomainEventPublisher();
    }

    @Bean
    public games.paths.core.port.match.TimeAdvancementPort timeAdvancementPort(
            games.paths.core.port.match.TurnCycleStorePort turnCycleStorePort,
            UserAccessPort userAccessPort,
            games.paths.core.port.event.DomainEventPublisher domainEventPublisher) {
        return new games.paths.core.service.match.TimeAdvancementService(
                turnCycleStorePort, userAccessPort, domainEventPublisher);
    }

    // ───── Step 21: Character template & class selection ─────

    @Bean
    public CharacterCommandPort characterCommandPort(StoryReadPort storyReadPort,
                                                     MatchReadPort matchReadPort,
                                                     UserAccessPort userAccessPort,
                                                     CharacterPersistencePort characterPersistencePort) {
        return new CharacterCommandService(storyReadPort, matchReadPort,
                userAccessPort, characterPersistencePort);
    }

    @Bean
    public CharacterQueryPort characterQueryPort(MatchReadPort matchReadPort,
                                                 CharacterReadPort characterReadPort,
                                                 StoryReadPort storyReadPort,
                                                 UserAccessPort userAccessPort) {
        return new CharacterQueryService(matchReadPort, characterReadPort,
                storyReadPort, userAccessPort);
    }

    // ───── Dev-only test-data cleanup ─────

    @Bean
    public TestDataCleanupPort testDataCleanupPort(GuestAdminPersistencePort guestAdminPersistencePort,
                                                   MatchPersistencePort matchPersistencePort) {
        return new TestDataCleanupService(guestAdminPersistencePort, matchPersistencePort);
    }
}
