package games.paths.core.service.match;

import games.paths.core.port.match.MovementPort.MovementAvailability;
import games.paths.core.port.match.MovementPort.MovementException.Code;

/**
 * MovementAvailabilityChecker - the check procedure of the movement system, extracted so that
 * exactly one piece of code answers "can this character take this edge?" for the two places
 * that ask:
 *
 * <ul>
 *   <li>{@code MatchQueryService}, for the {@code available}/{@code reason} pair it puts on
 *       every neighbor of {@code /api/match/{uuid}/info};</li>
 *   <li>{@code MovementService}, to accept or reject {@code action/move}.</li>
 * </ul>
 *
 * <p>Same shape as {@link EventAvailabilityChecker} (Step 29): a pure function over a
 * pre-loaded context, so {@code /info} judges N neighbors without a query per neighbor, and
 * the board can grey out a path with its cause instead of letting the player discover it by
 * being rejected.</p>
 *
 * <p>The order below is the contract: the first failing check names the reason, and the most
 * explanatory reasons come first (a comatose character is told they need a rescue, not that
 * they are short on energy). It reproduces the validation order of {@code MovementService}.
 * {@code MATCH_NOT_FOUND} and {@code NOT_A_NEIGHBOR} are not decided here: they are about
 * <em>finding</em> the match/edge, not about judging one the caller already holds.</p>
 */
public final class MovementAvailabilityChecker {

    private MovementAvailabilityChecker() {
    }

    /**
     * Everything about the mover that does not change from one edge to the next: loaded once
     * per match. {@code hasCharacter} is false when the caller owns no character in the match,
     * in which case no move is ever possible.
     */
    public record MoveCheckContext(boolean matchRunning,
                                   boolean hasCharacter,
                                   boolean coma,
                                   boolean sleeping,
                                   int energy,
                                   int carriedWeight,
                                   int weightMax,
                                   /** v0.35.3 — the backpack, for the edge resource costs. */
                                   int food,
                                   int magic,
                                   int coin) {

        /** Pre-v0.35.3 shape: a mover carrying no resources to spend. */
        public MoveCheckContext(boolean matchRunning, boolean hasCharacter, boolean coma,
                                boolean sleeping, int energy, int carriedWeight, int weightMax) {
            this(matchRunning, hasCharacter, coma, sleeping, energy, carriedWeight, weightMax,
                    0, 0, 0);
        }

        /** The context of a caller with no character: nothing is ever traversable. */
        public static MoveCheckContext noCharacter() {
            return new MoveCheckContext(false, false, false, false, 0, 0, 0, 0, 0, 0);
        }
    }

    /**
     * The per-edge facts: whether the link's registry condition holds, what the move costs in
     * this weather (edge + entry + weather modifier) and how full the destination is.
     * {@code maxCharacters <= 0} means the destination has no capacity limit.
     */
    public record MoveEdgeCheck(boolean conditionMet,
                                int totalEnergyCost,
                                int maxCharacters,
                                int charactersAtTarget,
                                /** v0.35.3 — edge-only resource costs. */
                                int costFood,
                                int costMagic,
                                int costCoin) {

        /** The pre-v0.35.3 shape: an edge that costs no resources. */
        public MoveEdgeCheck(boolean conditionMet, int totalEnergyCost,
                             int maxCharacters, int charactersAtTarget) {
            this(conditionMet, totalEnergyCost, maxCharacters, charactersAtTarget, 0, 0, 0);
        }
    }

    /** The single verdict. */
    public static MovementAvailability check(MoveCheckContext ctx, MoveEdgeCheck edge) {
        if (ctx == null || !ctx.hasCharacter()) {
            return MovementAvailability.no(Code.CHARACTER_CANNOT_ACT);
        }
        if (!ctx.matchRunning()) {
            return MovementAvailability.no(Code.MATCH_NOT_RUNNING);
        }
        // Coma outranks sleep: a comatose character is also flagged asleep, and the two are
        // not the same news for the player — one waits, the other needs a rescue.
        if (ctx.coma()) {
            return MovementAvailability.no(Code.COMA);
        }
        if (ctx.sleeping()) {
            return MovementAvailability.no(Code.SLEEPING);
        }
        if (edge == null) {
            return MovementAvailability.no(Code.NOT_A_NEIGHBOR);
        }
        if (!edge.conditionMet()) {
            return MovementAvailability.no(Code.MOVEMENT_CONDITION_NOT_MET);
        }
        if (ctx.carriedWeight() > ctx.weightMax()) {
            return MovementAvailability.no(Code.OVERWEIGHT);
        }
        if (ctx.energy() < edge.totalEnergyCost()) {
            return MovementAvailability.no(Code.INSUFFICIENT_ENERGY);
        }
        // v0.35.3 — after energy and before capacity: a mover who cannot afford the road is
        // told about the road, not about how crowded the place they cannot reach is.
        if (ctx.coin() < edge.costCoin()) {
            return MovementAvailability.no(Code.NOT_ENOUGH_COINS);
        }
        if (ctx.food() < edge.costFood()) {
            return MovementAvailability.no(Code.NOT_ENOUGH_FOOD);
        }
        if (ctx.magic() < edge.costMagic()) {
            return MovementAvailability.no(Code.NOT_ENOUGH_MAGIC);
        }
        if (edge.maxCharacters() > 0 && edge.charactersAtTarget() >= edge.maxCharacters()) {
            return MovementAvailability.no(Code.LOCATION_FULL);
        }
        return MovementAvailability.OK;
    }
}
