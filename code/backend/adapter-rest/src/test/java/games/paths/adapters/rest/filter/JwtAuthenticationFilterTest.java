package games.paths.adapters.rest.filter;

import games.paths.core.model.auth.TokenInfo;
import games.paths.core.port.auth.SessionPort;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link JwtAuthenticationFilter}.
 * Covers all filter branches: public paths, OPTIONS, missing/empty/invalid tokens,
 * admin authorization, and successful authentication.
 */
@ExtendWith(MockitoExtension.class)
class JwtAuthenticationFilterTest {

    @Mock
    private SessionPort sessionPort;

    @Mock
    private HttpServletRequest request;

    @Mock
    private HttpServletResponse response;

    @Mock
    private FilterChain filterChain;

    private JwtAuthenticationFilter filter;

    @BeforeEach
    void setUp() {
        filter = new JwtAuthenticationFilter(
                sessionPort,
                List.of("/api/echo/**", "/api/auth/guest", "/api/auth/refresh"),
                "/api/admin/"
        );
    }

    // ==========================================================================
    // Constructor edge cases
    // ==========================================================================

    @Test
    @DisplayName("Should handle null publicPaths and adminPathPrefix in constructor")
    void constructor_nullLists() {
        JwtAuthenticationFilter f = new JwtAuthenticationFilter(sessionPort, null, null);
        assertNotNull(f);
        // Should use defaults: empty public paths and /api/admin/
        assertFalse(f.isPublicPath("/api/echo"));
        assertTrue(f.isAdminPath("/api/admin/something"));
    }

    // ==========================================================================
    // OPTIONS requests
    // ==========================================================================

