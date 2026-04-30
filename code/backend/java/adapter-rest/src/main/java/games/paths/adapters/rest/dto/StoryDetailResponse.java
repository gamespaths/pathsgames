package games.paths.adapters.rest.dto;

import java.util.List;

import games.paths.core.dto.BaseStorySummaryResponse;

/**
 * StoryDetailResponse - REST response DTO for full story details.
 *
 * <p>Enhanced in Step 15 with character templates, classes, traits,
 * entity counts, and card info.</p>
 */
public class StoryDetailResponse extends BaseStorySummaryResponse {
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
    private List<DifficultyResponse> difficulties;
    private List<CharacterTemplateResponse> characterTemplates;
    private List<ClassInfoResponse> classes;
    private List<TraitInfoResponse> traits;
    private CardInfoResponse card;

    public StoryDetailResponse() {
        setPriority(0);
        setPeghi(0);
    }

    public String getVersionMin() { return versionMin; }
    public void setVersionMin(String versionMin) { this.versionMin = versionMin; }

    public String getVersionMax() { return versionMax; }
    public void setVersionMax(String versionMax) { this.versionMax = versionMax; }

    public String getClockSingularDescription() { return clockSingularDescription; }
    public void setClockSingularDescription(String clockSingularDescription) { this.clockSingularDescription = clockSingularDescription; }

    public String getClockPluralDescription() { return clockPluralDescription; }
    public void setClockPluralDescription(String clockPluralDescription) { this.clockPluralDescription = clockPluralDescription; }

    public Integer getIdTextClockSingular() { return idTextClockSingular; }
    public void setIdTextClockSingular(Integer idTextClockSingular) { this.idTextClockSingular = idTextClockSingular; }

    public Integer getIdTextClockPlural() { return idTextClockPlural; }
    public void setIdTextClockPlural(Integer idTextClockPlural) { this.idTextClockPlural = idTextClockPlural; }

    public String getCopyrightText() { return copyrightText; }
    public void setCopyrightText(String copyrightText) { this.copyrightText = copyrightText; }

    public String getLinkCopyright() { return linkCopyright; }
    public void setLinkCopyright(String linkCopyright) { this.linkCopyright = linkCopyright; }

    public int getLocationCount() { return locationCount; }
    public void setLocationCount(int locationCount) { this.locationCount = locationCount; }

    public int getEventCount() { return eventCount; }
    public void setEventCount(int eventCount) { this.eventCount = eventCount; }

    public int getItemCount() { return itemCount; }
    public void setItemCount(int itemCount) { this.itemCount = itemCount; }

    public int getClassCount() { return classCount; }
    public void setClassCount(int classCount) { this.classCount = classCount; }

    public int getCharacterTemplateCount() { return characterTemplateCount; }
    public void setCharacterTemplateCount(int characterTemplateCount) { this.characterTemplateCount = characterTemplateCount; }

    public int getTraitCount() { return traitCount; }
    public void setTraitCount(int traitCount) { this.traitCount = traitCount; }

    public List<DifficultyResponse> getDifficulties() { return difficulties; }
    public void setDifficulties(List<DifficultyResponse> difficulties) { this.difficulties = difficulties; }

    public List<CharacterTemplateResponse> getCharacterTemplates() { return characterTemplates; }
    public void setCharacterTemplates(List<CharacterTemplateResponse> characterTemplates) { this.characterTemplates = characterTemplates; }

    public List<ClassInfoResponse> getClasses() { return classes; }
    public void setClasses(List<ClassInfoResponse> classes) { this.classes = classes; }

    public List<TraitInfoResponse> getTraits() { return traits; }
    public void setTraits(List<TraitInfoResponse> traits) { this.traits = traits; }

    public CardInfoResponse getCard() { return card; }
    public void setCard(CardInfoResponse card) { this.card = card; }
}
