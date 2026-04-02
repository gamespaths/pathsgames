package games.paths.adapters.rest.cookie;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * CookiePolicyInitializer — wires {@code game.auth.cookie.*} properties from
 * {@code application.yml} into the static {@link CookieHelper}.
 *
 * <p>This runs once at application startup, before any HTTP requests are
 * processed, so the helper always uses the configured policy.</p>
 *
 * <pre>
 * # application.yml example:
 * game:
 *   auth:
 *     cookie:
 *       secure: false       # true in production (HTTPS)
 *       same-site: None     # None for dev (cross-origin localhost), Lax/Strict for prod
 * </pre>
 */
@Component
public class CookiePolicyInitializer {

    private static final Logger log = LoggerFactory.getLogger(CookiePolicyInitializer.class);

    @Value("${game.auth.cookie.secure:false}")
    private boolean secure;

    @Value("${game.auth.cookie.same-site:None}")
    private String sameSite;

    @PostConstruct
    public void init() {
        CookieHelper.configure(secure, sameSite);
        log.info("Cookie policy: Secure={}, SameSite={}", secure, sameSite);
    }
}
