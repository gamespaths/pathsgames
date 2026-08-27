package games.paths.core.service.match;

import games.paths.core.port.match.EdgeStateStorePort;

import java.util.Collection;

/**
 * EdgeStateEvaluator - THE edge-state rules of Step 30, as one pure function.
 *
 * <p>Two rules, in a deliberate order, because the first can cause the second:</p>
 * <ol>
 *   <li><b>Sadness overflow.</b> {@code sad >= sad_max} costs the character COS life points,
 *       resets sadness to zero and forces sleep.</li>
 *   <li><b>Coma.</b> {@code life <= 0} raises {@code is_coma} and {@code is_sleeping} and
 *       stamps {@code clock_in_coma}.</li>
 * </ol>
 *
 * <p>The cascade is the whole point of evaluating them together: the life the coma rule reads
 * is the life <em>after</em> the overflow subtraction, so one event can push a character over
 * the sadness cap and into a coma in a single pass.</p>
 *
 * <p>Like {@link EventAvailabilityChecker} this takes a snapshot rather than a store port, so
 * the three services that mutate stats — event execution, time-start recovery and the admin
 * change-stats command — share one implementation of the rules instead of three.</p>
 *
 * <p>Rescue, the {@code GAMEOVER} transition and the multiplayer help endpoints are NOT here:
 * they belong to step 59 of the roadmap.</p>
 *
 * <p>See {@code documentation_v0/Step30_EdgeStates.md}.</p>
 */
public final class EdgeStateEvaluator {

    private EdgeStateEvaluator() {
    }

    /**
     * Everything the two rules need, and nothing else.
     *
     * <p>{@code sadUnclamped} is the raw sum before the {@code [0, sadMax]} clamp. For a
     * well-authored character it agrees with the clamped value, since clamping a number at or
     * above the cap yields the cap; it is carried separately so the rule reads what the effect
     * actually did rather than what storage could represent.</p>
     */
    public record CharacterState(long idCharacter,
                                 int life,
                                 int sadUnclamped,
                                 int sadMax,
                                 int constitution,
                                 boolean alreadyComa) {
    }

    /**
     * What the caller must apply. Nothing is mutated here — the evaluator computes, the
     * services persist.
     */
    public record Verdict(long idCharacter,
                          boolean sadnessOverflow,
                          boolean comaTriggered,
                          boolean forcedSleep,
                          int lifeAfter,
                          int sadAfter) {

        /** True when this verdict changes anything at all. */
        public boolean anything() {
            return sadnessOverflow || comaTriggered;
        }
    }

    /**
     * The single verdict for one character.
     *
     * <p>{@code alreadyComa} suppresses only the coma <em>trigger</em> — the log row and the
     * {@code clock_in_coma} stamp — never the arithmetic: a comatose character caught by a
     * {@code target=ALL} sadness effect still takes the life hit.</p>
     */
    public static Verdict evaluate(CharacterState s) {
        int life = s.life();
        // A non-positive cap makes every comparison below true and would drain COS life on
        // every single event. sad_max comes from story import and nothing forces it positive,
        // so an unauthored cap must disable the rule rather than fire it forever.
        boolean overflow = s.sadMax() > 0 && s.sadUnclamped() >= s.sadMax();
        int sad = TimeStartRecoveryService.clamp(s.sadUnclamped(), 0, s.sadMax());
        boolean forcedSleep = false;

        if (overflow) {
            life = Math.max(0, life - s.constitution());
            sad = 0;
            forcedSleep = true;
        }

        boolean comaTriggered = life <= 0 && !s.alreadyComa();
        if (comaTriggered) {
            forcedSleep = true;
        }

        return new Verdict(s.idCharacter(), overflow, comaTriggered, forcedSleep, life, sad);
    }

    /**
     * True when every character of the match is comatose. An empty roster is NOT all-in-coma —
     * the guard lives here so no call site can forget it.
     */
    public static boolean allInComa(Collection<Boolean> comaFlags) {
        if (comaFlags == null || comaFlags.isEmpty()) {
            return false;
        }
        for (Boolean coma : comaFlags) {
            if (!Boolean.TRUE.equals(coma)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Persist one verdict: the state flags plus the {@code log_events} rows.
     *
     * <p>Stat values are NOT written here. Each service already owns a stats write of its own
     * and knows when to issue it; duplicating it would mean two UPDATEs per character.</p>
     */
    static void persist(EdgeStateStorePort store, long idMatch, Verdict v, int clock, Long idEvent) {
        if (v.sadnessOverflow()) {
            store.logEdgeState(idMatch, v.idCharacter(), idEvent, clock,
                    EdgeStateStorePort.MSG_SADNESS_OVERFLOW + " " + v.idCharacter());
        }
        if (v.comaTriggered()) {
            store.setComa(idMatch, v.idCharacter(), clock);
            store.logEdgeState(idMatch, v.idCharacter(), idEvent, clock,
                    EdgeStateStorePort.MSG_COMA + " " + v.idCharacter());
        } else if (v.forcedSleep()) {
            // Coma already implies sleep, so this is the overflow-without-coma case only.
            store.setSleeping(idMatch, v.idCharacter());
        }
    }
}
