package games.paths.core.model.story;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * ClassInfo - Domain model for a character class summary.
 * Used within StoryDetail to describe available classes for a story.
 */
public class ClassInfo {

    private final Long id;
    private final String uuid;
    private final String name;
    private final String description;
    private final int weightMax;
    private final int dexterityBase;
    private final int intelligenceBase;
    private final int constitutionBase;
    private final Integer idCard;
    private final CardInfo card;
    private final List<ClassBonusInfo> bonuses;

    private ClassInfo(Builder builder) {
        this.id = builder.id;
        this.uuid = builder.uuid;
        this.name = builder.name;
        this.description = builder.description;
        this.weightMax = builder.weightMax;
        this.dexterityBase = builder.dexterityBase;
        this.intelligenceBase = builder.intelligenceBase;
        this.constitutionBase = builder.constitutionBase;
        this.idCard = builder.idCard;
        this.card = builder.card;
        this.bonuses = builder.bonuses != null
                ? Collections.unmodifiableList(new ArrayList<>(builder.bonuses))
                : Collections.emptyList();
    }

    public Long getId() { return id; }
    public String getUuid() { return uuid; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public int getWeightMax() { return weightMax; }
    public int getDexterityBase() { return dexterityBase; }
    public int getIntelligenceBase() { return intelligenceBase; }
    public int getConstitutionBase() { return constitutionBase; }
    public Integer getIdCard() { return idCard; }
    public CardInfo getCard() { return card; }
    public List<ClassBonusInfo> getBonuses() { return bonuses; }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private Long id;
        private String uuid;
        private String name;
        private String description;
        private int weightMax;
        private int dexterityBase;
        private int intelligenceBase;
        private int constitutionBase;
        private Integer idCard;
        private CardInfo card;
        private List<ClassBonusInfo> bonuses;

        public Builder id(Long id) { this.id = id; return this; }
        public Builder uuid(String uuid) { this.uuid = uuid; return this; }
        public Builder name(String name) { this.name = name; return this; }
        public Builder description(String description) { this.description = description; return this; }
        public Builder weightMax(int weightMax) { this.weightMax = weightMax; return this; }
        public Builder dexterityBase(int dexterityBase) { this.dexterityBase = dexterityBase; return this; }
        public Builder intelligenceBase(int intelligenceBase) { this.intelligenceBase = intelligenceBase; return this; }
        public Builder constitutionBase(int constitutionBase) { this.constitutionBase = constitutionBase; return this; }
        public Builder idCard(Integer idCard) { this.idCard = idCard; return this; }
        public Builder card(CardInfo card) { this.card = card; return this; }
        public Builder bonuses(List<ClassBonusInfo> bonuses) { this.bonuses = bonuses; return this; }

        public ClassInfo build() {
            return new ClassInfo(this);
        }
    }

    @Override
    public String toString() {
        return "ClassInfo{uuid='" + uuid + "', name='" + name + "'}";
    }
}
