package games.paths.core.model.auth;

import games.paths.core.model.match.MatchStatusTotals;
import games.paths.core.model.match.MatchStatuses;

import java.util.List;

/**
 * UserStats - v1.7.0 the statistics of GET /api/auth/me over the matches the user created: played
 * (RUNNING, PAUSED, ENDED, GAMEOVER), completed (ENDED), game over, play time and clocks.
 */
public record UserStats(long matchesPlayed, long matchesCompleted, long matchesGameOver, long playTimeMs,
                        long clocksPlayed) {

    public static final UserStats EMPTY = new UserStats(0, 0, 0, 0, 0);

    /** Folds the per-status totals; a status outside {@link MatchStatuses#PLAYED} counts nowhere. */
    public static UserStats of(List<MatchStatusTotals> totals) {
        long played = 0;
        long completed = 0;
        long gameOver = 0;
        long playMs = 0;
        long clocks = 0;
        for (MatchStatusTotals t : totals == null ? List.<MatchStatusTotals>of() : totals) {
            if (!MatchStatuses.PLAYED.contains(t.status())) {
                continue;
            }
            played += t.matches();
            playMs += t.playMs();
            clocks += t.clocks();
            if (MatchStatuses.ENDED.equals(t.status())) {
                completed += t.matches();
            } else if (MatchStatuses.GAMEOVER.equals(t.status())) {
                gameOver += t.matches();
            }
        }
        return new UserStats(played, completed, gameOver, playMs, clocks);
    }
}
