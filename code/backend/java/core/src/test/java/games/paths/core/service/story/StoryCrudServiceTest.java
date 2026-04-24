package games.paths.core.service.story;

import games.paths.core.entity.story.StoryEntity;
import games.paths.core.port.story.StoryPersistencePort;
import games.paths.core.port.story.StoryReadPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link StoryCrudService}.
 * Step 17: Covers all branch cases for CRUD operations.
 */
class StoryCrudServiceTest {

    private StoryReadPort readPort;
    private StoryPersistencePort persistencePort;
    private StoryCrudService service;

    @BeforeEach
    void setup() {
        readPort = mock(StoryReadPort.class);
        persistencePort = mock(StoryPersistencePort.class);
        service = new StoryCrudService(readPort, persistencePort);
    }

    private StoryEntity makeStory(Long id, String uuid) {
        StoryEntity s = new StoryEntity();
        s.setId(id);
        s.setUuid(uuid);
        s.setAuthor("Author");
        s.setVisibility("PUBLIC");
        return s;
    }

    // === createStory ===

    @Nested
    @DisplayName("createStory")
    class CreateStory {

        @Test
        @DisplayName("Should return null for null data")
        void createStory_nullData() {
            assertNull(service.createStory(null));
        }

        @Test
        @DisplayName("Should return null for empty data")
        void createStory_emptyData() {
            assertNull(service.createStory(Map.of()));
        }

        @Test
        @DisplayName("Should create and return story map")
        void createStory_success() {
            StoryEntity saved = makeStory(1L, "gen-uuid");
            when(persistencePort.saveStory(any())).thenReturn(saved);

            Map<String, Object> result = service.createStory(Map.of("author", "Test"));
            assertNotNull(result);
            assertEquals("gen-uuid", result.get("uuid"));
            assertEquals("Author", result.get("author"));
        }
    }

    // === updateStory ===

    @Nested
    @DisplayName("updateStory")
    class UpdateStory {

        @Test
        @DisplayName("Should return null for null uuid")
        void updateStory_nullUuid() {
            assertNull(service.updateStory(null, Map.of("author", "X")));
        }

        @Test
        @DisplayName("Should return null for blank uuid")
        void updateStory_blankUuid() {
            assertNull(service.updateStory("  ", Map.of("author", "X")));
        }

        @Test
        @DisplayName("Should return null for null data")
        void updateStory_nullData() {
            assertNull(service.updateStory("uuid-1", null));
        }

        @Test
        @DisplayName("Should return null for empty data")
        void updateStory_emptyData() {
            assertNull(service.updateStory("uuid-1", Map.of()));
        }

        @Test
        @DisplayName("Should return null when story not found")
        void updateStory_notFound() {
            when(readPort.findStoryByUuid("missing")).thenReturn(Optional.empty());
            assertNull(service.updateStory("missing", Map.of("author", "X")));
        }

        @Test
        @DisplayName("Should update and return story")
        void updateStory_success() {
            StoryEntity existing = makeStory(1L, "uuid-1");
            when(readPort.findStoryByUuid("uuid-1")).thenReturn(Optional.of(existing));
            when(persistencePort.saveStory(any())).thenReturn(existing);

            Map<String, Object> result = service.updateStory("uuid-1", Map.of("author", "Updated"));
            assertNotNull(result);
            verify(persistencePort).saveStory(any());
        }
    }

    // === listEntities ===

    @Nested
    @DisplayName("listEntities")
    class ListEntities {

        @Test
        @DisplayName("Should return null for null storyUuid")
        void listEntities_nullStory() {
            assertNull(service.listEntities(null, "locations"));
        }

        @Test
        @DisplayName("Should return null for blank storyUuid")
        void listEntities_blankStory() {
            assertNull(service.listEntities("", "locations"));
        }

        @Test
        @DisplayName("Should return null for null entityType")
        void listEntities_nullType() {
            assertNull(service.listEntities("uuid-1", null));
        }

        @Test
        @DisplayName("Should return null for blank entityType")
        void listEntities_blankType() {
            assertNull(service.listEntities("uuid-1", ""));
        }

        @Test
        @DisplayName("Should return null when story not found")
        void listEntities_storyNotFound() {
            when(readPort.findStoryByUuid("missing")).thenReturn(Optional.empty());
            assertNull(service.listEntities("missing", "locations"));
        }

