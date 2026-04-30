package games.paths.core.service.story;

import games.paths.core.entity.story.CardEntity;
import games.paths.core.entity.story.CharacterTemplateEntity;
import games.paths.core.entity.story.ClassEntity;
import games.paths.core.entity.story.StoryDifficultyEntity;
import games.paths.core.entity.story.StoryEntity;
import games.paths.core.entity.story.TextEntity;
import games.paths.core.entity.story.TraitEntity;
import games.paths.core.model.story.CardInfo;
import games.paths.core.model.story.CharacterTemplateInfo;
import games.paths.core.model.story.ClassInfo;
import games.paths.core.model.story.DifficultyInfo;
import games.paths.core.model.story.StoryDetail;
import games.paths.core.model.story.StorySummary;
import games.paths.core.model.story.TraitInfo;
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
 * Unit tests for {@link StoryQueryService}.
 * Ensures full branch coverage for story listing, detail retrieval,
 * text resolution with language fallback, category/group queries,
 * and enriched story detail with character templates, classes, traits, and cards.
 */
@ExtendWith(MockitoExtension.class)
class StoryQueryServiceTest {

    @Mock
    private StoryReadPort readPort;

    @InjectMocks
    private StoryQueryService storyQueryService;

    // === Helper Methods ===

    private StoryEntity createStoryEntity(String uuid, String author, Integer idTextTitle,
                                          Integer idTextDesc, String visibility, Integer priority, Integer peghi) {
        StoryEntity e = new StoryEntity();
        e.setId(1L);
        e.setUuid(uuid);
        e.setAuthor(author);
        e.setIdTextTitle(idTextTitle);
        e.setIdTextDescription(idTextDesc);
        e.setVisibility(visibility);
        e.setPriority(priority);
        e.setPeghi(peghi);
        e.setCategory("adventure");
        e.setGroup("fantasy");
        e.setVersionMin("0.10");
        e.setVersionMax("1.0");
        e.setIdTextClockSingular(10);
        e.setIdTextClockPlural(11);
        e.setLinkCopyright("https://example.com");
        return e;
    }

    private TextEntity createTextEntity(Long storyId, Integer idText, String lang, String shortText) {
        TextEntity t = new TextEntity();
        t.setIdStory(storyId);
        t.setIdText(idText);
        t.setLang(lang);
        t.setShortText(shortText);
        return t;
    }

    private StoryDifficultyEntity createDifficultyEntity(Long storyId, String uuid) {
        StoryDifficultyEntity d = new StoryDifficultyEntity();
        d.setIdStory(storyId);
        d.setUuid(uuid);
        d.setExpCost(5);
        d.setMaxWeight(10);
        d.setMinCharacter(1);
        d.setMaxCharacter(4);
        d.setCostHelpComa(3);
        d.setCostMaxCharacteristics(3);
        d.setNumberMaxFreeAction(1);
        d.setIdTextDescription(200);
        return d;
    }

    private CharacterTemplateEntity createCharacterTemplateEntity(Long storyId, String uuid,
            Integer idTextName, Integer idTextDesc) {
        CharacterTemplateEntity ct = new CharacterTemplateEntity();
        ct.setIdStory(storyId);
        ct.setUuid(uuid);
        ct.setIdTextName(idTextName);
        ct.setIdTextDescription(idTextDesc);
        ct.setLifeMax(20);
        ct.setEnergyMax(10);
        ct.setSadMax(5);
        ct.setDexterityStart(2);
        ct.setIntelligenceStart(1);
        ct.setConstitutionStart(3);
        return ct;
    }

    private ClassEntity createClassEntity(Long storyId, String uuid,
            Integer idTextName, Integer idTextDesc) {
        ClassEntity cl = new ClassEntity();
        cl.setIdStory(storyId);
        cl.setUuid(uuid);
        cl.setIdTextName(idTextName);
        cl.setIdTextDescription(idTextDesc);
        cl.setWeightMax(15);
        cl.setDexterityBase(2);
        cl.setIntelligenceBase(1);
        cl.setConstitutionBase(3);
        return cl;
    }

    private TraitEntity createTraitEntity(Long storyId, String uuid,
            Integer idTextName, Integer idTextDesc) {
        TraitEntity tr = new TraitEntity();
        tr.setIdStory(storyId);
        tr.setUuid(uuid);
        tr.setIdTextName(idTextName);
        tr.setIdTextDescription(idTextDesc);
        tr.setCostPositive(2);
        tr.setCostNegative(1);
        tr.setIdClassPermitted(null);
        tr.setIdClassProhibited(null);
        return tr;
    }

