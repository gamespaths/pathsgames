package games.paths.adapters.rest.dto;

import games.paths.core.model.match.MatchMission;
import games.paths.core.model.match.MatchMissionStep;

import java.util.ArrayList;
import java.util.List;

/**
 * MatchMissionResponse - Step 37. One mission of a match: what the story authored plus the two
 * things only this match knows, the status it has reached and how far down the steps it is.
 */
public class MatchMissionResponse {

    private String uuid;
    private String name;
    private String description;
    private String status;
    private Integer stepReached;
    private int stepsTotal;
    private Integer idCard;
    private CardInfoResponse card;
    private List<StepDto> steps = new ArrayList<>();

    public static MatchMissionResponse fromModel(MatchMission m) {
        MatchMissionResponse d = new MatchMissionResponse();
        if (m == null) {
            return d;
        }
        d.uuid = m.getUuid();
        d.name = m.getName();
        d.description = m.getDescription();
        d.status = m.getStatus();
        d.stepReached = m.getStepReached();
        d.stepsTotal = m.getStepsTotal();
        d.idCard = m.getIdCard();
        d.card = CardInfoResponse.fromModel(m.getCard());
        for (MatchMissionStep s : m.getSteps()) {
            d.steps.add(StepDto.fromModel(s));
        }
        return d;
    }

    public static List<MatchMissionResponse> fromModel(List<MatchMission> model) {
        List<MatchMissionResponse> out = new ArrayList<>();
        if (model == null) {
            return out;
        }
        for (MatchMission m : model) {
            out.add(fromModel(m));
        }
        return out;
    }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Integer getStepReached() { return stepReached; }
    public void setStepReached(Integer stepReached) { this.stepReached = stepReached; }
    public int getStepsTotal() { return stepsTotal; }
    public void setStepsTotal(int stepsTotal) { this.stepsTotal = stepsTotal; }
    public Integer getIdCard() { return idCard; }
    public void setIdCard(Integer idCard) { this.idCard = idCard; }
    public CardInfoResponse getCard() { return card; }
    public void setCard(CardInfoResponse card) { this.card = card; }
    public List<StepDto> getSteps() { return steps; }
    public void setSteps(List<StepDto> steps) { this.steps = steps; }

    public static class StepDto {
        private String uuid;
        private Integer step;
        private String name;
        private String description;
        private Integer idCard;
        private CardInfoResponse card;
        private boolean done;

        public static StepDto fromModel(MatchMissionStep s) {
            StepDto d = new StepDto();
            d.uuid = s.getUuid();
            d.step = s.getStep();
            d.name = s.getName();
            d.description = s.getDescription();
            d.idCard = s.getIdCard();
            d.card = CardInfoResponse.fromModel(s.getCard());
            d.done = s.isDone();
            return d;
        }

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
        public CardInfoResponse getCard() { return card; }
        public void setCard(CardInfoResponse card) { this.card = card; }
        public boolean isDone() { return done; }
        public void setDone(boolean done) { this.done = done; }
    }
}
