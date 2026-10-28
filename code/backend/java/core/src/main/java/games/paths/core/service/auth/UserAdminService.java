package games.paths.core.service.auth;

import games.paths.core.model.auth.AdminActions;
import games.paths.core.model.auth.AdminUserActionResult;
import games.paths.core.model.auth.AdminUserDetail;
import games.paths.core.model.auth.AdminUserItem;
import games.paths.core.model.auth.AdminUserListFilter;
import games.paths.core.model.auth.AdminUserPage;
import games.paths.core.model.auth.UserAdminException;
import games.paths.core.model.auth.UserAdminException.Code;
import games.paths.core.model.auth.UserIdentity;
import games.paths.core.model.auth.UserStates;
import games.paths.core.model.auth.UserStats;
import games.paths.core.model.match.MatchStatuses;
import games.paths.core.port.auth.AccountPort;
import games.paths.core.port.auth.AdminInterventionPort;
import games.paths.core.port.auth.IdentityPersistencePort;
import games.paths.core.port.auth.TokenPersistencePort;
import games.paths.core.port.auth.UserAdminPersistencePort;
import games.paths.core.port.auth.UserAdminPort;
import games.paths.core.port.auth.UserStatePort;
import games.paths.core.port.match.MatchCommandPort;
import games.paths.core.port.match.MatchPersistencePort;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * UserAdminService - v1.7.0 {@link UserAdminPort}: list (email exact, nickname prefix, state; default = active
 * users by last access), detail, ban / suspend / unblock / re-link / deletion with the intervention log.
 */
public class UserAdminService implements UserAdminPort {

    public static final int DEFAULT_LIMIT = 50;
    public static final int MAX_LIMIT = 200;
    public static final int SUSPEND_MAX_DAYS = 90;
    private static final String SEP = "|";
    /** v1.10.0 the action name of the dev-only expireSuspension answer (never in the intervention log). */
    static final String EXPIRE_SUSPENSION = "EXPIRE_SUSPENSION";

    private final IdentityPersistencePort identities;
    private final UserAdminPersistencePort persistence;
    private final TokenPersistencePort tokens;
    private final UserStatePort userState;
    private final AdminInterventionPort interventions;
    private final SubjectHasher hasher;
    private final MatchPersistencePort matches;
    private final MatchCommandPort matchCommands;
    private final AccountPort accounts;
    private Clock clock = Clock.systemUTC();

    @SuppressWarnings("java:S107")
    public UserAdminService(IdentityPersistencePort identities, UserAdminPersistencePort persistence,
                            TokenPersistencePort tokens, UserStatePort userState,
                            AdminInterventionPort interventions, SubjectHasher hasher, MatchPersistencePort matches,
                            MatchCommandPort matchCommands, AccountPort accounts) {
        this.identities = identities;
        this.persistence = persistence;
        this.tokens = tokens;
        this.userState = userState;
        this.interventions = interventions;
        this.hasher = hasher;
        this.matches = matches;
        this.matchCommands = matchCommands;
        this.accounts = accounts;
    }

    void setClock(Clock clock) {
        this.clock = clock;
    }

    // ── list and detail ──────────────────────────────────────────────────────

