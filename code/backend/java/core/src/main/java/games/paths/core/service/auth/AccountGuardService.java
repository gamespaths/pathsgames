package games.paths.core.service.auth;

import games.paths.core.model.auth.AdminActions;
import games.paths.core.model.auth.AuthException;
import games.paths.core.model.auth.UserIdentity;
import games.paths.core.model.auth.UserStates;
import games.paths.core.model.auth.UserStatus;
import games.paths.core.port.auth.AccountGuardPort;
import games.paths.core.port.auth.AdminInterventionPort;
import games.paths.core.port.auth.UserAdminPersistencePort;
import games.paths.core.port.auth.UserStatePort;

import java.time.Clock;
import java.time.Instant;
import java.util.Optional;

/**
 * AccountGuardService - v1.7.0 {@link AccountGuardPort}: banned hashes at login, automatic unblock of an
 * ended suspension (written as a SYSTEM action), the armed re-link of an IDENTITY_MISMATCH.
 */
public class AccountGuardService implements AccountGuardPort {

    static final String AUTO_UNBLOCK_REASON = "Suspension ended";

    private final UserAdminPersistencePort persistence;
    private final AdminInterventionPort interventions;
    private final UserStatePort userState;
    private final SubjectHasher hasher;
    private Clock clock = Clock.systemUTC();

    public AccountGuardService(UserAdminPersistencePort persistence, AdminInterventionPort interventions,
                               UserStatePort userState, SubjectHasher hasher) {
        this.persistence = persistence;
        this.interventions = interventions;
        this.userState = userState;
        this.hasher = hasher;
    }

    void setClock(Clock clock) {
        this.clock = clock;
    }

    @Override
    public void checkNotBanned(String subject, String email) {
        if (persistence.isBanned(hasher.subject(subject), hasher.email(email))) {
            throw new AuthException(AuthException.Code.ACCOUNT_DISABLED, "The account is disabled");
        }
    }

    @Override
    public UserStatus admit(UserStatus user) {
        if (user.state() == UserStates.BLOCKED) {
            Optional<String> until = persistence.findByUuid(user.uuid()).map(i -> i.suspendedUntil());
            Instant end = until.map(AccountGuardService::parse).orElse(null);
            if (end != null && !clock.instant().isBefore(end)) {
                persistence.updateStateAndSuspension(user.id(), UserStates.ACTIVE, null);
                userState.evict(user.uuid());
                interventions.record(AdminActions.SYSTEM, AdminActions.UNBLOCK, user.uuid(), AUTO_UNBLOCK_REASON);
                return new UserStatus(user.id(), user.uuid(), user.username(), user.nickname(), user.role(),
                        UserStates.ACTIVE, user.language());
            }
            if (end != null) {
                throw new AuthException(AuthException.Code.ACCOUNT_DISABLED, "The account is suspended",
                        end.toString());
            }
        }
        UserStates.requireUsable(user.state());
        return user;
    }

    @Override
    public boolean relink(UserIdentity identity, String newSubject) {
        if (identity == null || identity.id() == null || identity.userId() == null
                || !persistence.isRelinkPending(identity.userId())) {
            return false;
        }
        persistence.replaceIdentitySubject(identity.id(), identity.userId(), newSubject);
        return true;
    }

    static Instant parse(String text) {
        try {
            return text == null || text.isBlank() ? null : Instant.parse(text);
        } catch (RuntimeException unreadable) {
            return null;
        }
    }
}
