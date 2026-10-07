package games.paths.core.model.match;

/**
 * MatchOwnerMoveResult - v0.41.6 the outcome of an admin owner move: MOVED or UNCHANGED, the previous
 * and the new owner and how many characters changed hands.
 */
public record MatchOwnerMoveResult(String status, String matchUuid, Owner previousOwner, Owner owner,
                                   int charactersMoved) {

    public static final String MOVED = "MOVED";
    public static final String UNCHANGED = "UNCHANGED";

    public record Owner(String uuid, String username) {
    }
}
