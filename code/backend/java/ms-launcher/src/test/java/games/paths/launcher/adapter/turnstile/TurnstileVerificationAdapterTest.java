package games.paths.launcher.adapter.turnstile;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TurnstileVerificationAdapterTest {

    @Test
    void emptySecretKey_bypassesValidation() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        TurnstileVerificationAdapter adapter =
                new TurnstileVerificationAdapter("", "0xROBOT", "prod", restTemplate);

        assertTrue(adapter.verify("anything", null));
        assertTrue(adapter.verify(null, null));
        verify(restTemplate, never()).postForObject(any(String.class), any(), eq(Map.class));
    }

    @Test
    void bypassTokenMatch_returnsTrueInNonProd_withoutCallingCloudflare() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        TurnstileVerificationAdapter adapter =
                new TurnstileVerificationAdapter("real-secret", "0xROBOT", "test", restTemplate);

        assertTrue(adapter.verify("0xROBOT", null));
        verify(restTemplate, never()).postForObject(any(String.class), any(), eq(Map.class));
    }

    @Test
    void mismatchedBypassToken_callsCloudflare() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.postForObject(any(String.class), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(Map.of("success", false));
        TurnstileVerificationAdapter adapter =
                new TurnstileVerificationAdapter("real-secret", "0xROBOT", "test", restTemplate);

        assertFalse(adapter.verify("other-token", null));
    }

    @Test
    void emptyBypassToken_neverShortCircuits() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        TurnstileVerificationAdapter adapter =
                new TurnstileVerificationAdapter("real-secret", "", "test", restTemplate);

        assertFalse(adapter.verify(null, null));
        assertFalse(adapter.verify("", null));
    }

    @Test
    void bypassTokenIgnoredInProd_callsCloudflare() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.postForObject(any(String.class), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(Map.of("success", false));
        TurnstileVerificationAdapter adapter =
                new TurnstileVerificationAdapter("real-secret", "0xROBOT", "prod", restTemplate);

        assertFalse(adapter.verify("0xROBOT", null));
        verify(restTemplate).postForObject(any(String.class), any(HttpEntity.class), eq(Map.class));
    }

    @Test
    void validToken_returnsTrueOnSuccess() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.postForObject(any(String.class), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(Map.of("success", true));
        TurnstileVerificationAdapter adapter =
                new TurnstileVerificationAdapter("real-secret", "", "test", restTemplate);

        assertTrue(adapter.verify("valid-cf-token", "1.2.3.4"));
    }

    /** The error-codes are the only way to tell a wrong secret from a reused or
     * expired token, so they must reach the logs. */
    @Test
    void refusal_logsTheCloudflareErrorCodes() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.postForObject(any(String.class), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(Map.of("success", false, "error-codes", java.util.List.of("timeout-or-duplicate")));
        TurnstileVerificationAdapter adapter =
                new TurnstileVerificationAdapter("real-secret", "", "test", restTemplate);

        ListAppender<ILoggingEvent> appender = attachAppender();
        assertFalse(adapter.verify("burnt-token", null));
        assertTrue(appender.list.stream()
                .anyMatch(e -> e.getFormattedMessage().contains("timeout-or-duplicate")));
    }

    @Test
    void nullResponseFromCloudflare_refuses() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.postForObject(any(String.class), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(null);
        TurnstileVerificationAdapter adapter =
                new TurnstileVerificationAdapter("real-secret", "", "test", restTemplate);

        assertFalse(adapter.verify("some-token", null));
    }

    @Test
    void transportFailure_isLoggedAndRefuses() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.postForObject(any(String.class), any(HttpEntity.class), eq(Map.class)))
                .thenThrow(new IllegalStateException("boom"));
        TurnstileVerificationAdapter adapter =
                new TurnstileVerificationAdapter("real-secret", "", "test", restTemplate);

        ListAppender<ILoggingEvent> appender = attachAppender();
        assertFalse(adapter.verify("some-token", null));
        assertTrue(appender.list.stream().anyMatch(e -> e.getFormattedMessage().contains("boom")));
    }

    /** Captures the adapter's own log events for the assertions above. */
    private static ListAppender<ILoggingEvent> attachAppender() {
        Logger logger = (Logger) LoggerFactory.getLogger(TurnstileVerificationAdapter.class);
        logger.setLevel(Level.WARN);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        return appender;
    }

    @Test
    void legacyTwoArgConstructor_stillWorks() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        TurnstileVerificationAdapter adapter =
                new TurnstileVerificationAdapter("", restTemplate);
        assertTrue(adapter.verify("anything", null));
    }
}
