package games.paths.core.service;

import games.paths.core.port.in.EchoPort;

import java.util.Collections;
import java.util.Map;

/**
 * EchoService - Domain service implementing the EchoPort.
 * This is pure domain logic with no Spring/framework dependency.
 * Properties are injected via constructor by the launcher configuration.
 */
public class EchoService implements EchoPort {

    private final String serverStatus;
    private final Map<String, String> serverProperties;

    public EchoService(String serverStatus, Map<String, String> serverProperties) {
        this.serverStatus = serverStatus;
        this.serverProperties = Collections.unmodifiableMap(serverProperties);
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
}