    private CardEntity createCardEntity(Long storyId, String uuid) {
        CardEntity c = new CardEntity();
        c.setIdStory(storyId);
        c.setUuid(uuid);
        c.setUrlImmage("https://example.com/card.png");
        c.setAlternativeImage("alt-img");
        c.setAwesomeIcon("fa-star");
        c.setStyleMain("bg-primary");
        c.setStyleDetail("text-light");
        c.setIdTextTitle(500);
        return c;
    }

    private void stubEmptyEntityCounts(Long storyId) {
        when(readPort.countLocationsByStoryId(storyId)).thenReturn(0L);
        when(readPort.countEventsByStoryId(storyId)).thenReturn(0L);
        when(readPort.countItemsByStoryId(storyId)).thenReturn(0L);
    }

    private void stubEmptySubEntities(Long storyId) {
        when(readPort.findCharacterTemplatesByStoryId(storyId)).thenReturn(List.of());
        when(readPort.findClassesByStoryId(storyId)).thenReturn(List.of());
        when(readPort.findTraitsByStoryId(storyId)).thenReturn(List.of());
    }

    // === SECTION: LIST PUBLIC STORIES ===

    @Nested
    @DisplayName("List Public Stories Tests")
    class ListPublicStories {

        @Test
        @DisplayName("Should return empty list when no public stories exist")
        void listPublicStories_empty() {
            when(readPort.findStoriesByVisibility("PUBLIC")).thenReturn(List.of());

            List<StorySummary> result = storyQueryService.listPublicStories("en");

            assertNotNull(result);
            assertTrue(result.isEmpty());
            verify(readPort).findStoriesByVisibility("PUBLIC");
        }

        @Test
        @DisplayName("Should return summaries with resolved text for public stories")
        void listPublicStories_withStories() {
            StoryEntity story = createStoryEntity("uuid-1", "Author1", 100, 101, "PUBLIC", 5, 2);
            when(readPort.findStoriesByVisibility("PUBLIC")).thenReturn(List.of(story));
            when(readPort.findTextByStoryIdTextAndLang(1L, 100, "en"))
                    .thenReturn(Optional.of(createTextEntity(1L, 100, "en", "Title EN")));
            when(readPort.findTextByStoryIdTextAndLang(1L, 101, "en"))
                    .thenReturn(Optional.of(createTextEntity(1L, 101, "en", "Desc EN")));
            when(readPort.findDifficultiesByStoryId(1L)).thenReturn(List.of(createDifficultyEntity(1L, "diff-1")));

            List<StorySummary> result = storyQueryService.listPublicStories("en");

            assertEquals(1, result.size());
            StorySummary s = result.get(0);
            assertAll("StorySummary fields",
                () -> assertEquals("uuid-1", s.getUuid()),
                () -> assertEquals("Title EN", s.getTitle()),
                () -> assertEquals("Desc EN", s.getDescription()),
                () -> assertEquals("Author1", s.getAuthor()),
                () -> assertEquals("adventure", s.getCategory()),
                () -> assertEquals("fantasy", s.getGroup()),
                () -> assertEquals("PUBLIC", s.getVisibility()),
                () -> assertEquals(5, s.getPriority()),
                () -> assertEquals(2, s.getPeghi()),
                () -> assertEquals(1, s.getDifficultyCount()),
                () -> assertNull(s.getCard())
            );
        }

        @Test
        @DisplayName("Should include card info in summary when story has idCard")
        void listPublicStories_withCard() {
            StoryEntity story = createStoryEntity("uuid-1", "Author1", 100, 101, "PUBLIC", 5, 2);
            story.setIdCard(42);
            when(readPort.findStoriesByVisibility("PUBLIC")).thenReturn(List.of(story));
            when(readPort.findTextByStoryIdTextAndLang(1L, 100, "en"))
                    .thenReturn(Optional.of(createTextEntity(1L, 100, "en", "Title EN")));
            when(readPort.findTextByStoryIdTextAndLang(1L, 101, "en"))
                    .thenReturn(Optional.of(createTextEntity(1L, 101, "en", "Desc EN")));
            when(readPort.findDifficultiesByStoryId(1L)).thenReturn(List.of());
            CardEntity card = createCardEntity(1L, "card-uuid");
            when(readPort.findCardByStoryIdAndCardId(1L, 42L)).thenReturn(Optional.of(card));
            when(readPort.findTextByStoryIdTextAndLang(1L, 500, "en"))
                    .thenReturn(Optional.of(createTextEntity(1L, 500, "en", "Card Title")));

            List<StorySummary> result = storyQueryService.listPublicStories("en");

            assertEquals(1, result.size());
            StorySummary s = result.get(0);
            assertNotNull(s.getCard());
            assertEquals("card-uuid", s.getCard().getUuid());
            assertEquals("Card Title", s.getCard().getTitle());
            assertEquals("https://example.com/card.png", s.getCard().getImageUrl());
        }

