package games.paths.core.service.story;

import games.paths.core.entity.story.StoryDifficultyEntity;
import games.paths.core.entity.story.StoryEntity;
import games.paths.core.entity.story.TextEntity;
import games.paths.core.model.story.DifficultyInfo;
import games.paths.core.model.story.StoryDetail;
import games.paths.core.model.story.StorySummary;
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
 * text resolution with language fallback, and null/edge cases.
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
        e.setClockSingularDescription("hour");
        e.setClockPluralDescription("hours");
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
                () -> assertEquals(1, s.getDifficultyCount())
            );
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
        @DisplayName("Should return full detail with resolved texts and difficulties")
        void getStory_success() {
            StoryEntity story = createStoryEntity("uuid-1", "Author1", 100, 101, "PUBLIC", 5, 2);
            story.setIdTextCopyright(102);
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
                () -> assertEquals("Easy", detail.getDifficulties().get(0).getDescription())
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
            when(readPort.countLocationsByStoryId(1L)).thenReturn(0L);
            when(readPort.countEventsByStoryId(1L)).thenReturn(0L);
            when(readPort.countItemsByStoryId(1L)).thenReturn(0L);

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
            when(readPort.countLocationsByStoryId(1L)).thenReturn(0L);
            when(readPort.countEventsByStoryId(1L)).thenReturn(0L);
            when(readPort.countItemsByStoryId(1L)).thenReturn(0L);

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
            when(readPort.countLocationsByStoryId(1L)).thenReturn(0L);
            when(readPort.countEventsByStoryId(1L)).thenReturn(0L);
            when(readPort.countItemsByStoryId(1L)).thenReturn(0L);

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
            when(readPort.countLocationsByStoryId(1L)).thenReturn(0L);
            when(readPort.countEventsByStoryId(1L)).thenReturn(0L);
            when(readPort.countItemsByStoryId(1L)).thenReturn(0L);

            StoryDetail detail = storyQueryService.getStoryByUuid("uuid-1", null);

            assertEquals("Default", detail.getTitle());
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
            when(readPort.countLocationsByStoryId(1L)).thenReturn(0L);
            when(readPort.countEventsByStoryId(1L)).thenReturn(0L);
            when(readPort.countItemsByStoryId(1L)).thenReturn(0L);

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
}
