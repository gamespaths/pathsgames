package games.paths.core.service.story;

import games.paths.core.entity.story.CardEntity;
import games.paths.core.entity.story.CreatorEntity;
import games.paths.core.entity.story.StoryEntity;
import games.paths.core.entity.story.TextEntity;
import games.paths.core.model.story.CardInfo;
import games.paths.core.model.story.CreatorInfo;
import games.paths.core.model.story.TextInfo;
import games.paths.core.port.story.StoryReadPort;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link ContentQueryService}.
 * Ensures full branch coverage for card, text, and creator content retrieval,
 * including text resolution with language fallback, creator resolution,
 * and all null/blank/missing edge cases.
 */
@ExtendWith(MockitoExtension.class)
class ContentQueryServiceTest {

    @Mock
    private StoryReadPort readPort;

    @InjectMocks
    private ContentQueryService service;

    // === Helpers ===

    private StoryEntity createStory(Long id, String uuid) {
        StoryEntity s = new StoryEntity();
        s.setId(id);
        s.setUuid(uuid);
        return s;
    }

    private CardEntity createCard(String uuid, Long storyId) {
        CardEntity c = new CardEntity();
        c.setId(10L);
        c.setUuid(uuid);
        c.setIdStory(storyId);
        c.setUrlImmage("https://img.com/card.png");
        c.setAlternativeImage("alt.jpg");
        c.setAwesomeIcon("fa-star");
        c.setStyleMain("bg-primary");
        c.setStyleDetail("text-light");
        c.setIdTextTitle(100);
        c.setIdTextDescription(101);
        c.setIdTextCopyright(102);
        c.setLinkCopyright("https://copy.com");
        c.setIdCreator(5);
        return c;
    }

    private TextEntity createText(Long storyId, Integer idText, String lang, String shortText, String longText) {
        TextEntity t = new TextEntity();
        t.setIdStory(storyId);
        t.setIdText(idText);
        t.setLang(lang);
        t.setShortText(shortText);
        t.setLongText(longText);
        t.setIdTextCopyright(200);
        t.setLinkCopyright("https://textcopy.com");
        t.setIdCreator(6);
        return t;
    }

    private CreatorEntity createCreator(Long id, String uuid, Long storyId) {
        CreatorEntity cr = new CreatorEntity();
        cr.setId(id);
        cr.setUuid(uuid);
        cr.setIdStory(storyId);
        cr.setIdText(300);
        cr.setLink("https://creator.com");
        cr.setUrl("https://creator.com/profile");
        cr.setUrlImage("https://creator.com/avatar.png");
        cr.setUrlEmote("https://creator.com/emote.png");
        cr.setUrlInstagram("https://instagram.com/creator");
        return cr;
    }

    // === GetCardByStoryAndCardUuid ===

    @Nested
    @DisplayName("GetCardByStoryAndCardUuid")
    class GetCard {

        @Test
        @DisplayName("Should return null when storyUuid is null")
        void storyUuid_null() {
            assertNull(service.getCardByStoryAndCardUuid(null, "card-uuid", "en"));
        }

        @Test
        @DisplayName("Should return null when storyUuid is blank")
        void storyUuid_blank() {
            assertNull(service.getCardByStoryAndCardUuid("  ", "card-uuid", "en"));
        }

        @Test
        @DisplayName("Should return null when cardUuid is null")
        void cardUuid_null() {
            assertNull(service.getCardByStoryAndCardUuid("story-uuid", null, "en"));
        }

        @Test
        @DisplayName("Should return null when cardUuid is blank")
        void cardUuid_blank() {
            assertNull(service.getCardByStoryAndCardUuid("story-uuid", "", "en"));
        }

        @Test
        @DisplayName("Should return null when story not found")
        void storyNotFound() {
            when(readPort.findStoryByUuid("unknown")).thenReturn(Optional.empty());
            assertNull(service.getCardByStoryAndCardUuid("unknown", "card-uuid", "en"));
        }

