package games.paths.adapters.rest.cookie;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;

import java.time.Duration;

/**
 * CookieHelper — utility for managing HttpOnly authentication cookies.
 *
 * <p>Two cookies are managed:</p>
 * <ul>
 *   <li><b>pathsgames.refreshToken</b> — contains the JWT refresh token (7-day lifetime).
 *       HttpOnly so JavaScript cannot read it, eliminating the XSS "blast radius"
 *       for refresh tokens.</li>
 *   <li><b>pathsgames.guestcookie</b> — contains the opaque guest-resume UUID (30-day lifetime).
 *       HttpOnly so the browser sends it automatically on POST /api/auth/guest/resume
 *       without JavaScript involvement.</li>
 * </ul>
 *
 * <p>Both cookies use {@code Path=/api/auth} so they are only sent on
 * authentication-related requests, reducing unnecessary header traffic.</p>
 *
 * <p><b>SameSite policy:</b>
 * Use {@code SameSite=None} (+ {@code Secure=false} on localhost) during development
 * so cookies travel across origins — e.g. from {@code http://127.0.0.1:5500} or
 * {@code file://} to {@code http://localhost:8042}. Chrome 89+ allows SameSite=None
 * without Secure for the loopback address.
 * In production set {@code secure=true} (HTTPS) and keep {@code sameSite=None}, or
 * switch to {@code Lax} if the frontend is served from the same host.</p>
 *
 * <p>The policy is configurable at startup via
 * {@link #configure(boolean, String)} — called by
 * {@code CookiePolicyInitializer} which reads {@code game.auth.cookie.*} from
 * {@code application.yml}.</p>
 */
public final class CookieHelper {

    public static final String REFRESH_TOKEN_COOKIE = "pathsgames.refreshToken";
    public static final String GUEST_COOKIE_TOKEN   = "pathsgames.guestcookie";

    /** Path scope — cookies are only sent for /api/auth/** requests. */
    private static final String COOKIE_PATH = "/api/auth";

    /** Default max-age for the refresh-token cookie (7 days). */
    public static final int REFRESH_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;   // 604 800

    /** Default max-age for the guest-cookie-token cookie (30 days). */
    public static final int GUEST_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;  // 2 592 000

    /** Applied cookie policy — overridden at startup by CookiePolicyInitializer. */
    //private static boolean secure  = false;
    private static String sameSite = "None";

    private CookieHelper() { /* static utility */ }

    /**
     * Configures the cookie Secure flag and SameSite attribute.
     * Called once at application startup by {@code CookiePolicyInitializer}.
     *
     * @param secure   {@code true} to set the Secure flag (required for HTTPS production)
     * @param sameSite SameSite attribute value: {@code "None"}, {@code "Lax"}, or {@code "Strict"}
     */
    public static void configure(String sameSite) {
        CookieHelper.sameSite = sameSite;
    }

    /* ─────────────────────────────────────────────
       SET cookies
       ───────────────────────────────────────────── */

    /** Writes the refresh-token as an HttpOnly cookie. */
    public static void setRefreshTokenCookie(HttpServletResponse response, String refreshToken) {
        addCookie(response, REFRESH_TOKEN_COOKIE, refreshToken, REFRESH_MAX_AGE_SECONDS);
    }

    /** Writes the guest-cookie-token as an HttpOnly cookie. */
    public static void setGuestCookieToken(HttpServletResponse response, String guestCookieToken) {
        addCookie(response, GUEST_COOKIE_TOKEN, guestCookieToken, GUEST_COOKIE_MAX_AGE_SECONDS);
    }

    /* ─────────────────────────────────────────────
       READ cookies
       ───────────────────────────────────────────── */

    /** Reads the refresh token from the incoming request cookies, or {@code null}. */
    public static String getRefreshToken(HttpServletRequest request) {
        return getCookieValue(request, REFRESH_TOKEN_COOKIE);
    }

    /** Reads the guest-cookie-token from the incoming request cookies, or {@code null}. */
    public static String getGuestCookieToken(HttpServletRequest request) {
        return getCookieValue(request, GUEST_COOKIE_TOKEN);
    }

    /* ─────────────────────────────────────────────
       DELETE cookies
       ───────────────────────────────────────────── */

    /** Deletes the refresh-token cookie. */
    public static void deleteRefreshTokenCookie(HttpServletResponse response) {
        addCookie(response, REFRESH_TOKEN_COOKIE, "", 0);
    }

    /** Deletes the guest-cookie-token cookie. */
    public static void deleteGuestCookieToken(HttpServletResponse response) {
        addCookie(response, GUEST_COOKIE_TOKEN, "", 0);
    }

    /** Deletes both authentication cookies at once. */
    public static void deleteAllAuthCookies(HttpServletResponse response) {
        deleteRefreshTokenCookie(response);
        deleteGuestCookieToken(response);
    }

    /* ─────────────────────────────────────────────
       INTERNAL helpers
       ───────────────────────────────────────────── */

    private static void addCookie(HttpServletResponse response, String name,
                                  String value, int maxAgeSeconds) {
        ResponseCookie cookie = ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(true) // Secure flag is required for SameSite=None in modern browsers
                .path(COOKIE_PATH)
                .maxAge(Duration.ofSeconds(maxAgeSeconds))
                .sameSite(sameSite)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private static String getCookieValue(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (name.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }
}
