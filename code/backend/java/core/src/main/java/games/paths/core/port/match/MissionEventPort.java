package games.paths.core.port.match;

/**
 * MissionEventPort - Step 37: how the mission engine fires an {@code id_event_completed}.
 * Narrow on purpose, so the engine never learns what running an event actually involves.
 */
@FunctionalInterface
public interface MissionEventPort {

    /** Run one event with no actor, no cost and no availability verdict, capped by {@code depth}. */
    void runMissionEvent(long idMatch, long idEvent, int depth);
}