        @Test
        @DisplayName("Should set card to null in summary when story has no idCard")
        void listPublicStories_noCard() {
            StoryEntity story = createStoryEntity("uuid-1", "Author1", 100, 101, "PUBLIC", 5, 2);
            when(readPort.findStoriesByVisibility("PUBLIC")).thenReturn(List.of(story));
            when(readPort.findTextByStoryIdTextAndLang(1L, 100, "en"))
                    .thenReturn(Optional.of(createTextEntity(1L, 100, "en", "Title EN")));
            when(readPort.findTextByStoryIdTextAndLang(1L, 101, "en"))
                    .thenReturn(Optional.of(createTextEntity(1L, 101, "en", "Desc EN")));
            when(readPort.findDifficultiesByStoryId(1L)).thenReturn(List.of());

            List<StorySummary> result = storyQueryService.listPublicStories("en");

            assertEquals(1, result.size());
            assertNull(result.get(0).getCard());
        }

        @Test
        @DisplayName("Should handle null priority and peghi in story entity")
        void listPublicStories_nullPriorityPeghi() {
            StoryEntity story = createStoryEntity("uuid-2", "Author2", null, null, "PUBLIC", null, null);
            when(readPort.findStoriesByVisibility("PUBLIC")).thenReturn(List.of(story));
            when(readPort.findDifficultiesByStoryId(1L)).thenReturn(List.of());

            List<StorySummary> result = storyQueryService.listPublicStories("en");

            assertEquals(1, result.size());
            assertEquals(0, result.get(0).getPriority());
            assertEquals(0, result.get(0).getPeghi());
            assertNull(result.get(0).getTitle());
            assertNull(result.get(0).getDescription());
        }
    }

    // === SECTION: LIST ALL STORIES ===

    @Nested
    @DisplayName("List All Stories Tests")
    class ListAllStories {

        @Test
        @DisplayName("Should return all stories regardless of visibility")
        void listAllStories_success() {
            StoryEntity s1 = createStoryEntity("uuid-1", "Author1", 100, 101, "PUBLIC", 5, 0);
            StoryEntity s2 = createStoryEntity("uuid-2", "Author2", 102, 103, "PRIVATE", 3, 0);
            s2.setId(2L);
            when(readPort.findAllStories()).thenReturn(List.of(s1, s2));
            when(readPort.findTextByStoryIdTextAndLang(anyLong(), anyInt(), eq("en"))).thenReturn(Optional.empty());
            when(readPort.findDifficultiesByStoryId(anyLong())).thenReturn(List.of());

            List<StorySummary> result = storyQueryService.listAllStories("en");

            assertEquals(2, result.size());
        }
    }

    // === SECTION: GET STORY BY UUID ===

    @Nested
    @DisplayName("Get Story By UUID Tests")
    class GetStoryByUuid {

        @Test
        @DisplayName("Should return null for null UUID")
        void getStory_nullUuid() {
            assertNull(storyQueryService.getStoryByUuid(null, "en"));
        }

        @Test
        @DisplayName("Should return null for blank UUID")
        void getStory_blankUuid() {
            assertNull(storyQueryService.getStoryByUuid("  ", "en"));
        }

        @Test
        @DisplayName("Should return null when story not found")
        void getStory_notFound() {
            when(readPort.findStoryByUuid("unknown")).thenReturn(Optional.empty());

            assertNull(storyQueryService.getStoryByUuid("unknown", "en"));
        }

