package games.paths.core.model.story;

/**
 * TextInfo - Domain model for a resolved text entry.
 * Includes both short and long text, resolved language, and optional
 * copyright and creator information. Immutable record.
 *
 * <p>Added in Step 16 for the content detail APIs.</p>
 */
public record TextInfo(
        int idText,
        String lang,
        String resolvedLang,
        String shortText,
        String longText,
        String copyrightText,
        String linkCopyright,
        CreatorInfo creator) {
}
