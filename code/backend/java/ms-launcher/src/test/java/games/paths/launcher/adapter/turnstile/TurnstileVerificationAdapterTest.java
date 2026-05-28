package games.paths.launcher.adapter.turnstile;

import org.junit.jupiter.api.Test;
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

    @Test
    void legacyTwoArgConstructor_stillWorks() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        TurnstileVerificationAdapter adapter =
                new TurnstileVerificationAdapter("", restTemplate);
        assertTrue(adapter.verify("anything", null));
    }
}
