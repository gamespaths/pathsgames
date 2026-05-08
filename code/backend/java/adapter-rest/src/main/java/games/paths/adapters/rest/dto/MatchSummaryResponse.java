package games.paths.adapters.rest.dto;

import games.paths.core.model.match.MatchSummary;

/**
 * MatchSummaryResponse - JSON projection of {@link MatchSummary}.
 * Step 19.
 */
public class MatchSummaryResponse {

    private String uuid;
    private String storyUuid;
    private String difficultyUuid;
    private String name;
    private String status;
    private Integer currentClock;
    private Integer expCost;
    private String userCreatorUuid;
    private String tsInsert;

    public MatchSummaryResponse() {
    }

    public static MatchSummaryResponse fromModel(MatchSummary m) {
        if (m == null) return null;
        MatchSummaryResponse r = new MatchSummaryResponse();
        r.uuid = m.getUuid();
        r.storyUuid = m.getStoryUuid();
        r.difficultyUuid = m.getDifficultyUuid();
        r.name = m.getName();
        r.status = m.getStatus();
        r.currentClock = m.getCurrentClock();
        r.expCost = m.getExpCost();
        r.userCreatorUuid = m.getUserCreatorUuid();
        r.tsInsert = m.getTsInsert();
        return r;
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
}
