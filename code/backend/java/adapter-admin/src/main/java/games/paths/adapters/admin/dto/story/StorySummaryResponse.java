package games.paths.adapters.admin.dto.story;

import games.paths.core.dto.BaseStorySummaryResponse;

/**
 * StorySummaryResponse - Admin REST response DTO for a story summary.
 */
public class StorySummaryResponse extends BaseStorySummaryResponse {

    public StorySummaryResponse() {}

    public StorySummaryResponse(String uuid, String title, String description, String author,
                                String category, String group, String visibility,
                                Integer priority, Integer peghi, int difficultyCount) {
        super(uuid, title, description, author, category, group, visibility,
              priority, peghi, difficultyCount);
    }
}
