package games.paths.core.model.story;

/**
 * CharacterTemplateInfo - Domain model for a character template summary.
 * Used within StoryDetail to describe available character templates for a story.
 */
public class CharacterTemplateInfo {

    private final String uuid;
    private final String name;
    private final String description;
    private final int lifeMax;
    private final int energyMax;
    private final int sadMax;
    private final int dexterityStart;
    private final int intelligenceStart;
    private final int constitutionStart;

    private CharacterTemplateInfo(Builder builder) {
        this.uuid = builder.uuid;
        this.name = builder.name;
        this.description = builder.description;
        this.lifeMax = builder.lifeMax;
        this.energyMax = builder.energyMax;
        this.sadMax = builder.sadMax;
        this.dexterityStart = builder.dexterityStart;
        this.intelligenceStart = builder.intelligenceStart;
        this.constitutionStart = builder.constitutionStart;
    }

    public String getUuid() { return uuid; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public int getLifeMax() { return lifeMax; }
    public int getEnergyMax() { return energyMax; }
    public int getSadMax() { return sadMax; }
    public int getDexterityStart() { return dexterityStart; }
    public int getIntelligenceStart() { return intelligenceStart; }
    public int getConstitutionStart() { return constitutionStart; }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private String uuid;
        private String name;
        private String description;
        private int lifeMax;
        private int energyMax;
        private int sadMax;
        private int dexterityStart;
        private int intelligenceStart;
        private int constitutionStart;

        public Builder uuid(String uuid) { this.uuid = uuid; return this; }
        public Builder name(String name) { this.name = name; return this; }
        public Builder description(String description) { this.description = description; return this; }
        public Builder lifeMax(int lifeMax) { this.lifeMax = lifeMax; return this; }
        public Builder energyMax(int energyMax) { this.energyMax = energyMax; return this; }
        public Builder sadMax(int sadMax) { this.sadMax = sadMax; return this; }
        public Builder dexterityStart(int dexterityStart) { this.dexterityStart = dexterityStart; return this; }
        public Builder intelligenceStart(int intelligenceStart) { this.intelligenceStart = intelligenceStart; return this; }
        public Builder constitutionStart(int constitutionStart) { this.constitutionStart = constitutionStart; return this; }

        public CharacterTemplateInfo build() {
            return new CharacterTemplateInfo(this);
        }
    }

    @Override
    public String toString() {
        return "CharacterTemplateInfo{uuid='" + uuid + "', name='" + name + "'}";
    }
}
