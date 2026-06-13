package games.paths.core.service.match;

/**
 * TurnPriorityCalculator - pure helper computing a character's turn priority
 * for the single-player turn cycle (Step 24).
 *
 * <p>Formula (higher acts first):
 * {@code priority = (DEX*3 + INT*2 + COS*1) * 1000 + LIFE*10 + idCharacter}.
 * The {@code idCharacter} term is the per-match character id, used as a stable
 * deterministic tie-breaker.</p>
 */
public final class TurnPriorityCalculator {

    private TurnPriorityCalculator() {
    }

    public static long compute(int dexterity, int intelligence, int constitution, int life, long idCharacter) {
        long stats = (long) (dexterity * 3 + intelligence * 2 + constitution);
        return stats * 1000L + (long) life * 10L + idCharacter;
    }
}
