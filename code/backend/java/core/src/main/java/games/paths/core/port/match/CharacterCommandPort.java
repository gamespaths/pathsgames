package games.paths.core.port.match;

import games.paths.core.model.match.CharacterInstanceInfo;
import games.paths.core.model.match.JoinMatchCommand;

/**
 * CharacterCommandPort - Inbound port for the write-side character operations.
 * Step 21: a player joins a match and instantiates a character.
 */
public interface CharacterCommandPort {

    /**
     * Joins a match: validates the loadout, computes the final statistics
     * (template + class + difficulty + traits) and persists the
     * {@code gaming_character_instance}, {@code gaming_backpack_resources} and
     * {@code gaming_character_traits} rows.
     *
     * @return the created character instance
     * @throws CharacterJoinException for explicit business-rule failures
     */
    CharacterInstanceInfo join(JoinMatchCommand command);

    /**
     * CharacterJoinException - thrown when a character cannot join a match.
     * The {@link #getCode()} value drives the HTTP status mapping in the
     * controller layer.
     */
    class CharacterJoinException extends RuntimeException {

        public enum Code {
            INVALID_INPUT,
            MATCH_NOT_FOUND,
            USER_NOT_FOUND,
            USER_BANNED,
            TEMPLATE_NOT_FOUND,
            CLASS_NOT_FOUND,
            CLASS_NOT_COMPATIBLE,
            ALREADY_JOINED,
            MATCH_NOT_JOINABLE,
            // Step 23 — trait selection validation
            TRAIT_NOT_FOUND,
            TRAIT_DUPLICATED,
            TRAIT_NOT_COMPATIBLE,
            TRAIT_COST_EXCEEDED
        }

        private final Code code;

        public CharacterJoinException(Code code, String message) {
            super(message);
            this.code = code;
        }

        public Code getCode() { return code; }
    }
}