    @Test
    @DisplayName("Should pass through OPTIONS requests (CORS preflight)")
    void options_passThrough() throws Exception {
        when(request.getMethod()).thenReturn("OPTIONS");
        when(request.getRequestURI()).thenReturn("/api/auth/me");

        filter.doFilterInternal(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
        verify(response, never()).setStatus(anyInt());
    }

    // ==========================================================================
    // Public path handling
    // ==========================================================================

    @Nested
    @DisplayName("Public Path Tests")
    class PublicPathTests {

        @Test
        @DisplayName("Should pass through exact public path match")
        void exactMatch() throws Exception {
            when(request.getMethod()).thenReturn("POST");
            when(request.getRequestURI()).thenReturn("/api/auth/guest");

            filter.doFilterInternal(request, response, filterChain);
            verify(filterChain).doFilter(request, response);
        }

        @Test
        @DisplayName("Should pass through wildcard public path match")
        void wildcardMatch() throws Exception {
            when(request.getMethod()).thenReturn("GET");
            when(request.getRequestURI()).thenReturn("/api/echo/test");

            filter.doFilterInternal(request, response, filterChain);
            verify(filterChain).doFilter(request, response);
        }

        @Test
        @DisplayName("Should pass through wildcard prefix exact match (without trailing slash)")
        void wildcardPrefixExact() throws Exception {
            when(request.getMethod()).thenReturn("GET");
            when(request.getRequestURI()).thenReturn("/api/echo");

            filter.doFilterInternal(request, response, filterChain);
            verify(filterChain).doFilter(request, response);
        }

        @Test
        @DisplayName("Should NOT pass through non-public path")
        void nonPublicPath() throws Exception {
            when(request.getMethod()).thenReturn("GET");
            when(request.getRequestURI()).thenReturn("/api/auth/me");
            when(request.getHeader("Authorization")).thenReturn(null);

            StringWriter sw = new StringWriter();
            when(response.getWriter()).thenReturn(new PrintWriter(sw));

            filter.doFilterInternal(request, response, filterChain);

            verify(filterChain, never()).doFilter(request, response);
            verify(response).setStatus(401);
        }
    }

    // ==========================================================================
    // isPublicPath method tests
    // ==========================================================================

    @Nested
    @DisplayName("isPublicPath Tests")
    class IsPublicPathTests {

        @Test
        @DisplayName("Should return false for null path")
        void nullPath() {
            assertFalse(filter.isPublicPath(null));
        }

        @Test
        @DisplayName("Should return true for exact match")
        void exactMatch() {
            assertTrue(filter.isPublicPath("/api/auth/guest"));
        }

        @Test
        @DisplayName("Should return true for wildcard match with subpath")
        void wildcardSubpath() {
            assertTrue(filter.isPublicPath("/api/echo/hello/world"));
        }

        @Test
        @DisplayName("Should return true for wildcard match on prefix itself")
        void wildcardPrefixOnly() {
            assertTrue(filter.isPublicPath("/api/echo"));
        }

        @Test
        @DisplayName("Should return false for unmatched path")
        void noMatch() {
            assertFalse(filter.isPublicPath("/api/secured/resource"));
        }
    }

    // ==========================================================================
    // isAdminPath method tests
    // ==========================================================================

    @Nested
    @DisplayName("isAdminPath Tests")
    class IsAdminPathTests {

        @Test
        @DisplayName("Should return true for admin path")
        void adminPath() {
            assertTrue(filter.isAdminPath("/api/admin/users"));
        }

        @Test
        @DisplayName("Should return false for non-admin path")
        void nonAdminPath() {
            assertFalse(filter.isAdminPath("/api/auth/me"));
        }

        @Test
        @DisplayName("Should return false for null path")
        void nullPath() {
            assertFalse(filter.isAdminPath(null));
        }
    }

    // ==========================================================================
    // Missing / Empty Authorization header
    // ==========================================================================

    @Nested
    @DisplayName("Authorization Header Tests")
    class AuthHeaderTests {

        @Test
        @DisplayName("Should return 401 when Authorization header is missing")
        void missingHeader() throws Exception {
            when(request.getMethod()).thenReturn("GET");
            when(request.getRequestURI()).thenReturn("/api/auth/me");
            when(request.getHeader("Authorization")).thenReturn(null);

            StringWriter sw = new StringWriter();
            when(response.getWriter()).thenReturn(new PrintWriter(sw));

            filter.doFilterInternal(request, response, filterChain);

            verify(response).setStatus(401);
            assertTrue(sw.toString().contains("MISSING_TOKEN"));
            verify(filterChain, never()).doFilter(request, response);
        }

        @Test
        @DisplayName("Should return 401 when Authorization header does not start with Bearer")
        void noBearerPrefix() throws Exception {
            when(request.getMethod()).thenReturn("GET");
            when(request.getRequestURI()).thenReturn("/api/auth/me");
            when(request.getHeader("Authorization")).thenReturn("Basic abc123");

            StringWriter sw = new StringWriter();
            when(response.getWriter()).thenReturn(new PrintWriter(sw));

            filter.doFilterInternal(request, response, filterChain);

            verify(response).setStatus(401);
            assertTrue(sw.toString().contains("MISSING_TOKEN"));
        }

        @Test
        @DisplayName("Should return 401 when Bearer token is empty")
        void emptyBearerToken() throws Exception {
            when(request.getMethod()).thenReturn("GET");
            when(request.getRequestURI()).thenReturn("/api/auth/me");
            when(request.getHeader("Authorization")).thenReturn("Bearer    ");

            StringWriter sw = new StringWriter();
            when(response.getWriter()).thenReturn(new PrintWriter(sw));

            filter.doFilterInternal(request, response, filterChain);

            verify(response).setStatus(401);
            assertTrue(sw.toString().contains("EMPTY_TOKEN"));
        }
    }

    // ==========================================================================
    // Token validation
    // ==========================================================================

    @Nested
    @DisplayName("Token Validation Tests")
    class TokenValidationTests {

        @Test
        @DisplayName("Should return 401 when access token validation fails")
        void invalidToken() throws Exception {
            when(request.getMethod()).thenReturn("GET");
            when(request.getRequestURI()).thenReturn("/api/auth/me");
            when(request.getHeader("Authorization")).thenReturn("Bearer invalid-jwt");
            when(sessionPort.validateAccessToken("invalid-jwt")).thenReturn(null);

            StringWriter sw = new StringWriter();
            when(response.getWriter()).thenReturn(new PrintWriter(sw));

            filter.doFilterInternal(request, response, filterChain);

            verify(response).setStatus(401);
            assertTrue(sw.toString().contains("INVALID_TOKEN"));
        }

        @Test
        @DisplayName("Should pass through with valid token and set request attributes")
        void validToken() throws Exception {
            when(request.getMethod()).thenReturn("GET");
            when(request.getRequestURI()).thenReturn("/api/auth/me");
            when(request.getHeader("Authorization")).thenReturn("Bearer valid-jwt");

            TokenInfo tokenInfo = TokenInfo.builder()
                    .userUuid("u-1")
                    .username("testuser")
                    .role("PLAYER")
                    .type("access")
                    .tokenId("jti-123")
                    .build();
            when(sessionPort.validateAccessToken("valid-jwt")).thenReturn(tokenInfo);

            filter.doFilterInternal(request, response, filterChain);

            verify(request).setAttribute("userUuid", "u-1");
            verify(request).setAttribute("username", "testuser");
            verify(request).setAttribute("role", "PLAYER");
            verify(request).setAttribute("tokenId", "jti-123");
            verify(filterChain).doFilter(request, response);
        }
    }

    // ==========================================================================
    // Admin authorization
    // ==========================================================================

    @Nested
    @DisplayName("Admin Authorization Tests")
    class AdminAuthorizationTests {

        @Test
        @DisplayName("Should return 403 when non-admin accesses admin path")
        void nonAdminAccessAdminPath() throws Exception {
            when(request.getMethod()).thenReturn("GET");
            when(request.getRequestURI()).thenReturn("/api/admin/users");
            when(request.getHeader("Authorization")).thenReturn("Bearer valid-jwt");

            TokenInfo tokenInfo = TokenInfo.builder()
                    .userUuid("u-1")
                    .username("guest_1")
                    .role("PLAYER")
                    .type("access")
                    .build();
            when(sessionPort.validateAccessToken("valid-jwt")).thenReturn(tokenInfo);

            StringWriter sw = new StringWriter();
            when(response.getWriter()).thenReturn(new PrintWriter(sw));

            filter.doFilterInternal(request, response, filterChain);

            verify(response).setStatus(403);
            assertTrue(sw.toString().contains("FORBIDDEN"));
            verify(filterChain, never()).doFilter(request, response);
        }

        @Test
        @DisplayName("Should allow admin to access admin path")
        void adminAccessAdminPath() throws Exception {
            when(request.getMethod()).thenReturn("GET");
            when(request.getRequestURI()).thenReturn("/api/admin/users");
            when(request.getHeader("Authorization")).thenReturn("Bearer admin-jwt");

            TokenInfo tokenInfo = TokenInfo.builder()
                    .userUuid("u-admin")
                    .username("admin")
                    .role("ADMIN")
                    .type("access")
                    .build();
            when(sessionPort.validateAccessToken("admin-jwt")).thenReturn(tokenInfo);

            filter.doFilterInternal(request, response, filterChain);

            verify(filterChain).doFilter(request, response);
            verify(request).setAttribute("userUuid", "u-admin");
        }

        @Test
        @DisplayName("Should allow non-admin to access non-admin protected path")
        void nonAdminAccessNonAdminPath() throws Exception {
            when(request.getMethod()).thenReturn("GET");
            when(request.getRequestURI()).thenReturn("/api/auth/me");
            when(request.getHeader("Authorization")).thenReturn("Bearer valid-jwt");

            TokenInfo tokenInfo = TokenInfo.builder()
                    .userUuid("u-1")
                    .username("guest_1")
                    .role("PLAYER")
                    .type("access")
                    .build();
            when(sessionPort.validateAccessToken("valid-jwt")).thenReturn(tokenInfo);

            filter.doFilterInternal(request, response, filterChain);

            verify(filterChain).doFilter(request, response);
        }
    }
}
