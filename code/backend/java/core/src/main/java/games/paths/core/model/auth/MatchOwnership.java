package games.paths.core.model.auth;

/**
 * MatchOwnership - v1.2.0 one match of a user as the guest merge sees it: story, status and the
 * last update that decides which STARTED match wins.
 */
public record MatchOwnership(long id, String uuid, long storyId, String status, String tsUpdate) {
}
