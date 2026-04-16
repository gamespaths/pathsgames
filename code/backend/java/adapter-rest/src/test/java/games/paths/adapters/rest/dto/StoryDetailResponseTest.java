package games.paths.adapters.rest.dto;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link StoryDetailResponse}.
 * Covers no-arg constructor, all setters/getters, and difficulties list.
 */
class StoryDetailResponseTest {

    @Test
    @DisplayName("No-arg constructor and setters should work for all fields")
    void settersAndGetters() {
        DifficultyResponse diff = new DifficultyResponse(
                "diff-1", "Easy", 5, 10, 1, 4, 3, 3, 1);

        StoryDetailResponse r = new StoryDetailResponse();
        r.setUuid("uuid-1");
        r.setTitle("Title");
        r.setDescription("Desc");
        r.setAuthor("Author");
        r.setCategory("adventure");
        r.setGroup("fantasy");
        r.setVisibility("PUBLIC");
        r.setPriority(5);
        r.setPeghi(2);
        r.setVersionMin("0.10");
        r.setVersionMax("1.0");
        r.setClockSingularDescription("hour");
        r.setClockPluralDescription("hours");
        r.setCopyrightText("(c) 2025");
        r.setLinkCopyright("https://example.com");
        r.setLocationCount(10);
        r.setEventCount(20);
        r.setItemCount(5);
        r.setClassCount(3);
        r.setCharacterTemplateCount(2);
        r.setTraitCount(4);
        r.setDifficulties(List.of(diff));

        CharacterTemplateResponse ct = new CharacterTemplateResponse(
                "ct-1", "Warrior", "Fighter", 20, 15, 10, 3, 2, 4);
        r.setCharacterTemplates(List.of(ct));

        ClassInfoResponse cl = new ClassInfoResponse(
                "class-1", "Knight", "Noble", 20, 3, 2, 4);
        r.setClasses(List.of(cl));

        TraitInfoResponse tr = new TraitInfoResponse(
                "trait-1", "Brave", "Fearless", 5, 3, null, null);
        r.setTraits(List.of(tr));

        CardInfoResponse card = new CardInfoResponse(
                "card-1", "https://img.com/card.png", "alt.jpg",
                "fa-star", "bg-dark", "text-light", "Card Title");
        r.setCard(card);

        assertAll("StoryDetailResponse fields",
            () -> assertEquals("uuid-1", r.getUuid()),
            () -> assertEquals("Title", r.getTitle()),
            () -> assertEquals("Desc", r.getDescription()),
            () -> assertEquals("Author", r.getAuthor()),
            () -> assertEquals("adventure", r.getCategory()),
            () -> assertEquals("fantasy", r.getGroup()),
            () -> assertEquals("PUBLIC", r.getVisibility()),
            () -> assertEquals(5, r.getPriority()),
            () -> assertEquals(2, r.getPeghi()),
            () -> assertEquals("0.10", r.getVersionMin()),
            () -> assertEquals("1.0", r.getVersionMax()),
            () -> assertEquals("hour", r.getClockSingularDescription()),
            () -> assertEquals("hours", r.getClockPluralDescription()),
            () -> assertEquals("(c) 2025", r.getCopyrightText()),
            () -> assertEquals("https://example.com", r.getLinkCopyright()),
            () -> assertEquals(10, r.getLocationCount()),
            () -> assertEquals(20, r.getEventCount()),
            () -> assertEquals(5, r.getItemCount()),
            () -> assertEquals(3, r.getClassCount()),
            () -> assertEquals(2, r.getCharacterTemplateCount()),
            () -> assertEquals(4, r.getTraitCount()),
            () -> assertEquals(1, r.getDifficulties().size()),
            () -> assertEquals("diff-1", r.getDifficulties().get(0).getUuid()),
            () -> assertEquals(1, r.getCharacterTemplates().size()),
            () -> assertEquals("ct-1", r.getCharacterTemplates().get(0).getUuid()),
            () -> assertEquals(1, r.getClasses().size()),
            () -> assertEquals("class-1", r.getClasses().get(0).getUuid()),
            () -> assertEquals(1, r.getTraits().size()),
            () -> assertEquals("trait-1", r.getTraits().get(0).getUuid()),
            () -> assertNotNull(r.getCard()),
            () -> assertEquals("card-1", r.getCard().getUuid())
        );
    }

    @Test
    @DisplayName("Default values should be 0 for int fields and null for objects")
    void defaultValues() {
        StoryDetailResponse r = new StoryDetailResponse();

        assertAll("Default values",
            () -> assertNull(r.getUuid()),
            () -> assertNull(r.getTitle()),
            () -> assertNull(r.getDifficulties()),
            () -> assertNull(r.getCharacterTemplates()),
            () -> assertNull(r.getClasses()),
            () -> assertNull(r.getTraits()),
            () -> assertNull(r.getCard()),
            () -> assertEquals(0, r.getPriority()),
            () -> assertEquals(0, r.getLocationCount()),
            () -> assertEquals(0, r.getClassCount()),
            () -> assertEquals(0, r.getCharacterTemplateCount()),
            () -> assertEquals(0, r.getTraitCount())
        );
    }
}
