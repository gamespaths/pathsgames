package games.paths.adapters.auth.google;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.client.json.webtoken.JsonWebSignature;
import games.paths.core.model.auth.AuthException;
import games.paths.core.model.auth.GoogleIdentityClaims;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests of the v1.2.0 Google verifier adapter and the test-only fake provider.
 */
class GoogleVerifierTest {

    private static final String SECRET = "PathsGamesDevSecret2026_MustBeAtLeast32Chars!";
    private static final String CLIENT = "client.apps.googleusercontent.com";

    private static String unsignedGoogleToken(Map<String, Object> claims) {
        Base64.Encoder enc = Base64.getUrlEncoder().withoutPadding();
        String header = enc.encodeToString("{\"alg\":\"RS256\",\"kid\":\"google-kid\"}".getBytes(StandardCharsets.UTF_8));
        StringBuilder json = new StringBuilder("{");
        claims.forEach((k, v) -> json.append(json.length() > 1 ? "," : "").append('"').append(k).append("\":")
                .append(v instanceof String ? "\"" + v + "\"" : String.valueOf(v)));
        json.append('}');
        return header + "." + enc.encodeToString(json.toString().getBytes(StandardCharsets.UTF_8)) + "."
                + enc.encodeToString("sig".getBytes(StandardCharsets.UTF_8));
    }

    private static Map<String, Object> googleClaims() {
        Map<String, Object> c = new HashMap<>();
        c.put("iss", "https://accounts.google.com");
        c.put("aud", CLIENT);
        c.put("sub", "sub-1");
        c.put("email", "mario@gmail.com");
        c.put("email_verified", true);
        c.put("name", "Mario Rossi");
        c.put("given_name", "Mario");
        c.put("family_name", "Rossi");
        c.put("picture", "https://lh3.googleusercontent.com/p");
        c.put("locale", "it");
        c.put("nonce", "n");
        c.put("exp", 2_000_000_000L);
        c.put("iat", 1_900_000_000L);
        return c;
    }

    @Test
    void fakeTokensRoundTripWhenEnabled() {
        FakeGoogleTokens fake = new FakeGoogleTokens(true, CLIENT, SECRET);
        assertTrue(fake.isEnabled());
        Map<String, Object> claims = new HashMap<>(Map.of("sub", "sub-1", "email", "mario@gmail.com", "nonce", "n",
                "given_name", "Mario", "expOffsetSeconds", "120", "iatOffsetSeconds", -10));
        String token = fake.mint(claims);
        assertTrue(FakeGoogleTokens.isFake(token));
        GoogleIdentityClaims c = fake.verify(token);
        assertEquals("sub-1", c.subject());
        assertEquals(CLIENT, c.audience());
        assertEquals("https://accounts.google.com", c.issuer());
        assertTrue(c.emailVerified());
        assertEquals("Mario", c.givenName());
        assertEquals("n", c.nonce());
        assertTrue(c.expiresAt() > c.issuedAt());
    }

    @Test
    void fakeTokenOverridesAndExpiry() {
        FakeGoogleTokens fake = new FakeGoogleTokens(true, CLIENT, SECRET);
        GoogleIdentityClaims c = fake.verify(fake.mint(Map.of("sub", "s", "aud", "other", "iss", "evil",
                "email_verified", false, "expOffsetSeconds", "x")));
        assertEquals("other", c.audience());
        assertEquals("evil", c.issuer());
        assertFalse(c.emailVerified());
        String expired = fake.mint(Map.of("sub", "s", "expOffsetSeconds", -120));
        assertEquals(AuthException.Code.INVALID_TOKEN,
                assertThrows(AuthException.class, () -> fake.verify(expired)).getCode());
        assertEquals(AuthException.Code.INVALID_TOKEN,
                assertThrows(AuthException.class, () -> fake.verify("a.b.c")).getCode());
        assertNotNull(fake.mint(null));
    }

    @Test
    void fakeProviderIsOffWithoutTheTestEndpoints() {
        FakeGoogleTokens on = new FakeGoogleTokens(true, CLIENT, SECRET);
        FakeGoogleTokens off = new FakeGoogleTokens(false, CLIENT, SECRET);
        String token = on.mint(Map.of("sub", "s"));
        assertFalse(off.isEnabled());
        assertThrows(IllegalStateException.class, () -> off.mint(Map.of()));
        assertThrows(AuthException.class, () -> off.verify(token));
        // with the provider off a fake token goes to the Google check, whose signature check refuses it
        assertThrows(AuthException.class, () -> new GoogleIdTokenVerifierAdapter(CLIENT, off,
                GsonFactory.getDefaultInstance(), t -> false).verify(token));
    }