        @Test
        @DisplayName("Should return null when card not found in story")
        void cardNotFound() {
            StoryEntity story = createStory(1L, "story-uuid");
            when(readPort.findStoryByUuid("story-uuid")).thenReturn(Optional.of(story));
            when(readPort.findCardByStoryIdAndUuid(1L, "card-uuid")).thenReturn(Optional.empty());

            assertNull(service.getCardByStoryAndCardUuid("story-uuid", "card-uuid", "en"));
        }

        @Test
        @DisplayName("Should return full card detail with resolved texts and creator")
        void success_fullCard() {
            StoryEntity story = createStory(1L, "story-uuid");
            CardEntity card = createCard("card-uuid", 1L);
            CreatorEntity creator = createCreator(5L, "cr-uuid", 1L);

            when(readPort.findStoryByUuid("story-uuid")).thenReturn(Optional.of(story));
            when(readPort.findCardByStoryIdAndUuid(1L, "card-uuid")).thenReturn(Optional.of(card));

            // Text resolution for title, description, copyright
            TextEntity titleText = new TextEntity();
            titleText.setShortText("Card Title");
            when(readPort.findTextByStoryIdTextAndLang(1L, 100, "en")).thenReturn(Optional.of(titleText));

            TextEntity descText = new TextEntity();
            descText.setShortText("Card Description");
            when(readPort.findTextByStoryIdTextAndLang(1L, 101, "en")).thenReturn(Optional.of(descText));

            TextEntity copyText = new TextEntity();
            copyText.setShortText("© 2026");
            when(readPort.findTextByStoryIdTextAndLang(1L, 102, "en")).thenReturn(Optional.of(copyText));

            // Creator resolution
            when(readPort.findCreatorsByStoryId(1L)).thenReturn(List.of(creator));
            TextEntity creatorNameText = new TextEntity();
            creatorNameText.setShortText("Author Name");
            when(readPort.findTextByStoryIdTextAndLang(1L, 300, "en")).thenReturn(Optional.of(creatorNameText));

            CardInfo result = service.getCardByStoryAndCardUuid("story-uuid", "card-uuid", "en");

            assertNotNull(result);
            assertAll("Card detail fields",
                () -> assertEquals("card-uuid", result.getUuid()),
                () -> assertEquals("https://img.com/card.png", result.getImageUrl()),
                () -> assertEquals("alt.jpg", result.getAlternativeImage()),
                () -> assertEquals("fa-star", result.getAwesomeIcon()),
                () -> assertEquals("bg-primary", result.getStyleMain()),
                () -> assertEquals("text-light", result.getStyleDetail()),
                () -> assertEquals("Card Title", result.getTitle()),
                () -> assertEquals("Card Description", result.getDescription()),
                () -> assertEquals("© 2026", result.getCopyrightText()),
                () -> assertEquals("https://copy.com", result.getLinkCopyright()),
                () -> assertNotNull(result.getCreator()),
                () -> assertEquals("cr-uuid", result.getCreator().getUuid()),
                () -> assertEquals("Author Name", result.getCreator().getName())
            );
        }

        @Test
        @DisplayName("Should return card with null text IDs producing null text fields")
        void success_nullTextIds() {
            StoryEntity story = createStory(1L, "story-uuid");
            CardEntity card = new CardEntity();
            card.setId(10L);
            card.setUuid("card-uuid");
            card.setIdStory(1L);
            card.setUrlImmage("https://img.com/card.png");
            // All text IDs and creator are null

            when(readPort.findStoryByUuid("story-uuid")).thenReturn(Optional.of(story));
            when(readPort.findCardByStoryIdAndUuid(1L, "card-uuid")).thenReturn(Optional.of(card));

            CardInfo result = service.getCardByStoryAndCardUuid("story-uuid", "card-uuid", "en");

            assertNotNull(result);
            assertAll("Null text fields",
                () -> assertNull(result.getTitle()),
                () -> assertNull(result.getDescription()),
                () -> assertNull(result.getCopyrightText()),
                () -> assertNull(result.getCreator())
            );
        }

