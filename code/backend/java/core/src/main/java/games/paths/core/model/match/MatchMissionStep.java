package games.paths.core.model.match;

import games.paths.core.model.story.CardInfo;

/**
 * MatchMissionStep - one step of a mission as a match sees it: the authored content plus the
 * only piece of state a step has, whether this match has already closed it.
 */
public class MatchMissionStep {

    private String uuid;
    private Integer step;
    private String name;
    private String description;
    private Integer idCard;
    private CardInfo card;
    private boolean done;

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public Integer getStep() { return step; }
    public void setStep(Integer step) { this.step = step; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Integer getIdCard() { return idCard; }
    public void setIdCard(Integer idCard) { this.idCard = idCard; }

    public CardInfo getCard() { return card; }
    public void setCard(CardInfo card) { this.card = card; }

    public boolean isDone() { return done; }
    public void setDone(boolean done) { this.done = done; }
}
