package games.paths.core.model.story;

/**
 * StoryImportResult - Domain model for the result of a story import operation.
 * Reports the counts of entities imported per category.
 */
public class StoryImportResult {

    private final String storyUuid;
    private final String status;
    private final int textsImported;
    private final int locationsImported;
    private final int eventsImported;
    private final int itemsImported;
    private final int difficultiesImported;
    private final int classesImported;
    private final int choicesImported;

    private StoryImportResult(Builder builder) {
        this.storyUuid = builder.storyUuid;
        this.status = builder.status;
        this.textsImported = builder.textsImported;
        this.locationsImported = builder.locationsImported;
        this.eventsImported = builder.eventsImported;
        this.itemsImported = builder.itemsImported;
        this.difficultiesImported = builder.difficultiesImported;
        this.classesImported = builder.classesImported;
        this.choicesImported = builder.choicesImported;
    }

    public String getStoryUuid() { return storyUuid; }
    public String getStatus() { return status; }
    public int getTextsImported() { return textsImported; }
    public int getLocationsImported() { return locationsImported; }
    public int getEventsImported() { return eventsImported; }
    public int getItemsImported() { return itemsImported; }
    public int getDifficultiesImported() { return difficultiesImported; }
    public int getClassesImported() { return classesImported; }
    public int getChoicesImported() { return choicesImported; }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private String storyUuid;
        private String status;
        private int textsImported;
        private int locationsImported;
        private int eventsImported;
        private int itemsImported;
        private int difficultiesImported;
        private int classesImported;
        private int choicesImported;

        public Builder storyUuid(String storyUuid) { this.storyUuid = storyUuid; return this; }
        public Builder status(String status) { this.status = status; return this; }
        public Builder textsImported(int textsImported) { this.textsImported = textsImported; return this; }
        public Builder locationsImported(int locationsImported) { this.locationsImported = locationsImported; return this; }
        public Builder eventsImported(int eventsImported) { this.eventsImported = eventsImported; return this; }
        public Builder itemsImported(int itemsImported) { this.itemsImported = itemsImported; return this; }
        public Builder difficultiesImported(int difficultiesImported) { this.difficultiesImported = difficultiesImported; return this; }
        public Builder classesImported(int classesImported) { this.classesImported = classesImported; return this; }
        public Builder choicesImported(int choicesImported) { this.choicesImported = choicesImported; return this; }

        public StoryImportResult build() {
            if (storyUuid == null || storyUuid.isBlank()) {
                throw new IllegalStateException("storyUuid is required");
            }
            if (status == null || status.isBlank()) {
                throw new IllegalStateException("status is required");
            }
            return new StoryImportResult(this);
        }
    }

    @Override
    public String toString() {
        return "StoryImportResult{storyUuid='" + storyUuid + "', status='" + status + "'}";
    }
}
