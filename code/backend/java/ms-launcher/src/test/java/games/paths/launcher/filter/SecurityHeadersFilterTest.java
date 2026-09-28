package games.paths.launcher.filter;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

/** v0.41.0 — Step 41 C: the API security headers and the no-store rule. */
class SecurityHeadersFilterTest {

    private MockHttpServletResponse run(String uri) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", uri);
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);
        new SecurityHeadersFilter().doFilter(request, response, chain);
        verify(chain).doFilter(request, response);
        return response;
    }

    @Test
    void everyResponseCarriesTheSecurityHeaders() throws Exception {
        MockHttpServletResponse response = run("/api/stories");

        assertEquals("nosniff", response.getHeader("X-Content-Type-Options"));
        assertEquals("DENY", response.getHeader("X-Frame-Options"));
        assertEquals("no-referrer", response.getHeader("Referrer-Policy"));
        assertEquals("default-src 'none'; frame-ancestors 'none'", response.getHeader("Content-Security-Policy"));
        assertEquals("max-age=31536000", response.getHeader("Strict-Transport-Security"));
        assertNull(response.getHeader("Cache-Control"), "public story reads stay cacheable");
    }

    @Test
    void authAndAdminAnswersAreNeverStored() throws Exception {
        assertEquals("no-store", run("/api/auth/guest").getHeader("Cache-Control"));
        assertEquals("no-store", run("/api/admin/guests").getHeader("Cache-Control"));
        assertNull(run("/api/echo/status").getHeader("Cache-Control"));
    }

    @Test
    void noStoreRule() {
        assertTrue(SecurityHeadersFilter.noStore("/api/auth"));
        assertTrue(SecurityHeadersFilter.noStore("/api/admin"));
        assertFalse(SecurityHeadersFilter.noStore("/api/authors"));
        assertFalse(SecurityHeadersFilter.noStore("/api/administrator"));
        assertFalse(SecurityHeadersFilter.noStore(null));
    }
}
