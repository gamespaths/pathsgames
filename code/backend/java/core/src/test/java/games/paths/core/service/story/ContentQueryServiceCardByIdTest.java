package games.paths.core.service.story;

import games.paths.core.entity.story.CardEntity;
import games.paths.core.entity.story.CreatorEntity;
import games.paths.core.entity.story.TextEntity;
import games.paths.core.model.story.CardInfo;
import games.paths.core.port.story.StoryReadPort;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link ContentQueryService#getCardByStoryIdAndCardId} — the
 * numeric-id card lookup used to resolve the cards embedded in match payloads
 * (weather, locations, events). The uuid-based lookup is covered by
 * {@link ContentQueryServiceTest}.
 */
@ExtendWith(MockitoExtension.class)
class ContentQueryServiceCardByIdTest {

    @Mock
    private StoryReadPort readPort;

    @InjectMocks
    private ContentQueryService service;

    private CardEntity card() {
        CardEntity c = new CardEntity();
        c.setId(10L);
        c.setUuid("card-uuid");
        c.setIdStory(1L);
        c.setCardType("location");
        c.setUrlImage("https://img.com/card.png");
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

    private TextEntity text(String shortText) {
        TextEntity t = new TextEntity();
        t.setShortText(shortText);
        return t;
    }

    @Test
    void nullStoryId_returnsNull() {
        assertNull(service.getCardByStoryIdAndCardId(null, 7, "en"));
        verifyNoInteractions(readPort);
    }

    @Test
    void nullCardId_returnsNull() {
        assertNull(service.getCardByStoryIdAndCardId(1L, null, "en"));
        verifyNoInteractions(readPort);
    }

    @Test
    void cardNotFound_returnsNull() {
        when(readPort.findCardByStoryIdAndCardId(1L, 7L)).thenReturn(Optional.empty());
        assertNull(service.getCardByStoryIdAndCardId(1L, 7, "en"));
    }

    @Test
    void success_resolvesTextsAndCreator() {
        CreatorEntity creator = new CreatorEntity();
        creator.setId(5L);
        creator.setUuid("cr-uuid");
        creator.setIdText(300);
        creator.setLink("https://creator.com");
        creator.setUrl("https://creator.com/profile");
        creator.setUrlImage("https://creator.com/avatar.png");
        creator.setUrlEmote("https://creator.com/emote.png");
        creator.setUrlInstagram("https://instagram.com/creator");

        when(readPort.findCardByStoryIdAndCardId(1L, 7L)).thenReturn(Optional.of(card()));
        when(readPort.findTextByStoryIdTextAndLang(1L, 100, "it")).thenReturn(Optional.of(text("Titolo")));
        when(readPort.findTextByStoryIdTextAndLang(1L, 101, "it")).thenReturn(Optional.of(text("Descrizione")));
        when(readPort.findTextByStoryIdTextAndLang(1L, 102, "it")).thenReturn(Optional.of(text("© 2026")));
        when(readPort.findCreatorsByStoryId(1L)).thenReturn(List.of(creator));
        when(readPort.findTextByStoryIdTextAndLang(1L, 300, "it")).thenReturn(Optional.of(text("Autore")));

        CardInfo result = service.getCardByStoryIdAndCardId(1L, 7, "it");

        assertNotNull(result);
        assertEquals("card-uuid", result.uuid());
        assertEquals("location", result.cardType());
        assertEquals("https://img.com/card.png", result.urlImage());
        assertEquals("Titolo", result.title());
        assertEquals("Descrizione", result.description());
        assertEquals("© 2026", result.copyrightText());
        assertEquals("https://copy.com", result.linkCopyright());
        assertNotNull(result.creator());
        assertEquals("cr-uuid", result.creator().uuid());
        assertEquals("Autore", result.creator().name());
    }

    @Test
    void nullLang_defaultsToEnglish() {
        CardEntity c = card();
        c.setIdTextDescription(null);
        c.setIdTextCopyright(null);
        c.setIdCreator(null);
        when(readPort.findCardByStoryIdAndCardId(1L, 7L)).thenReturn(Optional.of(c));
        when(readPort.findTextByStoryIdTextAndLang(1L, 100, "en")).thenReturn(Optional.of(text("Title")));

        CardInfo result = service.getCardByStoryIdAndCardId(1L, 7, null);

        assertNotNull(result);
        assertEquals("Title", result.title());
        assertNull(result.description());
        assertNull(result.copyrightText());
        assertNull(result.creator());
    }

    @Test
    void missingLang_fallsBackToEnglish() {
        CardEntity c = card();
        c.setIdTextDescription(null);
        c.setIdTextCopyright(null);
        c.setIdCreator(null);
        when(readPort.findCardByStoryIdAndCardId(1L, 7L)).thenReturn(Optional.of(c));
        when(readPort.findTextByStoryIdTextAndLang(1L, 100, "fr")).thenReturn(Optional.empty());
        when(readPort.findTextByStoryIdTextAndLang(1L, 100, "en")).thenReturn(Optional.of(text("Title")));

        CardInfo result = service.getCardByStoryIdAndCardId(1L, 7, "fr");

        assertNotNull(result);
        assertEquals("Title", result.title());
    }

    @Test
    void noTextInAnyLang_leavesTitleNull() {
        CardEntity c = card();
        c.setIdTextDescription(null);
        c.setIdTextCopyright(null);
        c.setIdCreator(null);
        when(readPort.findCardByStoryIdAndCardId(1L, 7L)).thenReturn(Optional.of(c));
        when(readPort.findTextByStoryIdTextAndLang(1L, 100, "fr")).thenReturn(Optional.empty());
        when(readPort.findTextByStoryIdTextAndLang(1L, 100, "en")).thenReturn(Optional.empty());

        CardInfo result = service.getCardByStoryIdAndCardId(1L, 7, "fr");

        assertNotNull(result);
        assertNull(result.title());
    }

    @Test
    void unknownCreatorId_leavesCreatorNull() {
        CardEntity c = card();
        c.setIdTextTitle(null);
        c.setIdTextDescription(null);
        c.setIdTextCopyright(null);
        CreatorEntity other = new CreatorEntity();
        other.setId(99L);
        when(readPort.findCardByStoryIdAndCardId(1L, 7L)).thenReturn(Optional.of(c));
        when(readPort.findCreatorsByStoryId(1L)).thenReturn(List.of(other));

        CardInfo result = service.getCardByStoryIdAndCardId(1L, 7, "en");

        assertNotNull(result);
        assertNull(result.creator());
    }
}
