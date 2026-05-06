package games.paths.core.port.match;

/**
 * SystemModePort - Outbound port used by match services to check whether
 * the system currently accepts new matches.
 *
 * <p>The implementation can read the {@code global_runtime_variables}
 * table or simply return a static value derived from the launcher
 * configuration. The match domain only cares about the boolean answer.</p>
 */
public interface SystemModePort {

    /**
     * @return {@code true} when the server is in maintenance mode and new
     *         matches must be rejected with HTTP 503.
     */
    boolean isMaintenance();
}
