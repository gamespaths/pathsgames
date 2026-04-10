package games.paths.adapters.rest.dto;

import games.paths.core.dto.BaseStorySummaryResponse;

/**
 * StorySummaryResponse - REST response DTO for a story catalogue listing entry.
 */
public class StorySummaryResponse extends BaseStorySummaryResponse {

    public StorySummaryResponse() {}

    public StorySummaryResponse(String uuid, String title, String description, String author,
                                String category, String group, String visibility,
                                int priority, int peghi, int difficultyCount) {
        super(uuid, title, description, author, category, group, visibility,
              priority, peghi, difficultyCount);
    }
}
