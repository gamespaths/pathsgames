package games.paths.core.model.story;

/**
 * StorySummary - Domain model for a lightweight story listing entry.
 * Contains only the fields needed to display a story in a catalogue/list view.
 */
public class StorySummary {

    private final String uuid;
    private final String title;
    private final String description;
    private final String author;
    private final String category;
    private final String group;
    private final String visibility;
    private final int priority;
    private final int peghi;
    private final int difficultyCount;

    private StorySummary(Builder builder) {
        this.uuid = builder.uuid;
        this.title = builder.title;
        this.description = builder.description;
        this.author = builder.author;
        this.category = builder.category;
        this.group = builder.group;
        this.visibility = builder.visibility;
        this.priority = builder.priority;
        this.peghi = builder.peghi;
        this.difficultyCount = builder.difficultyCount;
    }

    public String getUuid() { return uuid; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public String getAuthor() { return author; }
    public String getCategory() { return category; }
    public String getGroup() { return group; }
    public String getVisibility() { return visibility; }
    public int getPriority() { return priority; }
    public int getPeghi() { return peghi; }
    public int getDifficultyCount() { return difficultyCount; }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private String uuid;
        private String title;
        private String description;
        private String author;
        private String category;
        private String group;
        private String visibility;
        private int priority;
        private int peghi;
        private int difficultyCount;

        public Builder uuid(String uuid) { this.uuid = uuid; return this; }
        public Builder title(String title) { this.title = title; return this; }
        public Builder description(String description) { this.description = description; return this; }
        public Builder author(String author) { this.author = author; return this; }
        public Builder category(String category) { this.category = category; return this; }
        public Builder group(String group) { this.group = group; return this; }
        public Builder visibility(String visibility) { this.visibility = visibility; return this; }
        public Builder priority(int priority) { this.priority = priority; return this; }
        public Builder peghi(int peghi) { this.peghi = peghi; return this; }
        public Builder difficultyCount(int difficultyCount) { this.difficultyCount = difficultyCount; return this; }

        public StorySummary build() {
            if (uuid == null || uuid.isBlank()) {
                throw new IllegalStateException("uuid is required");
            }
            return new StorySummary(this);
        }
    }

    @Override
    public String toString() {
        return "StorySummary{uuid='" + uuid + "', title='" + title + "'}";
    }
}
