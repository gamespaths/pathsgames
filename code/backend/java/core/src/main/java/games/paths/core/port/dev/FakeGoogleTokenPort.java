package games.paths.core.port.dev;

import java.util.Map;

/**
 * FakeGoogleTokenPort - v1.2.0 test-only Google provider: mints ID tokens the verifier accepts only
 * while the test endpoints are enabled (Robot suites); off in the prod profile.
 */
public interface FakeGoogleTokenPort {

    boolean isEnabled();

    /** A signed fake ID token; claims not given get defaults (aud = client id, exp = now + 1 h). */
    String mint(Map<String, Object> claims);
}
