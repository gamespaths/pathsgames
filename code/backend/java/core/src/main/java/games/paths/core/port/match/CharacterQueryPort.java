package games.paths.core.port.match;

import games.paths.core.model.match.CharacterInstanceInfo;

import java.util.List;

/**
 * CharacterQueryPort - Inbound port for the read-side character operations.
 * Step 21: list the players of a match and read a single character detail.
 */
public interface CharacterQueryPort {

    /**
     * Lists the characters of a match. Returns {@code null} when the match does
     * not exist or the user is neither its creator nor a participant.
     */
    List<CharacterInstanceInfo> listPlayers(String matchUuid, String userUuid);

    /**
     * Returns the full detail of a single character in a match, or {@code null}
     * when the match/character does not exist or the user cannot access it.
     */
    CharacterInstanceInfo getCharacter(String matchUuid, String characterUuid, String userUuid);
}