        @Test
        @DisplayName("Should fallback to English when requested lang text not found")
        void success_languageFallback() {
            StoryEntity story = createStory(1L, "story-uuid");
            CardEntity card = createCard("card-uuid", 1L);

            when(readPort.findStoryByUuid("story-uuid")).thenReturn(Optional.of(story));
            when(readPort.findCardByStoryIdAndUuid(1L, "card-uuid")).thenReturn(Optional.of(card));

            // Italian not found for title, fallback to English
            when(readPort.findTextByStoryIdTextAndLang(1L, 100, "it")).thenReturn(Optional.empty());
            TextEntity enTitle = new TextEntity();
            enTitle.setShortText("English Title");
            when(readPort.findTextByStoryIdTextAndLang(1L, 100, "en")).thenReturn(Optional.of(enTitle));

            // Other texts found in Italian
            TextEntity itDesc = new TextEntity();
            itDesc.setShortText("Descrizione");
            when(readPort.findTextByStoryIdTextAndLang(1L, 101, "it")).thenReturn(Optional.of(itDesc));

            TextEntity itCopy = new TextEntity();
            itCopy.setShortText("© 2026 IT");
            when(readPort.findTextByStoryIdTextAndLang(1L, 102, "it")).thenReturn(Optional.of(itCopy));

            // Creator
            when(readPort.findCreatorsByStoryId(1L)).thenReturn(List.of());

            CardInfo result = service.getCardByStoryAndCardUuid("story-uuid", "card-uuid", "it");

            assertNotNull(result);
            assertEquals("English Title", result.getTitle());
            assertEquals("Descrizione", result.getDescription());
            assertNull(result.getCreator());
        }

        @Test
        @DisplayName("Should return null text when English fallback also not found")
        void success_noFallback() {
            StoryEntity story = createStory(1L, "story-uuid");
            CardEntity card = createCard("card-uuid", 1L);

            when(readPort.findStoryByUuid("story-uuid")).thenReturn(Optional.of(story));
            when(readPort.findCardByStoryIdAndUuid(1L, "card-uuid")).thenReturn(Optional.of(card));

            when(readPort.findTextByStoryIdTextAndLang(eq(1L), anyInt(), eq("fr"))).thenReturn(Optional.empty());
            when(readPort.findTextByStoryIdTextAndLang(eq(1L), anyInt(), eq("en"))).thenReturn(Optional.empty());
            when(readPort.findCreatorsByStoryId(1L)).thenReturn(List.of());

            CardInfo result = service.getCardByStoryAndCardUuid("story-uuid", "card-uuid", "fr");

            assertNotNull(result);
            assertNull(result.getTitle());
            assertNull(result.getDescription());
            assertNull(result.getCopyrightText());
        }

        @Test
        @DisplayName("Should resolve creator when id_creator matches creator entity ID")
        void success_creatorResolvedById() {
            StoryEntity story = createStory(1L, "story-uuid");
            CardEntity card = createCard("card-uuid", 1L);
            card.setIdCreator(7);

            CreatorEntity cr1 = createCreator(5L, "cr-1", 1L);
            CreatorEntity cr2 = createCreator(7L, "cr-2", 1L);
            cr2.setIdText(301);

            when(readPort.findStoryByUuid("story-uuid")).thenReturn(Optional.of(story));
            when(readPort.findCardByStoryIdAndUuid(1L, "card-uuid")).thenReturn(Optional.of(card));

            when(readPort.findTextByStoryIdTextAndLang(eq(1L), anyInt(), eq("en"))).thenReturn(Optional.empty());
            when(readPort.findCreatorsByStoryId(1L)).thenReturn(List.of(cr1, cr2));

            TextEntity cr2Name = new TextEntity();
            cr2Name.setShortText("Creator Two");
            when(readPort.findTextByStoryIdTextAndLang(1L, 301, "en")).thenReturn(Optional.of(cr2Name));

            CardInfo result = service.getCardByStoryAndCardUuid("story-uuid", "card-uuid", "en");

            assertNotNull(result);
            assertNotNull(result.getCreator());
            assertEquals("cr-2", result.getCreator().getUuid());
            assertEquals("Creator Two", result.getCreator().getName());
        }

