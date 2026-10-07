package games.paths.adapters.rest.dto;

import games.paths.core.port.match.ExperiencePort;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * JSON projection of POST /api/gameplay/{uuidMatch}/action/use-exp (Step 38).
 * {@code statChanges} repeats the purchase in the execute-event shape so the frontend
 * renders it with the badges it already has.
 */
public class UseExpResponse {

    private String matchUuid;
    private String characterUuid;
    private String stat;
    private Integer statBefore;
    private Integer statAfter;
    private Integer expBefore;
    private Integer expAfter;
    private Integer expCost;
    private Map<String, Integer> expCosts;
    private List<StatChangeDto> statChanges = new ArrayList<>();

    public static UseExpResponse fromModel(ExperiencePort.UseExpResult m) {
        UseExpResponse r = new UseExpResponse();
        r.matchUuid = m.matchUuid();
        r.characterUuid = m.characterUuid();
        r.stat = m.stat();
        r.statBefore = m.statBefore();
        r.statAfter = m.statAfter();
        r.expBefore = m.expBefore();
        r.expAfter = m.expAfter();
        r.expCost = m.expCost();
        r.expCosts = m.expCosts() != null ? new LinkedHashMap<>(m.expCosts()) : null;
        if (m.statChanges() != null) {
            for (ExperiencePort.StatChange c : m.statChanges()) {
                r.statChanges.add(StatChangeDto.fromModel(c));
            }
        }
        return r;
    }

    public String getMatchUuid() { return matchUuid; }
    public void setMatchUuid(String matchUuid) { this.matchUuid = matchUuid; }
    public String getCharacterUuid() { return characterUuid; }
    public void setCharacterUuid(String characterUuid) { this.characterUuid = characterUuid; }
    public String getStat() { return stat; }
    public void setStat(String stat) { this.stat = stat; }
    public Integer getStatBefore() { return statBefore; }
    public void setStatBefore(Integer statBefore) { this.statBefore = statBefore; }
    public Integer getStatAfter() { return statAfter; }
    public void setStatAfter(Integer statAfter) { this.statAfter = statAfter; }
    public Integer getExpBefore() { return expBefore; }
    public void setExpBefore(Integer expBefore) { this.expBefore = expBefore; }
    public Integer getExpAfter() { return expAfter; }
    public void setExpAfter(Integer expAfter) { this.expAfter = expAfter; }
    public Integer getExpCost() { return expCost; }
    public void setExpCost(Integer expCost) { this.expCost = expCost; }
    public Map<String, Integer> getExpCosts() { return expCosts; }
    public void setExpCosts(Map<String, Integer> expCosts) { this.expCosts = expCosts; }
    public List<StatChangeDto> getStatChanges() { return statChanges; }
    public void setStatChanges(List<StatChangeDto> statChanges) { this.statChanges = statChanges; }

    /** One stat moved by {@code delta} — the execute-event shape. */
    public static class StatChangeDto {
        private String characterUuid;
        private String statistic;
        private int before;
        private int after;
        private int delta;

        public static StatChangeDto fromModel(ExperiencePort.StatChange m) {
            StatChangeDto d = new StatChangeDto();
            d.characterUuid = m.characterUuid();
            d.statistic = m.statistic();
            d.before = m.before();
            d.after = m.after();
            d.delta = m.delta();
            return d;
        }

        public String getCharacterUuid() { return characterUuid; }
        public void setCharacterUuid(String characterUuid) { this.characterUuid = characterUuid; }
        public String getStatistic() { return statistic; }
        public void setStatistic(String statistic) { this.statistic = statistic; }
        public int getBefore() { return before; }
        public void setBefore(int before) { this.before = before; }
        public int getAfter() { return after; }
        public void setAfter(int after) { this.after = after; }
        public int getDelta() { return delta; }
        public void setDelta(int delta) { this.delta = delta; }
    }
}
