package games.paths.core.service.story;

import games.paths.core.entity.story.CardEntity;
import games.paths.core.entity.story.CreatorEntity;
import games.paths.core.entity.story.StoryEntity;
import games.paths.core.entity.story.TextEntity;
import games.paths.core.model.story.CardInfo;
import games.paths.core.model.story.CreatorInfo;
import games.paths.core.model.story.TextInfo;
import games.paths.core.port.story.ContentQueryPort;
import games.paths.core.port.story.StoryReadPort;

import java.util.Optional;

/**
 * ContentQueryService - Domain service implementing content querying.
 * Provides card, text, and creator lookup for a specific story,
 * with multi-language text resolution and fallback to English.
 *
 * <p>Added in Step 16 for story content detail APIs.</p>
 */
public class ContentQueryService implements ContentQueryPort {

    private final StoryReadPort readPort;

    public ContentQueryService(StoryReadPort readPort) {
        this.readPort = readPort;
    }

    @Override
    public CardInfo getCardByStoryAndCardUuid(String storyUuid, String cardUuid, String lang) {
        if (storyUuid == null || storyUuid.isBlank()) {
            return null;
        }
        if (cardUuid == null || cardUuid.isBlank()) {
            return null;
        }

        Optional<StoryEntity> storyOpt = readPort.findStoryByUuid(storyUuid);
        if (storyOpt.isEmpty()) {
            return null;
        }

        StoryEntity story = storyOpt.get();
        Optional<CardEntity> cardOpt = readPort.findCardByStoryIdAndUuid(story.getId(), cardUuid);
        if (cardOpt.isEmpty()) {
            return null;
        }

        CardEntity card = cardOpt.get();
        String title = resolveText(story.getId(), card.getIdTextTitle(), lang);
        String description = resolveText(story.getId(), card.getIdTextDescription(), lang);
        String copyrightText = resolveText(story.getId(), card.getIdTextCopyright(), lang);
        CreatorInfo creator = resolveCreator(story.getId(), card.getIdCreator(), lang);

        return CardInfo.builder()
                .uuid(card.getUuid())
                .imageUrl(card.getUrlImmage())
                .alternativeImage(card.getAlternativeImage())
                .awesomeIcon(card.getAwesomeIcon())
                .styleMain(card.getStyleMain())
                .styleDetail(card.getStyleDetail())
                .title(title)
                .description(description)
                .copyrightText(copyrightText)
                .linkCopyright(card.getLinkCopyright())
                .creator(creator)
                .build();
    }

    @Override
    public TextInfo getTextByStoryAndIdText(String storyUuid, int idText, String lang) {
        if (storyUuid == null || storyUuid.isBlank()) {
            return null;
        }

        Optional<StoryEntity> storyOpt = readPort.findStoryByUuid(storyUuid);
        if (storyOpt.isEmpty()) {
            return null;
        }

        StoryEntity story = storyOpt.get();
        String effectiveLang = (lang != null && !lang.isBlank()) ? lang : "en";

        Optional<TextEntity> textOpt = readPort.findTextByStoryIdTextAndLang(story.getId(), idText, effectiveLang);
        String resolvedLang = effectiveLang;

        if (textOpt.isEmpty() && !"en".equals(effectiveLang)) {
            textOpt = readPort.findTextByStoryIdTextAndLang(story.getId(), idText, "en");
            if (textOpt.isPresent()) {
                resolvedLang = "en";
            }
        }

        if (textOpt.isEmpty()) {
            return null;
        }

        TextEntity text = textOpt.get();
        String copyrightText = resolveText(story.getId(), text.getIdTextCopyright(), effectiveLang);
        CreatorInfo creator = resolveCreator(story.getId(), text.getIdCreator(), effectiveLang);

        return TextInfo.builder()
                .idText(text.getIdText())
                .lang(effectiveLang)
                .resolvedLang(resolvedLang)
                .shortText(text.getShortText())
                .longText(text.getLongText())
                .copyrightText(copyrightText)
                .linkCopyright(text.getLinkCopyright())
                .creator(creator)
                .build();
    }

    @Override
    public CreatorInfo getCreatorByStoryAndCreatorUuid(String storyUuid, String creatorUuid, String lang) {
        if (storyUuid == null || storyUuid.isBlank()) {
            return null;
        }
        if (creatorUuid == null || creatorUuid.isBlank()) {
            return null;
        }

        Optional<StoryEntity> storyOpt = readPort.findStoryByUuid(storyUuid);
        if (storyOpt.isEmpty()) {
            return null;
        }

        StoryEntity story = storyOpt.get();
        Optional<CreatorEntity> creatorOpt = readPort.findCreatorByStoryIdAndUuid(story.getId(), creatorUuid);
        if (creatorOpt.isEmpty()) {
            return null;
        }

        CreatorEntity creator = creatorOpt.get();
        String name = resolveText(story.getId(), creator.getIdText(), lang);

        return CreatorInfo.builder()
                .uuid(creator.getUuid())
                .name(name)
                .link(creator.getLink())
                .url(creator.getUrl())
                .urlImage(creator.getUrlImage())
                .urlEmote(creator.getUrlEmote())
                .urlInstagram(creator.getUrlInstagram())
                .build();
    }

    // === Private helpers ===

    /**
     * Resolves a text entry by story ID, text ID and language.
     * Falls back to "en" if the requested language is not found,
     * and returns null if no text exists at all.
     */
    private String resolveText(Long storyId, Integer idText, String lang) {
        if (idText == null) {
            return null;
        }
        String effectiveLang = (lang != null && !lang.isBlank()) ? lang : "en";

        Optional<TextEntity> text = readPort.findTextByStoryIdTextAndLang(storyId, idText, effectiveLang);
        if (text.isPresent()) {
            return text.get().getShortText();
        }

        // Fallback to English if requested lang not found
        if (!"en".equals(effectiveLang)) {
            Optional<TextEntity> fallback = readPort.findTextByStoryIdTextAndLang(storyId, idText, "en");
            if (fallback.isPresent()) {
                return fallback.get().getShortText();
            }
        }
        return null;
    }

    /**
     * Resolves a creator by looking up the integer id_creator reference
     * as the primary key (id) in the creator table for the story.
     * Note: id_creator on cards/texts refers to the creator's PK, not the UUID.
     */
    private CreatorInfo resolveCreator(Long storyId, Integer idCreator, String lang) {
        if (idCreator == null) {
            return null;
        }

        // id_creator in cards/texts is a reference to the creator's row.
        // We look up by story to find creators and match by the creator entity's idText or ID.
        // Since id_creator points to the creator table's business reference,
        // we search all creators for this story and find a match.
        // The simplest approach: use the creator list filtered by story.
        // For efficiency in Step 16 we just use the list that's already loaded.
        java.util.List<games.paths.core.entity.story.CreatorEntity> creators =
                readPort.findCreatorsByStoryId(storyId);
        for (games.paths.core.entity.story.CreatorEntity creator : creators) {
            if (creator.getId() != null && creator.getId().intValue() == idCreator) {
                String name = resolveText(storyId, creator.getIdText(), lang);
                return CreatorInfo.builder()
                        .uuid(creator.getUuid())
                        .name(name)
                        .link(creator.getLink())
                        .url(creator.getUrl())
                        .urlImage(creator.getUrlImage())
                        .urlEmote(creator.getUrlEmote())
                        .urlInstagram(creator.getUrlInstagram())
                        .build();
            }
        }
        return null;
    }
}
