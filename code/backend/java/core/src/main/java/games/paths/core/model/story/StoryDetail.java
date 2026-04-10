package games.paths.core.model.story;

import java.util.List;

/**
 * StoryDetail - Domain model for a full story view including difficulty levels.
 * Returned when fetching a single story by UUID.
 */
public class StoryDetail {

    private final String uuid;
    private final String title;
    private final String description;
    private final String author;
    private final String category;
    private final String group;
    private final String visibility;
    private final int priority;
    private final int peghi;
    private final String versionMin;
    private final String versionMax;
    private final String clockSingularDescription;
    private final String clockPluralDescription;
    private final String copyrightText;
    private final String linkCopyright;
    private final int locationCount;
    private final int eventCount;
    private final int itemCount;
    private final List<DifficultyInfo> difficulties;

    private StoryDetail(Builder builder) {
        this.uuid = builder.uuid;
        this.title = builder.title;
        this.description = builder.description;
        this.author = builder.author;
        this.category = builder.category;
        this.group = builder.group;
        this.visibility = builder.visibility;
        this.priority = builder.priority;
        this.peghi = builder.peghi;
        this.versionMin = builder.versionMin;
        this.versionMax = builder.versionMax;
        this.clockSingularDescription = builder.clockSingularDescription;
        this.clockPluralDescription = builder.clockPluralDescription;
        this.copyrightText = builder.copyrightText;
        this.linkCopyright = builder.linkCopyright;
        this.locationCount = builder.locationCount;
        this.eventCount = builder.eventCount;
        this.itemCount = builder.itemCount;
        this.difficulties = builder.difficulties != null ? List.copyOf(builder.difficulties) : List.of();
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
    public String getVersionMin() { return versionMin; }
    public String getVersionMax() { return versionMax; }
    public String getClockSingularDescription() { return clockSingularDescription; }
    public String getClockPluralDescription() { return clockPluralDescription; }
    public String getCopyrightText() { return copyrightText; }
    public String getLinkCopyright() { return linkCopyright; }
    public int getLocationCount() { return locationCount; }
    public int getEventCount() { return eventCount; }
    public int getItemCount() { return itemCount; }
    public List<DifficultyInfo> getDifficulties() { return difficulties; }

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
        private String versionMin;
        private String versionMax;
        private String clockSingularDescription;
        private String clockPluralDescription;
        private String copyrightText;
        private String linkCopyright;
        private int locationCount;
        private int eventCount;
        private int itemCount;
        private List<DifficultyInfo> difficulties;

        public Builder uuid(String uuid) { this.uuid = uuid; return this; }
        public Builder title(String title) { this.title = title; return this; }
        public Builder description(String description) { this.description = description; return this; }
        public Builder author(String author) { this.author = author; return this; }
        public Builder category(String category) { this.category = category; return this; }
        public Builder group(String group) { this.group = group; return this; }
        public Builder visibility(String visibility) { this.visibility = visibility; return this; }
        public Builder priority(int priority) { this.priority = priority; return this; }
        public Builder peghi(int peghi) { this.peghi = peghi; return this; }
        public Builder versionMin(String versionMin) { this.versionMin = versionMin; return this; }
        public Builder versionMax(String versionMax) { this.versionMax = versionMax; return this; }
        public Builder clockSingularDescription(String clockSingularDescription) { this.clockSingularDescription = clockSingularDescription; return this; }
        public Builder clockPluralDescription(String clockPluralDescription) { this.clockPluralDescription = clockPluralDescription; return this; }
        public Builder copyrightText(String copyrightText) { this.copyrightText = copyrightText; return this; }
        public Builder linkCopyright(String linkCopyright) { this.linkCopyright = linkCopyright; return this; }
        public Builder locationCount(int locationCount) { this.locationCount = locationCount; return this; }
        public Builder eventCount(int eventCount) { this.eventCount = eventCount; return this; }
        public Builder itemCount(int itemCount) { this.itemCount = itemCount; return this; }
        public Builder difficulties(List<DifficultyInfo> difficulties) { this.difficulties = difficulties; return this; }

        public StoryDetail build() {
            if (uuid == null || uuid.isBlank()) {
                throw new IllegalStateException("uuid is required");
            }
            return new StoryDetail(this);
        }
    }

    @Override
    public String toString() {
        return "StoryDetail{uuid='" + uuid + "', title='" + title + "'}";
    }
}
