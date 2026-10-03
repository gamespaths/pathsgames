package games.paths.adapters.admin.dto.match;

import games.paths.core.model.match.MatchOwnerMoveResult;

/** MatchOwnerMoveResponse - v0.41.6 body of PUT /api/admin/matches/{uuidMatch}/owner. */
public record MatchOwnerMoveResponse(String status, String matchUuid, MatchOwnerMoveResult.Owner previousOwner,
                                     MatchOwnerMoveResult.Owner owner, int charactersMoved) {

    public static MatchOwnerMoveResponse from(MatchOwnerMoveResult r) {
        return new MatchOwnerMoveResponse(r.status(), r.matchUuid(), r.previousOwner(), r.owner(),
                r.charactersMoved());
    }
}