    @Override
    public AdminUserPage list(AdminUserListFilter f) {
        AdminUserListFilter filter = f != null ? f : new AdminUserListFilter(null, null, null, null, null);
        int limit = clamp(filter.limit());
        Integer state = parseState(filter.state());
        if (notBlank(filter.email())) {
            List<AdminUserItem> hit = persistence.findByEmail(filter.email().trim().toLowerCase(Locale.ROOT))
                    .filter(u -> state == null || u.state() == state).map(List::of).orElse(List.of());
            return new AdminUserPage(hit, null, limit);
        }
        String[] cursor = decodeCursor(filter.cursor());
        List<AdminUserItem> rows;
        boolean byNickname = state != null || notBlank(filter.nickname());
        if (byNickname) {
            String prefix = notBlank(filter.nickname()) ? filter.nickname().trim().toLowerCase(Locale.ROOT) : "";
            rows = persistence.listByNickname(state, prefix, cursor == null ? null : cursor[0],
                    cursor == null ? null : cursor[1], limit + 1);
        } else {
            rows = persistence.listByLastAccess(UserStates.ACTIVE, cursor == null ? null : cursor[0],
                    cursor == null ? null : cursor[1], limit + 1);
        }
        boolean more = rows.size() > limit;
        List<AdminUserItem> page = new ArrayList<>(more ? rows.subList(0, limit) : rows);
        String next = null;
        if (more) {
            AdminUserItem last = page.get(page.size() - 1);
            next = encodeCursor(byNickname ? nicknameKey(last.nickname()) : nullToEmpty(last.tsLastAccess()),
                    last.uuid());
        }
        return new AdminUserPage(page, next, limit);
    }

    @Override
    public AdminUserDetail detail(String userUuid) {
        Optional<AdminUserItem> found = persistence.findByUuid(userUuid);
        if (found.isEmpty()) {
            return null;
        }
        AdminUserItem user = found.get();
        List<UserIdentity> ids = identities.findIdentitiesOfUser(user.id());
        UserStats stats = accounts != null ? accounts.stats(user.uuid()) : UserStats.EMPTY;
        return new AdminUserDetail(user.isGuest() ? "GUEST" : user.accountType(), user.suspendedUntil(),
                persistence.isRelinkPending(user.id()), persistence.hasBannedHashes(user.uuid()),
                tokens.countActiveTokensByUserId(user.id()), stats, ids);
    }

    // ── actions ──────────────────────────────────────────────────────────────

    @Override
    public AdminUserActionResult ban(String adminUuid, String userUuid, String reason) {
        String why = checkReason(reason);
        AdminUserItem user = bannable(userUuid);
        if (user.state() == UserStates.BANNED) {
            throw new UserAdminException(Code.INVALID_STATE_TRANSITION, "The user is already banned");
        }
        UserIdentity google = googleIdentity(user.id());
        String email = persistence.findEmail(user.id()).orElse(google != null ? google.email() : null);
        persistence.storeBannedHashes(user.uuid(), hasher.subject(google != null ? google.subject() : null),
                hasher.email(email));
        // A user already deleting keeps state 7: the deletion job continues, the hashes stay.
        int state = user.state() == UserStates.DELETING ? UserStates.DELETING : UserStates.BANNED;
        persistence.updateStateAndSuspension(user.id(), state, null);
        cutAccess(user);
        List<String> banned = banActiveMatches(user.id());
        interventions.record(adminUuid, AdminActions.BAN, user.uuid(), why);
        return new AdminUserActionResult(user.uuid(), AdminActions.BAN, state, null, false, banned);
    }

    @Override
    public AdminUserActionResult suspend(String adminUuid, String userUuid, String until, String reason) {
        String why = checkReason(reason);
        AdminUserItem user = bannable(userUuid);
        if (user.state() != UserStates.ACTIVE && user.state() != UserStates.BLOCKED) {
            throw new UserAdminException(Code.INVALID_STATE_TRANSITION, "Only an active or suspended user");
        }
        String end = checkUntil(until);
        persistence.updateStateAndSuspension(user.id(), UserStates.BLOCKED, end);
        cutAccess(user);
        interventions.record(adminUuid, AdminActions.SUSPEND, user.uuid(), why);
        return new AdminUserActionResult(user.uuid(), AdminActions.SUSPEND, UserStates.BLOCKED, end, false, List.of());
    }