        @Test
        @DisplayName("Should return full detail with resolved texts, difficulties, templates, classes, traits, and card")
        void getStory_success() {
            StoryEntity story = createStoryEntity("uuid-1", "Author1", 100, 101, "PUBLIC", 5, 2);
            story.setIdTextCopyright(102);
            story.setIdCard(10);
            when(readPort.findStoryByUuid("uuid-1")).thenReturn(Optional.of(story));
            when(readPort.findTextByStoryIdTextAndLang(1L, 100, "en"))
                    .thenReturn(Optional.of(createTextEntity(1L, 100, "en", "Title")));
            when(readPort.findTextByStoryIdTextAndLang(1L, 101, "en"))
                    .thenReturn(Optional.of(createTextEntity(1L, 101, "en", "Description")));
            when(readPort.findTextByStoryIdTextAndLang(1L, 102, "en"))
                    .thenReturn(Optional.of(createTextEntity(1L, 102, "en", "Copyright")));

            StoryDifficultyEntity diff = createDifficultyEntity(1L, "diff-uuid");
            when(readPort.findDifficultiesByStoryId(1L)).thenReturn(List.of(diff));
            when(readPort.findTextByStoryIdTextAndLang(1L, 200, "en"))
                    .thenReturn(Optional.of(createTextEntity(1L, 200, "en", "Easy")));
            when(readPort.countLocationsByStoryId(1L)).thenReturn(5L);
            when(readPort.countEventsByStoryId(1L)).thenReturn(10L);
            when(readPort.countItemsByStoryId(1L)).thenReturn(3L);

            // Step 15: Character templates, classes, traits
            CharacterTemplateEntity ct = createCharacterTemplateEntity(1L, "ct-uuid", 300, 301);
            when(readPort.findCharacterTemplatesByStoryId(1L)).thenReturn(List.of(ct));
            when(readPort.findTextByStoryIdTextAndLang(1L, 300, "en"))
                    .thenReturn(Optional.of(createTextEntity(1L, 300, "en", "Warrior")));
            when(readPort.findTextByStoryIdTextAndLang(1L, 301, "en"))
                    .thenReturn(Optional.of(createTextEntity(1L, 301, "en", "A strong fighter")));

            ClassEntity cl = createClassEntity(1L, "class-uuid", 400, 401);
            when(readPort.findClassesByStoryId(1L)).thenReturn(List.of(cl));
            when(readPort.findTextByStoryIdTextAndLang(1L, 400, "en"))
                    .thenReturn(Optional.of(createTextEntity(1L, 400, "en", "Knight")));
            when(readPort.findTextByStoryIdTextAndLang(1L, 401, "en"))
                    .thenReturn(Optional.of(createTextEntity(1L, 401, "en", "Noble warrior")));

            TraitEntity tr = createTraitEntity(1L, "trait-uuid", 450, 451);
            when(readPort.findTraitsByStoryId(1L)).thenReturn(List.of(tr));
            when(readPort.findTextByStoryIdTextAndLang(1L, 450, "en"))
                    .thenReturn(Optional.of(createTextEntity(1L, 450, "en", "Brave")));
            when(readPort.findTextByStoryIdTextAndLang(1L, 451, "en"))
                    .thenReturn(Optional.of(createTextEntity(1L, 451, "en", "Fearless")));

            // Card
            CardEntity card = createCardEntity(1L, "card-uuid");
            when(readPort.findCardByStoryIdAndCardId(1L, 10L)).thenReturn(Optional.of(card));
            when(readPort.findTextByStoryIdTextAndLang(1L, 500, "en"))
                    .thenReturn(Optional.of(createTextEntity(1L, 500, "en", "Card Title")));

            StoryDetail detail = storyQueryService.getStoryByUuid("uuid-1", "en");

            assertNotNull(detail);
            assertAll("StoryDetail fields",
                () -> assertEquals("uuid-1", detail.getUuid()),
                () -> assertEquals("Title", detail.getTitle()),
                () -> assertEquals("Description", detail.getDescription()),
                () -> assertEquals("Copyright", detail.getCopyrightText()),
                () -> assertEquals(5, detail.getLocationCount()),
                () -> assertEquals(10, detail.getEventCount()),
                () -> assertEquals(3, detail.getItemCount()),
                () -> assertEquals(1, detail.getDifficulties().size()),
                () -> assertEquals("Easy", detail.getDifficulties().get(0).getDescription()),
                // Step 15: new fields
                () -> assertEquals(1, detail.getCharacterTemplateCount()),
                () -> assertEquals(1, detail.getClassCount()),
                () -> assertEquals(1, detail.getTraitCount()),
                () -> assertEquals(1, detail.getCharacterTemplates().size()),
                () -> assertEquals("Warrior", detail.getCharacterTemplates().get(0).getName()),
                () -> assertEquals("A strong fighter", detail.getCharacterTemplates().get(0).getDescription()),
                () -> assertEquals(20, detail.getCharacterTemplates().get(0).getLifeMax()),
                () -> assertEquals(1, detail.getClasses().size()),
                () -> assertEquals("Knight", detail.getClasses().get(0).getName()),
                () -> assertEquals(15, detail.getClasses().get(0).getWeightMax()),
                () -> assertEquals(1, detail.getTraits().size()),
                () -> assertEquals("Brave", detail.getTraits().get(0).getName()),
                () -> assertEquals(2, detail.getTraits().get(0).getCostPositive()),
                () -> assertNotNull(detail.getCard()),
                () -> assertEquals("Card Title", detail.getCard().getTitle()),
                () -> assertEquals("https://example.com/card.png", detail.getCard().getImageUrl())
            );
        }

        @Test
        @DisplayName("Should return detail with null card when story has no idCard")
        void getStory_noCard() {
            StoryEntity story = createStoryEntity("uuid-1", "Author1", null, null, "PUBLIC", 0, 0);
            story.setIdCard(null);
            when(readPort.findStoryByUuid("uuid-1")).thenReturn(Optional.of(story));
            when(readPort.findDifficultiesByStoryId(1L)).thenReturn(List.of());
            stubEmptyEntityCounts(1L);
            stubEmptySubEntities(1L);

            StoryDetail detail = storyQueryService.getStoryByUuid("uuid-1", "en");

            assertNotNull(detail);
            assertNull(detail.getCard());
        }

