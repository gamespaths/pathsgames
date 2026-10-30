package games.paths.core.model.auth;

/**
 * UserIdentity - v1.2.0 one login provider of a user (users_identities row): provider, subject,
 * email (lowercase, never updated) and the profile refreshed at every login.
 */
public record UserIdentity(Long id, Long userId, String provider, String subject, String email,
                           String profileName, String givenName, String familyName, String pictureUrl,
                           String locale, String tsProfileUpdate) {

    public static final String PROVIDER_GOOGLE = "GOOGLE";

    /** The profile fields of a verified Google token, ready to insert or refresh. */
    public static UserIdentity fromGoogle(GoogleIdentityClaims c, String email, String now) {
        return new UserIdentity(null, null, PROVIDER_GOOGLE, c.subject(), email, c.name(), c.givenName(),
                c.familyName(), c.picture(), c.locale(), now);
    }

    @Override
    public String toString() {
        return "UserIdentity{id=" + id + ", userId=" + userId + ", provider='" + provider + "'}";
    }
}
