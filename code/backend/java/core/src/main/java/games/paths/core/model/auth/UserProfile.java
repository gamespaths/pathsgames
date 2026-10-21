package games.paths.core.model.auth;

/**
 * UserProfile - v1.2.0 what GET /api/auth/me shows: names, picture and the account type
 * (GUEST, GOOGLE or INTERNAL for a bootstrapped admin).
 */
public record UserProfile(String userUuid, String username, String nickname, String displayName,
                          String pictureUrl, String role, int state, String language, String accountType) {

    public static final String TYPE_GUEST = "GUEST";
    public static final String TYPE_GOOGLE = "GOOGLE";
    public static final String TYPE_INTERNAL = "INTERNAL";

    /** "given family" when present, else the provider name, else the nickname. */
    public static String displayNameOf(UserIdentity identity, String nickname) {
        if (identity != null) {
            String given = blankToNull(identity.givenName());
            String family = blankToNull(identity.familyName());
            if (given != null || family != null) {
                return ((given == null ? "" : given) + " " + (family == null ? "" : family)).trim();
            }
            if (blankToNull(identity.profileName()) != null) {
                return identity.profileName().trim();
            }
        }
        return nickname;
    }

    /** The profile of a user and its (optional) Google identity. */
    public static UserProfile of(UserStatus user, UserIdentity identity) {
        String type = identity != null ? TYPE_GOOGLE : user.isGuest() ? TYPE_GUEST : TYPE_INTERNAL;
        return new UserProfile(user.uuid(), user.username(), user.nickname(),
                displayNameOf(identity, user.nickname()), identity == null ? null : identity.pictureUrl(),
                user.role(), user.state(), user.language(), type);
    }

    private static String blankToNull(String text) {
        return text == null || text.isBlank() ? null : text;
    }

    @Override
    public String toString() {
        return "UserProfile{userUuid='" + userUuid + "', accountType='" + accountType + "'}";
    }
}