        @Test
        @DisplayName("Should return empty list for unknown entity type")
        void listEntities_unknownType() {
            StoryEntity story = makeStory(1L, "uuid-1");
            when(readPort.findStoryByUuid("uuid-1")).thenReturn(Optional.of(story));
            List<Map<String, Object>> result = service.listEntities("uuid-1", "unknown");
            assertNotNull(result);
            assertTrue(result.isEmpty());
        }
    }

    // === getEntity ===

    @Nested
    @DisplayName("getEntity")
    class GetEntity {

        @Test
        @DisplayName("Should return null for null storyUuid")
        void getEntity_nullStory() {
            assertNull(service.getEntity(null, "locations", "e1"));
        }

        @Test
        @DisplayName("Should return null for blank entityUuid")
        void getEntity_blankEntity() {
            assertNull(service.getEntity("uuid-1", "locations", ""));
        }

        @Test
        @DisplayName("Should return null for null entityType")
        void getEntity_nullType() {
            assertNull(service.getEntity("uuid-1", null, "e1"));
        }

        @Test
        @DisplayName("Should return null when story not found")
        void getEntity_storyNotFound() {
            when(readPort.findStoryByUuid("missing")).thenReturn(Optional.empty());
            assertNull(service.getEntity("missing", "locations", "e1"));
        }
    }

    // === createEntity ===

    @Nested
    @DisplayName("createEntity")
    class CreateEntity {

        @Test
        @DisplayName("Should return null for null storyUuid")
        void createEntity_nullStory() {
            assertNull(service.createEntity(null, "locations", Map.of("a", "b")));
        }

        @Test
        @DisplayName("Should return null for null data")
        void createEntity_nullData() {
            assertNull(service.createEntity("uuid-1", "locations", null));
        }

        @Test
        @DisplayName("Should return null for empty data")
        void createEntity_emptyData() {
            assertNull(service.createEntity("uuid-1", "locations", Map.of()));
        }

        @Test
        @DisplayName("Should return null when story not found")
        void createEntity_storyNotFound() {
            when(readPort.findStoryByUuid("missing")).thenReturn(Optional.empty());
            assertNull(service.createEntity("missing", "locations", Map.of("a", "b")));
        }
    }

    // === updateEntity ===

    @Nested
    @DisplayName("updateEntity")
    class UpdateEntity {

        @Test
        @DisplayName("Should return null for null storyUuid")
        void updateEntity_nullStory() {
            assertNull(service.updateEntity(null, "locations", "e1", Map.of("a", "b")));
        }

        @Test
        @DisplayName("Should return null for blank entityUuid")
        void updateEntity_blankEntity() {
            assertNull(service.updateEntity("uuid-1", "locations", "", Map.of("a", "b")));
        }

        @Test
        @DisplayName("Should return null for null data")
        void updateEntity_nullData() {
            assertNull(service.updateEntity("uuid-1", "locations", "e1", null));
        }

        @Test
        @DisplayName("Should return null for empty data")
        void updateEntity_emptyData() {
            assertNull(service.updateEntity("uuid-1", "locations", "e1", Map.of()));
        }

        @Test
        @DisplayName("Should return null when story not found")
        void updateEntity_storyNotFound() {
            when(readPort.findStoryByUuid("missing")).thenReturn(Optional.empty());
            assertNull(service.updateEntity("missing", "locations", "e1", Map.of("a", "b")));
        }
    }

    // === deleteEntity ===

    @Nested
    @DisplayName("deleteEntity")
    class DeleteEntity {

        @Test
        @DisplayName("Should return false for null storyUuid")
        void deleteEntity_nullStory() {
            assertFalse(service.deleteEntity(null, "locations", "e1"));
        }

        @Test
        @DisplayName("Should return false for blank entityUuid")
        void deleteEntity_blankEntity() {
            assertFalse(service.deleteEntity("uuid-1", "locations", ""));
        }

        @Test
        @DisplayName("Should return false for null entityType")
        void deleteEntity_nullType() {
            assertFalse(service.deleteEntity("uuid-1", null, "e1"));
        }

        @Test
        @DisplayName("Should return false when story not found")
        void deleteEntity_storyNotFound() {
            when(readPort.findStoryByUuid("missing")).thenReturn(Optional.empty());
            assertFalse(service.deleteEntity("missing", "locations", "e1"));
        }
    }