        @Test
        @DisplayName("Should return null card when card entity not found in DB")
        void getStory_cardNotFound() {
            StoryEntity story = createStoryEntity("uuid-1", "Author1", null, null, "PUBLIC", 0, 0);
            story.setIdCard(99);
            when(readPort.findStoryByUuid("uuid-1")).thenReturn(Optional.of(story));
            when(readPort.findDifficultiesByStoryId(1L)).thenReturn(List.of());
            stubEmptyEntityCounts(1L);
            stubEmptySubEntities(1L);
            when(readPort.findCardByStoryIdAndCardId(1L, 99L)).thenReturn(Optional.empty());

            StoryDetail detail = storyQueryService.getStoryByUuid("uuid-1", "en");

            assertNotNull(detail);
            assertNull(detail.getCard());
        }

        @Test
        @DisplayName("Should handle character template with null numeric fields")
        void getStory_characterTemplateNullFields() {
            StoryEntity story = createStoryEntity("uuid-1", "Author1", null, null, "PUBLIC", 0, 0);
            when(readPort.findStoryByUuid("uuid-1")).thenReturn(Optional.of(story));
            when(readPort.findDifficultiesByStoryId(1L)).thenReturn(List.of());
            stubEmptyEntityCounts(1L);

            CharacterTemplateEntity ct = new CharacterTemplateEntity();
            ct.setIdStory(1L);
            ct.setUuid("ct-null");
            // All Integers are null
            when(readPort.findCharacterTemplatesByStoryId(1L)).thenReturn(List.of(ct));
            when(readPort.findClassesByStoryId(1L)).thenReturn(List.of());
            when(readPort.findTraitsByStoryId(1L)).thenReturn(List.of());

            StoryDetail detail = storyQueryService.getStoryByUuid("uuid-1", "en");

            CharacterTemplateInfo ctInfo = detail.getCharacterTemplates().get(0);
            assertAll("Default values for null CharacterTemplate fields",
                () -> assertEquals(10, ctInfo.getLifeMax()),
                () -> assertEquals(10, ctInfo.getEnergyMax()),
                () -> assertEquals(10, ctInfo.getSadMax()),
                () -> assertEquals(1, ctInfo.getDexterityStart()),
                () -> assertEquals(1, ctInfo.getIntelligenceStart()),
                () -> assertEquals(1, ctInfo.getConstitutionStart())
            );
        }

        @Test
        @DisplayName("Should handle class entity with null numeric fields")
        void getStory_classNullFields() {
            StoryEntity story = createStoryEntity("uuid-1", "Author1", null, null, "PUBLIC", 0, 0);
            when(readPort.findStoryByUuid("uuid-1")).thenReturn(Optional.of(story));
            when(readPort.findDifficultiesByStoryId(1L)).thenReturn(List.of());
            stubEmptyEntityCounts(1L);

            ClassEntity cl = new ClassEntity();
            cl.setIdStory(1L);
            cl.setUuid("class-null");
            // All Integers are null
            when(readPort.findCharacterTemplatesByStoryId(1L)).thenReturn(List.of());
            when(readPort.findClassesByStoryId(1L)).thenReturn(List.of(cl));
            when(readPort.findTraitsByStoryId(1L)).thenReturn(List.of());

            StoryDetail detail = storyQueryService.getStoryByUuid("uuid-1", "en");

            ClassInfo clInfo = detail.getClasses().get(0);
            assertAll("Default values for null Class fields",
                () -> assertEquals(10, clInfo.getWeightMax()),
                () -> assertEquals(1, clInfo.getDexterityBase()),
                () -> assertEquals(1, clInfo.getIntelligenceBase()),
                () -> assertEquals(1, clInfo.getConstitutionBase())
            );
        }

        @Test
        @DisplayName("Should handle trait entity with null cost fields")
        void getStory_traitNullFields() {
            StoryEntity story = createStoryEntity("uuid-1", "Author1", null, null, "PUBLIC", 0, 0);
            when(readPort.findStoryByUuid("uuid-1")).thenReturn(Optional.of(story));
            when(readPort.findDifficultiesByStoryId(1L)).thenReturn(List.of());
            stubEmptyEntityCounts(1L);

            TraitEntity tr = new TraitEntity();
            tr.setIdStory(1L);
            tr.setUuid("trait-null");
            // costPositive and costNegative are null
            when(readPort.findCharacterTemplatesByStoryId(1L)).thenReturn(List.of());
            when(readPort.findClassesByStoryId(1L)).thenReturn(List.of());
            when(readPort.findTraitsByStoryId(1L)).thenReturn(List.of(tr));

            StoryDetail detail = storyQueryService.getStoryByUuid("uuid-1", "en");

            TraitInfo trInfo = detail.getTraits().get(0);
            assertAll("Default values for null Trait fields",
                () -> assertEquals(0, trInfo.getCostPositive()),
                () -> assertEquals(0, trInfo.getCostNegative()),
                () -> assertNull(trInfo.getIdClassPermitted()),
                () -> assertNull(trInfo.getIdClassProhibited())
            );
        }

