package games.paths.core.service.match;

import games.paths.core.entity.story.StoryDifficultyEntity;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * ExperienceCostCalculator - Step 38: what a +1 on DEX/INT/COS costs and whether it is allowed.
 * Pure arithmetic shared by {@code /info} (expCosts) and the use-exp action, so both agree.
 */
public final class ExperienceCostCalculator {

    /** Stat tokens of use-exp, in the order {@code expCosts} is rendered. */
    public static final List<String> STATS = List.of("dex", "int", "cos");

    private final int expCost;
    private final int expCostBase;
    private final Integer maxStatValue;

    /**
     * Guards: {@code expCost <= 0 → 1}, {@code expCostBase <= 0 → 0},
     * {@code maxStatValue <= 0 / null → no cap}.
     */
    public ExperienceCostCalculator(Integer expCost, Integer expCostBase, Integer maxStatValue) {
        this.expCost = expCost == null || expCost <= 0 ? 1 : expCost;
        this.expCostBase = expCostBase == null || expCostBase < 0 ? 0 : expCostBase;
        this.maxStatValue = maxStatValue == null || maxStatValue <= 0 ? null : maxStatValue;
    }

    /** Reads the three parameters off the difficulty row; a null row falls back to {@code fallbackExpCost}. */
    public static ExperienceCostCalculator of(StoryDifficultyEntity difficulty, Integer fallbackExpCost) {
        if (difficulty == null) {
            return new ExperienceCostCalculator(fallbackExpCost, 0, 0);
        }
        return new ExperienceCostCalculator(difficulty.getExpCost(), difficulty.getExpCostBase(),
                difficulty.getMaxStatValue());
    }

    public int expCost() { return expCost; }
    public int expCostBase() { return expCostBase; }
    /** Null when there is no cap. */
    public Integer maxStatValue() { return maxStatValue; }

    /** {@code max(1, expCost × current + expCostBase)}. */
    public int cost(int current) {
        return Math.max(1, expCost * current + expCostBase);
    }

    /** True when {@code current + 1} would pass the cap. */
    public boolean atCap(int current) {
        return maxStatValue != null && current >= maxStatValue;
    }

    /** The cost of the next point, or null when the stat is at its cap. */
    public Integer costOrNull(int current) {
        return atCap(current) ? null : cost(current);
    }

    /** {@code {dex, int, cos}} → cost of the next point, null at cap. Insertion-ordered. */
    public Map<String, Integer> costs(int dexterity, int intelligence, int constitution) {
        Map<String, Integer> m = new LinkedHashMap<>();
        m.put("dex", costOrNull(dexterity));
        m.put("int", costOrNull(intelligence));
        m.put("cos", costOrNull(constitution));
        return m;
    }
}
