package games.paths.core.port;

import java.util.List;
import java.util.Map;

/**
 * EchoPort - Inbound port for server health/status checks.
 * Part of the Hexagonal Architecture: this is a domain port
 * that the adapter-rest module will call.
 */
public interface EchoPort {
    String getServerStatus();
    long getTimestamp();
    Map<String, String> getServerProperties();

    /** v1.7.0 the languages a profile may choose. */
    List<String> getSupportedLanguages();

    /** v1.7.0 the themes a profile may choose. */
    List<String> getSupportedThemes();

    /** v1.7.0 step 8 the browsers that refetch a match on page return: "webkit" or "all". */
    default List<String> getMatchRefetchBrowsers() {
        return List.of("webkit");
    }

    /** v1.7.0 step 8 the seconds a page must stay hidden before the return refetches the match. */
    default int getMatchRefetchMinHiddenSeconds() {
        return 30;
    }
}