        @Test
        @DisplayName("Should return detail with empty lists when no templates/classes/traits exist")
        void getStory_emptySubEntities() {
            StoryEntity story = createStoryEntity("uuid-1", "Author1", null, null, "PUBLIC", 0, 0);
            when(readPort.findStoryByUuid("uuid-1")).thenReturn(Optional.of(story));
            when(readPort.findDifficultiesByStoryId(1L)).thenReturn(List.of());
            stubEmptyEntityCounts(1L);
            stubEmptySubEntities(1L);

            StoryDetail detail = storyQueryService.getStoryByUuid("uuid-1", "en");

            assertAll("Empty sub-entity lists",
                () -> assertTrue(detail.getCharacterTemplates().isEmpty()),
                () -> assertTrue(detail.getClasses().isEmpty()),
                () -> assertTrue(detail.getTraits().isEmpty()),
                () -> assertEquals(0, detail.getCharacterTemplateCount()),
                () -> assertEquals(0, detail.getClassCount()),
                () -> assertEquals(0, detail.getTraitCount())
            );
        }

        @Test
        @DisplayName("Should fallback to English when requested lang text not found")
        void getStory_languageFallback() {
            StoryEntity story = createStoryEntity("uuid-1", "Author1", 100, null, "PUBLIC", 0, 0);
            when(readPort.findStoryByUuid("uuid-1")).thenReturn(Optional.of(story));
            // Italian not found
            when(readPort.findTextByStoryIdTextAndLang(1L, 100, "it")).thenReturn(Optional.empty());
            // English found
            when(readPort.findTextByStoryIdTextAndLang(1L, 100, "en"))
                    .thenReturn(Optional.of(createTextEntity(1L, 100, "en", "English Title")));
            when(readPort.findDifficultiesByStoryId(1L)).thenReturn(List.of());
            stubEmptyEntityCounts(1L);
            stubEmptySubEntities(1L);

            StoryDetail detail = storyQueryService.getStoryByUuid("uuid-1", "it");

            assertNotNull(detail);
            assertEquals("English Title", detail.getTitle());
        }

        @Test
        @DisplayName("Should return null text when neither requested lang nor English found")
        void getStory_noTextAtAll() {
            StoryEntity story = createStoryEntity("uuid-1", "Author1", 100, null, "PUBLIC", 0, 0);
            when(readPort.findStoryByUuid("uuid-1")).thenReturn(Optional.of(story));
            when(readPort.findTextByStoryIdTextAndLang(1L, 100, "it")).thenReturn(Optional.empty());
            when(readPort.findTextByStoryIdTextAndLang(1L, 100, "en")).thenReturn(Optional.empty());
            when(readPort.findDifficultiesByStoryId(1L)).thenReturn(List.of());
            stubEmptyEntityCounts(1L);
            stubEmptySubEntities(1L);

            StoryDetail detail = storyQueryService.getStoryByUuid("uuid-1", "it");

            assertNotNull(detail);
            assertNull(detail.getTitle());
        }

        @Test
        @DisplayName("Should not fallback when lang is already 'en' and text not found")
        void getStory_englishNotFound() {
            StoryEntity story = createStoryEntity("uuid-1", "Author1", 100, null, "PUBLIC", 0, 0);
            when(readPort.findStoryByUuid("uuid-1")).thenReturn(Optional.of(story));
            when(readPort.findTextByStoryIdTextAndLang(1L, 100, "en")).thenReturn(Optional.empty());
            when(readPort.findDifficultiesByStoryId(1L)).thenReturn(List.of());
            stubEmptyEntityCounts(1L);
            stubEmptySubEntities(1L);

            StoryDetail detail = storyQueryService.getStoryByUuid("uuid-1", "en");

            assertNull(detail.getTitle());
            // Should only call once for "en", no double fallback
            verify(readPort, times(1)).findTextByStoryIdTextAndLang(1L, 100, "en");
        }

        @Test
        @DisplayName("Should use 'en' when lang parameter is null or blank")
        void getStory_nullLang() {
            StoryEntity story = createStoryEntity("uuid-1", "Author1", 100, null, "PUBLIC", 0, 0);
            when(readPort.findStoryByUuid("uuid-1")).thenReturn(Optional.of(story));
            when(readPort.findTextByStoryIdTextAndLang(1L, 100, "en"))
                    .thenReturn(Optional.of(createTextEntity(1L, 100, "en", "Default")));
            when(readPort.findDifficultiesByStoryId(1L)).thenReturn(List.of());
            stubEmptyEntityCounts(1L);
            stubEmptySubEntities(1L);

            StoryDetail detail = storyQueryService.getStoryByUuid("uuid-1", null);

            assertEquals("Default", detail.getTitle());
        }