        @Test
        @DisplayName("Should handle null/blank lang defaulting to English")
        void success_nullLang() {
            StoryEntity story = createStory(1L, "story-uuid");
            CardEntity card = new CardEntity();
            card.setId(10L);
            card.setUuid("card-uuid");
            card.setIdStory(1L);
            card.setIdTextTitle(100);

            when(readPort.findStoryByUuid("story-uuid")).thenReturn(Optional.of(story));
            when(readPort.findCardByStoryIdAndUuid(1L, "card-uuid")).thenReturn(Optional.of(card));

            TextEntity enTitle = new TextEntity();
            enTitle.setShortText("English Title");
            when(readPort.findTextByStoryIdTextAndLang(1L, 100, "en")).thenReturn(Optional.of(enTitle));

            CardInfo result = service.getCardByStoryAndCardUuid("story-uuid", "card-uuid", null);

            assertNotNull(result);
            assertEquals("English Title", result.getTitle());
        }

        @Test
        @DisplayName("Should handle blank lang defaulting to English")
        void success_blankLang() {
            StoryEntity story = createStory(1L, "story-uuid");
            CardEntity card = new CardEntity();
            card.setId(10L);
            card.setUuid("card-uuid");
            card.setIdStory(1L);
            card.setIdTextTitle(100);

            when(readPort.findStoryByUuid("story-uuid")).thenReturn(Optional.of(story));
            when(readPort.findCardByStoryIdAndUuid(1L, "card-uuid")).thenReturn(Optional.of(card));

            TextEntity enTitle = new TextEntity();
            enTitle.setShortText("English Title");
            when(readPort.findTextByStoryIdTextAndLang(1L, 100, "en")).thenReturn(Optional.of(enTitle));

            CardInfo result = service.getCardByStoryAndCardUuid("story-uuid", "card-uuid", "  ");

            assertNotNull(result);
            assertEquals("English Title", result.getTitle());
        }
    }

    // === GetTextByStoryAndIdText ===

    @Nested
    @DisplayName("GetTextByStoryAndIdText")
    class GetText {

        @Test
        @DisplayName("Should return null when storyUuid is null")
        void storyUuid_null() {
            assertNull(service.getTextByStoryAndIdText(null, 1, "en"));
        }

        @Test
        @DisplayName("Should return null when storyUuid is blank")
        void storyUuid_blank() {
            assertNull(service.getTextByStoryAndIdText("", 1, "en"));
        }

        @Test
        @DisplayName("Should return null when story not found")
        void storyNotFound() {
            when(readPort.findStoryByUuid("unknown")).thenReturn(Optional.empty());
            assertNull(service.getTextByStoryAndIdText("unknown", 1, "en"));
        }

        @Test
        @DisplayName("Should return null when text not found in any language")
        void textNotFound() {
            StoryEntity story = createStory(1L, "story-uuid");
            when(readPort.findStoryByUuid("story-uuid")).thenReturn(Optional.of(story));
            when(readPort.findTextByStoryIdTextAndLang(1L, 999, "en")).thenReturn(Optional.empty());

            assertNull(service.getTextByStoryAndIdText("story-uuid", 999, "en"));
        }

