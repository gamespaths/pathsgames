package games.paths.launcher.config;

import games.paths.adapters.auth.google.FakeGoogleTokens;
import games.paths.adapters.auth.google.GoogleIdTokenVerifierAdapter;
import games.paths.core.model.auth.UserPreferences;
import games.paths.core.port.auth.AccountGuardPort;
import games.paths.core.port.auth.AccountPort;
import games.paths.core.port.auth.AdminInterventionPort;
import games.paths.core.port.auth.AdminBootstrapPort;
import games.paths.core.port.auth.GoogleLoginPort;
import games.paths.core.port.auth.GoogleTokenVerifierPort;
import games.paths.core.port.auth.GuestMergePersistencePort;
import games.paths.core.port.auth.GuestPersistencePort;
import games.paths.core.port.auth.IdentityPersistencePort;
import games.paths.core.port.auth.JwtPort;
import games.paths.core.port.auth.TokenPersistencePort;
import games.paths.core.port.auth.UserAdminPersistencePort;
import games.paths.core.port.auth.UserAdminPort;
import games.paths.core.port.auth.UserStatePort;
import games.paths.core.port.match.MatchCommandPort;
import games.paths.core.port.match.MatchPersistencePort;
import games.paths.core.service.auth.AccountGuardService;
import games.paths.core.service.auth.AccountService;
import games.paths.core.service.auth.AdminBootstrapService;
import games.paths.core.service.auth.GoogleLoginService;
import games.paths.core.service.auth.GuestMergeService;
import games.paths.core.service.auth.SubjectHasher;
import games.paths.core.service.auth.UserAdminService;
import games.paths.core.service.auth.UserStateService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * AuthConfig - v1.2.0 wires the Google SSO services: verifier (and the test-only fake provider), login
 * with guest merge, the 60 s user state cache, account deletion and the admin bootstrap.
 * v1.7.0 the account guard (ban hashes, suspension end, re-link) and the admin user management.
 */
@Configuration
public class AuthConfig {

    @Bean
    public FakeGoogleTokens fakeGoogleTokens(
            @Value("${game.dev.test-endpoints-enabled:false}") boolean testEndpointsEnabled,
            @Value("${game.auth.google.client-id:}") String clientId,
            @Value("${game.auth.jwt.secret}") String jwtSecret) {
        return new FakeGoogleTokens(testEndpointsEnabled, clientId, jwtSecret);
    }

    @Bean
    public GoogleTokenVerifierPort googleTokenVerifierPort(@Value("${game.auth.google.client-id:}") String clientId,
                                                           FakeGoogleTokens fakeGoogleTokens) {
        return new GoogleIdTokenVerifierAdapter(clientId, fakeGoogleTokens);
    }

    @Bean
    public UserStatePort userStatePort(IdentityPersistencePort identityPersistencePort) {
        return new UserStateService(identityPersistencePort);
    }

    @Bean
    @SuppressWarnings("java:S107")
    public GoogleLoginPort googleLoginPort(GoogleTokenVerifierPort verifier, IdentityPersistencePort identities,
                                           JwtPort jwtPort, TokenPersistencePort tokens, GuestPersistencePort guests,
                                           GuestMergePersistencePort mergePersistence, UserStatePort userStatePort,
                                           AccountGuardPort accountGuardPort,
                                           @Value("${game.auth.google.enabled:true}") boolean enabled,
                                           @Value("${game.auth.max-tokens-per-user:12}") int maxTokensPerUser) {
        GoogleLoginService service = new GoogleLoginService(verifier, identities, jwtPort, tokens, guests,
                new GuestMergeService(mergePersistence), enabled, maxTokensPerUser);
        service.setUserState(userStatePort);
        service.setAccountGuard(accountGuardPort);
        return service;
    }

    @Bean
    public AccountPort accountPort(IdentityPersistencePort identities, GoogleTokenVerifierPort verifier,
                                   TokenPersistencePort tokens, MatchPersistencePort matches,
                                   UserStatePort userStatePort,
                                   @Value("${game.auth.account.chunk:100}") int chunk,
                                   @Value("${game.auth.account.retention-months:24}") int retentionMonths,
                                   @Value("${game.profile.supported-languages:en,it}") String languages,
                                   @Value("${game.profile.supported-themes:default,high-contrast}") String themes) {
        AccountService service = new AccountService(identities, verifier, tokens, matches, userStatePort);
        service.configure(chunk, retentionMonths);
        service.configurePreferences(UserPreferences.parseList(languages, UserPreferences.DEFAULT_LANGUAGES),
                UserPreferences.parseList(themes, UserPreferences.DEFAULT_THEMES));
        return service;
    }

    @Bean
    public SubjectHasher subjectHasher(
            @Value("${game.auth.banned-subject-pepper:" + SubjectHasher.DEFAULT_PEPPER + "}") String pepper) {
        return new SubjectHasher(pepper);
    }

    @Bean
    public AccountGuardPort accountGuardPort(UserAdminPersistencePort persistence, AdminInterventionPort interventions,
                                             UserStatePort userStatePort, SubjectHasher subjectHasher) {
        return new AccountGuardService(persistence, interventions, userStatePort, subjectHasher);
    }

    @Bean
    @SuppressWarnings("java:S107")
    public UserAdminPort userAdminPort(IdentityPersistencePort identities, UserAdminPersistencePort persistence,
                                       TokenPersistencePort tokens, UserStatePort userStatePort,
                                       AdminInterventionPort interventions, SubjectHasher subjectHasher,
                                       MatchPersistencePort matches, MatchCommandPort matchCommands,
                                       AccountPort accountPort) {
        return new UserAdminService(identities, persistence, tokens, userStatePort, interventions, subjectHasher,
                matches, matchCommands, accountPort);
    }

    @Bean
    public AdminBootstrapPort adminBootstrapPort(IdentityPersistencePort identities, JwtPort jwtPort,
                                                 @Value("${game.admin.token-days:365}") int tokenDays) {
        return new AdminBootstrapService(identities, jwtPort, tokenDays);
    }
}
