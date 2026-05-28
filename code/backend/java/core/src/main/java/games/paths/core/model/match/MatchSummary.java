package games.paths.core.model.match;

import java.util.ArrayList;
import java.util.List;

/**
 * MatchSummary - Domain model returned by {@code MatchCommandPort.createMatch}
 * and {@code MatchQueryPort.listUserMatches}. Summary projection of a
 * {@code gaming_match} row.
 *
 * <p>Step 0.19.9: exposes the creator loadout persisted at match creation
 * (single-player flag, character template, class and trait uuids).</p>
 */
public class MatchSummary {

    private String uuid;
    private String storyUuid;
    private String difficultyUuid;
    private String name;
    private String status;
    private Integer currentClock;
    private Integer expCost;
    private String userCreatorUuid;
    private String tsInsert;
    private Integer singlePlayer;
    private String characterTemplateUuid;
    private String classUuid;
    private List<String> traitUuids = new ArrayList<>();

    public MatchSummary() {
    }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public String getStoryUuid() { return storyUuid; }
    public void setStoryUuid(String storyUuid) { this.storyUuid = storyUuid; }

    public String getDifficultyUuid() { return difficultyUuid; }
    public void setDifficultyUuid(String difficultyUuid) { this.difficultyUuid = difficultyUuid; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

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
    public void setTraitUuids(List<String> traitUuids) {
        this.traitUuids = traitUuids != null ? traitUuids : new ArrayList<>();
    }
}