        @Test
        @DisplayName("Should return text in requested language successfully")
        void success_requestedLang() {
            StoryEntity story = createStory(1L, "story-uuid");
            TextEntity text = createText(1L, 100, "it", "Ciao", "Ciao Mondo");

            when(readPort.findStoryByUuid("story-uuid")).thenReturn(Optional.of(story));
            when(readPort.findTextByStoryIdTextAndLang(1L, 100, "it")).thenReturn(Optional.of(text));
            // Copyright text
            when(readPort.findTextByStoryIdTextAndLang(1L, 200, "it")).thenReturn(Optional.empty());
            when(readPort.findTextByStoryIdTextAndLang(1L, 200, "en")).thenReturn(Optional.empty());
            // Creator
            when(readPort.findCreatorsByStoryId(1L)).thenReturn(List.of());

            TextInfo result = service.getTextByStoryAndIdText("story-uuid", 100, "it");

            assertNotNull(result);
            assertAll("Text info fields",
                () -> assertEquals(100, result.getIdText()),
                () -> assertEquals("it", result.getLang()),
                () -> assertEquals("it", result.getResolvedLang()),
                () -> assertEquals("Ciao", result.getShortText()),
                () -> assertEquals("Ciao Mondo", result.getLongText()),
                () -> assertEquals("https://textcopy.com", result.getLinkCopyright())
            );
        }

        @Test
        @DisplayName("Should fallback to English when requested language not found")
        void success_fallbackToEnglish() {
            StoryEntity story = createStory(1L, "story-uuid");
            TextEntity enText = createText(1L, 100, "en", "Hello", "Hello World");

            when(readPort.findStoryByUuid("story-uuid")).thenReturn(Optional.of(story));
            when(readPort.findTextByStoryIdTextAndLang(1L, 100, "fr")).thenReturn(Optional.empty());
            when(readPort.findTextByStoryIdTextAndLang(1L, 100, "en")).thenReturn(Optional.of(enText));
            when(readPort.findTextByStoryIdTextAndLang(1L, 200, "fr")).thenReturn(Optional.empty());
            when(readPort.findTextByStoryIdTextAndLang(1L, 200, "en")).thenReturn(Optional.empty());
            when(readPort.findCreatorsByStoryId(1L)).thenReturn(List.of());

            TextInfo result = service.getTextByStoryAndIdText("story-uuid", 100, "fr");

            assertNotNull(result);
            assertEquals("fr", result.getLang());
            assertEquals("en", result.getResolvedLang());
            assertEquals("Hello", result.getShortText());
        }

        @Test
        @DisplayName("Should return null when text not found in English either")
        void fallback_englishNotFound() {
            StoryEntity story = createStory(1L, "story-uuid");

            when(readPort.findStoryByUuid("story-uuid")).thenReturn(Optional.of(story));
            when(readPort.findTextByStoryIdTextAndLang(1L, 100, "fr")).thenReturn(Optional.empty());
            when(readPort.findTextByStoryIdTextAndLang(1L, 100, "en")).thenReturn(Optional.empty());

            assertNull(service.getTextByStoryAndIdText("story-uuid", 100, "fr"));
        }

        @Test
        @DisplayName("Should not attempt English fallback when requested lang is already English")
        void englishRequested_noDoubleLookup() {
            StoryEntity story = createStory(1L, "story-uuid");

            when(readPort.findStoryByUuid("story-uuid")).thenReturn(Optional.of(story));
            when(readPort.findTextByStoryIdTextAndLang(1L, 100, "en")).thenReturn(Optional.empty());

            assertNull(service.getTextByStoryAndIdText("story-uuid", 100, "en"));

            // Only one call to find text, no fallback attempt
            verify(readPort, times(1)).findTextByStoryIdTextAndLang(1L, 100, "en");
        }

        @Test
        @DisplayName("Should default null lang to English")
        void nullLang_defaultsToEnglish() {
            StoryEntity story = createStory(1L, "story-uuid");
            TextEntity enText = createText(1L, 100, "en", "Hello", "Hello World");

            when(readPort.findStoryByUuid("story-uuid")).thenReturn(Optional.of(story));
            when(readPort.findTextByStoryIdTextAndLang(1L, 100, "en")).thenReturn(Optional.of(enText));
            when(readPort.findTextByStoryIdTextAndLang(1L, 200, "en")).thenReturn(Optional.empty());
            when(readPort.findCreatorsByStoryId(1L)).thenReturn(List.of());

            TextInfo result = service.getTextByStoryAndIdText("story-uuid", 100, null);

            assertNotNull(result);
            assertEquals("en", result.getLang());
            assertEquals("en", result.getResolvedLang());
        }