        @Test
        @DisplayName("Should use 'en' when lang parameter is blank")
        void getStory_blankLang() {
            StoryEntity story = createStoryEntity("uuid-1", "Author1", 100, null, "PUBLIC", 0, 0);
            when(readPort.findStoryByUuid("uuid-1")).thenReturn(Optional.of(story));
            when(readPort.findTextByStoryIdTextAndLang(1L, 100, "en"))
                    .thenReturn(Optional.of(createTextEntity(1L, 100, "en", "Default")));
            when(readPort.findDifficultiesByStoryId(1L)).thenReturn(List.of());
            stubEmptyEntityCounts(1L);
            stubEmptySubEntities(1L);

            StoryDetail detail = storyQueryService.getStoryByUuid("uuid-1", "   ");

            assertEquals("Default", detail.getTitle());
        }

        @Test
        @DisplayName("Should handle null priority and peghi in getStoryByUuid")
        void getStory_nullPriorityAndPeghiInDetail() {
            StoryEntity story = createStoryEntity("uuid-1", "Author1", null, null, "PUBLIC", null, null);
            when(readPort.findStoryByUuid("uuid-1")).thenReturn(Optional.of(story));
            when(readPort.findDifficultiesByStoryId(1L)).thenReturn(List.of());
            stubEmptyEntityCounts(1L);
            stubEmptySubEntities(1L);

            StoryDetail detail = storyQueryService.getStoryByUuid("uuid-1", "en");

            assertNotNull(detail);
            assertAll("Null priority/peghi defaults to 0 in detail",
                () -> assertEquals(0, detail.getPriority()),
                () -> assertEquals(0, detail.getPeghi())
            );
        }

        @Test
        @DisplayName("Should handle difficulty with null numeric fields")
        void getStory_difficultyNullFields() {
            StoryEntity story = createStoryEntity("uuid-1", "Author1", null, null, "PUBLIC", 0, 0);
            when(readPort.findStoryByUuid("uuid-1")).thenReturn(Optional.of(story));

            StoryDifficultyEntity diff = new StoryDifficultyEntity();
            diff.setIdStory(1L);
            diff.setUuid("diff-1");
            // All integer fields are null
            when(readPort.findDifficultiesByStoryId(1L)).thenReturn(List.of(diff));
            stubEmptyEntityCounts(1L);
            stubEmptySubEntities(1L);

            StoryDetail detail = storyQueryService.getStoryByUuid("uuid-1", "en");

            assertNotNull(detail);
            DifficultyInfo di = detail.getDifficulties().get(0);
            assertAll("Difficulty defaults for null fields",
                () -> assertEquals(5, di.getExpCost()),
                () -> assertEquals(10, di.getMaxWeight()),
                () -> assertEquals(1, di.getMinCharacter()),
                () -> assertEquals(4, di.getMaxCharacter()),
                () -> assertEquals(3, di.getCostHelpComa()),
                () -> assertEquals(3, di.getCostMaxCharacteristics()),
                () -> assertEquals(1, di.getNumberMaxFreeAction())
            );
        }
    }

    // === SECTION: LIST CATEGORIES (Step 15) ===

    @Nested
    @DisplayName("List Categories Tests")
    class ListCategories {

        @Test
        @DisplayName("Should return distinct categories from public stories")
        void listCategories_success() {
            when(readPort.findDistinctCategoriesByVisibility("PUBLIC"))
                    .thenReturn(List.of("adventure", "horror", "sci-fi"));

            List<String> result = storyQueryService.listCategories();

            assertEquals(3, result.size());
            assertEquals("adventure", result.get(0));
            assertEquals("horror", result.get(1));
            assertEquals("sci-fi", result.get(2));
        }

        @Test
        @DisplayName("Should return empty list when no categories exist")
        void listCategories_empty() {
            when(readPort.findDistinctCategoriesByVisibility("PUBLIC")).thenReturn(List.of());

            List<String> result = storyQueryService.listCategories();

            assertNotNull(result);
            assertTrue(result.isEmpty());
        }
    }

    // === SECTION: LIST STORIES BY CATEGORY (Step 15) ===

    @Nested
    @DisplayName("List Stories By Category Tests")
    class ListStoriesByCategory {

