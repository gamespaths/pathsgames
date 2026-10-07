package games.paths.core.port.match;

import java.util.Optional;

/**
 * ExperienceStorePort - Outbound port of Step 38: the rows use-exp reads and the two it writes.
 */
public interface ExperienceStorePort {

    Optional<MatchExpView> findMatchByUuid(String matchUuid);

    Optional<CharacterExpView> findCharacterByMatchAndUser(long idMatch, long idUser);

    /** The {@code secure_param} of a story location, or empty when the location is gone. */
    Optional<Integer> findLocationSecureParam(long idStory, long idLocation);

    /** The difficulty the match was created on; empty when the row is gone. */
    Optional<DifficultyExpView> findDifficulty(long idStory, long idDifficulty);

    /** Writes the three characteristics and the exp of one character. */
    void updateCharacter(long idMatch, long idCharacter, int dexterity, int intelligence,
                         int constitution, int exp);

    /** One {@code log_events} row whose message starts with {@code EXP_USE}. */
    void logExpUse(long idMatch, long idCharacter, int clock, String message);

    record MatchExpView(long id, String uuid, String status, Long idStory, Long idDifficulty,
                        Integer expCost, int currentClock, Long idCharacterCurrentTurn) {
    }

    record CharacterExpView(long id, String uuid, int dexterity, int intelligence, int constitution,
                            int exp, boolean isSleeping, boolean isComa, Long idLocation) {
    }

    record DifficultyExpView(Integer expCost, Integer expCostBase, Integer maxStatValue) {
    }
}