        @Test
        @DisplayName("Should default blank lang to English")
        void blankLang_defaultsToEnglish() {
            StoryEntity story = createStory(1L, "story-uuid");
            TextEntity enText = createText(1L, 100, "en", "Hello", "Hello World");

            when(readPort.findStoryByUuid("story-uuid")).thenReturn(Optional.of(story));
            when(readPort.findTextByStoryIdTextAndLang(1L, 100, "en")).thenReturn(Optional.of(enText));
            when(readPort.findTextByStoryIdTextAndLang(1L, 200, "en")).thenReturn(Optional.empty());
            when(readPort.findCreatorsByStoryId(1L)).thenReturn(List.of());

            TextInfo result = service.getTextByStoryAndIdText("story-uuid", 100, "  ");

            assertNotNull(result);
            assertEquals("en", result.getLang());
        }

        @Test
        @DisplayName("Should resolve copyright text and creator for text entry")
        void success_withCopyrightAndCreator() {
            StoryEntity story = createStory(1L, "story-uuid");
            TextEntity text = createText(1L, 100, "en", "Hello", "Hello World");
            CreatorEntity creator = createCreator(6L, "cr-uuid", 1L);

            when(readPort.findStoryByUuid("story-uuid")).thenReturn(Optional.of(story));
            when(readPort.findTextByStoryIdTextAndLang(1L, 100, "en")).thenReturn(Optional.of(text));

            TextEntity copyText = new TextEntity();
            copyText.setShortText("© 2026");
            when(readPort.findTextByStoryIdTextAndLang(1L, 200, "en")).thenReturn(Optional.of(copyText));

            when(readPort.findCreatorsByStoryId(1L)).thenReturn(List.of(creator));
            TextEntity creatorName = new TextEntity();
            creatorName.setShortText("Author");
            when(readPort.findTextByStoryIdTextAndLang(1L, 300, "en")).thenReturn(Optional.of(creatorName));

            TextInfo result = service.getTextByStoryAndIdText("story-uuid", 100, "en");

            assertNotNull(result);
            assertEquals("© 2026", result.getCopyrightText());
            assertNotNull(result.getCreator());
            assertEquals("cr-uuid", result.getCreator().getUuid());
            assertEquals("Author", result.getCreator().getName());
        }

        @Test
        @DisplayName("Should handle text with null copyright and creator IDs")
        void success_nullCopyrightAndCreator() {
            StoryEntity story = createStory(1L, "story-uuid");
            TextEntity text = new TextEntity();
            text.setIdStory(1L);
            text.setIdText(100);
            text.setLang("en");
            text.setShortText("Hello");
            text.setLongText("Hello World");
            // idTextCopyright and idCreator are null

            when(readPort.findStoryByUuid("story-uuid")).thenReturn(Optional.of(story));
            when(readPort.findTextByStoryIdTextAndLang(1L, 100, "en")).thenReturn(Optional.of(text));

            TextInfo result = service.getTextByStoryAndIdText("story-uuid", 100, "en");

            assertNotNull(result);
            assertNull(result.getCopyrightText());
            assertNull(result.getCreator());
        }
    }

    // === GetCreatorByStoryAndCreatorUuid ===

    @Nested
    @DisplayName("GetCreatorByStoryAndCreatorUuid")
    class GetCreator {

        @Test
        @DisplayName("Should return null when storyUuid is null")
        void storyUuid_null() {
            assertNull(service.getCreatorByStoryAndCreatorUuid(null, "cr-uuid", "en"));
        }

        @Test
        @DisplayName("Should return null when storyUuid is blank")
        void storyUuid_blank() {
            assertNull(service.getCreatorByStoryAndCreatorUuid("  ", "cr-uuid", "en"));
        }

        @Test
        @DisplayName("Should return null when creatorUuid is null")
        void creatorUuid_null() {
            assertNull(service.getCreatorByStoryAndCreatorUuid("story-uuid", null, "en"));
        }

