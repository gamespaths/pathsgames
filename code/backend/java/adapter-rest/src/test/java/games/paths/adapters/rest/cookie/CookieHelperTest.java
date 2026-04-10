package games.paths.adapters.rest.cookie;

import jakarta.servlet.http.Cookie;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.http.HttpHeaders;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link CookieHelper}.
 * Tests cookie set / read / delete operations using Spring Mock servlet objects.
 */
class CookieHelperTest {

    @BeforeEach
    void resetCookiePolicy() {
        // Reset to a known SameSite policy before each test
        CookieHelper.configure("None");
    }

    // ── configure() ─────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("configure()")
    class ConfigureTests {

        @Test
        @DisplayName("configure() changes SameSite attribute in Set-Cookie header")
        void configure_changesSameSite() {
            CookieHelper.configure("Lax");
            MockHttpServletResponse response = new MockHttpServletResponse();
            CookieHelper.setRefreshTokenCookie(response, "some-token");
            String header = response.getHeader(HttpHeaders.SET_COOKIE);
            assertNotNull(header);
            assertTrue(header.contains("SameSite=Lax"), "Expected SameSite=Lax in: " + header);
        }

        @Test
        @DisplayName("configure(None) sets SameSite=None")
        void configure_setsNone() {
            CookieHelper.configure("None");
            MockHttpServletResponse response = new MockHttpServletResponse();
            CookieHelper.setRefreshTokenCookie(response, "token");
            String header = response.getHeader(HttpHeaders.SET_COOKIE);
            assertNotNull(header);
            assertTrue(header.contains("SameSite=None"), "Expected SameSite=None in: " + header);
        }
    }

    // ── setRefreshTokenCookie() ──────────────────────────────────────────────────

    @Nested
    @DisplayName("setRefreshTokenCookie()")
    class SetRefreshTokenTests {

        @Test
        @DisplayName("Writes Set-Cookie header with correct cookie name")
        void setRefreshTokenCookie_writesHeader() {
            MockHttpServletResponse response = new MockHttpServletResponse();
            CookieHelper.setRefreshTokenCookie(response, "refresh-value");

            String header = response.getHeader(HttpHeaders.SET_COOKIE);
            assertNotNull(header, "Expected Set-Cookie header");
            assertTrue(header.contains(CookieHelper.REFRESH_TOKEN_COOKIE), "Expected cookie name in header");
            assertTrue(header.contains("refresh-value"), "Expected cookie value in header");
        }

        @Test
        @DisplayName("Cookie is HttpOnly")
        void setRefreshTokenCookie_isHttpOnly() {
            MockHttpServletResponse response = new MockHttpServletResponse();
            CookieHelper.setRefreshTokenCookie(response, "tk");
            String header = response.getHeader(HttpHeaders.SET_COOKIE);
            assertTrue(header.contains("HttpOnly"), "Cookie must be HttpOnly");
        }

        @Test
        @DisplayName("Cookie has correct path /api/auth")
        void setRefreshTokenCookie_hasPath() {
            MockHttpServletResponse response = new MockHttpServletResponse();
            CookieHelper.setRefreshTokenCookie(response, "tk");
            String header = response.getHeader(HttpHeaders.SET_COOKIE);
            assertTrue(header.contains("Path=/api/auth"), "Cookie must have Path=/api/auth");
        }
    }

    // ── setGuestCookieToken() ────────────────────────────────────────────────────

    @Nested
    @DisplayName("setGuestCookieToken()")
    class SetGuestCookieTests {

        @Test
        @DisplayName("Writes Set-Cookie header with correct guest cookie name")
        void setGuestCookieToken_writesHeader() {
            MockHttpServletResponse response = new MockHttpServletResponse();
            CookieHelper.setGuestCookieToken(response, "guest-value");

            String header = response.getHeader(HttpHeaders.SET_COOKIE);
            assertNotNull(header);
            assertTrue(header.contains(CookieHelper.GUEST_COOKIE_TOKEN), "Expected guest cookie name");
            assertTrue(header.contains("guest-value"), "Expected cookie value");
        }
    }

    // ── getRefreshToken() ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getRefreshToken()")
    class GetRefreshTokenTests {

        @Test
        @DisplayName("Returns the refresh token value when cookie is present")
        void getRefreshToken_returnsValue() {
            MockHttpServletRequest request = new MockHttpServletRequest();
            request.setCookies(new Cookie(CookieHelper.REFRESH_TOKEN_COOKIE, "rt-123"));

            String result = CookieHelper.getRefreshToken(request);
            assertEquals("rt-123", result);
        }

