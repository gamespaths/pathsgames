package games.paths.core.service.match;

import games.paths.core.entity.story.ClassEntity;
import games.paths.core.entity.story.StoryDifficultyEntity;
import games.paths.core.entity.story.TraitEntity;
import games.paths.core.port.story.StoryReadPort;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * TraitSelectionValidator - Step 23 domain rules for the traits selected at
 * character creation (match create loadout and match join):
 * <ul>
 *   <li>every trait uuid must exist in the story ({@code TRAIT_NOT_FOUND});</li>
 *   <li>no duplicate selections ({@code TRAIT_DUPLICATED});</li>
 *   <li>{@code id_class_permitted}/{@code id_class_prohibited} must match the
 *       selected class ({@code TRAIT_NOT_COMPATIBLE}); a permitted-restricted
 *       trait is rejected when no class is selected;</li>
 *   <li>Σ cost_positive and Σ cost_negative must each stay within the
 *       difficulty budgets ({@code TRAIT_COST_EXCEEDED}); a {@code null}
 *       budget means "no limit".</li>
 * </ul>
 */
public final class TraitSelectionValidator {

    public enum Violation {
        TRAIT_NOT_FOUND,
        TRAIT_DUPLICATED,
        TRAIT_NOT_COMPATIBLE,
        TRAIT_COST_EXCEEDED,
        /**
         * v0.35.2 — {@code hide_on_start_match = 1}: the trait is never offered at
         * character creation, and asking for it anyway is refused here. The API still
         * returns it (the same list resolves the traits a character already owns), so a
         * client that only hid the row would be a rule anyone could walk around with curl.
         */
        TRAIT_NOT_SELECTABLE
    }

    /**
     * TraitSelectionException - raised on the first violated rule; callers
     * translate {@link #getViolation()} into their own exception codes.
     */
    public static class TraitSelectionException extends RuntimeException {
        private final Violation violation;

        public TraitSelectionException(Violation violation, String message) {
            super(message);
            this.violation = violation;
        }

        public Violation getViolation() { return violation; }
    }

    private TraitSelectionValidator() { }

    /**
     * Resolves and validates the selected traits for a story/class/difficulty.
     * Blank uuids are ignored; all other rules are strict.
     */
    public static List<TraitEntity> resolveAndValidate(StoryReadPort storyReadPort,
                                                       Long storyId,
                                                       ClassEntity clazz,
                                                       StoryDifficultyEntity difficulty,
                                                       List<String> traitUuids) {
        List<TraitEntity> resolved = new ArrayList<>();
        if (traitUuids == null || traitUuids.isEmpty()) {
            return resolved;
        }
        Set<String> seen = new HashSet<>();
        for (String uuid : traitUuids) {
            if (uuid == null || uuid.isBlank()) {
                continue;
            }
            String key = uuid.trim();
            if (!seen.add(key)) {
                throw new TraitSelectionException(Violation.TRAIT_DUPLICATED,
                        "Trait selected more than once: " + key);
            }
            TraitEntity trait = storyReadPort.findTraitByStoryIdAndUuid(storyId, key)
                    .orElseThrow(() -> new TraitSelectionException(Violation.TRAIT_NOT_FOUND,
                            "Trait not found: " + key));
            if (trait.isHiddenOnStartMatch()) {
                throw new TraitSelectionException(Violation.TRAIT_NOT_SELECTABLE,
                        "Trait " + key + " cannot be chosen at character creation");
            }
            validateClassCompatibility(trait, clazz, key);
            resolved.add(trait);
        }
        validateCostBudget(resolved, difficulty);
        return resolved;
    }

    private static void validateClassCompatibility(TraitEntity trait, ClassEntity clazz, String uuid) {
        Long classId = clazz != null ? clazz.getId() : null;
        Integer permitted = trait.getIdClassPermitted();
        Integer prohibited = trait.getIdClassProhibited();
        if (permitted != null && (classId == null || permitted.longValue() != classId)) {
            throw new TraitSelectionException(Violation.TRAIT_NOT_COMPATIBLE,
                    "Trait " + uuid + " is permitted only for another class");
        }
        if (prohibited != null && classId != null && prohibited.longValue() == classId) {
            throw new TraitSelectionException(Violation.TRAIT_NOT_COMPATIBLE,
                    "Trait " + uuid + " is prohibited for the selected class");
        }
    }

    private static void validateCostBudget(List<TraitEntity> traits, StoryDifficultyEntity difficulty) {
        if (difficulty == null || traits.isEmpty()) {
            return;
        }
        int totalPositive = 0;
        int totalNegative = 0;
        for (TraitEntity t : traits) {
            totalPositive += nz(t.getCostPositive());
            totalNegative += nz(t.getCostNegative());
        }
        Integer positiveBudget = difficulty.getTraitCostPositiveBudget();
        Integer negativeBudget = difficulty.getTraitCostNegativeBudget();
        if (positiveBudget != null && totalPositive > positiveBudget) {
            throw new TraitSelectionException(Violation.TRAIT_COST_EXCEEDED,
                    "Total positive trait cost " + totalPositive
                            + " exceeds the difficulty budget " + positiveBudget);
        }
        if (negativeBudget != null && totalNegative > negativeBudget) {
            throw new TraitSelectionException(Violation.TRAIT_COST_EXCEEDED,
                    "Total negative trait cost " + totalNegative
                            + " exceeds the difficulty budget " + negativeBudget);
        }
    }

    private static int nz(Integer v) { return v != null ? v : 0; }
}