    @Override
    public AdminUserActionResult unblock(String adminUuid, String userUuid, String reason) {
        String why = checkReason(reason);
        AdminUserItem user = existing(userUuid);
        if (user.state() != UserStates.BLOCKED && user.state() != UserStates.BANNED) {
            throw new UserAdminException(Code.INVALID_STATE_TRANSITION, "Only a suspended or banned user");
        }
        persistence.updateStateAndSuspension(user.id(), UserStates.ACTIVE, null);
        persistence.deleteBannedHashes(user.uuid());
        userState.evict(user.uuid());
        interventions.record(adminUuid, AdminActions.UNBLOCK, user.uuid(), why);
        return new AdminUserActionResult(user.uuid(), AdminActions.UNBLOCK, UserStates.ACTIVE, null, false, List.of());
    }

    @Override
    public AdminUserActionResult relinkSubject(String adminUuid, String userUuid, String reason) {
        String why = checkReason(reason);
        AdminUserItem user = existing(userUuid);
        if (user.isGuest() || user.state() == UserStates.DELETING || googleIdentity(user.id()) == null) {
            throw new UserAdminException(Code.INVALID_STATE_TRANSITION, "Only a Google user can be re-linked");
        }
        persistence.setRelinkPending(user.id(), true);
        interventions.record(adminUuid, AdminActions.RELINK_SUBJECT, user.uuid(), why);
        return new AdminUserActionResult(user.uuid(), AdminActions.RELINK_SUBJECT, user.state(),
                user.suspendedUntil(), true, List.of());
    }

    @Override
    public AdminUserActionResult deleteUser(String adminUuid, String userUuid, String reason) {
        String why = checkReason(reason);
        AdminUserItem user = bannable(userUuid);
        if (user.state() == UserStates.DELETING) {
            throw new UserAdminException(Code.INVALID_STATE_TRANSITION, "The user is already being deleted");
        }
        identities.updateState(user.id(), UserStates.DELETING);
        cutAccess(user);
        interventions.record(adminUuid, AdminActions.DELETE_OLD_USER, user.uuid(), why);
        return new AdminUserActionResult(user.uuid(), AdminActions.DELETE_OLD_USER, UserStates.DELETING, null,
                false, List.of());
    }

    @Override
    public int purgeInterventionLog() {
        String bound = clock.instant().atOffset(ZoneOffset.UTC).minusMonths(AdminActions.RETENTION_MONTHS)
                .toInstant().toString();
        return interventions.deleteOlderThan(bound);
    }

