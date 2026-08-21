package games.paths.core.service.match;

import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.model.match.CharacterInstanceInfo;
import games.paths.core.port.match.CharacterQueryPort;
import games.paths.core.port.match.CharacterReadPort;
import games.paths.core.port.match.MatchReadPort;
import games.paths.core.port.match.UserAccessPort;
import games.paths.core.port.story.ContentQueryPort;
import games.paths.core.port.story.StoryReadPort;

import java.util.List;
import java.util.Optional;

/**
 * CharacterQueryService - Domain service implementing the read-side character
 * operations (Step 21): list the players of a match and read a single
 * character detail. Access is granted to the match creator or to any user who
 * already has a character in the match.
 */
public class CharacterQueryService implements CharacterQueryPort {

    private final MatchReadPort matchReadPort;
    private final CharacterReadPort characterReadPort;
    private final StoryReadPort storyReadPort;
    private final UserAccessPort userAccessPort;
    /** Step 34 — resolves the item cards; null keeps the endpoints working without them. */
    private final ContentQueryPort contentQueryPort;

    public CharacterQueryService(MatchReadPort matchReadPort,
                                 CharacterReadPort characterReadPort,
                                 StoryReadPort storyReadPort,
                                 UserAccessPort userAccessPort) {
        this(matchReadPort, characterReadPort, storyReadPort, userAccessPort, null);
    }

    public CharacterQueryService(MatchReadPort matchReadPort,
                                 CharacterReadPort characterReadPort,
                                 StoryReadPort storyReadPort,
                                 UserAccessPort userAccessPort,
                                 ContentQueryPort contentQueryPort) {
        this.matchReadPort = matchReadPort;
        this.characterReadPort = characterReadPort;
        this.storyReadPort = storyReadPort;
        this.userAccessPort = userAccessPort;
        this.contentQueryPort = contentQueryPort;
    }

    @Override
    public List<CharacterInstanceInfo> listPlayers(String matchUuid, String userUuid) {
        if (isBlank(matchUuid) || isBlank(userUuid)) {
            return null;
        }
        Optional<GamingMatchEntity> matchOpt = matchReadPort.findMatchByUuid(matchUuid);
        if (matchOpt.isEmpty()) {
            return null;
        }
        GamingMatchEntity match = matchOpt.get();
        UserAccessPort.UserView user = resolveAccess(match, userUuid);
        if (user == null) {
            return null;
        }
        List<GamingCharacterInstanceEntity> characters = characterReadPort.findCharactersByMatchId(match.getId());
        return buildInfos(characters, match, user);
    }

    @Override
    public CharacterInstanceInfo getCharacter(String matchUuid, String characterUuid, String userUuid) {
        if (isBlank(matchUuid) || isBlank(characterUuid) || isBlank(userUuid)) {
            return null;
        }
        Optional<GamingMatchEntity> matchOpt = matchReadPort.findMatchByUuid(matchUuid);
        if (matchOpt.isEmpty()) {
            return null;
        }
        GamingMatchEntity match = matchOpt.get();
        UserAccessPort.UserView user = resolveAccess(match, userUuid);
        if (user == null) {
            return null;
        }
        Optional<GamingCharacterInstanceEntity> charOpt =
                characterReadPort.findCharacterByMatchIdAndUuid(match.getId(), characterUuid);
        if (charOpt.isEmpty()) {
            return null;
        }
        List<CharacterInstanceInfo> built = buildInfos(List.of(charOpt.get()), match, user);
        return built.isEmpty() ? null : built.get(0);
    }

    /**
     * Resolves the requesting user and checks access: the user must be the match
     * creator or already have a character in the match. Returns {@code null}
     * when the user is unknown or has no access.
     */
    private UserAccessPort.UserView resolveAccess(GamingMatchEntity match, String userUuid) {
        Optional<UserAccessPort.UserView> userOpt = userAccessPort.findByUuid(userUuid);
        if (userOpt.isEmpty()) {
            return null;
        }
        UserAccessPort.UserView user = userOpt.get();
        if (user.id() != null && user.id().equals(match.getIdUserCreator())) {
            return user;
        }
        boolean participant = characterReadPort.findCharactersByMatchId(match.getId()).stream()
                .anyMatch(c -> c.getIdUser() != null && c.getIdUser().equals(user.id()));
        return participant ? user : null;
    }

    private List<CharacterInstanceInfo> buildInfos(List<GamingCharacterInstanceEntity> characters,
                                                   GamingMatchEntity match,
                                                   UserAccessPort.UserView requester) {
        String requesterUuid = requester != null ? requester.uuid() : null;
        Long requesterId = requester != null ? requester.id() : null;
        // These two endpoints carry no ?lang=, so English is what preserves today's
        // behaviour exactly; adding lang to the port is a follow-up, not this step.
        return CharacterMapper.buildAll(characters, match,
                new CharacterMapper.MapperContext(storyReadPort, characterReadPort, contentQueryPort,
                        requesterUuid, requesterId, ItemInstanceMapper.DEFAULT_LANG, true));
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
