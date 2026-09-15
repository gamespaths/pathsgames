package games.paths.adapters.rest.dto;

import games.paths.core.dto.BaseStorySummaryResponse;

/**
 * StorySummaryResponse - REST response DTO for a story catalogue listing entry.
 */
public class StorySummaryResponse extends BaseStorySummaryResponse {

    private CardInfoResponse card;

    public StorySummaryResponse() {}

    public StorySummaryResponse(String uuid, String title, String description, String author,
                                String category, String group, String visibility,
                                int priority, int peghi, int difficultyCount,
                                CardInfoResponse card) {
        super(uuid, title, description, author, category, group, visibility,
              priority, peghi, difficultyCount);
        this.card = card;
    }

    /** v0.37.6 — one mapper for the public list and the static catalog export. */
    public static StorySummaryResponse fromModel(games.paths.core.model.story.StorySummary s) {
        return new StorySummaryResponse(
                s.uuid(), s.title(), s.description(), s.author(),
                s.category(), s.group(), s.visibility(),
                s.priority(), s.peghi(), s.difficultyCount(),
                CardInfoResponse.fromModel(s.card()));
    }

    public CardInfoResponse getCard() { return card; }
    public void setCard(CardInfoResponse card) { this.card = card; }
}