        @Test
        @DisplayName("Should return stories filtered by category")
        void listByCategory_success() {
            StoryEntity story = createStoryEntity("uuid-1", "Author1", 100, 101, "PUBLIC", 5, 2);
            when(readPort.findStoriesByCategoryAndVisibility("adventure", "PUBLIC"))
                    .thenReturn(List.of(story));
            when(readPort.findTextByStoryIdTextAndLang(1L, 100, "en"))
                    .thenReturn(Optional.of(createTextEntity(1L, 100, "en", "Title")));
            when(readPort.findTextByStoryIdTextAndLang(1L, 101, "en"))
                    .thenReturn(Optional.of(createTextEntity(1L, 101, "en", "Desc")));
            when(readPort.findDifficultiesByStoryId(1L)).thenReturn(List.of());

            List<StorySummary> result = storyQueryService.listStoriesByCategory("adventure", "en");

            assertEquals(1, result.size());
            assertEquals("uuid-1", result.get(0).getUuid());
            assertEquals("adventure", result.get(0).getCategory());
        }

        @Test
        @DisplayName("Should return empty list for null category")
        void listByCategory_null() {
            List<StorySummary> result = storyQueryService.listStoriesByCategory(null, "en");

            assertNotNull(result);
            assertTrue(result.isEmpty());
            verifyNoInteractions(readPort);
        }

        @Test
        @DisplayName("Should return empty list for blank category")
        void listByCategory_blank() {
            List<StorySummary> result = storyQueryService.listStoriesByCategory("  ", "en");

            assertNotNull(result);
            assertTrue(result.isEmpty());
            verifyNoInteractions(readPort);
        }

        @Test
        @DisplayName("Should return empty list when category has no stories")
        void listByCategory_noMatches() {
            when(readPort.findStoriesByCategoryAndVisibility("unknown", "PUBLIC"))
                    .thenReturn(List.of());

            List<StorySummary> result = storyQueryService.listStoriesByCategory("unknown", "en");

            assertNotNull(result);
            assertTrue(result.isEmpty());
        }
    }

    // === SECTION: LIST GROUPS (Step 15) ===

    @Nested
    @DisplayName("List Groups Tests")
    class ListGroups {

        @Test
        @DisplayName("Should return distinct groups from public stories")
        void listGroups_success() {
            when(readPort.findDistinctGroupsByVisibility("PUBLIC"))
                    .thenReturn(List.of("dark", "fantasy"));

            List<String> result = storyQueryService.listGroups();

            assertEquals(2, result.size());
            assertEquals("dark", result.get(0));
            assertEquals("fantasy", result.get(1));
        }

        @Test
        @DisplayName("Should return empty list when no groups exist")
        void listGroups_empty() {
            when(readPort.findDistinctGroupsByVisibility("PUBLIC")).thenReturn(List.of());

            List<String> result = storyQueryService.listGroups();

            assertNotNull(result);
            assertTrue(result.isEmpty());
        }
    }

    // === SECTION: LIST STORIES BY GROUP (Step 15) ===

    @Nested
    @DisplayName("List Stories By Group Tests")
    class ListStoriesByGroup {

        @Test
        @DisplayName("Should return stories filtered by group")
        void listByGroup_success() {
            StoryEntity story = createStoryEntity("uuid-1", "Author1", 100, 101, "PUBLIC", 5, 2);
            when(readPort.findStoriesByGroupAndVisibility("fantasy", "PUBLIC"))
                    .thenReturn(List.of(story));
            when(readPort.findTextByStoryIdTextAndLang(1L, 100, "en"))
                    .thenReturn(Optional.of(createTextEntity(1L, 100, "en", "Title")));
            when(readPort.findTextByStoryIdTextAndLang(1L, 101, "en"))
                    .thenReturn(Optional.of(createTextEntity(1L, 101, "en", "Desc")));
            when(readPort.findDifficultiesByStoryId(1L)).thenReturn(List.of());

            List<StorySummary> result = storyQueryService.listStoriesByGroup("fantasy", "en");

            assertEquals(1, result.size());
            assertEquals("uuid-1", result.get(0).getUuid());
        }

        @Test
        @DisplayName("Should return empty list for null group")
        void listByGroup_null() {
            List<StorySummary> result = storyQueryService.listStoriesByGroup(null, "en");

            assertNotNull(result);
            assertTrue(result.isEmpty());
            verifyNoInteractions(readPort);
        }

        @Test
        @DisplayName("Should return empty list for blank group")
        void listByGroup_blank() {
            List<StorySummary> result = storyQueryService.listStoriesByGroup("  ", "en");

            assertNotNull(result);
            assertTrue(result.isEmpty());
            verifyNoInteractions(readPort);
        }

        @Test
        @DisplayName("Should return empty list when group has no stories")
        void listByGroup_noMatches() {
            when(readPort.findStoriesByGroupAndVisibility("unknown", "PUBLIC"))
                    .thenReturn(List.of());

            List<StorySummary> result = storyQueryService.listStoriesByGroup("unknown", "en");

            assertNotNull(result);
            assertTrue(result.isEmpty());
        }
    }
}
