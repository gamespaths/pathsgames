package games.paths.adapters.rest.dto;

import java.util.List;

/**
 * Shared base DTO for the creator loadout persisted at match creation: the
 * single-player flag, character template, class and trait uuids — layered on
 * top of the {@code uuid} + {@code name} identity pair.
 *
 * <p>v0.20.8 — extracted from {@code MatchCreateRequest} and
 * {@code MatchSummaryResponse} to eliminate the ~18 duplicated loadout lines
 * per class previously flagged by SonarQube (duplicated lines on new code).
 * {@code MatchCreateRequest} only consumes {@code name} + loadout; the
 * inherited {@code uuid} accessor stays unused on the request side.</p>
 */
public abstract class AbstractCreatorLoadoutDto extends AbstractUuidNameDto {

    private Integer singlePlayer;
    private String characterTemplateUuid;
    private String classUuid;
    private List<String> traitUuids;

    protected AbstractCreatorLoadoutDto() {
    }

    public Integer getSinglePlayer() { return singlePlayer; }
    public void setSinglePlayer(Integer singlePlayer) { this.singlePlayer = singlePlayer; }

    public String getCharacterTemplateUuid() { return characterTemplateUuid; }
    public void setCharacterTemplateUuid(String characterTemplateUuid) {
        this.characterTemplateUuid = characterTemplateUuid;
    }

    public String getClassUuid() { return classUuid; }
    public void setClassUuid(String classUuid) { this.classUuid = classUuid; }

    public List<String> getTraitUuids() { return traitUuids; }
    public void setTraitUuids(List<String> traitUuids) { this.traitUuids = traitUuids; }
}
