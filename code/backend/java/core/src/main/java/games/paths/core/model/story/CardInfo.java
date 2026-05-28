package games.paths.core.model.story;

/**
 * CardInfo - Domain model for a visual card with resolved text
 * and optional creator information. Immutable record.
 *
 * <p>Used within story summaries and content detail APIs. Enhanced in Step 16
 * to include copyright and creator fields (consolidated from the former
 * CardDetail type).</p>
 */
public record CardInfo(
        String uuid,
        String cardType,
        String urlImage,
        String alternativeImage,
        String awesomeIcon,
        String styleMain,
        String styleDetail,
        String styleImageLittle,
        String styleImageMedium,
        String styleImageLarge,
        String title,
        String description,
        String copyrightText,
        String linkCopyright,
        CreatorInfo creator) {
}