        @Test
        @DisplayName("Returns null when refresh cookie is absent")
        void getRefreshToken_notPresent_returnsNull() {
            MockHttpServletRequest request = new MockHttpServletRequest();
            request.setCookies(new Cookie("other.cookie", "value"));

            assertNull(CookieHelper.getRefreshToken(request));
        }

        @Test
        @DisplayName("Returns null when no cookies at all (null array)")
        void getRefreshToken_noCookies_returnsNull() {
            MockHttpServletRequest request = new MockHttpServletRequest();
            // No cookies added → getCookies() returns null
            assertNull(CookieHelper.getRefreshToken(request));
        }
    }

    // ── getGuestCookieToken() ────────────────────────────────────────────────────

    @Nested
    @DisplayName("getGuestCookieToken()")
    class GetGuestCookieTests {

        @Test
        @DisplayName("Returns the guest token value when cookie is present")
        void getGuestCookieToken_returnsValue() {
            MockHttpServletRequest request = new MockHttpServletRequest();
            request.setCookies(new Cookie(CookieHelper.GUEST_COOKIE_TOKEN, "gc-abc"));

            assertEquals("gc-abc", CookieHelper.getGuestCookieToken(request));
        }

        @Test
        @DisplayName("Returns null when guest cookie is absent")
        void getGuestCookieToken_absent_returnsNull() {
            MockHttpServletRequest request = new MockHttpServletRequest();
            assertNull(CookieHelper.getGuestCookieToken(request));
        }
    }

    // ── deleteRefreshTokenCookie() ───────────────────────────────────────────────

    @Nested
    @DisplayName("deleteRefreshTokenCookie()")
    class DeleteRefreshTokenTests {

        @Test
        @DisplayName("Writes a Set-Cookie header with Max-Age=0 to delete the cookie")
        void deleteRefreshTokenCookie_setsMaxAgeZero() {
            MockHttpServletResponse response = new MockHttpServletResponse();
            CookieHelper.deleteRefreshTokenCookie(response);

            String header = response.getHeader(HttpHeaders.SET_COOKIE);
            assertNotNull(header);
            assertTrue(header.contains("Max-Age=0"), "Expected Max-Age=0 for cookie deletion");
            assertTrue(header.contains(CookieHelper.REFRESH_TOKEN_COOKIE));
        }
    }

    // ── deleteGuestCookieToken() ─────────────────────────────────────────────────

    @Nested
    @DisplayName("deleteGuestCookieToken()")
    class DeleteGuestCookieTests {

        @Test
        @DisplayName("Writes a Set-Cookie header with Max-Age=0 to delete the guest cookie")
        void deleteGuestCookieToken_setsMaxAgeZero() {
            MockHttpServletResponse response = new MockHttpServletResponse();
            CookieHelper.deleteGuestCookieToken(response);

            String header = response.getHeader(HttpHeaders.SET_COOKIE);
            assertNotNull(header);
            assertTrue(header.contains("Max-Age=0"), "Expected Max-Age=0 for cookie deletion");
            assertTrue(header.contains(CookieHelper.GUEST_COOKIE_TOKEN));
        }
    }

    // ── deleteAllAuthCookies() ───────────────────────────────────────────────────

    @Nested
    @DisplayName("deleteAllAuthCookies()")
    class DeleteAllCookiesTests {

        @Test
        @DisplayName("Writes two Set-Cookie headers (one per cookie) with Max-Age=0")
        void deleteAllAuthCookies_writesTwo() {
            MockHttpServletResponse response = new MockHttpServletResponse();
            CookieHelper.deleteAllAuthCookies(response);

            // MockHttpServletResponse stores multiple headers for the same header name
            var headers = response.getHeaders(HttpHeaders.SET_COOKIE);
            assertEquals(2, headers.size(), "Expected two Set-Cookie deletion headers");
            assertTrue(headers.stream().anyMatch(h -> h.contains(CookieHelper.REFRESH_TOKEN_COOKIE)));
            assertTrue(headers.stream().anyMatch(h -> h.contains(CookieHelper.GUEST_COOKIE_TOKEN)));
        }
    }

    // ── constants ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("Constants have expected values")
    void constants_haveExpectedValues() {
        assertEquals("pathsgames.refreshToken", CookieHelper.REFRESH_TOKEN_COOKIE);
        assertEquals("pathsgames.guestcookie",  CookieHelper.GUEST_COOKIE_TOKEN);
        assertEquals(7 * 24 * 60 * 60,  CookieHelper.REFRESH_MAX_AGE_SECONDS);
        assertEquals(30 * 24 * 60 * 60, CookieHelper.GUEST_COOKIE_MAX_AGE_SECONDS);
    }
}
