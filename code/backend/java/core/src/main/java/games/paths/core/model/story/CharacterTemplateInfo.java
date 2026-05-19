package games.paths.core.model.story;

/**
 * CharacterTemplateInfo - Domain model for a character template summary.
 * Used within StoryDetail to describe available character templates for a story.
 * Immutable record.
 */
public record CharacterTemplateInfo(
        String uuid,
        String name,
        String description,
        int lifeMax,
        int energyMax,
        int sadMax,
        int dexterityStart,
        int intelligenceStart,
        int constitutionStart,
        Integer idCard,
        CardInfo card,
        Integer idClassPermitted,
        Integer idClassProhibited) {
}
