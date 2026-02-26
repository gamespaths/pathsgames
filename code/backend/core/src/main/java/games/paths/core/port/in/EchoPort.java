package games.paths.core.port.in;

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
}