        @Test
        @DisplayName("Should return null when creatorUuid is blank")
        void creatorUuid_blank() {
            assertNull(service.getCreatorByStoryAndCreatorUuid("story-uuid", "", "en"));
        }

        @Test
        @DisplayName("Should return null when story not found")
        void storyNotFound() {
            when(readPort.findStoryByUuid("unknown")).thenReturn(Optional.empty());
            assertNull(service.getCreatorByStoryAndCreatorUuid("unknown", "cr-uuid", "en"));
        }

        @Test
        @DisplayName("Should return null when creator not found in story")
        void creatorNotFound() {
            StoryEntity story = createStory(1L, "story-uuid");
            when(readPort.findStoryByUuid("story-uuid")).thenReturn(Optional.of(story));
            when(readPort.findCreatorByStoryIdAndUuid(1L, "cr-uuid")).thenReturn(Optional.empty());

            assertNull(service.getCreatorByStoryAndCreatorUuid("story-uuid", "cr-uuid", "en"));
        }

        @Test
        @DisplayName("Should return creator with resolved name")
        void success_fullCreator() {
            StoryEntity story = createStory(1L, "story-uuid");
            CreatorEntity creator = createCreator(5L, "cr-uuid", 1L);

            when(readPort.findStoryByUuid("story-uuid")).thenReturn(Optional.of(story));
            when(readPort.findCreatorByStoryIdAndUuid(1L, "cr-uuid")).thenReturn(Optional.of(creator));

            TextEntity nameText = new TextEntity();
            nameText.setShortText("Creator Name");
            when(readPort.findTextByStoryIdTextAndLang(1L, 300, "en")).thenReturn(Optional.of(nameText));

            CreatorInfo result = service.getCreatorByStoryAndCreatorUuid("story-uuid", "cr-uuid", "en");

            assertNotNull(result);
            assertAll("Creator info fields",
                () -> assertEquals("cr-uuid", result.getUuid()),
                () -> assertEquals("Creator Name", result.getName()),
                () -> assertEquals("https://creator.com", result.getLink()),
                () -> assertEquals("https://creator.com/profile", result.getUrl()),
                () -> assertEquals("https://creator.com/avatar.png", result.getUrlImage()),
                () -> assertEquals("https://creator.com/emote.png", result.getUrlEmote()),
                () -> assertEquals("https://instagram.com/creator", result.getUrlInstagram())
            );
        }

        @Test
        @DisplayName("Should return creator with null name when idText is null")
        void success_nullIdText() {
            StoryEntity story = createStory(1L, "story-uuid");
            CreatorEntity creator = createCreator(5L, "cr-uuid", 1L);
            creator.setIdText(null);

            when(readPort.findStoryByUuid("story-uuid")).thenReturn(Optional.of(story));
            when(readPort.findCreatorByStoryIdAndUuid(1L, "cr-uuid")).thenReturn(Optional.of(creator));

            CreatorInfo result = service.getCreatorByStoryAndCreatorUuid("story-uuid", "cr-uuid", "en");

            assertNotNull(result);
            assertNull(result.getName());
        }

        @Test
        @DisplayName("Should resolve creator name with language fallback")
        void success_langFallback() {
            StoryEntity story = createStory(1L, "story-uuid");
            CreatorEntity creator = createCreator(5L, "cr-uuid", 1L);

            when(readPort.findStoryByUuid("story-uuid")).thenReturn(Optional.of(story));
            when(readPort.findCreatorByStoryIdAndUuid(1L, "cr-uuid")).thenReturn(Optional.of(creator));

            when(readPort.findTextByStoryIdTextAndLang(1L, 300, "it")).thenReturn(Optional.empty());
            TextEntity enName = new TextEntity();
            enName.setShortText("English Name");
            when(readPort.findTextByStoryIdTextAndLang(1L, 300, "en")).thenReturn(Optional.of(enName));

            CreatorInfo result = service.getCreatorByStoryAndCreatorUuid("story-uuid", "cr-uuid", "it");

            assertNotNull(result);
            assertEquals("English Name", result.getName());
        }

