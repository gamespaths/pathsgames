package games.paths.core.model.story;

/**
 * CreatorInfo - Domain model for a content creator profile.
 * Used to expose creator details for cards, texts, and stories.
 * Immutable record (added in Step 16 for the content detail APIs).
 */
public record CreatorInfo(
        String uuid,
        String name,
        String link,
        String url,
        String urlImage,
        String urlEmote,
        String urlInstagram) {
}
