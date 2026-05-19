package games.paths.core.model.story;

import java.util.List;

/**
 * StoryDetail - Domain model for a full story view including difficulty levels,
 * character templates, classes, and traits. Immutable record.
 *
 * <p>Returned when fetching a single story by UUID. Because the type carries
 * 28 components, instances are assembled through the nested {@link Builder}
 * rather than the canonical constructor.</p>
 */
public record StoryDetail(
        String uuid,
        String title,
        String description,
        String author,
        String category,
        String group,
        String visibility,
        int priority,
        int peghi,
        String versionMin,
        String versionMax,
        String clockSingularDescription,
        String clockPluralDescription,
        Integer idTextClockSingular,
        Integer idTextClockPlural,
        String copyrightText,
        String linkCopyright,
        int locationCount,
        int eventCount,
        int itemCount,
        int classCount,
        int characterTemplateCount,
        int traitCount,
        List<DifficultyInfo> difficulties,
        List<CharacterTemplateInfo> characterTemplates,
        List<ClassInfo> classes,
        List<TraitInfo> traits,
        CardInfo card) {

    public StoryDetail {
        if (uuid == null || uuid.isBlank()) {
            throw new IllegalStateException("uuid is required");
        }
        difficulties = ClassBonusInfoListHelper.immutableCopy(difficulties);
        characterTemplates = ClassBonusInfoListHelper.immutableCopy(characterTemplates);
        classes = ClassBonusInfoListHelper.immutableCopy(classes);
        traits = ClassBonusInfoListHelper.immutableCopy(traits);
    }

    public static Builder builder() { return new Builder(); }

    /**
     * Mutable assembler for {@link StoryDetail}. This is the only builder left
     * in the story-model package after the v0.19.8 record migration, so it has
     * no cross-class duplicate.
     */
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
        public Builder clockSingularDescription(String v) { this.clockSingularDescription = v; return this; }
        public Builder clockPluralDescription(String v) { this.clockPluralDescription = v; return this; }
        public Builder idTextClockSingular(Integer v) { this.idTextClockSingular = v; return this; }
        public Builder idTextClockPlural(Integer v) { this.idTextClockPlural = v; return this; }
        public Builder copyrightText(String copyrightText) { this.copyrightText = copyrightText; return this; }
        public Builder linkCopyright(String linkCopyright) { this.linkCopyright = linkCopyright; return this; }
        public Builder locationCount(int locationCount) { this.locationCount = locationCount; return this; }
        public Builder eventCount(int eventCount) { this.eventCount = eventCount; return this; }
        public Builder itemCount(int itemCount) { this.itemCount = itemCount; return this; }
        public Builder classCount(int classCount) { this.classCount = classCount; return this; }
        public Builder characterTemplateCount(int v) { this.characterTemplateCount = v; return this; }
        public Builder traitCount(int traitCount) { this.traitCount = traitCount; return this; }
        public Builder difficulties(List<DifficultyInfo> difficulties) { this.difficulties = difficulties; return this; }
        public Builder characterTemplates(List<CharacterTemplateInfo> v) { this.characterTemplates = v; return this; }
        public Builder classes(List<ClassInfo> classes) { this.classes = classes; return this; }
        public Builder traits(List<TraitInfo> traits) { this.traits = traits; return this; }
        public Builder card(CardInfo card) { this.card = card; return this; }

        public StoryDetail build() {
            return new StoryDetail(uuid, title, description, author, category, group,
                    visibility, priority, peghi, versionMin, versionMax,
                    clockSingularDescription, clockPluralDescription,
                    idTextClockSingular, idTextClockPlural, copyrightText, linkCopyright,
                    locationCount, eventCount, itemCount, classCount,
                    characterTemplateCount, traitCount,
                    difficulties, characterTemplates, classes, traits, card);
        }
    }
}
