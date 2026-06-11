<?php

namespace Games\Paths\Core\Service\Matches;

use Games\Paths\Core\Port\Matches\StoryMatchReadPort;

/**
 * TraitSelectionValidator — Step 23 domain rules for the traits selected at
 * character creation (match create loadout and match join):
 * - every trait uuid must exist in the story (TRAIT_NOT_FOUND);
 * - no duplicate selections (TRAIT_DUPLICATED);
 * - id_class_permitted/id_class_prohibited must match the selected class
 *   (TRAIT_NOT_COMPATIBLE); a permitted-restricted trait is rejected when no
 *   class is selected;
 * - the sum of cost_positive and the sum of cost_negative must each stay
 *   within the difficulty budgets (TRAIT_COST_EXCEEDED); a NULL budget means
 *   "no limit".
 *
 * Violations are raised as {@see TraitSelectionException}; callers translate
 * the code into their own exception type.
 */
class TraitSelectionValidator
{
    public const TRAIT_NOT_FOUND = 'TRAIT_NOT_FOUND';
    public const TRAIT_DUPLICATED = 'TRAIT_DUPLICATED';
    public const TRAIT_NOT_COMPATIBLE = 'TRAIT_NOT_COMPATIBLE';
    public const TRAIT_COST_EXCEEDED = 'TRAIT_COST_EXCEEDED';

    /**
     * Resolves and validates the selected traits. Blank uuids are ignored.
     *
     * @param string[] $traitUuids
     * @return array[] the resolved trait rows
     */
    public static function resolveAndValidate(
        StoryMatchReadPort $storyReadPort,
        int $storyId,
        ?array $class,
        ?array $difficulty,
        array $traitUuids
    ): array {
        $resolved = [];
        $seen = [];
        foreach ($traitUuids as $uuid) {
            if ($uuid === null || trim((string)$uuid) === '') {
                continue;
            }
            $key = trim((string)$uuid);
            if (isset($seen[$key])) {
                throw new TraitSelectionException(
                    self::TRAIT_DUPLICATED,
                    'Trait selected more than once: ' . $key
                );
            }
            $seen[$key] = true;
            $trait = $storyReadPort->findTraitByUuid($storyId, $key);
            if ($trait === null) {
                throw new TraitSelectionException(self::TRAIT_NOT_FOUND, 'Trait not found: ' . $key);
            }
            self::validateClassCompatibility($trait, $class, $key);
            $resolved[] = $trait;
        }
        self::validateCostBudget($resolved, $difficulty);
        return $resolved;
    }

    private static function validateClassCompatibility(array $trait, ?array $class, string $uuid): void
    {
        $classId = $class !== null ? (int)$class['id'] : null;
        $permitted = $trait['id_class_permitted'] ?? null;
        $prohibited = $trait['id_class_prohibited'] ?? null;
        if ($permitted !== null && ($classId === null || (int)$permitted !== $classId)) {
            throw new TraitSelectionException(
                self::TRAIT_NOT_COMPATIBLE,
                'Trait ' . $uuid . ' is permitted only for another class'
            );
        }
        if ($prohibited !== null && $classId !== null && (int)$prohibited === $classId) {
            throw new TraitSelectionException(
                self::TRAIT_NOT_COMPATIBLE,
                'Trait ' . $uuid . ' is prohibited for the selected class'
            );
        }
    }

    private static function validateCostBudget(array $traits, ?array $difficulty): void
    {
        if ($difficulty === null || $traits === []) {
            return;
        }
        $totalPositive = 0;
        $totalNegative = 0;
        foreach ($traits as $t) {
            $totalPositive += (int)($t['cost_positive'] ?? 0);
            $totalNegative += (int)($t['cost_negative'] ?? 0);
        }
        $positiveBudget = $difficulty['trait_cost_positive_budget'] ?? null;
        $negativeBudget = $difficulty['trait_cost_negative_budget'] ?? null;
        if ($positiveBudget !== null && $totalPositive > (int)$positiveBudget) {
            throw new TraitSelectionException(
                self::TRAIT_COST_EXCEEDED,
                "Total positive trait cost {$totalPositive} exceeds the difficulty budget {$positiveBudget}"
            );
        }
        if ($negativeBudget !== null && $totalNegative > (int)$negativeBudget) {
            throw new TraitSelectionException(
                self::TRAIT_COST_EXCEEDED,
                "Total negative trait cost {$totalNegative} exceeds the difficulty budget {$negativeBudget}"
            );
        }
    }
}
