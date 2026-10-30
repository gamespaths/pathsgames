package games.paths.core.service;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import games.paths.core.model.auth.UserPreferences;
import games.paths.core.port.EchoPort;

/**
 * EchoService - Domain service implementing the EchoPort.
 * This is pure domain logic with no Spring/framework dependency.
 * Properties are injected via constructor by the launcher configuration.
 */
public class EchoService implements EchoPort {

    private final String serverStatus;
    private final Map<String, String> serverProperties;
    private List<String> supportedLanguages = UserPreferences.DEFAULT_LANGUAGES;
    private List<String> supportedThemes = UserPreferences.DEFAULT_THEMES;
    private List<String> matchRefetchBrowsers = DEFAULT_REFETCH_BROWSERS;
    private int matchRefetchMinHiddenSeconds = DEFAULT_REFETCH_MIN_HIDDEN_SECONDS;

    public static final List<String> DEFAULT_REFETCH_BROWSERS = List.of("webkit");
    public static final int DEFAULT_REFETCH_MIN_HIDDEN_SECONDS = 30;

    public EchoService(String serverStatus, Map<String, String> serverProperties) {
        this.serverStatus = serverStatus;
        this.serverProperties = Collections.unmodifiableMap(serverProperties);
    }

    /** v1.7.0 the supported-languages and supported-themes lists; null keeps the default. */
    public void setSupported(List<String> languages, List<String> themes) {
        if (languages != null) {
            this.supportedLanguages = List.copyOf(languages);
        }
        if (themes != null) {
            this.supportedThemes = List.copyOf(themes);
        }
    }

    /** v1.7.0 step 8 the page-return refetch parameters; null or negative keeps the default. */
    public void setMatchRefetch(List<String> browsers, Integer minHiddenSeconds) {
        if (browsers != null && !browsers.isEmpty()) {
            this.matchRefetchBrowsers = List.copyOf(browsers);
        }
        if (minHiddenSeconds != null && minHiddenSeconds >= 0) {
            this.matchRefetchMinHiddenSeconds = minHiddenSeconds;
        }
    }

    @Override
    public String getServerStatus() {
        return serverStatus;
    }

    @Override
    public long getTimestamp() {
        return System.currentTimeMillis();
    }

    @Override
    public Map<String, String> getServerProperties() {
        return serverProperties;
    }

    @Override
    public List<String> getSupportedLanguages() {
        return supportedLanguages;
    }

    @Override
    public List<String> getSupportedThemes() {
        return supportedThemes;
    }

    @Override
    public List<String> getMatchRefetchBrowsers() {
        return matchRefetchBrowsers;
    }

    @Override
    public int getMatchRefetchMinHiddenSeconds() {
        return matchRefetchMinHiddenSeconds;
    }
}
