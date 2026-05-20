package games.paths.adapters.rest.dto;

import games.paths.core.model.match.MatchSummary;

import java.util.List;

/**
 * MatchSummaryResponse - JSON projection of {@link MatchSummary}.
 * Step 19.
 *
 * <p>Step 0.19.9 — also surfaces the creator loadout (single-player flag,
 * character template, class and trait uuids) persisted at match creation.</p>
 */
public class MatchSummaryResponse extends AbstractUuidNameDto {

    private String storyUuid;
    private String difficultyUuid;
    private String status;
    private Integer currentClock;
    private Integer expCost;
    private String userCreatorUuid;
    private String tsInsert;
    private Integer singlePlayer;
    private String characterTemplateUuid;
    private String classUuid;
    private List<String> traitUuids;

    public MatchSummaryResponse() {
    }

    public static MatchSummaryResponse fromModel(MatchSummary m) {
        if (m == null) return null;
        MatchSummaryResponse r = new MatchSummaryResponse();
        r.setUuid(m.getUuid());
        r.storyUuid = m.getStoryUuid();
        r.difficultyUuid = m.getDifficultyUuid();
        r.setName(m.getName());
        r.status = m.getStatus();
        r.currentClock = m.getCurrentClock();
        r.expCost = m.getExpCost();
        r.userCreatorUuid = m.getUserCreatorUuid();
        r.tsInsert = m.getTsInsert();
        r.singlePlayer = m.getSinglePlayer();
        r.characterTemplateUuid = m.getCharacterTemplateUuid();
        r.classUuid = m.getClassUuid();
        r.traitUuids = m.getTraitUuids();
        return r;
    }

    public String getStoryUuid() { return storyUuid; }
    public void setStoryUuid(String storyUuid) { this.storyUuid = storyUuid; }

    public String getDifficultyUuid() { return difficultyUuid; }
    public void setDifficultyUuid(String difficultyUuid) { this.difficultyUuid = difficultyUuid; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Integer getCurrentClock() { return currentClock; }
    public void setCurrentClock(Integer currentClock) { this.currentClock = currentClock; }

    public Integer getExpCost() { return expCost; }
    public void setExpCost(Integer expCost) { this.expCost = expCost; }

    public String getUserCreatorUuid() { return userCreatorUuid; }
    public void setUserCreatorUuid(String userCreatorUuid) { this.userCreatorUuid = userCreatorUuid; }

    public String getTsInsert() { return tsInsert; }
    public void setTsInsert(String tsInsert) { this.tsInsert = tsInsert; }

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
