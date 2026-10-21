package games.paths.core.service.auth;

import java.util.Locale;
import java.util.function.Predicate;

/**
 * NicknameGenerator - v1.2.0 the nickname of a new Google user: the email local part without its
 * +tag, lowercase; a taken one gets the first free suffix #2, #3, ...
 */
public final class NicknameGenerator {

    static final int MAX_LENGTH = 90;
    static final int MAX_SUFFIX = 1000;
    static final String FALLBACK = "player";

    private NicknameGenerator() {
    }

    /** The nickname base of an email: local part, +tag removed, lowercase, at most 90 chars. */
    public static String base(String email) {
        if (email == null) {
            return FALLBACK;
        }
        String local = email.trim().toLowerCase(Locale.ROOT);
        int at = local.indexOf('@');
        if (at >= 0) {
            local = local.substring(0, at);
        }
        int plus = local.indexOf('+');
        if (plus >= 0) {
            local = local.substring(0, plus);
        }
        if (local.isBlank()) {
            return FALLBACK;
        }
        return local.length() > MAX_LENGTH ? local.substring(0, MAX_LENGTH) : local;
    }

    /** The candidate number n: the base itself for n = 1, else base#n. */
    public static String candidate(String base, int n) {
        return n <= 1 ? base : base + "#" + n;
    }

    /** The first candidate from {@code start} that {@code taken} rejects not; a uuid suffix after 1000. */
    public static String firstFree(String base, int start, Predicate<String> taken, String uuid) {
        for (int n = Math.max(1, start); n <= MAX_SUFFIX; n++) {
            String nickname = candidate(base, n);
            if (!taken.test(nickname)) {
                return nickname;
            }
        }
        return base + "#" + uuid.substring(0, 8);
    }
}
