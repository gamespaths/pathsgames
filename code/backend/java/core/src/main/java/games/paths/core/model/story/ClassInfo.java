package games.paths.core.model.story;

import java.util.List;

/**
 * ClassInfo - Domain model for a character class summary.
 * Used within StoryDetail to describe available classes for a story.
 * Immutable record; {@code bonuses} is always a non-null immutable list.
 */
public record ClassInfo(
        Long id,
        String uuid,
        String name,
        String description,
        int weightMax,
        int dexterityBase,
        int intelligenceBase,
        int constitutionBase,
        Integer idCard,
        CardInfo card,
        List<ClassBonusInfo> bonuses) {

    public ClassInfo {
        bonuses = ClassBonusInfoListHelper.immutableCopy(bonuses);
    }
}
