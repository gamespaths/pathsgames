package games.paths.core.service.match;

import games.paths.core.port.match.SystemModePort;

/**
 * PropertySystemModeService - Default {@link SystemModePort} implementation
 * driven by a single string property (typically the same one used by the
 * {@code EchoService}). When the value equals {@code "MAINTENANCE"} the
 * server is considered to be under maintenance.
 *
 * <p>The launcher wires this service from the
 * {@code game.server.status} application property so that flipping the
 * status string also gates new match creation.</p>
 */
public class PropertySystemModeService implements SystemModePort {

    private static final String MAINTENANCE_STATUS = "MAINTENANCE";

    private final String serverStatus;

    public PropertySystemModeService(String serverStatus) {
        this.serverStatus = serverStatus;
    }

    @Override
    public boolean isMaintenance() {
        return MAINTENANCE_STATUS.equalsIgnoreCase(serverStatus);
    }
}
