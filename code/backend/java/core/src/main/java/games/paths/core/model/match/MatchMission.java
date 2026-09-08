package games.paths.core.model.match;

import games.paths.core.model.story.CardInfo;

import java.util.ArrayList;
import java.util.List;

/**
 * MatchMission - Step 37 domain model for one mission of a match, status and step progress
 * included. Only missions this match has actually reached are ever built into one.
 */
public class MatchMission {

    private String uuid;
    private String name;
    private String description;
    private Integer idCard;
    private CardInfo card;
    /** AVAILABLE, ACTIVE, COMPLETED or FAILED — never LOCKED, which is simply absence. */
    private String status;
    /** The {@code step} number of the last step closed; null while none has been. */
    private Integer stepReached;
    private int stepsTotal;
    private List<MatchMissionStep> steps = new ArrayList<>();

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Integer getIdCard() { return idCard; }
    public void setIdCard(Integer idCard) { this.idCard = idCard; }

    public CardInfo getCard() { return card; }
    public void setCard(CardInfo card) { this.card = card; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Integer getStepReached() { return stepReached; }
    public void setStepReached(Integer stepReached) { this.stepReached = stepReached; }

    public int getStepsTotal() { return stepsTotal; }
    public void setStepsTotal(int stepsTotal) { this.stepsTotal = stepsTotal; }

    public List<MatchMissionStep> getSteps() { return steps; }
    public void setSteps(List<MatchMissionStep> steps) { this.steps = steps; }
}