    @Override
    public AdminUserActionResult expireSuspension(String userUuid) {
        AdminUserItem user = existing(userUuid);
        if (user.state() != UserStates.BLOCKED) {
            throw new UserAdminException(Code.INVALID_STATE_TRANSITION, "Only a suspended user");
        }
        String end = clock.instant().minusSeconds(1).toString();
        persistence.updateStateAndSuspension(user.id(), UserStates.BLOCKED, end);
        userState.evict(user.uuid());
        return new AdminUserActionResult(user.uuid(), EXPIRE_SUSPENSION, UserStates.BLOCKED, end, false, List.of());
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private AdminUserItem existing(String userUuid) {
        if (!notBlank(userUuid)) {
            throw new UserAdminException(Code.USER_NOT_FOUND, "A user uuid is required");
        }
        return persistence.findByUuid(userUuid.trim())
                .orElseThrow(() -> new UserAdminException(Code.USER_NOT_FOUND, "No user has this uuid"));
    }

    /** A user that may be banned, suspended or deleted: never a guest, never an ADMIN. */
    private AdminUserItem bannable(String userUuid) {
        AdminUserItem user = existing(userUuid);
        if (user.isGuest()) {
            throw new UserAdminException(Code.GUEST_NOT_BANNABLE, "Guests are limited per IP, not banned");
        }
        if (user.isAdmin()) {
            throw new UserAdminException(Code.ADMIN_NOT_BANNABLE, "An ADMIN can never be banned or suspended");
        }
        return user;
    }

    /** v1.7.0 sessions revoked with reason ADMIN and the access tokens issued until now refused. */
    private void cutAccess(AdminUserItem user) {
        tokens.revokeAllUserTokens(user.id(), games.paths.core.model.auth.RevokeReasons.ADMIN);
        tokens.setSessionsValidAfter(user.id(), SessionService.validAfter(clock.instant()));
        userState.evict(user.uuid());
    }

    private List<String> banActiveMatches(long userId) {
        List<String> uuids = matches.findMatchUuidsByUserCreator(userId, MatchStatuses.ACTIVE);
        List<String> banned = new ArrayList<>();
        for (String uuid : uuids) {
            if (matchCommands.updateMatch(uuid, MatchStatuses.BANNED, null, AdminActions.BAN)
                    == MatchCommandPort.UpdateOutcome.UPDATED) {
                banned.add(uuid);
            }
        }
        return banned;
    }

    private UserIdentity googleIdentity(long userId) {
        return identities.findIdentitiesOfUser(userId).stream()
                .filter(i -> UserIdentity.PROVIDER_GOOGLE.equals(i.provider())).findFirst().orElse(null);
    }

    static String checkReason(String reason) {
        if (!notBlank(reason)) {
            throw new UserAdminException(Code.INVALID_INPUT, "A reason is required");
        }
        String text = reason.trim();
        if (text.length() > AdminActions.REASON_MAX) {
            throw new UserAdminException(Code.INVALID_INPUT, "The reason is longer than 500 characters");
        }
        return text;
    }

    /** The ISO-8601 end of a suspension: an instant or a date (its start, UTC), future and within 90 days. */
    String checkUntil(String until) {
        if (!notBlank(until)) {
            throw new UserAdminException(Code.SUSPEND_UNTIL_INVALID, "until is required");
        }
        Instant end;
        try {
            String t = until.trim();
            end = t.length() == 10 ? LocalDate.parse(t).atStartOfDay(ZoneOffset.UTC).toInstant() : Instant.parse(t);
        } catch (DateTimeParseException e) {
            throw new UserAdminException(Code.SUSPEND_UNTIL_INVALID, "until is not an ISO-8601 date");
        }
        Instant now = clock.instant();
        if (!end.isAfter(now) || end.isAfter(now.plus(SUSPEND_MAX_DAYS, ChronoUnit.DAYS))) {
            throw new UserAdminException(Code.SUSPEND_UNTIL_INVALID, "until must be in the next 90 days");
        }
        return end.toString();
    }

    static Integer parseState(String state) {
        if (!notBlank(state)) {
            return null;
        }
        try {
            int value = Integer.parseInt(state.trim());
            if (value >= UserStates.REGISTRATION && value <= UserStates.DELETING && value != UserStates.GUEST) {
                return value;
            }
        } catch (NumberFormatException ignored) {
            // falls through to the refusal
        }
        throw new UserAdminException(Code.INVALID_INPUT, "state must be 1-7 (6, guests, is not listable)");
    }

    static int clamp(Integer limit) {
        return limit == null ? DEFAULT_LIMIT : Math.max(1, Math.min(limit, MAX_LIMIT));
    }

    static String nicknameKey(String nickname) {
        return nickname == null ? "" : nickname.toLowerCase(Locale.ROOT);
    }

    static String encodeCursor(String key, String uuid) {
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString((key + SEP + uuid).getBytes(StandardCharsets.UTF_8));
    }

    /** [key, uuid] of an opaque cursor; null (first page) when missing or malformed. */
    static String[] decodeCursor(String cursor) {
        if (!notBlank(cursor)) {
            return null;
        }
        try {
            String raw = new String(Base64.getUrlDecoder().decode(cursor.trim()), StandardCharsets.UTF_8);
            int sep = raw.lastIndexOf(SEP);
            if (sep < 0 || sep == raw.length() - 1) {
                return null;
            }
            return new String[]{raw.substring(0, sep), raw.substring(sep + 1)};
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static String nullToEmpty(String text) {
        return text == null ? "" : text;
    }

    private static boolean notBlank(String text) {
        return text != null && !text.isBlank();
    }
}
