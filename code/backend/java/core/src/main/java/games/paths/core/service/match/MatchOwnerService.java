package games.paths.core.service.match;

import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.model.auth.AdminUserView;
import games.paths.core.model.match.MatchOwnerMoveResult;
import games.paths.core.model.match.MatchOwnerMoveResult.Owner;
import games.paths.core.model.match.MatchStatuses;
import games.paths.core.port.match.CharacterReadPort;
import games.paths.core.port.match.MatchLogWriterPort;
import games.paths.core.port.match.MatchOwnerPort;
import games.paths.core.port.match.MatchPersistencePort;
import games.paths.core.port.match.UserDirectoryPort;
import games.paths.core.port.match.MatchOwnerPort.MatchOwnerException.Code;

import java.time.Clock;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * MatchOwnerService - v0.41.6 admin owner move: resolve uuid → email → username, refuse terminal,
 * multi-character, not eligible and duplicate-active targets, move creator and characters, log it.
 */
public class MatchOwnerService implements MatchOwnerPort {

    private final MatchPersistencePort persistence;
    private final CharacterReadPort characters;
    private final UserDirectoryPort users;
    private final MatchLogWriterPort logWriter;
    private final Clock clock;

    public MatchOwnerService(MatchPersistencePort persistence, CharacterReadPort characters,
                             UserDirectoryPort users, MatchLogWriterPort logWriter) {
        this(persistence, characters, users, logWriter, Clock.systemUTC());
    }

    public MatchOwnerService(MatchPersistencePort persistence, CharacterReadPort characters,
                             UserDirectoryPort users, MatchLogWriterPort logWriter, Clock clock) {
        this.persistence = persistence;
        this.characters = characters;
        this.users = users;
        this.logWriter = logWriter;
        this.clock = clock;
    }

    @Override
    public AdminUserView owner(String uuidMatch) {
        GamingMatchEntity match = requireMatch(uuidMatch);
        return creator(match).map(this::counted).orElseThrow(() -> new MatchOwnerException(
                Code.USER_NOT_FOUND, "The owner of the match no longer exists"));
    }

    @Override
    public AdminUserView findUser(String identifier) {
        return counted(resolve(identifier));
    }

    @Override
    public MatchOwnerMoveResult move(String uuidMatch, String identifier) {
        if (isBlank(identifier)) {
            throw new MatchOwnerException(Code.INVALID_INPUT, "Field 'user' is required");
        }
        GamingMatchEntity match = requireMatch(uuidMatch);
        AdminUserView target = resolve(identifier);
        if (MatchStatuses.isTerminal(match.getStatus())) {
            throw new MatchOwnerException(Code.MATCH_TERMINATED, "A terminated match cannot be moved");
        }
        List<GamingCharacterInstanceEntity> rows = characters.findCharactersByMatchId(match.getId());
        Optional<AdminUserView> previous = creator(match);
        Owner from = previous.map(MatchOwnerService::ownerOf).orElse(new Owner(null, null));
        Owner to = ownerOf(target);
        if (Objects.equals(match.getIdUserCreator(), target.id())
                && rows.stream().allMatch(c -> Objects.equals(c.getIdUser(), target.id()))) {
            return new MatchOwnerMoveResult(MatchOwnerMoveResult.UNCHANGED, match.getUuid(), from, to, 0);
        }
        // With one character, a target that already holds it can only be a half-written move: repaired.
        if (rows.size() > 1) {
            throw new MatchOwnerException(Code.MATCH_MULTI_CHARACTER,
                    "A match with more than one character cannot be moved");
        }
        String reason = target.reason(clock.instant());
        if (reason != null) {
            throw new MatchOwnerException(Code.valueOf(reason), AdminUserView.REASON_EXPIRED.equals(reason)
                    ? "The target guest has expired" : "The target user cannot own a match");
        }
        // A target that already is the creator (repair) owns this very match: not a duplicate.
        if (!Objects.equals(match.getIdUserCreator(), target.id())
                && persistence.hasActiveMatchForStory(target.id(), match.getIdStory(), List.copyOf(MatchStatuses.ACTIVE))) {
            throw new MatchOwnerException(Code.ACTIVE_MATCH_ALREADY_EXISTS,
                    "The target user already has an active match on this story");
        }
        int moved = persistence.changeOwner(match.getId(), target.id());
        if (logWriter != null) {
            int now = match.getCurrentClock() == null ? 0 : match.getCurrentClock();
            logWriter.write(match.getId(), null, null, now,
                    MatchLogWriterPort.ownerChanged(label(from), label(to)));
        }
        return new MatchOwnerMoveResult(MatchOwnerMoveResult.MOVED, match.getUuid(), from, to, moved);
    }

    /** uuid first (when it parses as one), then a unique email, then a unique username. */
    AdminUserView resolve(String identifier) {
        if (isBlank(identifier)) {
            throw new MatchOwnerException(Code.INVALID_INPUT, "A user identifier is required");
        }
        String id = identifier.trim();
        if (isUuid(id)) {
            Optional<AdminUserView> byUuid = users.findByUuid(id);
            if (byUuid.isPresent()) {
                return byUuid.get();
            }
        }
        Optional<AdminUserView> byEmail = unique(users.findByEmail(id), "email");
        if (byEmail.isPresent()) {
            return byEmail.get();
        }
        return unique(users.findByUsername(id), "username").orElseThrow(() -> new MatchOwnerException(
                Code.USER_NOT_FOUND, "No user matches: " + id));
    }

    private static Optional<AdminUserView> unique(List<AdminUserView> hits, String what) {
        if (hits == null || hits.isEmpty()) {
            return Optional.empty();
        }
        if (hits.size() > 1) {
            throw new MatchOwnerException(Code.USER_AMBIGUOUS, "More than one user has this " + what);
        }
        return Optional.of(hits.get(0));
    }

    private GamingMatchEntity requireMatch(String uuidMatch) {
        if (isBlank(uuidMatch)) {
            throw new MatchOwnerException(Code.INVALID_INPUT, "The match uuid is required");
        }
        return persistence.findMatchByUuid(uuidMatch).orElseThrow(() -> new MatchOwnerException(
                Code.MATCH_NOT_FOUND, "Match not found: " + uuidMatch));
    }

    private Optional<AdminUserView> creator(GamingMatchEntity match) {
        return match.getIdUserCreator() == null ? Optional.empty() : users.findById(match.getIdUserCreator());
    }

    private AdminUserView counted(AdminUserView user) {
        return user.withMatchCount(persistence.countMatchesByUserCreator(user.id()));
    }

    private static Owner ownerOf(AdminUserView user) {
        return new Owner(user.uuid(), user.username());
    }

    private static String label(Owner owner) {
        return owner.username() + "/" + owner.uuid();
    }

    private static boolean isUuid(String text) {
        try {
            UUID.fromString(text);
            return text.length() == 36;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private static boolean isBlank(String text) {
        return text == null || text.isBlank();
    }
}
