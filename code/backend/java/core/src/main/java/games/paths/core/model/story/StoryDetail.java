package games.paths.core.model.story;

import java.util.List;

/**
 * StoryDetail - Domain model for a full story view including difficulty levels,
 * character templates, classes, and traits.
 * Returned when fetching a single story by UUID.
 *
 * <p>Enhanced in Step 15 to include character templates, classes, traits,
 * and additional entity counts for the story content APIs.</p>
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
    private final Integer idTextClockSingular;
    private final Integer idTextClockPlural;
    private final String copyrightText;
    private final String linkCopyright;
    private final int locationCount;
    private final int eventCount;
    private final int itemCount;
    private final int classCount;
    private final int characterTemplateCount;
    private final int traitCount;
    private final List<DifficultyInfo> difficulties;
    private final List<CharacterTemplateInfo> characterTemplates;
    private final List<ClassInfo> classes;
    private final List<TraitInfo> traits;
    private final CardInfo card;

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
        this.idTextClockSingular = builder.idTextClockSingular;
        this.idTextClockPlural = builder.idTextClockPlural;
        this.copyrightText = builder.copyrightText;
        this.linkCopyright = builder.linkCopyright;
        this.locationCount = builder.locationCount;
        this.eventCount = builder.eventCount;
        this.itemCount = builder.itemCount;
        this.classCount = builder.classCount;
        this.characterTemplateCount = builder.characterTemplateCount;
        this.traitCount = builder.traitCount;
        this.difficulties = builder.difficulties != null ? List.copyOf(builder.difficulties) : List.of();
        this.characterTemplates = builder.characterTemplates != null ? List.copyOf(builder.characterTemplates) : List.of();
        this.classes = builder.classes != null ? List.copyOf(builder.classes) : List.of();
        this.traits = builder.traits != null ? List.copyOf(builder.traits) : List.of();
        this.card = builder.card;
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
    public Integer getIdTextClockSingular() { return idTextClockSingular; }
    public Integer getIdTextClockPlural() { return idTextClockPlural; }
    public String getCopyrightText() { return copyrightText; }
    public String getLinkCopyright() { return linkCopyright; }
    public int getLocationCount() { return locationCount; }
    public int getEventCount() { return eventCount; }
    public int getItemCount() { return itemCount; }
    public int getClassCount() { return classCount; }
    public int getCharacterTemplateCount() { return characterTemplateCount; }
    public int getTraitCount() { return traitCount; }
    public List<DifficultyInfo> getDifficulties() { return difficulties; }
    public List<CharacterTemplateInfo> getCharacterTemplates() { return characterTemplates; }
    public List<ClassInfo> getClasses() { return classes; }
    public List<TraitInfo> getTraits() { return traits; }
    public CardInfo getCard() { return card; }

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
        private Integer idTextClockSingular;
        private Integer idTextClockPlural;
        private String copyrightText;
        private String linkCopyright;
        private int locationCount;
        private int eventCount;
        private int itemCount;
        private int classCount;
        private int characterTemplateCount;
        private int traitCount;
        private List<DifficultyInfo> difficulties;
        private List<CharacterTemplateInfo> characterTemplates;
        private List<ClassInfo> classes;
        private List<TraitInfo> traits;
        private CardInfo card;

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
        public Builder idTextClockSingular(Integer idTextClockSingular) { this.idTextClockSingular = idTextClockSingular; return this; }
        public Builder idTextClockPlural(Integer idTextClockPlural) { this.idTextClockPlural = idTextClockPlural; return this; }
        public Builder copyrightText(String copyrightText) { this.copyrightText = copyrightText; return this; }
        public Builder linkCopyright(String linkCopyright) { this.linkCopyright = linkCopyright; return this; }
        public Builder locationCount(int locationCount) { this.locationCount = locationCount; return this; }
        public Builder eventCount(int eventCount) { this.eventCount = eventCount; return this; }
        public Builder itemCount(int itemCount) { this.itemCount = itemCount; return this; }
        public Builder difficulties(List<DifficultyInfo> difficulties) { this.difficulties = difficulties; return this; }
        public Builder characterTemplates(List<CharacterTemplateInfo> characterTemplates) { this.characterTemplates = characterTemplates; return this; }
        public Builder classes(List<ClassInfo> classes) { this.classes = classes; return this; }
        public Builder traits(List<TraitInfo> traits) { this.traits = traits; return this; }
        public Builder card(CardInfo card) { this.card = card; return this; }
        public Builder classCount(int classCount) { this.classCount = classCount; return this; }
        public Builder characterTemplateCount(int characterTemplateCount) { this.characterTemplateCount = characterTemplateCount; return this; }
        public Builder traitCount(int traitCount) { this.traitCount = traitCount; return this; }

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
