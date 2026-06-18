package games.paths.core.port.story;

import games.paths.core.model.story.StorySummary;
import games.paths.core.model.story.StoryDetail;
import games.paths.core.model.story.TraitInfo;

import java.util.List;

/**
 * StoryQueryPort - Inbound port for querying stories.
 * Part of the Hexagonal Architecture: this is a domain port
 * that the adapter-rest module will call to retrieve story data.
 *
 * <p>Enhanced in Step 15 with category/group listing and filtering methods.</p>
 */
public interface StoryQueryPort {

    /**
     * Lists all publicly visible stories, ordered by priority descending.
     *
     * @param lang the language code for text resolution (e.g., "en", "it")
     * @return a list of story summaries
     */
    List<StorySummary> listPublicStories(String lang);

    /**
     * Lists all stories (any visibility) for admin purposes.
     *
     * @param lang the language code for text resolution
     * @return a list of all story summaries
     */
    List<StorySummary> listAllStories(String lang);

    /**
     * Retrieves the full detail of a single story by UUID.
     *
     * @param uuid the story UUID
     * @param lang the language code for text resolution
     * @return the story detail, or null if not found
     */
    StoryDetail getStoryByUuid(String uuid, String lang);

    // === Step 15: Category and Group queries ===

    /**
     * Lists distinct categories of publicly visible stories.
     *
     * @return a list of category strings
     */
    List<String> listCategories();

    /**
     * Lists publicly visible stories filtered by category.
     *
     * @param category the category to filter by
     * @param lang the language code for text resolution
     * @return a list of matching story summaries
     */
    List<StorySummary> listStoriesByCategory(String category, String lang);

    /**
     * Lists distinct groups of publicly visible stories.
     *
     * @return a list of group strings
     */
    List<String> listGroups();

    /**
     * Lists publicly visible stories filtered by group.
     *
     * @param group the group to filter by
     * @param lang the language code for text resolution
     * @return a list of matching story summaries
     */
    List<StorySummary> listStoriesByGroup(String group, String lang);

    // === Step 23: Trait listing filtered by class ===

    /**
     * Outcome of {@link #listTraitsForClass(String, String, String)}; the
     * status distinguishes the two 404 reasons in the REST layer.
     */
    record TraitsForClassResult(Status status, List<TraitInfo> traits) {
        public enum Status { OK, STORY_NOT_FOUND, CLASS_NOT_FOUND }

        public static TraitsForClassResult storyNotFound() {
            return new TraitsForClassResult(Status.STORY_NOT_FOUND, List.of());
        }
        public static TraitsForClassResult classNotFound() {
            return new TraitsForClassResult(Status.CLASS_NOT_FOUND, List.of());
        }
        public static TraitsForClassResult ok(List<TraitInfo> traits) {
            return new TraitsForClassResult(Status.OK, traits);
        }
    }

    /**
     * Lists the traits of a story selectable with the given class: a trait is
     * included when {@code id_class_permitted} is null or equals the class and
     * {@code id_class_prohibited} is null or differs from the class.
     *
     * @param storyUuid the story UUID
     * @param classUuid the class UUID
     * @param lang the language code for text resolution
     * @return the filtered traits, or a not-found status
     */
    TraitsForClassResult listTraitsForClass(String storyUuid, String classUuid, String lang);
}