    @Test
    void fakeKeyDependsOnTheSecret() {
        String token = new FakeGoogleTokens(true, CLIENT, SECRET).mint(Map.of("sub", "s"));
        FakeGoogleTokens other = new FakeGoogleTokens(true, CLIENT, SECRET + "-other-stage");
        assertThrows(AuthException.class, () -> other.verify(token));
        assertEquals(32, FakeGoogleTokens.deriveKey(SECRET).length);
    }

    @Test
    void isFakeGuards() {
        assertFalse(FakeGoogleTokens.isFake(null));
        assertFalse(FakeGoogleTokens.isFake("nodot"));
        assertFalse(FakeGoogleTokens.isFake("%%%.x.y"));
        assertFalse(FakeGoogleTokens.isFake(unsignedGoogleToken(googleClaims())));
    }

    @Test
    void realTokensGoThroughTheGoogleCheck() {
        String token = unsignedGoogleToken(googleClaims());
        GoogleIdTokenVerifierAdapter ok = new GoogleIdTokenVerifierAdapter(CLIENT, null,
                GsonFactory.getDefaultInstance(), t -> true);
        GoogleIdentityClaims c = ok.verify(token);
        assertEquals("sub-1", c.subject());
        assertEquals(CLIENT, c.audience());
        assertEquals("Rossi", c.familyName());
        assertEquals("it", c.locale());
        assertEquals(2_000_000_000L, c.expiresAt());
        assertEquals(CLIENT, ok.clientId());

        GoogleIdTokenVerifierAdapter refused = new GoogleIdTokenVerifierAdapter(CLIENT, null,
                GsonFactory.getDefaultInstance(), t -> false);
        assertEquals(AuthException.Code.INVALID_TOKEN,
                assertThrows(AuthException.class, () -> refused.verify(token)).getCode());
        GoogleIdTokenVerifierAdapter down = new GoogleIdTokenVerifierAdapter(CLIENT, null,
                GsonFactory.getDefaultInstance(), t -> {
                    throw new IOException("no network");
                });
        assertEquals(AuthException.Code.PROVIDER_UNAVAILABLE,
                assertThrows(AuthException.class, () -> down.verify(token)).getCode());
        GoogleIdTokenVerifierAdapter badKeys = new GoogleIdTokenVerifierAdapter(CLIENT, null,
                GsonFactory.getDefaultInstance(), t -> {
                    throw new GeneralSecurityException("bad cert");
                });
        assertEquals(AuthException.Code.PROVIDER_UNAVAILABLE,
                assertThrows(AuthException.class, () -> badKeys.verify(token)).getCode());
        assertEquals(AuthException.Code.INVALID_TOKEN,
                assertThrows(AuthException.class, () -> ok.verify("garbage")).getCode());
        assertEquals(AuthException.Code.INVALID_TOKEN,
                assertThrows(AuthException.class, () -> ok.verify(null)).getCode());
    }

    @Test
    void toClaimsAudienceShapesAndMissingTimes() {
        GoogleIdToken.Payload p = new GoogleIdToken.Payload();
        p.setAudience(List.of("a", "b"));
        assertEquals("a", GoogleIdTokenVerifierAdapter.toClaims(p).audience());
        p.setAudience(List.of());
        assertNull(GoogleIdTokenVerifierAdapter.toClaims(p).audience());
        p.setAudience(null);
        GoogleIdentityClaims c = GoogleIdTokenVerifierAdapter.toClaims(p);
        assertNull(c.audience());
        assertEquals(0, c.expiresAt());
        assertEquals(0, c.issuedAt());
        assertFalse(c.emailVerified());
        assertNotNull(new JsonWebSignature.Header());
    }

    @Test
    void productionConstructorBuildsTheGoogleVerifier() {
        GoogleIdTokenVerifierAdapter adapter = new GoogleIdTokenVerifierAdapter(CLIENT,
                new FakeGoogleTokens(true, CLIENT, SECRET));
        String fake = new FakeGoogleTokens(true, CLIENT, SECRET).mint(Map.of("sub", "s"));
        assertEquals("s", adapter.verify(fake).subject());
    }
}
