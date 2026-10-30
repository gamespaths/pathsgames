package games.paths.adapters.rest.filter;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** v1.10.0 {@link RequestPaths}: the routed path and the raw URIs refused before any path check. */
class RequestPathsTest {

    private static HttpServletRequest request(String uri, String context) {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn(uri);
        when(request.getContextPath()).thenReturn(context);
        return request;
    }

    @Test
    @DisplayName("The routed path is decoded, without ;parameters, with single slashes and no context path")
    void routed() {
        assertEquals("/api/admin/users", RequestPaths.routed(request("/api/%61dmin/users", null)));
        assertEquals("/api/admin/users", RequestPaths.routed(request("/api;x=1/admin;y/users", "")));
        assertEquals("/api/admin/users", RequestPaths.routed(request("//api///admin/users", null)));
        assertEquals("/api/admin/users/a@b.com", RequestPaths.routed(request("/ctx/api/admin/users/a%40b.com", "/ctx")));
        assertEquals("/other/api", RequestPaths.routed(request("/other/api", "/ctx")));
        assertEquals("/api/x%zz", RequestPaths.routed(request("/api/x%zz", null)));
        assertNull(RequestPaths.routed(request(null, null)));
    }

    @Test
    @DisplayName("Suspicious: ';', '\\\\', dot segments, broken escapes, needless or dangerous escapes")
    void suspicious() {
        for (String uri : new String[] {"/api/%61dmin/users", "/api;x/admin", "/api/admin;jsessionid=1",
                "/api\\\\admin", "/api/x/../admin", "/api/./admin", "/api/%2e%2e/admin", "/api/%2Fadmin",
                "/api/%5cadmin", "/api/%3Badmin", "/api/%25admin", "/api/%00", "/api/%7f", "/api/%7E", "/api/%2D",
                "/api/x%zz", "/api/x%4", "/api/x%"}) {
            assertTrue(RequestPaths.isSuspicious(uri), uri);
        }
        for (String uri : new String[] {"/api/admin/users", "/api/admin/users/mario%40gmail.com",
                "/api/admin/users/a%2Bb%40gmail.com", "/api/stories/%C3%A8", "/api/x%20y", "/api/x.y/z..w", "/"}) {
            assertFalse(RequestPaths.isSuspicious(uri), uri);
        }
        assertFalse(RequestPaths.isSuspicious(null));
    }
}