    // === Step 17: Success-path tests for entity dispatch ===

    @Nested
    @DisplayName("CRUD dispatch success")
    class CrudDispatchSuccess {

        @BeforeEach
        void setupStory() {
            when(readPort.findStoryByUuid("uuid-1")).thenReturn(Optional.of(makeStory(1L, "uuid-1")));
        }

        @Test void listLocations() {
            games.paths.core.entity.story.LocationEntity loc = new games.paths.core.entity.story.LocationEntity();
            loc.setUuid("loc-1");
            loc.setIdStory(1L);
            when(readPort.findLocationsByStoryId(1L)).thenReturn(java.util.List.of(loc));
            var result = service.listEntities("uuid-1", "locations");
            assertNotNull(result);
            assertEquals(1, result.size());
            assertEquals("loc-1", result.get(0).get("uuid"));
        }

        @Test void listDifficulties() {
            when(readPort.findDifficultiesByStoryId(1L)).thenReturn(java.util.List.of(new games.paths.core.entity.story.StoryDifficultyEntity()));
            assertNotNull(service.listEntities("uuid-1", "difficulties"));
        }

        @Test void getLocation_found() {
            games.paths.core.entity.story.LocationEntity loc = new games.paths.core.entity.story.LocationEntity();
            loc.setUuid("loc-1");
            when(readPort.findLocationByStoryIdAndUuid(1L, "loc-1")).thenReturn(Optional.of(loc));
            var result = service.getEntity("uuid-1", "locations", "loc-1");
            assertNotNull(result);
            assertEquals("loc-1", result.get("uuid"));
        }

        @Test void getLocation_notFound() {
            when(readPort.findLocationByStoryIdAndUuid(1L, "missing")).thenReturn(Optional.empty());
            assertNull(service.getEntity("uuid-1", "locations", "missing"));
        }

        @Test void getUnknownType() {
            assertNull(service.getEntity("uuid-1", "unknown-type", "e1"));
        }

        @Test void createLocation() {
            games.paths.core.entity.story.LocationEntity saved = new games.paths.core.entity.story.LocationEntity();
            saved.setUuid("new-loc");
            saved.setIdStory(1L);
            when(persistencePort.saveLocation(any())).thenReturn(saved);
            var result = service.createEntity("uuid-1", "locations", Map.of("isSafe", 1));
            assertNotNull(result);
            assertEquals("new-loc", result.get("uuid"));
        }

        @Test void createUnknownType() {
            assertNull(service.createEntity("uuid-1", "unknown-type", Map.of("a", "b")));
        }

        @Test void updateLocation() {
            games.paths.core.entity.story.LocationEntity loc = new games.paths.core.entity.story.LocationEntity();
            loc.setUuid("loc-1");
            loc.setIdStory(1L);
            when(readPort.findLocationByStoryIdAndUuid(1L, "loc-1")).thenReturn(Optional.of(loc));
            when(persistencePort.saveLocation(any())).thenReturn(loc);
            var result = service.updateEntity("uuid-1", "locations", "loc-1", Map.of("isSafe", 0));
            assertNotNull(result);
        }

        @Test void updateLocation_notFound() {
            when(readPort.findLocationByStoryIdAndUuid(1L, "missing")).thenReturn(Optional.empty());
            assertNull(service.updateEntity("uuid-1", "locations", "missing", Map.of("isSafe", 0)));
        }

        @Test void updateUnknownType() {
            assertNull(service.updateEntity("uuid-1", "unknown-type", "e1", Map.of("a", "b")));
        }

        @Test void deleteLocation_found() {
            games.paths.core.entity.story.LocationEntity loc = new games.paths.core.entity.story.LocationEntity();
            when(readPort.findLocationByStoryIdAndUuid(1L, "loc-1")).thenReturn(Optional.of(loc));
            assertTrue(service.deleteEntity("uuid-1", "locations", "loc-1"));
            verify(persistencePort).deleteLocationByUuid("loc-1");
        }

        @Test void deleteLocation_notFound() {
            when(readPort.findLocationByStoryIdAndUuid(1L, "missing")).thenReturn(Optional.empty());
            assertFalse(service.deleteEntity("uuid-1", "locations", "missing"));
        }

        @Test void deleteUnknownType() {
            assertFalse(service.deleteEntity("uuid-1", "unknown-type", "e1"));
        }
    }
}