        @Test
        @DisplayName("Should handle null lang defaulting to English")
        void success_nullLang() {
            StoryEntity story = createStory(1L, "story-uuid");
            CreatorEntity creator = createCreator(5L, "cr-uuid", 1L);

            when(readPort.findStoryByUuid("story-uuid")).thenReturn(Optional.of(story));
            when(readPort.findCreatorByStoryIdAndUuid(1L, "cr-uuid")).thenReturn(Optional.of(creator));

            TextEntity nameText = new TextEntity();
            nameText.setShortText("English Name");
            when(readPort.findTextByStoryIdTextAndLang(1L, 300, "en")).thenReturn(Optional.of(nameText));

            CreatorInfo result = service.getCreatorByStoryAndCreatorUuid("story-uuid", "cr-uuid", null);

            assertNotNull(result);
            assertEquals("English Name", result.getName());
        }

        @Test
        @DisplayName("Should return creator with all null URLs")
        void success_nullUrls() {
            StoryEntity story = createStory(1L, "story-uuid");
            CreatorEntity creator = new CreatorEntity();
            creator.setId(5L);
            creator.setUuid("cr-uuid");
            creator.setIdStory(1L);
            // All URLs are null

            when(readPort.findStoryByUuid("story-uuid")).thenReturn(Optional.of(story));
            when(readPort.findCreatorByStoryIdAndUuid(1L, "cr-uuid")).thenReturn(Optional.of(creator));

            CreatorInfo result = service.getCreatorByStoryAndCreatorUuid("story-uuid", "cr-uuid", "en");

            assertNotNull(result);
            assertNull(result.getName());
            assertNull(result.getLink());
            assertNull(result.getUrl());
            assertNull(result.getUrlImage());
            assertNull(result.getUrlEmote());
            assertNull(result.getUrlInstagram());
        }
    }

    // === ResolveCreator helper edge cases ===

    @Nested
    @DisplayName("ResolveCreator Internal Logic")
    class ResolveCreatorInternal {

        @Test
        @DisplayName("Should return null when no creator matches id_creator")
        void noMatchingCreator() {
            StoryEntity story = createStory(1L, "story-uuid");
            CardEntity card = createCard("card-uuid", 1L);
            card.setIdCreator(99); // No creator with id=99

            CreatorEntity cr1 = createCreator(5L, "cr-1", 1L);

            when(readPort.findStoryByUuid("story-uuid")).thenReturn(Optional.of(story));
            when(readPort.findCardByStoryIdAndUuid(1L, "card-uuid")).thenReturn(Optional.of(card));
            when(readPort.findTextByStoryIdTextAndLang(eq(1L), anyInt(), eq("en"))).thenReturn(Optional.empty());
            when(readPort.findCreatorsByStoryId(1L)).thenReturn(List.of(cr1));

            CardInfo result = service.getCardByStoryAndCardUuid("story-uuid", "card-uuid", "en");

            assertNotNull(result);
            assertNull(result.getCreator());
        }

        @Test
        @DisplayName("Should return null when creator list is empty")
        void emptyCreatorList() {
            StoryEntity story = createStory(1L, "story-uuid");
            CardEntity card = createCard("card-uuid", 1L);

            when(readPort.findStoryByUuid("story-uuid")).thenReturn(Optional.of(story));
            when(readPort.findCardByStoryIdAndUuid(1L, "card-uuid")).thenReturn(Optional.of(card));
            when(readPort.findTextByStoryIdTextAndLang(eq(1L), anyInt(), eq("en"))).thenReturn(Optional.empty());
            when(readPort.findCreatorsByStoryId(1L)).thenReturn(List.of());

            CardInfo result = service.getCardByStoryAndCardUuid("story-uuid", "card-uuid", "en");

            assertNotNull(result);
            assertNull(result.getCreator());
        }
    }
}
