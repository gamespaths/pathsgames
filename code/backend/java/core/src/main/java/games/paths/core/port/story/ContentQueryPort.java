package games.paths.core.port.story;

import games.paths.core.model.story.CardInfo;
import games.paths.core.model.story.CreatorInfo;
import games.paths.core.model.story.TextInfo;

/**
 * ContentQueryPort - Inbound port for querying story content details.
 * Part of the Hexagonal Architecture: this is a domain port
 * that the adapter-rest module will call to retrieve card, text,
 * and creator content for a specific story.
 *
 * <p>Added in Step 16 for story content detail APIs.</p>
 */
public interface ContentQueryPort {

    /**
     * Retrieves the full detail of a card within a story.
     *
     * @param storyUuid the story UUID
     * @param cardUuid  the card UUID
     * @param lang      the language code for text resolution (e.g., "en", "it")
     * @return the card detail, or null if story or card not found
     */
    CardInfo getCardByStoryAndCardUuid(String storyUuid, String cardUuid, String lang);

    /**
     * Retrieves a resolved text entry within a story,
     * with language fallback to English if the requested language is not available.
     *
     * @param storyUuid the story UUID
     * @param idText    the text business identifier (integer grouping key)
     * @param lang      the language code (e.g., "en", "it")
     * @return the text info, or null if story or text not found
     */
    TextInfo getTextByStoryAndIdText(String storyUuid, int idText, String lang);

    /**
     * Retrieves the detail of a creator within a story.
     *
     * @param storyUuid   the story UUID
     * @param creatorUuid the creator UUID
     * @param lang        the language code for text resolution
     * @return the creator info, or null if story or creator not found
     */
    CreatorInfo getCreatorByStoryAndCreatorUuid(String storyUuid, String creatorUuid, String lang);
}
